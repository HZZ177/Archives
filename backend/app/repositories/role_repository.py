from typing import List, Optional, Dict, Any
from sqlalchemy import select, exists
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from backend.app.core.logger import logger
from backend.app.models.user import User, Role
from backend.app.models.permission import Permission
from backend.app.repositories.base_repository import BaseRepository
from backend.app.schemas.role import RoleCreate, RoleUpdate


class RoleRepository(BaseRepository[Role, RoleCreate, RoleUpdate]):
    """
    Role模型的数据库操作仓库
    """
    def __init__(self):
        super().__init__(Role)
    
    async def get_all_roles(
        self, 
        db: AsyncSession, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[Role]:
        """
        获取所有角色列表
        """
        try:
            result = await db.execute(
                select(Role).offset(skip).limit(limit)
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"获取角色列表失败: {str(e)}")
            raise
    
    async def get_role_by_id(self, db: AsyncSession, role_id: int) -> Optional[Role]:
        """
        根据ID获取角色
        """
        try:
            return await db.get(Role, role_id)
        except Exception as e:
            logger.error(f"获取角色详情失败: {str(e)}")
            raise
    
    async def get_role_with_permissions(self, db: AsyncSession, role_id: int) -> Optional[Role]:
        """
        根据ID获取角色（带权限）
        """
        try:
            stmt = select(Role).options(
                joinedload(Role.permissions)
            ).where(Role.id == role_id)
            
            result = await db.execute(stmt)
            return result.unique().scalar_one_or_none()
        except Exception as e:
            logger.error(f"获取角色（带权限）失败: {str(e)}")
            raise
    
    async def create_role(
        self, 
        db: AsyncSession, 
        role_data: Dict[str, Any], 
        permission_ids: Optional[List[int]] = None
    ) -> Role:
        """
        创建角色
        """
        try:
            # 创建角色
            db_role = Role(**role_data)
            db.add(db_role)
            await db.flush()  # 获取角色ID
            
            # 如果有权限ID，则分配权限
            if permission_ids:
                await self.update_role_permissions(db, db_role, permission_ids)
            
            await db.commit()
            await db.refresh(db_role)
            
            return db_role
        except Exception as e:
            await db.rollback()
            logger.error(f"创建角色失败: {str(e)}")
            raise
    
    async def update_role(
        self, 
        db: AsyncSession, 
        role: Role, 
        role_data: Dict[str, Any], 
        permission_ids: Optional[List[int]] = None
    ) -> Role:
        """
        更新角色
        """
        try:
            # 更新角色属性
            for key, value in role_data.items():
                setattr(role, key, value)
            
            # 如果有权限ID，则更新权限
            if permission_ids is not None:
                await self.update_role_permissions(db, role, permission_ids)
            
            await db.commit()
            await db.refresh(role)
            
            return role
        except Exception as e:
            await db.rollback()
            logger.error(f"更新角色失败: {str(e)}")
            raise
    
    async def delete_role(self, db: AsyncSession, role: Role) -> None:
        """
        删除角色
        """
        try:
            await db.delete(role)
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"删除角色失败: {str(e)}")
            raise
    
    async def check_role_name_exists(
        self, 
        db: AsyncSession, 
        name: str, 
        exclude_id: Optional[int] = None
    ) -> bool:
        """
        检查角色名是否已存在
        """
        try:
            query = select(exists().where(Role.name == name))
            
            # 排除自身ID (更新时)
            if exclude_id is not None:
                query = query.where(Role.id != exclude_id)
                
            result = await db.execute(query)
            return result.scalar()
        except Exception as e:
            logger.error(f"检查角色名是否存在失败: {str(e)}")
            raise
    
    async def check_role_has_users(self, db: AsyncSession, role_id: int) -> bool:
        """
        检查角色是否分配给用户
        """
        try:
            stmt = select(User).join(User.roles).where(Role.id == role_id)
            result = await db.execute(stmt)
            return bool(result.first())
        except Exception as e:
            logger.error(f"检查角色是否分配给用户失败: {str(e)}")
            raise
    
    async def get_role_permissions(self, db: AsyncSession, role_id: int) -> List[int]:
        """
        获取角色的权限ID列表
        """
        try:
            role = await self.get_role_with_permissions(db, role_id)
            if not role:
                return []
                
            return [perm.id for perm in role.permissions]
        except Exception as e:
            logger.error(f"获取角色权限失败: {str(e)}")
            raise
    
    async def update_role_permissions(
        self, 
        db: AsyncSession, 
        role: Role, 
        permission_ids: List[int]
    ) -> None:
        """
        更新角色的权限
        """
        try:
            # 查询所有需要的权限
            stmt = select(Permission).where(Permission.id.in_(permission_ids))
            result = await db.execute(stmt)
            permissions = result.scalars().all()
            
            # 使用relationship管理器的set方法设置权限
            await db.run_sync(lambda session: setattr(role, 'permissions', permissions))
        except Exception as e:
            logger.error(f"更新角色权限失败: {str(e)}")
            raise


# 创建仓库实例
role_repository = RoleRepository() 