from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.api.deps import get_current_active_user, get_current_admin_user, get_db, get_user_permissions, success_response, error_response
from backend.app.models.user import User
from backend.app.models.permission import Permission
from backend.app.schemas.permission import PermissionCreate, PermissionResponse, PermissionUpdate, PermissionTree
from backend.app.models.user import Role
from backend.app.schemas.response import APIResponse
from backend.app.core.logger import logger

router = APIRouter()


@router.get("/", response_model=APIResponse[List[PermissionResponse]])
async def read_permissions(
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)],
        skip: int = 0,
        limit: int = 1000
):
    """
    获取所有页面权限列表（扁平结构）
    """
    try:
        result = await db.execute(
            select(Permission)
            .options(selectinload(Permission.children))
            .offset(skip)
            .limit(limit)
        )
        permissions = result.scalars().all()
        return success_response(data=permissions)
    except Exception as e:
        logger.error(f"获取权限列表失败: {str(e)}")
        return error_response(message=f"获取权限列表失败: {str(e)}")


@router.get("/tree", response_model=APIResponse[List[PermissionTree]])
async def read_permissions_tree(
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取页面权限树（树形结构）
    """
    try:
        # 查询所有顶级权限
        result = await db.execute(
            select(Permission)
            .options(selectinload(Permission.children))
            .where(Permission.parent_id.is_(None))
            .order_by(Permission.sort)
        )
        
        permissions = result.unique().scalars().all()
        return success_response(data=permissions)
    except Exception as e:
        logger.error(f"获取权限树失败: {str(e)}")
        return error_response(message=f"获取权限树失败: {str(e)}")


@router.post("/", response_model=APIResponse[PermissionResponse], status_code=status.HTTP_201_CREATED)
async def create_permission(
        permission_in: PermissionCreate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_admin_user)]
):
    """
    创建新页面权限
    """
    try:
        # 检查权限代码是否已存在
        result = await db.execute(select(Permission).where(Permission.code == permission_in.code))
        if result.scalar_one_or_none():
            return error_response(message="权限代码已存在")

        # 检查页面路径是否已存在
        result = await db.execute(select(Permission).where(Permission.page_path == permission_in.page_path))
        if result.scalar_one_or_none():
            return error_response(message="页面路径已存在")

        # 如果有父权限，检查是否存在
        if permission_in.parent_id:
            parent = await db.get(Permission, permission_in.parent_id)
            if not parent:
                return error_response(message="父权限不存在")

        # 创建新权限
        db_permission = Permission(**permission_in.model_dump())

        db.add(db_permission)
        await db.commit()
        await db.refresh(db_permission)

        return success_response(data=db_permission, message="权限创建成功")
    except Exception as e:
        logger.error(f"创建权限失败: {str(e)}")
        return error_response(message=f"创建权限失败: {str(e)}")


@router.get("/{permission_id}", response_model=APIResponse[PermissionResponse])
async def read_permission(
        permission_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取特定页面权限详情
    """
    try:
        permission = await db.get(Permission, permission_id)
        if not permission:
            return error_response(message="权限不存在")

        return success_response(data=permission)
    except Exception as e:
        logger.error(f"获取权限详情失败: {str(e)}")
        return error_response(message=f"获取权限详情失败: {str(e)}")


@router.post("/update/{permission_id}", response_model=APIResponse[PermissionResponse])
async def update_permission(
        permission_id: int,
        permission_in: PermissionUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_admin_user)]
):
    """
    更新页面权限信息
    """
    try:
        # 获取权限
        permission = await db.get(Permission, permission_id)
        if not permission:
            return error_response(message="权限不存在")

        # 检查权限代码是否已存在
        if permission_in.code and permission_in.code != permission.code:
            result = await db.execute(select(Permission).where(Permission.code == permission_in.code))
            if result.scalar_one_or_none():
                return error_response(message="权限代码已存在")
        
        # 检查页面路径是否已存在
        if permission_in.page_path and permission_in.page_path != permission.page_path:
            result = await db.execute(select(Permission).where(Permission.page_path == permission_in.page_path))
            if result.scalar_one_or_none():
                return error_response(message="页面路径已存在")

        # 如果更新了父权限，检查是否存在
        if permission_in.parent_id and permission_in.parent_id != permission.parent_id:
            # 不能将自己设为自己的父级
            if permission_in.parent_id == permission_id:
                return error_response(message="不能将自己设为自己的父级")
            
            parent = await db.get(Permission, permission_in.parent_id)
            if not parent:
                return error_response(message="父权限不存在")

        # 更新权限数据
        update_data = permission_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(permission, key, value)

        await db.commit()
        await db.refresh(permission)

        return success_response(data=permission, message="权限更新成功")
    except Exception as e:
        logger.error(f"更新权限失败: {str(e)}")
        return error_response(message=f"更新权限失败: {str(e)}")


@router.post("/delete/{permission_id}", response_model=APIResponse)
async def delete_permission(
        permission_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_admin_user)]
):
    """
    删除页面权限
    """
    try:
        # 获取权限
        permission = await db.get(Permission, permission_id)
        if not permission:
            return error_response(message="权限不存在")

        # 检查是否有子权限
        if permission.children:
            return error_response(message="该权限下有子权限，无法删除")

        # 检查是否有角色使用该权限
        stmt = select(Role).join(Role.permissions).where(Permission.id == permission_id)
        result = await db.execute(stmt)
        if result.first():
            return error_response(message="该权限正在被角色使用，无法删除")

        # 删除权限
        await db.delete(permission)
        await db.commit()
        
        return success_response(message="权限删除成功")
    except Exception as e:
        logger.error(f"删除权限失败: {str(e)}")
        return error_response(message=f"删除权限失败: {str(e)}")


@router.get("/user/pages", response_model=APIResponse[List[str]])
async def read_current_user_pages(
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取当前用户可访问的页面路径列表
    """
    try:
        # 获取用户权限
        permissions = await get_user_permissions(db, current_user)
        
        # 查询对应的页面路径
        stmt = select(Permission.page_path).where(Permission.code.in_(permissions))
        result = await db.execute(stmt)
        pages = result.scalars().all()
    
        return success_response(data=pages)
    except Exception as e:
        logger.error(f"获取用户页面列表失败: {str(e)}")
        return error_response(message=f"获取用户页面列表失败: {str(e)}")


@router.get("/user/current", response_model=APIResponse[List[str]])
async def read_current_user_permissions(
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取当前用户的权限代码列表
    """
    try:
        # 获取用户权限
        permissions = await get_user_permissions(db, current_user)
        
        return success_response(data=permissions)
    except Exception as e:
        logger.error(f"获取用户权限列表失败: {str(e)}")
        return error_response(message=f"获取用户权限列表失败: {str(e)}") 