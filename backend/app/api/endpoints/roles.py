from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload
from backend.app.api.deps import get_current_active_user, get_current_admin_user, get_db, require_permissions, check_permissions
from backend.app.core.logger import logger
from backend.app.models.user import User, Role
from backend.app.models.permission import Permission, role_permission
from backend.app.schemas.role import RoleCreate, RoleResponse, RoleUpdate, RoleWithPermissions
from backend.app.schemas.permission import RolePermissionUpdate

router = APIRouter()


@router.get("/", response_model=List[RoleResponse])
async def read_roles(
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)],
        skip: int = 0,
        limit: int = 100
):
    """
    获取所有角色列表
    """
    # 权限检查
    if not current_user.is_superuser:
        await check_permissions(db, current_user, ["system:role:list"])
    
    result = await db.execute(select(Role).offset(skip).limit(limit))
    roles = result.scalars().all()
    return roles


@router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
        role_in: RoleCreate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    创建新角色，同时支持权限分配
    """
    # 权限检查
    if not current_user.is_superuser:
        await check_permissions(db, current_user, ["system:role:create"])
    
    # 检查角色名是否已存在
    result = await db.execute(select(Role).where(Role.name == role_in.name))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="角色名已存在"
        )

    # 创建新角色
    db_role = Role(**role_in.model_dump(exclude={'permission_ids'}))
    db.add(db_role)
    await db.flush()  # 获取角色ID

    # 如果有权限ID，则分配权限
    if role_in.permission_ids:
        # 查询所有需要的权限
        stmt = select(Permission).where(Permission.id.in_(role_in.permission_ids))
        result = await db.execute(stmt)
        permissions = result.scalars().all()
        
        # 验证所有权限是否存在
        found_ids = {perm.id for perm in permissions}
        missing_ids = set(role_in.permission_ids) - found_ids
        if missing_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"权限ID {missing_ids} 不存在"
            )
        
        # 使用relationship管理器的set方法设置权限
        await db.run_sync(lambda session: setattr(db_role, 'permissions', permissions))

    await db.commit()
    await db.refresh(db_role)

    return db_role


@router.get("/{role_id}", response_model=RoleWithPermissions)
async def read_role(
        role_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取特定角色详情
    """
    # 权限检查
    if not current_user.is_superuser:
        # 使用装饰器进行权限检查
        await check_permissions(db, current_user, ["system:role:query"])
    
    try:
        # 查询角色
        role = await db.get(Role, role_id)
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="角色不存在"
            )
        
        # 手动加载角色的权限
        stmt = select(Role).options(
            joinedload(Role.permissions)
        ).where(Role.id == role_id)
        
        result = await db.execute(stmt)
        role_with_permissions = result.unique().scalar_one()
        
        # 在角色对象上设置权限列表的浅拷贝，避免延迟加载问题
        permissions_list = []
        for perm in role_with_permissions.permissions:
            # 创建权限对象的浅拷贝，避免延迟加载children
            perm_dict = {
                "id": perm.id,
                "code": perm.code,
                "name": perm.name,
                "page_path": perm.page_path,
                "icon": perm.icon,
                "sort": perm.sort,
                "is_visible": perm.is_visible,
                "parent_id": perm.parent_id,
                "description": perm.description,
                "created_at": perm.created_at,
                "updated_at": perm.updated_at,
                "children": []  # 不包含children，避免递归问题
            }
            permissions_list.append(perm_dict)
        
        # 设置结果
        result = {
            "id": role.id,
            "name": role.name,
            "description": role.description,
            "is_default": role.is_default,
            "status": role.status,
            "created_at": role.created_at,
            "updated_at": role.updated_at,
            "permissions": permissions_list
        }
        
        return result
        
    except Exception as e:
        logger.error(f"获取角色详情失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取角色详情失败: {str(e)}"
        )


@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
        role_id: int,
        role_in: RoleUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新角色信息，同时支持权限更新
    """
    # 权限检查
    if not current_user.is_superuser:
        await check_permissions(db, current_user, ["system:role:update"])
    
    # 获取角色
    role = await db.get(Role, role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="角色不存在"
        )

    # 检查角色名是否已存在
    if role_in.name and role_in.name != role.name:
        result = await db.execute(select(Role).where(Role.name == role_in.name))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="角色名已存在"
            )

    # 更新角色数据
    update_data = role_in.model_dump(exclude={'permission_ids'}, exclude_unset=True)
    for key, value in update_data.items():
        setattr(role, key, value)

    # 如果提供了权限ID，则更新权限
    if role_in.permission_ids is not None:
        # 查询所有需要的权限
        stmt = select(Permission).where(Permission.id.in_(role_in.permission_ids))
        result = await db.execute(stmt)
        permissions = result.scalars().all()
        
        # 验证所有权限是否存在
        found_ids = {perm.id for perm in permissions}
        missing_ids = set(role_in.permission_ids) - found_ids
        if missing_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"权限ID {missing_ids} 不存在"
            )
        
        # 使用relationship管理器的set方法设置权限
        await db.run_sync(lambda session: setattr(role, 'permissions', permissions))

    await db.commit()
    await db.refresh(role)

    return role


@router.delete("/{role_id}", status_code=status.HTTP_200_OK)
async def delete_role(
        role_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    删除角色
    """
    try:
        # 权限检查
        if not current_user.is_superuser:
            await check_permissions(db, current_user, ["system:role:delete"])
        
        # 获取角色
        role = await db.get(Role, role_id)
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="角色不存在"
            )

        # 检查是否为默认角色
        if role.is_default:
            return {
                "success": False,
                "message": "不能删除默认角色"
            }

        # 检查是否有用户使用该角色 - 使用count查询而非关系导航
        query = "SELECT COUNT(*) FROM user_role WHERE role_id = :role_id"
        result = await db.execute(text(query), {"role_id": role_id})
        user_count = result.scalar_one()
        
        if user_count > 0:
            return {
                "success": False,
                "message": "该角色正在被用户使用，无法删除"
            }

        await db.delete(role)
        await db.commit()
        
        return {
            "success": True,
            "message": "角色删除成功"
        }
    except Exception as e:
        logger.error(f"删除角色失败: {str(e)}")
        # 确保任何数据库操作异常都会回滚
        try:
            await db.rollback()
        except:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除角色失败: {str(e)}"
        )


@router.get("/{role_id}/permissions", response_model=List[int])
async def read_role_permissions(
        role_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取角色的权限ID列表
    """
    # 权限检查
    if not current_user.is_superuser:
        await check_permissions(db, current_user, ["system:role:list"])
    
    # 获取角色
    role = await db.get(Role, role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="角色不存在"
        )

    # 返回权限ID列表
    return [perm.id for perm in role.permissions]


@router.put("/{role_id}/permissions", status_code=status.HTTP_200_OK)
async def update_role_permissions(
        role_id: int,
        permissions_in: RolePermissionUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新角色的权限
    """
    # 权限检查
    if not current_user.is_superuser:
        await check_permissions(db, current_user, ["system:role:update"])
    
    # 获取角色
    role = await db.get(Role, role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="角色不存在"
        )
    
    # 查询权限是否存在
    for perm_id in permissions_in.permission_ids:
        perm = await db.get(Permission, perm_id)
        if not perm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"权限ID {perm_id} 不存在"
            )
    
    # 清除现有权限
    role.permissions = []
    
    # 添加新权限
    for perm_id in permissions_in.permission_ids:
        perm = await db.get(Permission, perm_id)
        role.permissions.append(perm)
    
    await db.commit()
    
    return {"status": "success", "message": "权限更新成功"} 