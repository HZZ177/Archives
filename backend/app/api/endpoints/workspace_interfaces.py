from typing import Annotated, List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Query
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
from backend.app.repositories.workspace_interface_repository import workspace_interface_repository

router = APIRouter()


@router.get("/workspace/{workspace_id}/check-exists", response_model=APIResponse[bool])
async def check_interface_exists(
    workspace_id: int,
    path: str,
    method: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    exclude_id: Optional[int] = None
):
    """
    检查工作区中是否已存在相同路径和方法的接口
    """
    try:
        # 验证工作区访问权限
        await workspace_interface_service.validate_workspace_access(db, workspace_id, current_user)
        
        # 检查接口是否存在
        exists = await workspace_interface_service.check_interface_exists(
            db, workspace_id, path, method, exclude_id
        )
        
        return success_response(data=exists)
    except HTTPException as e:
        return error_response(message=e.detail, status_code=e.status_code)
    except Exception as e:
        logger.error(f"检查接口是否存在失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"检查接口是否存在失败: {str(e)}", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/workspace/{workspace_id}", response_model=APIResponse[Dict[str, Any]])
async def get_workspace_interfaces(
    workspace_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    page: int = Query(1, description="页码，从1开始", ge=1),
    page_size: int = Query(10, description="每页数量", ge=1, le=100),
    search: str = Query('', description="搜索关键词，可搜索路径和描述")
):
    """
    获取工作区下的接口，带分页和搜索
    """
    try:
        result = await workspace_interface_service.get_interfaces(
            db, workspace_id, current_user, page=page, page_size=page_size, search=search
        )
        return success_response(data=result)
    except HTTPException as e:
        return error_response(message=e.detail, status_code=e.status_code)
    except Exception as e:
        logger.error(f"获取工作区接口失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"获取工作区接口失败: {str(e)}", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        return error_response(message=str(e) if hasattr(e, "detail") else f"获取接口详情失败: {str(e)}", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        return error_response(message=str(e) if hasattr(e, "detail") else f"创建接口失败: {str(e)}", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        return error_response(message=str(e) if hasattr(e, "detail") else f"更新接口失败: {str(e)}", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        return error_response(message=str(e) if hasattr(e, "detail") else f"删除接口失败: {str(e)}", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR) 