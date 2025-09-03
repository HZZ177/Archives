from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.logger import logger
from backend.app.models.module_section_config import ModuleSectionConfig
from backend.app.repositories.base_repository import BaseRepository
from backend.app.schemas.module_section_config import ModuleSectionConfigCreate, ModuleSectionConfigUpdate

class ModuleSectionConfigRepository(BaseRepository[ModuleSectionConfig, ModuleSectionConfigCreate, ModuleSectionConfigUpdate]):
    """模块配置仓库"""
    def __init__(self):
        super().__init__(ModuleSectionConfig)

    async def get_all_configs(self, db: AsyncSession) -> List[ModuleSectionConfig]:
        """获取所有模块配置（已废弃，请使用get_configs_by_workspace）"""
        try:
            result = await db.execute(
                select(ModuleSectionConfig).order_by(ModuleSectionConfig.display_order)
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"获取模块配置列表失败: {str(e)}")
            raise

    async def get_configs_by_workspace(self, db: AsyncSession, workspace_id: int) -> List[ModuleSectionConfig]:
        """获取指定工作区的模块配置"""
        try:
            result = await db.execute(
                select(ModuleSectionConfig)
                .where(ModuleSectionConfig.workspace_id == workspace_id)
                .order_by(ModuleSectionConfig.display_order)
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"获取工作区模块配置列表失败: {str(e)}")
            raise

    async def get_by_ids(self, db: AsyncSession, config_ids: List[int]) -> List[ModuleSectionConfig]:
        """通过ID列表获取配置（已废弃，请使用get_by_ids_and_workspace）"""
        try:
            result = await db.execute(
                select(ModuleSectionConfig).where(ModuleSectionConfig.id.in_(config_ids))
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"通过ID获取模块配置列表失败: {str(e)}")
            raise

    async def get_by_ids_and_workspace(self, db: AsyncSession, config_ids: List[int], workspace_id: int) -> List[ModuleSectionConfig]:
        """通过ID列表和工作区ID获取配置"""
        try:
            result = await db.execute(
                select(ModuleSectionConfig)
                .where(ModuleSectionConfig.id.in_(config_ids))
                .where(ModuleSectionConfig.workspace_id == workspace_id)
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"通过ID和工作区获取模块配置列表失败: {str(e)}")
            raise

    async def update_configs(self, db: AsyncSession, configs: List[ModuleSectionConfig]) -> List[ModuleSectionConfig]:
        """批量更新模块配置"""
        try:
            for config in configs:
                await db.merge(config)
            await db.commit()
            return configs
        except Exception as e:
            await db.rollback()
            logger.error(f"更新模块配置失败: {str(e)}")
            raise

# 创建仓库实例
module_section_config_repository = ModuleSectionConfigRepository() 