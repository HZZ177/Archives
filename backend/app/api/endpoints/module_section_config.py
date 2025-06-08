from typing import Annotated, List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_db, success_response, error_response
from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.schemas.module_section_config import ModuleSectionConfigResponse, ModuleSectionConfigUpdate
from backend.app.schemas.response import APIResponse
from backend.app.services.module_section_config_service import module_section_config_service

router = APIRouter()

@router.get("/config", response_model=APIResponse[List[ModuleSectionConfigResponse]])
async def get_module_section_configs(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """获取模块配置列表"""
    try:
        configs = await module_section_config_service.get_all_configs(db)
        return success_response(data=configs)
    except Exception as e:
        logger.error(f"获取模块配置列表失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"获取模块配置列表失败: {str(e)}")

@router.put("/config", response_model=APIResponse[List[ModuleSectionConfigResponse]])
async def update_module_section_configs(
    configs: List[ModuleSectionConfigUpdate],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """更新模块配置"""
    try:
        updated_configs = await module_section_config_service.update_configs(db, configs)
        return success_response(data=updated_configs, message="模块配置更新成功")
    except Exception as e:
        logger.error(f"更新模块配置失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"更新模块配置失败: {str(e)}") 