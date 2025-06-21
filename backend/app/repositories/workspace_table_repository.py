from typing import List, Optional, Dict, Any
from sqlalchemy import select, exists
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.logger import logger
from backend.app.models.workspace_table import WorkspaceTable
from backend.app.repositories.base_repository import BaseRepository
from backend.app.schemas.workspace_table import WorkspaceTableCreate, WorkspaceTableUpdate


class WorkspaceTableRepository(BaseRepository[WorkspaceTable, WorkspaceTableCreate, WorkspaceTableUpdate]):
    """
    WorkspaceTable模型的数据库操作仓库
    """
    def __init__(self):
        super().__init__(WorkspaceTable)
    
    async def get_by_id(self, db: AsyncSession, table_id: int) -> Optional[WorkspaceTable]:
        """
        根据ID获取工作区数据库表
        """
        try:
            result = await db.execute(
                select(WorkspaceTable).where(WorkspaceTable.id == table_id)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"根据ID获取工作区数据库表失败: {str(e)}")
            raise
    
    async def get_by_workspace_id(self, db: AsyncSession, workspace_id: int) -> List[WorkspaceTable]:
        """
        获取工作区下的所有数据库表
        """
        try:
            result = await db.execute(
                select(WorkspaceTable)
                .where(WorkspaceTable.workspace_id == workspace_id)
                .order_by(WorkspaceTable.name)
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"获取工作区数据库表失败: {str(e)}")
            raise
    
    async def create_table(
        self,
        db: AsyncSession,
        workspace_id: int,
        user_id: int,
        table_data: Dict[str, Any]
    ) -> WorkspaceTable:
        """
        创建工作区数据库表
        """
        try:
            table = WorkspaceTable(
                workspace_id=workspace_id,
                user_id=user_id,
                created_by=user_id,
                **table_data
            )
            db.add(table)
            await db.commit()
            await db.refresh(table)
            return table
        except Exception as e:
            await db.rollback()
            logger.error(f"创建工作区数据库表失败: {str(e)}")
            raise
    
    async def update_table(
        self,
        db: AsyncSession,
        table_id: int,
        user_id: int,
        table_data: Dict[str, Any]
    ) -> Optional[WorkspaceTable]:
        """
        更新工作区数据库表
        """
        try:
            table = await self.get_by_id(db, table_id)
            if not table:
                return None
            
            # 更新字段
            for key, value in table_data.items():
                setattr(table, key, value)
            
            # 更新最后修改者
            table.user_id = user_id
            
            await db.commit()
            await db.refresh(table)
            return table
        except Exception as e:
            await db.rollback()
            logger.error(f"更新工作区数据库表失败: {str(e)}")
            raise
    
    async def delete_table(self, db: AsyncSession, table_id: int) -> bool:
        """
        删除工作区数据库表
        """
        try:
            table = await self.get_by_id(db, table_id)
            if not table:
                return False
            
            await db.delete(table)
            await db.commit()
            return True
        except Exception as e:
            await db.rollback()
            logger.error(f"删除工作区数据库表失败: {str(e)}")
            raise
    
    async def check_table_exists(
        self,
        db: AsyncSession,
        workspace_id: int,
        table_name: str,
        exclude_id: Optional[int] = None
    ) -> bool:
        """
        检查工作区中是否已存在同名表
        """
        try:
            query = select(exists().where(
                (WorkspaceTable.workspace_id == workspace_id) &
                (WorkspaceTable.name == table_name)
            ))
            
            if exclude_id:
                query = query.where(WorkspaceTable.id != exclude_id)
                
            result = await db.execute(query)
            return result.scalar()
        except Exception as e:
            logger.error(f"检查工作区数据库表是否存在失败: {str(e)}")
            raise


# 创建工作区数据库表仓库实例
workspace_table_repository = WorkspaceTableRepository() 