from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from backend.app.core.logger import logger
from backend.app.models.coding_bug import WorkspaceCodingConfig
from backend.app.models.user import User
from backend.app.schemas.coding_bug import (
    WorkspaceCodingConfigCreate,
    WorkspaceCodingConfigUpdate,
    WorkspaceCodingConfigResponse
)


class CodingConfigService:
    """Coding配置管理服务"""
    
    async def create_config(
        self,
        db: AsyncSession,
        config_data: WorkspaceCodingConfigCreate,
        current_user: User
    ) -> WorkspaceCodingConfig:
        """创建工作区Coding配置"""
        try:
            # 检查是否已存在配置
            existing_config = await self.get_config_by_workspace(db, config_data.workspace_id)
            if existing_config:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="该工作区已存在Coding配置"
                )
            
            # 创建新配置
            config = WorkspaceCodingConfig(
                workspace_id=config_data.workspace_id,
                api_token=config_data.api_token,
                project_name=config_data.project_name,
                is_enabled=config_data.is_enabled,
                sync_conditions=config_data.sync_conditions,
                selected_iteration=config_data.selected_iteration,
                created_by=current_user.id
            )
            
            db.add(config)
            await db.commit()
            await db.refresh(config)
            
            logger.info(f"创建Coding配置成功: workspace_id={config_data.workspace_id}")
            return config
            
        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"创建Coding配置失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建配置失败: {str(e)}"
            )
    
    async def get_config_by_workspace(
        self,
        db: AsyncSession,
        workspace_id: int
    ) -> Optional[WorkspaceCodingConfig]:
        """根据工作区ID获取Coding配置"""
        try:
            query = select(WorkspaceCodingConfig).where(
                WorkspaceCodingConfig.workspace_id == workspace_id
            )
            result = await db.execute(query)
            return result.scalar_one_or_none()
            
        except Exception as e:
            logger.error(f"获取Coding配置失败: {str(e)}")
            return None
    
    async def update_config(
        self,
        db: AsyncSession,
        workspace_id: int,
        config_data: WorkspaceCodingConfigUpdate,
        current_user: User
    ) -> WorkspaceCodingConfig:
        """更新工作区Coding配置"""
        try:
            # 获取现有配置
            config = await self.get_config_by_workspace(db, workspace_id)
            if not config:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="未找到该工作区的Coding配置"
                )
            
            # 更新字段
            update_data = config_data.dict(exclude_unset=True)
            for field, value in update_data.items():
                setattr(config, field, value)
            
            await db.commit()
            await db.refresh(config)
            
            logger.info(f"更新Coding配置成功: workspace_id={workspace_id}")
            return config
            
        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"更新Coding配置失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新配置失败: {str(e)}"
            )
    
    async def delete_config(
        self,
        db: AsyncSession,
        workspace_id: int,
        current_user: User
    ) -> str:
        """删除工作区Coding配置"""
        try:
            # 获取现有配置
            config = await self.get_config_by_workspace(db, workspace_id)
            if not config:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="未找到该工作区的Coding配置"
                )
            
            await db.delete(config)
            await db.commit()
            
            logger.info(f"删除Coding配置成功: workspace_id={workspace_id}")
            return "Coding配置删除成功"
            
        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"删除Coding配置失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除配置失败: {str(e)}"
            )
    
    async def test_config(
        self,
        db: AsyncSession,
        workspace_id: int
    ) -> Dict[str, Any]:
        """测试Coding配置连接"""
        try:
            config = await self.get_config_by_workspace(db, workspace_id)
            if not config:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="未找到该工作区的Coding配置"
                )
            
            if not config.is_enabled:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Coding配置已禁用"
                )
            
            # 导入coding_service进行测试
            from backend.app.services.coding_service import coding_service
            
            # 尝试获取少量数据进行连接测试
            response_data = await coding_service.fetch_bugs_from_coding(
                api_token=config.api_token,
                project_name=config.project_name,
                offset=0,
                limit=1
            )
            
            return {
                "success": True,
                "message": "连接测试成功",
                "project_name": config.project_name,
                "test_time": "刚刚"
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"测试Coding配置失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"连接测试失败: {str(e)}"
            )
    
    async def update_last_sync_time(
        self,
        db: AsyncSession,
        workspace_id: int
    ) -> None:
        """更新最后同步时间"""
        try:
            config = await self.get_config_by_workspace(db, workspace_id)
            if config:
                from backend.app.db.utils import get_local_time
                config.last_sync_at = get_local_time()
                await db.commit()
                
        except Exception as e:
            logger.error(f"更新同步时间失败: {str(e)}")


# 创建全局服务实例
coding_config_service = CodingConfigService()
