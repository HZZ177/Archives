from typing import List
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.logger import logger
from backend.app.models.module_section_config import ModuleSectionConfig
from backend.app.repositories.module_section_config_repository import module_section_config_repository
from backend.app.schemas.module_section_config import ModuleSectionConfigUpdate

class ModuleSectionConfigService:
    """模块配置服务"""
    
    async def get_all_configs(self, db: AsyncSession) -> List[ModuleSectionConfig]:
        """获取所有模块配置"""
        try:
            return await module_section_config_repository.get_all_configs(db)
        except Exception as e:
            logger.error(f"获取模块配置列表失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取模块配置列表失败: {str(e)}"
            )

    async def update_configs(
        self,
        db: AsyncSession,
        configs_to_update: List[ModuleSectionConfigUpdate]
    ) -> List[ModuleSectionConfig]:
        """更新模块配置"""
        try:
            config_ids = [c.id for c in configs_to_update]
            
            # 1. 从数据库中获取现有的对象
            existing_configs_list = await module_section_config_repository.get_by_ids(db, config_ids)
            existing_configs_map = {c.id: c for c in existing_configs_list}

            if len(existing_configs_list) != len(configs_to_update):
                raise HTTPException(status_code=404, detail="一个或多个配置项未找到")
            
            # 2. 更新对象属性
            for i, config_update in enumerate(configs_to_update):
                db_config = existing_configs_map.get(config_update.id)
                if db_config:
                    db_config.section_key = config_update.section_key
                    db_config.section_name = config_update.section_name
                    db_config.section_icon = config_update.section_icon
                    db_config.is_enabled = config_update.is_enabled
                    db_config.display_order = i + 1
            
            # 3. 提交事务
            await db.commit()
            
            # 4. 按请求的顺序返回更新后的对象
            final_ordered_list = [existing_configs_map[c.id] for c in configs_to_update]
            return final_ordered_list

        except Exception as e:
            await db.rollback()
            logger.error(f"更新模块配置失败: {str(e)}")
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新模块配置失败: {str(e)}"
            )

# 创建服务实例
module_section_config_service = ModuleSectionConfigService() 