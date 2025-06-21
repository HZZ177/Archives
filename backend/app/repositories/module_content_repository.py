from typing import Optional, Dict, Any
from sqlalchemy import select, exists, delete, insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.core.logger import logger
from backend.app.models.module_content import ModuleContent, module_content_table, module_content_interface
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
                select(ModuleContent)
                .options(
                    selectinload(ModuleContent.database_tables),
                    selectinload(ModuleContent.api_interfaces)
                )
                .where(ModuleContent.module_node_id == module_node_id)
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
            return bool(result.scalar())
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
            
            # 提取 database_table_refs 和 api_interface_refs，避免直接设置到模型
            update_data = content_data.model_dump(exclude_unset=True)
            database_table_refs = update_data.pop('database_table_refs', None)
            api_interface_refs = update_data.pop('api_interface_refs', None)
            
            if content:
                # 更新内容
                for key, value in update_data.items():
                    setattr(content, key, value)
                
                # 更新最后修改者
                content.user_id = user_id
            else:
                # 创建新内容
                content = ModuleContent()
                setattr(content, 'module_node_id', module_node_id)
                setattr(content, 'user_id', user_id)
                setattr(content, 'created_by', user_id)
                
                # 设置其他字段
                for key, value in update_data.items():
                    setattr(content, key, value)
                
                db.add(content)
            
            # 先提交以获取 content.id
            await db.commit()
            await db.refresh(content)
            
            # 处理数据库表关联关系
            if database_table_refs is not None:
                # 清除现有关联
                await db.execute(
                    delete(module_content_table)
                    .where(module_content_table.c.module_content_id == content.id)
                )
                
                # 建立新的关联
                if database_table_refs:
                    for table_id in database_table_refs:
                        await db.execute(
                            insert(module_content_table)
                            .values(module_content_id=content.id, workspace_table_id=table_id)
                        )
            
            # 处理接口关联关系
            if api_interface_refs is not None:
                # 清除现有关联
                await db.execute(
                    delete(module_content_interface)
                    .where(module_content_interface.c.module_content_id == content.id)
                )
                
                # 建立新的关联
                if api_interface_refs:
                    for interface_id in api_interface_refs:
                        await db.execute(
                            insert(module_content_interface)
                            .values(module_content_id=content.id, workspace_interface_id=interface_id)
                        )
            
            await db.commit()
            await db.refresh(content)
            
            return content
        except Exception as e:
            await db.rollback()
            logger.error(f"更新或创建模块内容失败: {str(e)}")
            raise
    
    # 图像路径更新方法已移除
    
    # 图像路径清除方法已移除


# 创建模块内容仓库实例
module_content_repository = ModuleContentRepository() 