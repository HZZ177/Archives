from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_db, success_response, error_response
from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.schemas.module_section_config import (
    ModuleConfigForWorkspaceResponse,
    WorkspaceModuleConfigUpdate
)
from backend.app.schemas.response import APIResponse
from backend.app.services.module_section_config_service import module_section_config_service
from backend.app.services.workspace_service import workspace_service

router = APIRouter()

@router.get("/config", response_model=APIResponse[List[ModuleConfigForWorkspaceResponse]])
async def get_module_section_configs(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    workspace_id: Optional[int] = Query(None, description="工作区ID，不指定则使用用户默认工作区")
):
    """获取工作区的模块配置列表"""
    try:
        # 如果未指定工作区，使用用户的默认工作区
        if workspace_id is None and current_user.default_workspace_id:
            workspace_id = current_user.default_workspace_id
        # 如果用户没有默认工作区，尝试获取
        elif workspace_id is None:
            default_workspace = await workspace_service.get_default_workspace(db, current_user)
            workspace_id = default_workspace.id

        configs = await module_section_config_service.get_workspace_module_configs(db, workspace_id)
        return success_response(data=configs)
    except Exception as e:
        logger.error(f"获取工作区模块配置列表失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"获取工作区模块配置列表失败: {str(e)}")

@router.put("/config", response_model=APIResponse[List[ModuleConfigForWorkspaceResponse]])
async def update_module_section_configs(
    configs: List[WorkspaceModuleConfigUpdate],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    workspace_id: Optional[int] = Query(None, description="工作区ID，不指定则使用用户默认工作区")
):
    """更新工作区模块配置"""
    try:
        # 如果未指定工作区，使用用户的默认工作区
        if workspace_id is None and current_user.default_workspace_id:
            workspace_id = current_user.default_workspace_id
        # 如果用户没有默认工作区，尝试获取
        elif workspace_id is None:
            default_workspace = await workspace_service.get_default_workspace(db, current_user)
            workspace_id = default_workspace.id

        updated_configs = await module_section_config_service.update_workspace_module_configs(db, workspace_id, configs)
        return success_response(data=updated_configs, message="工作区模块配置更新成功")
    except Exception as e:
        logger.error(f"更新工作区模块配置失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"更新工作区模块配置失败: {str(e)}")