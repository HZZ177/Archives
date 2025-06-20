from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_db, success_response, error_response
from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.schemas.workspace_interface import (
    WorkspaceInterfaceCreate,
    WorkspaceInterfaceUpdate,
    WorkspaceInterfaceResponse,
    WorkspaceInterfaceDetail
)
from backend.app.schemas.response import APIResponse
from backend.app.services.workspace_interface_service import workspace_interface_service

router = APIRouter()


@router.get("/workspace/{workspace_id}", response_model=APIResponse[List[WorkspaceInterfaceResponse]])
async def get_workspace_interfaces(
    workspace_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取工作区下的所有接口
    """
    try:
        interfaces = await workspace_interface_service.get_interfaces(db, workspace_id, current_user)
        return success_response(data=interfaces)
    except HTTPException as e:
        return error_response(message=e.detail, status_code=e.status_code)
    except Exception as e:
        logger.error(f"获取工作区接口失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"获取工作区接口失败: {str(e)}")


@router.get("/{interface_id}", response_model=APIResponse[WorkspaceInterfaceDetail])
async def get_interface(
    interface_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取工作区接口详情
    """
    try:
        interface = await workspace_interface_service.get_interface(db, interface_id, current_user)
        return success_response(data=interface)
    except HTTPException as e:
        return error_response(message=e.detail, status_code=e.status_code)
    except Exception as e:
        logger.error(f"获取接口详情失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"获取接口详情失败: {str(e)}")


@router.post("/workspace/{workspace_id}", response_model=APIResponse[WorkspaceInterfaceResponse])
async def create_interface(
    workspace_id: int,
    interface_data: WorkspaceInterfaceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    创建工作区接口
    """
    try:
        interface = await workspace_interface_service.create_interface(db, workspace_id, interface_data, current_user)
        return success_response(data=interface, message="接口创建成功")
    except HTTPException as e:
        return error_response(message=e.detail, status_code=e.status_code)
    except Exception as e:
        logger.error(f"创建接口失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"创建接口失败: {str(e)}")


@router.put("/{interface_id}", response_model=APIResponse[WorkspaceInterfaceResponse])
async def update_interface(
    interface_id: int,
    interface_data: WorkspaceInterfaceUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新工作区接口
    """
    try:
        interface = await workspace_interface_service.update_interface(db, interface_id, interface_data, current_user)
        return success_response(data=interface, message="接口更新成功")
    except HTTPException as e:
        return error_response(message=e.detail, status_code=e.status_code)
    except Exception as e:
        logger.error(f"更新接口失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"更新接口失败: {str(e)}")


@router.delete("/{interface_id}", response_model=APIResponse)
async def delete_interface(
    interface_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    删除工作区接口
    """
    try:
        success = await workspace_interface_service.delete_interface(db, interface_id, current_user)
        return success_response(message="接口删除成功")
    except HTTPException as e:
        return error_response(message=e.detail, status_code=e.status_code)
    except Exception as e:
        logger.error(f"删除接口失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"删除接口失败: {str(e)}") 