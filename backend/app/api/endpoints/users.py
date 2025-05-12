from typing import Annotated, List, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_current_admin_user, get_db, check_permissions, success_response, error_response
from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.schemas.response import APIResponse
from backend.app.schemas.role import RoleResponse, UserRoleUpdate
from backend.app.schemas.user import UserCreate, UserResponse, UserUpdate, UserStatusUpdate, UserPage
from backend.app.services.user_service import user_service

router = APIRouter()


@router.get("/", response_model=APIResponse[UserPage])
async def read_users(
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)],
        skip: int = 0,
        limit: int = 100,
        keyword: str = None,
        page: int = 1,
        page_size: int = 10
):
    """
    获取所有用户列表，支持根据用户名、邮箱或手机号搜索
    
    参数:
    - page: 页码，默认1
    - page_size: 每页数量，默认10
    - keyword: 搜索关键词（可搜索用户名、邮箱、手机号）
    """
    try:
        # 权限检查
        if not current_user.is_superuser:
            await check_permissions(db, current_user, ["system:user:list"])
        
        # 调用服务层获取用户列表
        page_data = await user_service.get_users_page(
            db=db,
            current_user=current_user,
            skip=skip,
            limit=limit,
            keyword=keyword,
            page=page,
            page_size=page_size
        )
        
        return success_response(data=page_data)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取用户列表失败: {str(e)}")
        return error_response(message=f"获取用户列表失败: {str(e)}")


@router.post("/", response_model=APIResponse[UserResponse], status_code=status.HTTP_201_CREATED)
async def create_user(
        user_in: UserCreate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    创建新用户，同时支持角色分配
    """
    try:
        # 权限检查
        if not current_user.is_superuser:
            await check_permissions(db, current_user, ["system:user:create"])
        
        # 调用服务层创建用户
        user = await user_service.create_user(
            db=db, 
            user_data=user_in,
            current_user=current_user
        )
        
        return success_response(data=user, message="用户创建成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"创建用户失败: {str(e)}")
        return error_response(message=f"创建用户失败: {str(e)}")


@router.get("/{user_id}", response_model=APIResponse[UserResponse])
async def read_user(
        user_id: int,
        current_user: Annotated[User, Depends(get_current_active_user)],
        db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    获取特定用户
    """
    try:
        # 调用服务层获取用户
        user = await user_service.get_user(
            db=db, 
            user_id=user_id,
            current_user=current_user
        )
        
        return success_response(data=user)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取用户详情失败: {str(e)}")
        return error_response(message=f"获取用户详情失败: {str(e)}")


@router.post("/update/{user_id}", response_model=APIResponse[UserResponse])
async def update_user(
        user_id: int,
        user_in: UserUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新用户信息
    """
    try:
        # 权限检查：超级管理员、更新自己的信息，或拥有system:user:update权限的用户
        if not current_user.is_superuser and current_user.id != user_id:
            # 非超级管理员且不是更新自己的信息，检查是否有更新权限
            await check_permissions(db, current_user, ["system:user:update"])
        
        # 调用服务层更新用户
        updated_user = await user_service.update_user(
            db=db, 
            user_id=user_id,
            user_data=user_in,
            current_user=current_user
        )
        
        return success_response(data=updated_user, message="用户更新成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"更新用户失败: {str(e)}")
        return error_response(message=f"更新用户失败: {str(e)}")


@router.post("/update_status/{user_id}", response_model=APIResponse[UserResponse])
async def update_user_status(
        user_id: int,
        status_update: UserStatusUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新用户状态
    """
    try:
        # 权限检查
        if not current_user.is_superuser:
            await check_permissions(db, current_user, ["system:user:update"])
        
        # 调用服务层更新用户状态
        updated_user = await user_service.update_user_status(
            db=db, 
            user_id=user_id,
            status_data=status_update,
            current_user=current_user
        )
        
        return success_response(data=updated_user, message="用户状态更新成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"更新用户状态失败: {str(e)}")
        return error_response(message=f"更新用户状态失败: {str(e)}")


@router.post("/delete/{user_id}", response_model=APIResponse)
async def delete_user(
        user_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    删除用户
    """
    try:
        # 权限检查
        if not current_user.is_superuser:
            await check_permissions(db, current_user, ["system:user:delete"])
        
        # 调用服务层删除用户
        message = await user_service.delete_user(
            db=db, 
            user_id=user_id,
            current_user=current_user
        )
        
        return success_response(message=message)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"删除用户失败: {str(e)}")
        return error_response(message=f"删除用户失败: {str(e)}")


@router.get("/{user_id}/roles", response_model=APIResponse[List[RoleResponse]])
async def read_user_roles(
        user_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取用户的角色列表
    """
    try:
        # 权限检查
        if not current_user.is_superuser and current_user.id != user_id:
            await check_permissions(db, current_user, ["system:user:query"])
        
        # 调用服务层获取用户角色
        roles = await user_service.get_user_roles(
            db=db, 
            user_id=user_id,
            current_user=current_user
        )
        
        return success_response(data=roles)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取用户角色失败: {str(e)}")
        return error_response(message=f"获取用户角色失败: {str(e)}")


@router.post("/{user_id}/update_roles", response_model=APIResponse)
async def update_user_roles(
        user_id: int,
        roles_in: UserRoleUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新用户的角色
    """
    try:
        # 权限检查
        if not current_user.is_superuser:
            await check_permissions(db, current_user, ["system:user:update"])
        
        # 调用服务层更新用户角色
        message = await user_service.update_user_roles(
            db=db, 
            user_id=user_id,
            roles_data=roles_in,
            current_user=current_user
        )
        
        return success_response(message=message)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"更新用户角色失败: {str(e)}")
        return error_response(message=f"更新用户角色失败: {str(e)}")
