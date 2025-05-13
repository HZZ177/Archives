from typing import List, Optional, Dict, Any
from sqlalchemy import select, update, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.models.workspace import Workspace, workspace_user
from backend.app.repositories.base_repository import BaseRepository
from backend.app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate


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
            return result.scalars().all()
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
            return result.scalars().all()
        except Exception as e:
            logger.error(f"获取用户({user_id})的工作区失败: {str(e)}")
            raise
    
    async def create_workspace(self, db: AsyncSession, workspace_data: Dict[str, Any], created_by: int) -> Workspace:
        """
        创建工作区
        """
        try:
            workspace = Workspace(**workspace_data, created_by=created_by)
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


# 创建工作区仓库实例
workspace_repository = WorkspaceRepository() 