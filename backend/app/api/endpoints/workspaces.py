from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_db, success_response, error_response
from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceResponse,
    WorkspaceUpdate,
    WorkspaceAddUser,
    WorkspaceUserResponse,
    UserDefaultWorkspace
)
from backend.app.schemas.response import APIResponse
from backend.app.services.workspace_service import workspace_service

router = APIRouter()


@router.get("/", response_model=APIResponse[List[WorkspaceResponse]])
async def get_workspaces(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取用户可访问的工作区列表
    """
    try:
        workspaces = await workspace_service.get_workspaces(db, current_user)
        return success_response(data=workspaces)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取工作区列表失败: {str(e)}")
        return error_response(message=f"获取工作区列表失败: {str(e)}")


@router.get("/default", response_model=APIResponse[WorkspaceResponse])
async def get_default_workspace(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取用户的默认工作区
    """
    try:
        workspace = await workspace_service.get_default_workspace(db, current_user)
        return success_response(data=workspace)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取默认工作区失败: {str(e)}")
        return error_response(message=f"获取默认工作区失败: {str(e)}")


@router.post("/", response_model=APIResponse[WorkspaceResponse], status_code=status.HTTP_201_CREATED)
async def create_workspace(
    workspace_in: WorkspaceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    创建新工作区（仅管理员）
    """
    try:
        if not current_user.is_superuser:
            return error_response(
                status_code=status.HTTP_403_FORBIDDEN,
                message="只有超级管理员可以创建工作区"
            )
        workspace = await workspace_service.create_workspace(db, workspace_in, current_user)
        return success_response(data=workspace, message="工作区创建成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"创建工作区失败: {str(e)}")
        return error_response(message=f"创建工作区失败: {str(e)}")


@router.get("/{workspace_id}", response_model=APIResponse[WorkspaceResponse])
async def read_workspace(
    workspace_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取工作区详情
    """
    try:
        workspace = await workspace_service.get_workspace(db, workspace_id)
        return success_response(data=workspace)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取工作区详情失败: {str(e)}")
        return error_response(message=f"获取工作区详情失败: {str(e)}")


@router.post("/update/{workspace_id}", response_model=APIResponse[WorkspaceResponse])
async def update_workspace(
    workspace_id: int,
    workspace_in: WorkspaceUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新工作区信息
    """
    try:
        workspace = await workspace_service.update_workspace(db, workspace_id, workspace_in, current_user)
        return success_response(data=workspace, message="工作区更新成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"更新工作区失败: {str(e)}")
        return error_response(message=f"更新工作区失败: {str(e)}")


@router.post("/delete/{workspace_id}", response_model=APIResponse)
async def delete_workspace(
    workspace_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    删除工作区（仅超级管理员）
    """
    try:
        result = await workspace_service.delete_workspace(db, workspace_id, current_user)
        return success_response(message="工作区删除成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"删除工作区失败: {str(e)}")
        return error_response(message=f"删除工作区失败: {str(e)}")


@router.get("/{workspace_id}/users", response_model=APIResponse[List[WorkspaceUserResponse]])
async def get_workspace_users(
    workspace_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取工作区用户列表
    """
    try:
        users = await workspace_service.get_workspace_users(db, workspace_id, current_user)
        return success_response(data=users)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取工作区用户列表失败: {str(e)}")
        return error_response(message=f"获取工作区用户列表失败: {str(e)}")


@router.post("/{workspace_id}/users", response_model=APIResponse)
async def add_user_to_workspace(
    workspace_id: int,
    user_data: WorkspaceAddUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    添加用户到工作区
    """
    try:
        result = await workspace_service.add_user_to_workspace(db, workspace_id, user_data, current_user)
        return success_response(message="用户已添加到工作区")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"添加用户到工作区失败: {str(e)}")
        return error_response(message=f"添加用户到工作区失败: {str(e)}")


@router.post("/{workspace_id}/users/{user_id}/remove", response_model=APIResponse)
async def remove_user_from_workspace(
    workspace_id: int,
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    从工作区移除用户
    """
    try:
        result = await workspace_service.remove_user_from_workspace(db, workspace_id, user_id, current_user)
        return success_response(message="用户已从工作区移除")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"从工作区移除用户失败: {str(e)}")
        return error_response(message=f"从工作区移除用户失败: {str(e)}")


@router.post("/users/{user_id}/default", response_model=APIResponse)
async def set_user_default_workspace(
    user_id: int,
    workspace_data: UserDefaultWorkspace,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    设置用户的默认工作区
    """
    try:
        user = await workspace_service.set_user_default_workspace(
            db, user_id, workspace_data.workspace_id, current_user
        )
        return success_response(message="默认工作区设置成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"设置默认工作区失败: {str(e)}")
        return error_response(message=f"设置默认工作区失败: {str(e)}")


@router.post("/add_to_default/{user_id}", response_model=APIResponse)
async def add_user_to_default_workspace(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    将用户添加到系统默认工作区
    
    当用户首次登录发现没有任何工作区访问权限时，可以使用此API自动分配默认工作区
    - 如果用户已有工作区访问权限，则不执行任何操作
    - 如果没有默认工作区，则分配第一个可用工作区
    """
    try:
        # 检查权限：只有超级管理员或自己才能执行此操作
        if not current_user.is_superuser and current_user.id != user_id:
            return error_response(
                status_code=status.HTTP_403_FORBIDDEN,
                message="您没有权限执行此操作"
            )
            
        result = await workspace_service.add_user_to_default_workspace(db, user_id)
        return success_response(
            data={"workspace_id": result.get("workspace_id")},
            message=result.get("message", "用户已添加到默认工作区")
        )
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"添加用户到默认工作区失败: {str(e)}")
        return error_response(message=f"添加用户到默认工作区失败: {str(e)}") 