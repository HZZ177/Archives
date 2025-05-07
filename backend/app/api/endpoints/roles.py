from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from backend.app.api.deps import get_current_active_user, get_current_admin_user, get_db, require_permissions
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
        # 使用装饰器进行权限检查
        await require_permissions(["system:role:list"])(lambda: None)(
            db=db, current_user=current_user
        )
    
    result = await db.execute(select(Role).offset(skip).limit(limit))
    roles = result.scalars().all()
    return roles


@router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
        role_in: RoleCreate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_admin_user)]
):
    """
    创建新角色
    """
    # 检查角色名是否已存在
    result = await db.execute(select(Role).where(Role.name == role_in.name))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="角色名已存在"
        )

    # 创建新角色
    db_role = Role(**role_in.model_dump())

    db.add(db_role)
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
        await require_permissions(["system:role:query"])(lambda: None)(
            db=db, current_user=current_user
        )
    
    # 查询角色及其权限
    result = await db.execute(
        select(Role)
        .options(joinedload(Role.permissions))
        .where(Role.id == role_id)
    )
    role = result.unique().scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="角色不存在"
        )

    return role


@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
        role_id: int,
        role_in: RoleUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_admin_user)]
):
    """
    更新角色信息
    """
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
    update_data = role_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(role, key, value)

    await db.commit()
    await db.refresh(role)

    return role


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
        role_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_admin_user)]
):
    """
    删除角色
    """
    # 获取角色
    role = await db.get(Role, role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="角色不存在"
        )

    # 删除角色
    await db.delete(role)
    await db.commit()

    return None


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
        # 使用装饰器进行权限检查
        await require_permissions(["system:role:query"])(lambda: None)(
            db=db, current_user=current_user
        )
    
    # 获取角色
    role = await db.get(Role, role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="角色不存在"
        )
    
    # 查询角色权限
    result = await db.execute(
        select(Permission.id)
        .join(role_permission, Permission.id == role_permission.c.permission_id)
        .where(role_permission.c.role_id == role_id)
    )
    permission_ids = [row[0] for row in result.all()]
    
    return permission_ids


@router.put("/{role_id}/permissions", status_code=status.HTTP_200_OK)
async def update_role_permissions(
        role_id: int,
        permissions_in: RolePermissionUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_admin_user)]
):
    """
    更新角色的权限
    """
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
    
    # 使用SQL方式：首先删除所有现有的角色-权限关联
    await db.execute(
        text("DELETE FROM role_permission WHERE role_id = :role_id"),
        {"role_id": role_id}
    )
    
    # 添加新的权限关联
    for perm_id in permissions_in.permission_ids:
        await db.execute(
            text("INSERT INTO role_permission (role_id, permission_id) VALUES (:role_id, :permission_id)"),
            {"role_id": role_id, "permission_id": perm_id}
        )
    
    await db.commit()
    
    return {"status": "success", "message": "权限更新成功"} 