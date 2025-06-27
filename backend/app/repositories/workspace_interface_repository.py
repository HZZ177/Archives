from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select, exists, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.logger import logger
from backend.app.models.workspace_interface import WorkspaceInterface
from backend.app.repositories.base_repository import BaseRepository
from backend.app.schemas.workspace_interface import WorkspaceInterfaceCreate, WorkspaceInterfaceUpdate


class WorkspaceInterfaceRepository(BaseRepository[WorkspaceInterface, WorkspaceInterfaceCreate, WorkspaceInterfaceUpdate]):
    """
    WorkspaceInterface模型的数据库操作仓库
    """
    def __init__(self):
        super().__init__(WorkspaceInterface)
    
    async def get_by_id(self, db: AsyncSession, interface_id: int) -> Optional[WorkspaceInterface]:
        """
        根据ID获取工作区接口
        """
        try:
            result = await db.execute(
                select(WorkspaceInterface).where(WorkspaceInterface.id == interface_id)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"根据ID获取工作区接口失败: {str(e)}")
            raise
    
    async def get_by_workspace_id(
        self, 
        db: AsyncSession, 
        workspace_id: int, 
        skip: int = 0, 
        limit: int = 100,
        search: str = ''
    ) -> List[WorkspaceInterface]:
        """
        获取工作区下的接口，带分页和搜索
        
        :param db: 数据库会话
        :param workspace_id: 工作区ID
        :param skip: 跳过的记录数
        :param limit: 返回的记录数
        :param search: 搜索关键词，可搜索路径和描述
        :return: 接口列表
        """
        try:
            query = select(WorkspaceInterface).where(WorkspaceInterface.workspace_id == workspace_id)
            
            # 如果有搜索关键词，添加搜索条件
            if search:
                query = query.where(
                    or_(
                        WorkspaceInterface.path.ilike(f"%{search}%"),
                        WorkspaceInterface.description.ilike(f"%{search}%")
                    )
                )
            
            # 添加排序、分页
            query = query.order_by(WorkspaceInterface.updated_at.desc()).offset(skip).limit(limit)
            
            result = await db.execute(query)
            return result.scalars().all()
        except Exception as e:
            logger.error(f"获取工作区接口失败: {str(e)}")
            raise
    
    async def count_by_workspace_id(
        self, 
        db: AsyncSession, 
        workspace_id: int,
        search: str = ''
    ) -> int:
        """
        获取工作区下的接口总数，带搜索
        
        :param db: 数据库会话
        :param workspace_id: 工作区ID
        :param search: 搜索关键词，可搜索路径和描述
        :return: 接口总数
        """
        try:
            query = select(func.count(WorkspaceInterface.id)).where(
                WorkspaceInterface.workspace_id == workspace_id
            )
            
            # 如果有搜索关键词，添加搜索条件
            if search:
                query = query.where(
                    or_(
                        WorkspaceInterface.path.ilike(f"%{search}%"),
                        WorkspaceInterface.description.ilike(f"%{search}%")
                    )
                )
                
            result = await db.execute(query)
            return result.scalar_one()
        except Exception as e:
            logger.error(f"获取工作区接口总数失败: {str(e)}")
            raise
    
    async def create_interface(
        self,
        db: AsyncSession,
        workspace_id: int,
        user_id: int,
        interface_data: Dict[str, Any]
    ) -> WorkspaceInterface:
        """
        创建工作区接口
        """
        try:
            interface = WorkspaceInterface(
                workspace_id=workspace_id,
                user_id=user_id,
                created_by=user_id,
                **interface_data
            )
            db.add(interface)
            await db.commit()
            await db.refresh(interface)
            return interface
        except Exception as e:
            await db.rollback()
            logger.error(f"创建工作区接口失败: {str(e)}")
            raise
    
    async def update_interface(
        self,
        db: AsyncSession,
        interface_id: int,
        user_id: int,
        interface_data: Dict[str, Any]
    ) -> Optional[WorkspaceInterface]:
        """
        更新工作区接口
        """
        try:
            interface = await self.get_by_id(db, interface_id)
            if not interface:
                return None
            
            # 更新字段
            for key, value in interface_data.items():
                setattr(interface, key, value)
            
            # 更新最后修改者
            interface.user_id = user_id
            
            await db.commit()
            await db.refresh(interface)
            return interface
        except Exception as e:
            await db.rollback()
            logger.error(f"更新工作区接口失败: {str(e)}")
            raise
    
    async def delete_interface(self, db: AsyncSession, interface_id: int) -> bool:
        """
        删除工作区接口
        """
        try:
            interface = await self.get_by_id(db, interface_id)
            if not interface:
                return False
            
            await db.delete(interface)
            await db.commit()
            return True
        except Exception as e:
            await db.rollback()
            logger.error(f"删除工作区接口失败: {str(e)}")
            raise
    
    async def check_interface_exists(
        self,
        db: AsyncSession,
        workspace_id: int,
        path: str,
        method: str,
        exclude_id: Optional[int] = None
    ) -> bool:
        """
        检查工作区中是否已存在相同路径和方法的接口
        """
        try:
            query = select(exists().where(
                (WorkspaceInterface.workspace_id == workspace_id) &
                (WorkspaceInterface.path == path) &
                (WorkspaceInterface.method == method)
            ))
            
            if exclude_id:
                query = query.where(WorkspaceInterface.id != exclude_id)
                
            result = await db.execute(query)
            return result.scalar()
        except Exception as e:
            logger.error(f"检查工作区接口是否存在失败: {str(e)}")
            raise


# 创建工作区接口仓库实例
workspace_interface_repository = WorkspaceInterfaceRepository() 