from typing import Optional, Dict, Any, List
from sqlalchemy import select, exists
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.logger import logger
from backend.app.models.module_content import ModuleContent
from backend.app.models.module_structure import ModuleStructureNode
from backend.app.repositories.base_repository import BaseRepository
from backend.app.schemas.module_content import ModuleContentCreate, ModuleContentUpdate


class ModuleContentRepository(BaseRepository[ModuleContent, ModuleContentCreate, ModuleContentUpdate]):
    """
    ModuleContent模型的数据库操作仓库
    """
    def __init__(self):
        super().__init__(ModuleContent)
    
    async def get_by_node_id(self, db: AsyncSession, module_node_id: int) -> Optional[ModuleContent]:
        """
        根据模块节点ID获取内容
        """
        try:
            result = await db.execute(
                select(ModuleContent).where(ModuleContent.module_node_id == module_node_id)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"根据节点ID获取模块内容失败: {str(e)}")
            raise
    
    async def check_node_exists(self, db: AsyncSession, module_node_id: int) -> bool:
        """
        检查模块节点是否存在
        """
        try:
            result = await db.execute(
                select(exists().where(ModuleStructureNode.id == module_node_id))
            )
            return result.scalar()
        except Exception as e:
            logger.error(f"检查模块节点是否存在失败: {str(e)}")
            raise
    
    async def upsert_content(
        self,
        db: AsyncSession,
        module_node_id: int,
        user_id: int,
        content_data: ModuleContentUpdate
    ) -> ModuleContent:
        """
        创建或更新模块内容
        """
        try:
            # 获取现有内容
            content = await self.get_by_node_id(db, module_node_id)
            
            if content:
                # 更新内容
                update_data = content_data.model_dump(exclude_unset=True)
                for key, value in update_data.items():
                    setattr(content, key, value)
                
                # 更新最后修改者
                content.user_id = user_id
            else:
                # 创建新内容
                content_dict = content_data.model_dump(exclude_unset=True)
                content = ModuleContent(
                    module_node_id=module_node_id,
                    user_id=user_id,
                    created_by=user_id,
                    **content_dict
                )
                db.add(content)
            
            await db.commit()
            await db.refresh(content)
            
            return content
        except Exception as e:
            await db.rollback()
            logger.error(f"更新或创建模块内容失败: {str(e)}")
            raise
    
    async def update_table_refs(
        self,
        db: AsyncSession,
        module_node_id: int,
        user_id: int,
        table_refs: List[int]
    ) -> Optional[ModuleContent]:
        """
        更新模块内容中的数据库表引用
        """
        try:
            content = await self.get_by_node_id(db, module_node_id)
            if not content:
                return None
            
            content.database_table_refs_json = table_refs
            content.user_id = user_id
            
            await db.commit()
            await db.refresh(content)
            return content
        except Exception as e:
            await db.rollback()
            logger.error(f"更新模块内容数据库表引用失败: {str(e)}")
            raise
    
    async def update_interface_refs(
        self,
        db: AsyncSession,
        module_node_id: int,
        user_id: int,
        interface_refs: List[int]
    ) -> Optional[ModuleContent]:
        """
        更新模块内容中的接口引用
        """
        try:
            content = await self.get_by_node_id(db, module_node_id)
            if not content:
                return None
            
            content.api_interface_refs_json = interface_refs
            content.user_id = user_id
            
            await db.commit()
            await db.refresh(content)
            return content
        except Exception as e:
            await db.rollback()
            logger.error(f"更新模块内容接口引用失败: {str(e)}")
            raise
    
    # 图像路径更新方法已移除
    
    # 图像路径清除方法已移除


# 创建模块内容仓库实例
module_content_repository = ModuleContentRepository() 