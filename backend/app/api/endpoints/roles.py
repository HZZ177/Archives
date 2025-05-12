from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_current_admin_user, get_db, require_permissions, check_permissions, success_response, error_response
from backend.app.core.logger import logger
from backend.app.models.user import User, Role
from backend.app.schemas.role import RoleCreate, RoleResponse, RoleUpdate, RoleWithPermissions
from backend.app.schemas.permission import RolePermissionUpdate
from backend.app.schemas.response import APIResponse
from backend.app.services.role_service import role_service

router = APIRouter()


@router.get("/", response_model=APIResponse[List[RoleResponse]])
async def read_roles(
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)],
        skip: int = 0,
        limit: int = 100
):
    """
    获取所有角色列表
    """
    try:
        # 权限检查
        if not current_user.is_superuser:
            await check_permissions(db, current_user, ["system:role:list"])
        
        roles = await role_service.get_roles_list(db, skip, limit)
        return success_response(data=roles)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取角色列表失败: {str(e)}")
        return error_response(message=f"获取角色列表失败: {str(e)}")


@router.post("/", response_model=APIResponse[RoleResponse], status_code=status.HTTP_201_CREATED)
async def create_role(
        role_in: RoleCreate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    创建新角色，同时支持权限分配
    """
    try:
        # 权限检查
        if not current_user.is_superuser:
            await check_permissions(db, current_user, ["system:role:create"])
        
        role = await role_service.create_role(db, role_in)
        return success_response(data=role, message="角色创建成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"创建角色失败: {str(e)}")
        return error_response(message=f"创建角色失败: {str(e)}")


@router.get("/{role_id}", response_model=APIResponse[RoleWithPermissions])
async def read_role(
        role_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取特定角色详情
    """
    try:
        # 权限检查
        if not current_user.is_superuser:
            # 使用装饰器进行权限检查
            await check_permissions(db, current_user, ["system:role:query"])
        
        role_with_permissions = await role_service.get_role_with_permissions(db, role_id)
        return success_response(data=role_with_permissions)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取角色详情失败: {str(e)}")
        return error_response(message=f"获取角色详情失败: {str(e)}")


@router.post("/update/{role_id}", response_model=APIResponse[RoleResponse])
async def update_role(
        role_id: int,
        role_in: RoleUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新角色信息，同时支持权限更新
    """
    try:
        # 权限检查
        if not current_user.is_superuser:
            await check_permissions(db, current_user, ["system:role:update"])
        
        role = await role_service.update_role(db, role_id, role_in)
        return success_response(data=role, message="角色更新成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"更新角色失败: {str(e)}")
        return error_response(message=f"更新角色失败: {str(e)}")


@router.post("/delete/{role_id}", response_model=APIResponse)
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
        
        message = await role_service.delete_role(db, role_id)
        return success_response(message=message)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"删除角色失败: {str(e)}")
        return error_response(message=f"删除角色失败: {str(e)}")


@router.get("/{role_id}/permissions", response_model=APIResponse[List[int]])
async def read_role_permissions(
        role_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取角色的权限ID列表
    """
    try:
        # 权限检查
        if not current_user.is_superuser:
            await check_permissions(db, current_user, ["system:role:query"])
        
        permission_ids = await role_service.get_role_permissions(db, role_id)
        return success_response(data=permission_ids)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取角色权限失败: {str(e)}")
        return error_response(message=f"获取角色权限失败: {str(e)}")


@router.post("/{role_id}/update_permissions", response_model=APIResponse)
async def update_role_permissions(
        role_id: int,
        permissions_in: RolePermissionUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新角色的权限
    """
    try:
        # 权限检查
        if not current_user.is_superuser:
            await check_permissions(db, current_user, ["system:role:update"])
        
        message = await role_service.update_role_permissions(db, role_id, permissions_in.permission_ids)
        return success_response(message=message)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"更新角色权限失败: {str(e)}")
        return error_response(message=f"更新角色权限失败: {str(e)}") 