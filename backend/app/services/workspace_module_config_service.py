from typing import List
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from backend.app.core.logger import logger
from backend.app.models.module_section_config import ModuleSectionConfig, WorkspaceModuleConfig
from backend.app.schemas.module_section_config import (
    ModuleConfigForWorkspaceResponse,
    WorkspaceModuleConfigUpdate
)

class WorkspaceModuleConfigService:
    """工作区模块配置服务"""
    
    async def get_workspace_module_configs(self, db: AsyncSession, workspace_id: int) -> List[ModuleConfigForWorkspaceResponse]:
        """获取指定工作区的模块配置"""
        try:
            # 查询工作区的模块配置，联接全局模块配置获取完整信息
            result = await db.execute(
                select(WorkspaceModuleConfig, ModuleSectionConfig)
                .join(ModuleSectionConfig, WorkspaceModuleConfig.section_key == ModuleSectionConfig.section_key)
                .where(WorkspaceModuleConfig.workspace_id == workspace_id)
                .order_by(WorkspaceModuleConfig.display_order)
            )
            
            configs = []
            for workspace_config, module_config in result.all():
                config_response = ModuleConfigForWorkspaceResponse(
                    id=workspace_config.id,
                    section_key=workspace_config.section_key,
                    section_name=module_config.section_name,
                    section_icon=module_config.section_icon,
                    section_type=module_config.section_type,
                    is_enabled=workspace_config.is_enabled,
                    display_order=workspace_config.display_order,
                    created_at=workspace_config.created_at,
                    updated_at=workspace_config.updated_at
                )
                configs.append(config_response)
            
            return configs
        except Exception as e:
            logger.error(f"获取工作区模块配置列表失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取工作区模块配置列表失败: {str(e)}"
            )
    
    async def update_workspace_module_configs(
        self,
        db: AsyncSession,
        workspace_id: int,
        configs_to_update: List[WorkspaceModuleConfigUpdate]
    ) -> List[ModuleConfigForWorkspaceResponse]:
        """更新指定工作区的模块配置"""
        try:
            config_ids = [c.id for c in configs_to_update]
            
            # 1. 从数据库中获取现有的对象，并验证它们属于指定工作区
            result = await db.execute(
                select(WorkspaceModuleConfig)
                .where(WorkspaceModuleConfig.id.in_(config_ids))
                .where(WorkspaceModuleConfig.workspace_id == workspace_id)
            )
            existing_configs_list = result.scalars().all()
            existing_configs_map = {c.id: c for c in existing_configs_list}

            if len(existing_configs_list) != len(configs_to_update):
                raise HTTPException(status_code=404, detail="一个或多个配置项未找到或不属于指定工作区")
            
            # 2. 更新对象属性
            for i, config_update in enumerate(configs_to_update):
                db_config = existing_configs_map.get(config_update.id)
                if db_config:
                    if config_update.is_enabled is not None:
                        db_config.is_enabled = config_update.is_enabled
                    if config_update.display_order is not None:
                        db_config.display_order = config_update.display_order
                    else:
                        # 如果没有指定display_order，使用在列表中的位置
                        db_config.display_order = i + 1
            
            # 3. 提交事务
            await db.commit()
            
            # 4. 返回更新后的配置列表
            return await self.get_workspace_module_configs(db, workspace_id)

        except Exception as e:
            await db.rollback()
            logger.error(f"更新工作区模块配置失败: {str(e)}")
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新工作区模块配置失败: {str(e)}"
            )
    
    async def init_workspace_module_configs(self, db: AsyncSession, workspace_id: int) -> None:
        """为新工作区初始化模块配置"""
        try:
            # 获取所有全局模块配置
            result = await db.execute(select(ModuleSectionConfig).order_by(ModuleSectionConfig.display_order))
            global_configs = result.scalars().all()
            
            # 检查该工作区是否已有配置
            existing_result = await db.execute(
                select(WorkspaceModuleConfig)
                .where(WorkspaceModuleConfig.workspace_id == workspace_id)
            )
            existing_configs = existing_result.scalars().all()
            existing_keys = {config.section_key for config in existing_configs}
            
            # 为缺少的模块创建工作区配置
            added_count = 0
            for global_config in global_configs:
                if global_config.section_key not in existing_keys:
                    workspace_config = WorkspaceModuleConfig(
                        workspace_id=workspace_id,
                        section_key=global_config.section_key,
                        is_enabled=True,  # 默认启用
                        display_order=global_config.display_order
                    )
                    db.add(workspace_config)
                    added_count += 1
            
            if added_count > 0:
                await db.commit()
                logger.info(f"为工作区 {workspace_id} 初始化了 {added_count} 个模块配置")
            
        except Exception as e:
            await db.rollback()
            logger.error(f"初始化工作区模块配置失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"初始化工作区模块配置失败: {str(e)}"
            )

# 创建服务实例
workspace_module_config_service = WorkspaceModuleConfigService()
