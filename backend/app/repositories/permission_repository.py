from typing import List, Optional, Set
from sqlalchemy import select, exists
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.core.logger import logger
from backend.app.models.permission import Permission, role_permission
from backend.app.models.user import User, Role, user_role
from backend.app.repositories.base_repository import BaseRepository
from backend.app.schemas.permission import PermissionCreate, PermissionUpdate


class PermissionRepository(BaseRepository[Permission, PermissionCreate, PermissionUpdate]):
    """
    Permission模型的数据库操作仓库
    """
    def __init__(self):
        super().__init__(Permission)
    
    async def get_all_permissions(
        self, 
        db: AsyncSession, 
        skip: int = 0, 
        limit: int = 1000
    ) -> List[Permission]:
        """
        获取所有权限列表（扁平结构）
        """
        try:
            result = await db.execute(
                select(Permission)
                .options(selectinload(Permission.children))
                .offset(skip)
                .limit(limit)
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"获取权限列表失败: {str(e)}")
            raise
    
    async def get_permissions_tree(self, db: AsyncSession) -> List[Permission]:
        """
        获取权限树（树形结构）
        """
        try:
            result = await db.execute(
                select(Permission)
                .options(selectinload(Permission.children))
                .where(Permission.parent_id.is_(None))
                .order_by(Permission.sort)
            )
            return result.unique().scalars().all()
        except Exception as e:
            logger.error(f"获取权限树失败: {str(e)}")
            raise
    
    async def check_code_exists(
        self, 
        db: AsyncSession, 
        code: str, 
        exclude_id: Optional[int] = None
    ) -> bool:
        """
        检查权限代码是否已存在
        """
        try:
            query = select(exists().where(Permission.code == code))
            
            # 排除自身ID (更新时)
            if exclude_id is not None:
                query = query.where(Permission.id != exclude_id)
                
            result = await db.execute(query)
            return result.scalar()
        except Exception as e:
            logger.error(f"检查权限代码是否存在失败: {str(e)}")
            raise
    
    async def check_page_path_exists(
        self, 
        db: AsyncSession, 
        page_path: str, 
        exclude_id: Optional[int] = None
    ) -> bool:
        """
        检查页面路径是否已存在
        """
        try:
            query = select(exists().where(Permission.page_path == page_path))
            
            # 排除自身ID (更新时)
            if exclude_id is not None:
                query = query.where(Permission.id != exclude_id)
                
            result = await db.execute(query)
            return result.scalar()
        except Exception as e:
            logger.error(f"检查页面路径是否存在失败: {str(e)}")
            raise
    
    async def get_permission_by_id(self, db: AsyncSession, permission_id: int) -> Optional[Permission]:
        """
        获取单个权限
        """
        try:
            return await db.get(Permission, permission_id)
        except Exception as e:
            logger.error(f"获取权限详情失败: {str(e)}")
            raise
    
    async def create_permission(
        self, 
        db: AsyncSession, 
        permission_data: PermissionCreate
    ) -> Permission:
        """
        创建权限
        """
        try:
            db_permission = Permission(**permission_data.model_dump())
            
            db.add(db_permission)
            await db.commit()
            await db.refresh(db_permission)
            
            return db_permission
        except Exception as e:
            await db.rollback()
            logger.error(f"创建权限失败: {str(e)}")
            raise
    
    async def update_permission(
        self, 
        db: AsyncSession, 
        permission: Permission, 
        permission_data: PermissionUpdate
    ) -> Permission:
        """
        更新权限
        """
        try:
            update_data = permission_data.model_dump(exclude_unset=True)
            
            for key, value in update_data.items():
                setattr(permission, key, value)
            
            await db.commit()
            await db.refresh(permission)
            
            return permission
        except Exception as e:
            await db.rollback()
            logger.error(f"更新权限失败: {str(e)}")
            raise
    
    async def delete_permission(self, db: AsyncSession, permission: Permission) -> None:
        """
        删除权限
        """
        try:
            await db.delete(permission)
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"删除权限失败: {str(e)}")
            raise
    
    async def check_has_children(self, db: AsyncSession, permission_id: int) -> bool:
        """
        检查权限是否有子权限
        """
        try:
            result = await db.execute(
                select(exists().where(Permission.parent_id == permission_id))
            )
            return result.scalar()
        except Exception as e:
            logger.error(f"检查权限是否有子权限失败: {str(e)}")
            raise
    
    async def check_roles_using_permission(self, db: AsyncSession, permission_id: int) -> bool:
        """
        检查是否有角色使用该权限
        """
        try:
            stmt = select(exists()).select_from(
                role_permission
            ).where(
                role_permission.c.permission_id == permission_id
            )
            result = await db.execute(stmt)
            return result.scalar()
        except Exception as e:
            logger.error(f"检查角色使用权限失败: {str(e)}")
            raise
    
    async def get_user_permissions(self, db: AsyncSession, user: User) -> Set[str]:
        """
        获取用户权限代码列表
        """
        try:
            # 超级管理员拥有所有权限
            if user.is_superuser:
                result = await db.execute(select(Permission.code).where(Permission.code.isnot(None)))
                permission_codes = result.scalars().all()
                return set(permission_codes)
            
            # 普通用户只有角色授予的权限
            # 直接通过user_id查询，避免使用user.roles关系
            query = (
                select(Permission.code)
                .select_from(Permission)
                .join(role_permission, Permission.id == role_permission.c.permission_id)
                .join(Role, Role.id == role_permission.c.role_id)
                .join(user_role, Role.id == user_role.c.role_id)
                .where(user_role.c.user_id == user.id)
                .where(Permission.code.isnot(None))
            )
            
            result = await db.execute(query)
            permission_codes = result.scalars().all()
            return set(permission_codes)
        except Exception as e:
            logger.error(f"获取用户权限列表失败: {str(e)}")
            raise
    
    async def get_user_pages(self, db: AsyncSession, user: User) -> List[str]:
        """
        获取用户可访问的页面路径列表
        """
        try:
            # 超级管理员可以访问所有页面
            if user.is_superuser:
                query = select(Permission.page_path).where(Permission.page_path.isnot(None))
                result = await db.execute(query)
                pages = result.scalars().all()
                return list(pages)
            
            # 普通用户只能访问角色授予的权限对应的页面
            # 直接通过user_id查询，避免使用user.roles关系
            query = (
                select(Permission.page_path)
                .select_from(Permission)
                .join(role_permission, Permission.id == role_permission.c.permission_id)
                .join(Role, Role.id == role_permission.c.role_id)
                .join(user_role, Role.id == user_role.c.role_id)
                .where(user_role.c.user_id == user.id)
                .where(Permission.page_path.isnot(None))
            )
            
            result = await db.execute(query)
            pages = result.scalars().all()
            return list(pages)
        except Exception as e:
            logger.error(f"获取用户页面列表失败: {str(e)}")
            raise


# 创建权限仓库实例
permission_repository = PermissionRepository() 