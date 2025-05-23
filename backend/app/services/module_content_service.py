from typing import Optional, List, Tuple

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.logger import logger
from backend.app.models.module_content import ModuleContent
from backend.app.models.user import User
from backend.app.repositories.module_content_repository import module_content_repository
from backend.app.schemas.module_content import ModuleContentUpdate


class ModuleContentService:
    """
    模块内容相关的业务逻辑服务
    """
    
    async def validate_module_node(
        self,
        db: AsyncSession,
        module_node_id: int
    ) -> bool:
        """
        验证模块节点是否存在
        
        :raises: HTTPException 如果节点不存在
        """
        node_exists = await module_content_repository.check_node_exists(db, module_node_id)
        if not node_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="模块节点不存在"
            )
        return True
    
    async def get_module_content(
        self,
        db: AsyncSession,
        module_node_id: int
    ) -> ModuleContent:
        """
        获取特定模块节点的内容
        
        :param db: 数据库会话
        :param module_node_id: 模块节点ID
        :return: 模块内容对象
        """
        try:
            # 验证模块节点存在
            await self.validate_module_node(db, module_node_id)
            
            # 获取模块内容
            content = await module_content_repository.get_by_node_id(db, module_node_id)
            
            if not content:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="模块内容不存在"
                )
            
            return content
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取模块内容失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取模块内容失败: {str(e)}"
            )
    
    async def upsert_module_content(
        self,
        db: AsyncSession,
        module_node_id: int,
        content_data: ModuleContentUpdate,
        user: User
    ) -> Tuple[ModuleContent, str]:
        """
        创建或更新特定模块节点的内容
        
        :param db: 数据库会话
        :param module_node_id: 模块节点ID
        :param content_data: 内容更新数据
        :param user: 当前用户
        :return: (模块内容对象, 操作消息)
        """
        try:
            # 验证模块节点存在
            await self.validate_module_node(db, module_node_id)
            
            # 检查是否已存在内容
            existing_content = await module_content_repository.get_by_node_id(db, module_node_id)
            
            # 执行更新或创建
            content = await module_content_repository.upsert_content(
                db, module_node_id, user.id, content_data
            )
            
            # 根据操作类型返回相应消息
            message = "模块内容更新成功" if existing_content else "模块内容创建成功"
            
            return content, message
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"更新模块内容失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新模块内容失败: {str(e)}"
            )


# 创建模块内容服务实例
module_content_service = ModuleContentService() 