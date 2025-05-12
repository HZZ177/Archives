from typing import Annotated, List

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_current_admin_user, get_db, success_response, error_response
from backend.app.models.user import User
from backend.app.schemas.permission import PermissionCreate, PermissionResponse, PermissionUpdate, PermissionTree
from backend.app.schemas.response import APIResponse
from backend.app.core.logger import logger
from backend.app.services.permission_service import permission_service

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
        permissions = await permission_service.get_permissions_list(db, skip, limit)
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
        permissions = await permission_service.get_permissions_tree(db)
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
        permission = await permission_service.create_permission(db, permission_in)
        return success_response(data=permission, message="权限创建成功")
    except Exception as e:
        logger.error(f"创建权限失败: {str(e)}")
        return error_response(message=str(e))


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
        permission = await permission_service.get_permission(db, permission_id)
        return success_response(data=permission)
    except Exception as e:
        logger.error(f"获取权限详情失败: {str(e)}")
        return error_response(message=str(e))


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
        permission = await permission_service.update_permission(db, permission_id, permission_in)
        return success_response(data=permission, message="权限更新成功")
    except Exception as e:
        logger.error(f"更新权限失败: {str(e)}")
        return error_response(message=str(e))


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
        success, message = await permission_service.delete_permission(db, permission_id)
        return success_response(message=message)
    except Exception as e:
        logger.error(f"删除权限失败: {str(e)}")
        return error_response(message=str(e))


@router.get("/user/pages", response_model=APIResponse[List[str]])
async def read_current_user_pages(
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取当前用户可访问的页面路径列表
    """
    try:
        pages = await permission_service.get_user_pages(db, current_user)
        return success_response(data=pages)
    except Exception as e:
        logger.error(f"获取用户页面列表失败: {str(e)}")
        return error_response(message=str(e))


@router.get("/user/current", response_model=APIResponse[List[str]])
async def read_current_user_permissions(
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取当前用户的权限代码列表
    """
    try:
        permissions = await permission_service.get_user_permissions(db, current_user)
        return success_response(data=permissions)
    except Exception as e:
        logger.error(f"获取用户权限列表失败: {str(e)}")
        return error_response(message=str(e)) 