from typing import List, Optional, Dict, Any, Tuple

from fastapi import HTTPException, status
from sqlalchemy import select, update, and_, or_, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.models.workspace import Workspace, workspace_user
from backend.app.models.workspace_interface import WorkspaceInterface
from backend.app.models.workspace_table import WorkspaceTable
from backend.app.repositories.base_repository import BaseRepository
from backend.app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate
from backend.app.schemas.workspace_interface import WorkspaceInterfaceCreate, WorkspaceInterfaceUpdate
from backend.app.schemas.workspace_table import WorkspaceTableCreate, WorkspaceTableUpdate


class WorkspaceRepository(BaseRepository[Workspace, WorkspaceCreate, WorkspaceUpdate]):
    """工作区数据访问仓库"""
    
    def __init__(self):
        super().__init__(Workspace)
    
    async def get_by_id(self, db: AsyncSession, workspace_id: int) -> Optional[Workspace]:
        """
        通过ID获取工作区
        """
        try:
            result = await db.execute(
                select(Workspace).where(Workspace.id == workspace_id)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"获取工作区(ID:{workspace_id})失败: {str(e)}")
            raise
    
    async def get_all_workspaces(self, db: AsyncSession) -> List[Workspace]:
        """
        获取所有工作区
        """
        try:
            result = await db.execute(
                select(Workspace).order_by(Workspace.name)
            )
            return list(result.scalars().all())
        except Exception as e:
            logger.error(f"获取所有工作区失败: {str(e)}")
            raise
    
    async def get_user_workspaces(self, db: AsyncSession, user_id: int) -> List[Workspace]:
        """
        获取用户可访问的工作区
        """
        try:
            result = await db.execute(
                select(Workspace)
                .join(workspace_user, Workspace.id == workspace_user.c.workspace_id)
                .where(workspace_user.c.user_id == user_id)
                .order_by(Workspace.name)
            )
            return list(result.scalars().all())
        except Exception as e:
            logger.error(f"获取用户({user_id})的工作区失败: {str(e)}")
            raise
    
    async def create(self, db: AsyncSession, obj_in: WorkspaceCreate, created_by: int) -> Workspace:
        """
        创建工作区
        """
        try:
            db_obj_data = obj_in.dict()
            db_obj_data['created_by'] = created_by
            workspace = Workspace(**db_obj_data)
            db.add(workspace)
            await db.commit()
            await db.refresh(workspace)
            return workspace
        except Exception as e:
            await db.rollback()
            logger.error(f"创建工作区失败: {str(e)}")
            raise
    
    async def update_workspace(self, db: AsyncSession, workspace: Workspace, update_data: Dict[str, Any]) -> Workspace:
        """
        更新工作区
        """
        try:
            for field, value in update_data.items():
                setattr(workspace, field, value)
            
            await db.commit()
            await db.refresh(workspace)
            return workspace
        except Exception as e:
            await db.rollback()
            logger.error(f"更新工作区(ID:{workspace.id})失败: {str(e)}")
            raise
    
    async def delete_workspace(self, db: AsyncSession, workspace: Workspace) -> None:
        """
        删除工作区
        """
        try:
            await db.delete(workspace)
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"删除工作区(ID:{workspace.id})失败: {str(e)}")
            raise
    
    async def add_user_to_workspace(
        self, db: AsyncSession, workspace_id: int, user_id: int, access_level: str
    ) -> None:
        """
        添加用户到工作区
        """
        try:
            # 检查用户是否已在工作区中
            result = await db.execute(
                select(workspace_user).where(
                    and_(
                        workspace_user.c.workspace_id == workspace_id,
                        workspace_user.c.user_id == user_id
                    )
                )
            )
            
            existing = result.fetchone()
            
            if existing:
                # 更新用户访问级别
                await db.execute(
                    workspace_user.update()
                    .where(
                        and_(
                            workspace_user.c.workspace_id == workspace_id,
                            workspace_user.c.user_id == user_id
                        )
                    )
                    .values(access_level=access_level)
                )
            else:
                # 添加用户到工作区
                await db.execute(
                    workspace_user.insert().values(
                        workspace_id=workspace_id,
                        user_id=user_id,
                        access_level=access_level
                    )
                )
            
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"添加/更新用户({user_id})到工作区({workspace_id})失败: {str(e)}")
            raise
    
    async def remove_user_from_workspace(self, db: AsyncSession, workspace_id: int, user_id: int) -> None:
        """
        从工作区移除用户
        """
        try:
            await db.execute(
                workspace_user.delete().where(
                    and_(
                        workspace_user.c.workspace_id == workspace_id,
                        workspace_user.c.user_id == user_id
                    )
                )
            )
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"从工作区({workspace_id})移除用户({user_id})失败: {str(e)}")
            raise
    
    async def reset_default_workspaces(self, db: AsyncSession) -> None:
        """
        重置所有默认工作区
        """
        try:
            await db.execute(
                update(Workspace).where(Workspace.is_default == True).values(is_default=False)
            )
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"重置默认工作区失败: {str(e)}")
            raise
    
    async def get_workspace_users(self, db: AsyncSession, workspace_id: int) -> List[Dict[str, Any]]:
        """
        获取工作区用户列表
        """
        try:
            result = await db.execute(
                select(
                    User.id,
                    User.username,
                    User.email,
                    workspace_user.c.access_level
                )
                .join(workspace_user, User.id == workspace_user.c.user_id)
                .where(workspace_user.c.workspace_id == workspace_id)
                .order_by(User.username)
            )
            
            users = []
            for row in result.all():
                users.append({
                    "user_id": row.id,
                    "username": row.username,
                    "email": row.email,
                    "access_level": row.access_level,
                    "workspace_id": workspace_id
                })
            return users
        except Exception as e:
            logger.error(f"获取工作区({workspace_id})用户列表失败: {str(e)}")
            raise
    
    async def get_user_access_level(self, db: AsyncSession, workspace_id: int, user_id: int) -> Optional[str]:
        """
        获取用户在工作区的访问级别
        """
        try:
            result = await db.execute(
                select(workspace_user.c.access_level)
                .where(
                    and_(
                        workspace_user.c.workspace_id == workspace_id,
                        workspace_user.c.user_id == user_id
                    )
                )
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"获取用户({user_id})在工作区({workspace_id})的访问级别失败: {str(e)}")
            raise
    
    async def batch_add_users_to_workspace_db(
        self, db: AsyncSession, workspace_id: int, users_to_add: List[Dict[str, Any]]
    ) -> Dict[str, int]:
        """
        批量添加用户到工作区。如果用户已存在则跳过。
        users_to_add: 包含 {"user_id": int, "access_level": str} 的字典列表
        返回: {"added": count, "skipped": count}
        """
        added_count = 0
        skipped_count = 0
        try:
            for user_data in users_to_add:
                user_id = user_data["user_id"]
                access_level = user_data["access_level"]

                # 检查用户是否已在工作区中
                result = await db.execute(
                    select(workspace_user.c.user_id).where(
                        and_(
                            workspace_user.c.workspace_id == workspace_id,
                            workspace_user.c.user_id == user_id
                        )
                    )
                )
                existing_relation = result.fetchone()

                if existing_relation:
                    skipped_count += 1
                else:
                    # 用户不存在，则添加
                    await db.execute(
                        workspace_user.insert().values(
                            workspace_id=workspace_id,
                            user_id=user_id,
                            access_level=access_level
                        )
                    )
                    added_count += 1
            
            await db.commit()
            return {"added": added_count, "skipped": skipped_count}
        except Exception as e:
            await db.rollback()
            logger.error(f"批量添加用户到工作区({workspace_id})失败(仅添加新用户): {str(e)}")
            raise
    
    async def batch_remove_users_from_workspace_db(
        self, db: AsyncSession, workspace_id: int, user_ids: List[int]
    ) -> int:
        """
        从工作区批量移除用户。
        返回成功删除的记录数。
        """
        if not user_ids:
            return 0
        try:
            # 构建删除语句
            stmt = workspace_user.delete().where(
                and_(
                    workspace_user.c.workspace_id == workspace_id,
                    workspace_user.c.user_id.in_(user_ids)
                )
            )
            result = await db.execute(stmt)
            await db.commit()
            return result.rowcount # 返回受影响的行数，即成功删除的用户数
        except Exception as e:
            await db.rollback()
            logger.error(f"从工作区({workspace_id})批量移除用户失败: IDs {user_ids}, Error: {str(e)}")
            raise
    
    async def get_default_system_workspace(self, db: AsyncSession) -> Optional[Workspace]:
        """
        获取系统默认工作区
        """
        try:
            result = await db.execute(
                select(Workspace).where(Workspace.is_default == True)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"获取系统默认工作区失败: {str(e)}")
            raise
    
    async def set_user_default_workspace(self, db: AsyncSession, user_id: int, workspace_id: int) -> None:
        """
        设置用户的默认工作区
        """
        try:
            await db.execute(
                update(User)
                .where(User.id == user_id)
                .values(default_workspace_id=workspace_id)
            )
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"设置用户({user_id})的默认工作区({workspace_id})失败: {str(e)}")
            raise

    async def get_tables_by_workspace_id(
        self, 
        db: AsyncSession, 
        workspace_id: int,
        skip: int = 0,
        limit: int = 100,
        search: str = ''
    ) -> List[WorkspaceTable]:
        """
        获取工作区下的数据库表，支持分页和搜索
        
        :param db: 数据库会话
        :param workspace_id: 工作区ID
        :param skip: 跳过的记录数
        :param limit: 返回的记录数
        :param search: 搜索关键词，搜索表名和描述
        :return: 数据库表列表
        """
        try:
            query = select(WorkspaceTable).options(
                selectinload(WorkspaceTable.creator),
                selectinload(WorkspaceTable.last_editor)
            ).where(
                and_(
                    WorkspaceTable.workspace_id == workspace_id,
                    WorkspaceTable.created_by.isnot(None)
                )
            )
            
            # 添加搜索条件
            if search:
                query = query.where(
                    or_(
                        WorkspaceTable.name.ilike(f"%{search}%"),
                        WorkspaceTable.description.ilike(f"%{search}%")
                    )
                )
            
            # 添加分页
            query = query.offset(skip).limit(limit)
            
            result = await db.execute(query)
            return list(result.scalars().all())
        except Exception as e:
            logger.error(f"获取工作区表失败: {str(e)}")
            raise

    async def count_tables_by_workspace_id(
        self, 
        db: AsyncSession, 
        workspace_id: int,
        search: str = ''
    ) -> int:
        """
        获取工作区下数据库表的总数
        
        :param db: 数据库会话
        :param workspace_id: 工作区ID
        :param search: 搜索关键词
        :return: 数据库表总数
        """
        try:
            query = select(func.count(WorkspaceTable.id)).where(
                and_(
                    WorkspaceTable.workspace_id == workspace_id,
                    WorkspaceTable.created_by.isnot(None)
                )
            )
            
            # 添加搜索条件
            if search:
                query = query.where(
                    or_(
                        WorkspaceTable.name.ilike(f"%{search}%"),
                        WorkspaceTable.description.ilike(f"%{search}%")
                    )
                )
            
            result = await db.execute(query)
            return result.scalar() or 0
        except Exception as e:
            logger.error(f"获取工作区下数据库表总数失败: {str(e)}")
            raise

    async def get_table_by_id(self, db: AsyncSession, table_id: int) -> Optional[WorkspaceTable]:
        """通过ID获取工作区表"""
        try:
            result = await db.execute(
                select(WorkspaceTable)
                .options(
                    selectinload(WorkspaceTable.creator),
                    selectinload(WorkspaceTable.last_editor)
                )
                .where(WorkspaceTable.id == table_id)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"获取工作区表(ID:{table_id})失败: {str(e)}")
            raise

    async def create_workspace_table(self, db: AsyncSession, table_create: WorkspaceTableCreate, created_by_id: int) -> WorkspaceTable:
        """创建工作区表"""
        try:
            db_obj_data = table_create.dict()
            db_obj_data['created_by'] = created_by_id
            db_obj_data['user_id'] = created_by_id  # 设置最后修改者为创建者
            new_table = WorkspaceTable(**db_obj_data)
            db.add(new_table)
            await db.commit()
            await db.refresh(new_table)
            
            # 显式加载creator和last_editor关系，避免在序列化过程中出现异步加载错误
            result = await db.execute(
                select(WorkspaceTable)
                .options(
                    selectinload(WorkspaceTable.creator),
                    selectinload(WorkspaceTable.last_editor)
                )
                .where(WorkspaceTable.id == new_table.id)
            )
            return result.scalar_one_or_none() or new_table
        except Exception as e:
            await db.rollback()
            logger.error(f"创建工作区表失败: {str(e)}")
            raise

    async def update_workspace_table(self, db: AsyncSession, table_obj: WorkspaceTable, table_update: WorkspaceTableUpdate) -> WorkspaceTable:
        """更新工作区表"""
        try:
            update_data = table_update.dict(exclude_unset=True)
            for field, value in update_data.items():
                setattr(table_obj, field, value)

            await db.commit()
            await db.refresh(table_obj)
            
            # 显式加载creator和last_editor关系，避免在序列化过程中出现异步加载错误
            result = await db.execute(
                select(WorkspaceTable)
                .options(
                    selectinload(WorkspaceTable.creator),
                    selectinload(WorkspaceTable.last_editor)
                )
                .where(WorkspaceTable.id == table_obj.id)
            )
            updated_table_with_relations = result.scalar_one_or_none()
            return updated_table_with_relations or table_obj
        except Exception as e:
            await db.rollback()
            logger.error(f"更新工作区表(ID:{table_obj.id})失败: {str(e)}")
            raise

    async def delete_workspace_table(self, db: AsyncSession, table_id: int):
        table = await self.get_table_by_id(db, table_id)
        if table:
            await db.delete(table)
            await db.commit()

    async def get_interfaces_by_workspace_id(
        self, 
        db: AsyncSession, 
        workspace_id: int,
        skip: int = 0,
        limit: int = 100,
        search: str = ''
    ) -> List[WorkspaceInterface]:
        """
        获取工作区下的接口，支持分页和搜索
        
        :param db: 数据库会话
        :param workspace_id: 工作区ID
        :param skip: 跳过的记录数
        :param limit: 返回的记录数
        :param search: 搜索关键词，搜索路径和描述
        :return: 接口列表
        """
        try:
            query = select(WorkspaceInterface).options(selectinload(WorkspaceInterface.creator)).where(
                and_(
                    WorkspaceInterface.workspace_id == workspace_id,
                    WorkspaceInterface.created_by.isnot(None)
                )
            )
            
            # 添加搜索条件
            if search:
                query = query.where(
                    or_(
                        WorkspaceInterface.path.ilike(f"%{search}%"),
                        WorkspaceInterface.description.ilike(f"%{search}%")
                    )
                )
            
            # 添加分页
            query = query.offset(skip).limit(limit)
            
            result = await db.execute(query)
            return list(result.scalars().all())
        except Exception as e:
            logger.error(f"获取工作区下的接口失败: {str(e)}")
            raise

    async def count_interfaces_by_workspace_id(
        self, 
        db: AsyncSession, 
        workspace_id: int,
        search: str = ''
    ) -> int:
        """
        获取工作区下接口的总数
        
        :param db: 数据库会话
        :param workspace_id: 工作区ID
        :param search: 搜索关键词
        :return: 接口总数
        """
        try:
            query = select(func.count(WorkspaceInterface.id)).where(
                and_(
                    WorkspaceInterface.workspace_id == workspace_id,
                    WorkspaceInterface.created_by.isnot(None)
                )
            )
            
            # 添加搜索条件
            if search:
                query = query.where(
                    or_(
                        WorkspaceInterface.path.ilike(f"%{search}%"),
                        WorkspaceInterface.description.ilike(f"%{search}%")
                    )
                )
            
            result = await db.execute(query)
            return result.scalar() or 0
        except Exception as e:
            logger.error(f"获取工作区下接口总数失败: {str(e)}")
            raise

    async def get_interface_by_id(self, db: AsyncSession, interface_id: int) -> Optional[WorkspaceInterface]:
        return await db.get(WorkspaceInterface, interface_id)

    async def create_workspace_interface(self, db: AsyncSession, interface_create: WorkspaceInterfaceCreate, created_by_id: int) -> WorkspaceInterface:
        """创建工作区接口"""
        try:
            db_obj_data = interface_create.dict()
            db_obj_data['created_by'] = created_by_id
            new_interface = WorkspaceInterface(**db_obj_data)
            db.add(new_interface)
            await db.commit()
            await db.refresh(new_interface)
            return new_interface
        except Exception as e:
            await db.rollback()
            logger.error(f"创建工作区接口失败: {str(e)}")
            raise

    async def update_workspace_interface(self, db: AsyncSession, interface_id: int, interface_update: WorkspaceInterfaceUpdate) -> Optional[WorkspaceInterface]:
        interface = await self.get_interface_by_id(db, interface_id)
        if interface:
            update_data = interface_update.dict(exclude_unset=True)
            for key, value in update_data.items():
                setattr(interface, key, value)
            await db.commit()
            await db.refresh(interface)
        return interface

    async def delete_workspace_interface(self, db: AsyncSession, interface_id: int):
        interface = await self.get_interface_by_id(db, interface_id)
        if interface:
            await db.delete(interface)
            await db.commit()


# 创建工作区仓库实例
workspace_repository = WorkspaceRepository() 