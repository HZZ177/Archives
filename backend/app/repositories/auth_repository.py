from typing import Optional, List
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.repositories.base_repository import BaseRepository
from backend.app.schemas.user import UserCreate, UserUpdate


class AuthRepository(BaseRepository[User, UserCreate, UserUpdate]):
    """
    用户认证相关的数据库操作仓库
    包含所有用户数据访问方法
    """
    def __init__(self):
        super().__init__(User)
    
    # 基础用户查询方法
    
    async def get_user_by_id(self, db: AsyncSession, user_id: int) -> Optional[User]:
        """
        通过ID获取用户
        """
        try:
            return await self.get(db, user_id)
        except Exception as e:
            logger.error(f"通过ID获取用户失败: {str(e)}")
            raise
    
    async def get_user_by_username(self, db: AsyncSession, username: str) -> Optional[User]:
        """
        通过用户名获取用户
        """
        try:
            return await self.get_by_attribute(db, "username", username)
        except Exception as e:
            logger.error(f"通过用户名获取用户失败: {str(e)}")
            raise
    
    async def get_user_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        """
        通过邮箱获取用户
        """
        try:
            return await self.get_by_attribute(db, "email", email)
        except Exception as e:
            logger.error(f"通过邮箱获取用户失败: {str(e)}")
            raise
    
    async def get_user_by_mobile(self, db: AsyncSession, mobile: str) -> Optional[User]:
        """
        通过手机号获取用户
        """
        try:
            return await self.get_by_attribute(db, "mobile", mobile)
        except Exception as e:
            logger.error(f"通过手机号获取用户失败: {str(e)}")
            raise
    
    async def get_user_by_username_or_mobile(self, db: AsyncSession, username_or_mobile: str) -> Optional[User]:
        """
        通过用户名或手机号获取用户
        """
        try:
            stmt = select(User).where(
                or_(
                    User.username == username_or_mobile,
                    User.mobile == username_or_mobile
                )
            )
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"通过用户名或手机号获取用户失败: {str(e)}")
            raise
    
    # 兼容旧版API的别名方法，保证向后兼容
    
    async def get_by_username(self, db: AsyncSession, username: str) -> Optional[User]:
        """
        通过用户名获取用户（兼容旧版API）
        """
        return await self.get_user_by_username(db, username)
    
    async def get_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        """
        通过邮箱获取用户（兼容旧版API）
        """
        return await self.get_user_by_email(db, email)
    
    async def get_by_mobile(self, db: AsyncSession, mobile: str) -> Optional[User]:
        """
        通过手机号获取用户（兼容旧版API）
        """
        return await self.get_user_by_mobile(db, mobile)
    
    async def get_by_username_or_mobile(self, db: AsyncSession, username_or_mobile: str) -> Optional[User]:
        """
        通过用户名或手机号获取用户（兼容旧版API）
        """
        return await self.get_user_by_username_or_mobile(db, username_or_mobile)
    
    # 用户管理方法
    
    async def get_all_users(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> List[User]:
        """
        获取所有用户列表
        """
        try:
            return await self.get_multi(db, skip=skip, limit=limit)
        except Exception as e:
            logger.error(f"获取用户列表失败: {str(e)}")
            raise
    
    async def create_user(self, db: AsyncSession, user_in: UserCreate) -> User:
        """
        创建新用户
        """
        try:
            return await self.create(db, obj_in=user_in)
        except Exception as e:
            logger.error(f"创建用户失败: {str(e)}")
            raise
    
    async def update_user(self, db: AsyncSession, db_obj: User, obj_in: UserUpdate) -> User:
        """
        更新用户信息
        """
        try:
            return await self.update(db, db_obj=db_obj, obj_in=obj_in)
        except Exception as e:
            logger.error(f"更新用户信息失败: {str(e)}")
            raise
    
    async def delete_user(self, db: AsyncSession, user_id: int) -> Optional[User]:
        """
        删除用户
        """
        try:
            return await self.remove(db, id=user_id)
        except Exception as e:
            logger.error(f"删除用户失败: {str(e)}")
            raise
    
    async def update_password(self, db: AsyncSession, user: User, hashed_password: str) -> User:
        """
        更新用户密码
        
        :param db: 数据库会话
        :param user: 用户对象
        :param hashed_password: 加密后的密码
        :return: 更新后的用户
        """
        try:
            # 更新密码
            user.hashed_password = hashed_password
            db.add(user)
            await db.commit()
            await db.refresh(user)
            return user
        except Exception as e:
            await db.rollback()
            logger.error(f"更新用户密码失败: {str(e)}")
            raise

    async def get_first_superuser(self, db: AsyncSession) -> Optional[User]:
        """
        获取第一个超级管理员用户
        """
        try:
            stmt = select(User).where(User.is_superuser == True).limit(1)
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"获取超级管理员失败: {str(e)}")
            raise


# 创建认证仓库实例
auth_repository = AuthRepository() 