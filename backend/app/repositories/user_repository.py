from typing import List, Optional, Dict, Any, Tuple, Set
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from backend.app.core.logger import logger
from backend.app.models.user import User, Role, user_role
from backend.app.repositories.base_repository import BaseRepository
from backend.app.schemas.user import UserCreate, UserUpdate, UserPage


class UserRepository(BaseRepository[User, UserCreate, UserUpdate]):
    """
    User模型的数据库操作仓库
    """
    def __init__(self):
        super().__init__(User)
    
    async def get_users_list(
        self, 
        db: AsyncSession, 
        skip: int = 0, 
        limit: int = 100,
        keyword: Optional[str] = None,
        page: int = 1,
        page_size: int = 10
    ) -> Dict[str, Any]:
        """
        获取用户列表，支持分页和关键字搜索
        
        :param db: 数据库会话
        :param skip: 跳过记录数
        :param limit: 限制记录数
        :param keyword: 搜索关键词
        :param page: 页码
        :param page_size: 每页数量
        :return: 包含用户列表和总数的字典
        """
        try:
            # 构建查询
            query = select(User)
            
            # 如果有关键词，添加搜索条件
            if keyword:
                search_pattern = f"%{keyword}%"
                query = query.where(
                    or_(
                        User.username.ilike(search_pattern),  # 用户名匹配
                        User.email.ilike(search_pattern),     # 邮箱匹配
                        User.mobile.ilike(search_pattern)     # 手机号匹配
                    )
                )
            
            # 计算总数量
            count_query = select(func.count()).select_from(query.subquery())
            count_result = await db.execute(count_query)
            total_count = count_result.scalar_one()
            
            # 添加分页
            offset = (page - 1) * page_size
            query = query.offset(offset).limit(page_size)
            
            # 执行查询
            result = await db.execute(query)
            users = result.scalars().all()
            
            return {
                "items": users,
                "total": total_count
            }
        except Exception as e:
            logger.error(f"获取用户列表失败: {str(e)}")
            raise
    
    async def get_user_by_id(self, db: AsyncSession, user_id: int) -> Optional[User]:
        """
        根据ID获取用户
        
        :param db: 数据库会话
        :param user_id: 用户ID
        :return: 用户对象或None
        """
        try:
            return await db.get(User, user_id)
        except Exception as e:
            logger.error(f"获取用户详情失败: {str(e)}")
            raise
    
    async def check_username_exists(
        self, 
        db: AsyncSession, 
        username: str, 
        exclude_id: Optional[int] = None
    ) -> bool:
        """
        检查用户名是否已存在
        
        :param db: 数据库会话
        :param username: 用户名
        :param exclude_id: 排除的用户ID（用于更新时排除自身）
        :return: 是否存在
        """
        try:
            query = select(User).where(User.username == username)
            
            if exclude_id is not None:
                query = query.where(User.id != exclude_id)
                
            result = await db.execute(query)
            return result.scalar_one_or_none() is not None
        except Exception as e:
            logger.error(f"检查用户名是否存在失败: {str(e)}")
            raise
    
    async def check_email_exists(
        self, 
        db: AsyncSession, 
        email: str, 
        exclude_id: Optional[int] = None
    ) -> bool:
        """
        检查邮箱是否已存在
        
        :param db: 数据库会话
        :param email: 邮箱
        :param exclude_id: 排除的用户ID（用于更新时排除自身）
        :return: 是否存在
        """
        try:
            if not email:  # 如果邮箱为空，则视为不存在
                return False
                
            query = select(User).where(User.email == email)
            
            if exclude_id is not None:
                query = query.where(User.id != exclude_id)
                
            result = await db.execute(query)
            return result.scalar_one_or_none() is not None
        except Exception as e:
            logger.error(f"检查邮箱是否存在失败: {str(e)}")
            raise
    
    async def check_mobile_exists(
        self, 
        db: AsyncSession, 
        mobile: str, 
        exclude_id: Optional[int] = None
    ) -> bool:
        """
        检查手机号是否已存在
        
        :param db: 数据库会话
        :param mobile: 手机号
        :param exclude_id: 排除的用户ID（用于更新时排除自身）
        :return: 是否存在
        """
        try:
            if not mobile:  # 如果手机号为空，则视为不存在
                return False
                
            query = select(User).where(User.mobile == mobile)
            
            if exclude_id is not None:
                query = query.where(User.id != exclude_id)
                
            result = await db.execute(query)
            return result.scalar_one_or_none() is not None
        except Exception as e:
            logger.error(f"检查手机号是否存在失败: {str(e)}")
            raise
    
    async def create_user(
        self, 
        db: AsyncSession, 
        user_data: Dict[str, Any], 
        role_ids: Optional[List[int]] = None
    ) -> User:
        """
        创建用户
        
        :param db: 数据库会话
        :param user_data: 用户数据
        :param role_ids: 角色ID列表
        :return: 创建的用户对象
        """
        try:
            # 创建用户
            user = User(**user_data)
            db.add(user)
            await db.flush()  # 获取用户ID
            
            # 如果有角色ID，则分配角色
            if role_ids:
                # 使用run_sync在同步上下文中执行，避免greenlet错误
                def assign_roles(session, user_obj, roles_list):
                    for role_id in roles_list:
                        role = session.get(Role, role_id)
                        if role:
                            user_obj.roles.append(role)
                
                await db.run_sync(assign_roles, user, role_ids)
            
            # 提交事务
            await db.commit()
            await db.refresh(user)
            
            return user
        except Exception as e:
            await db.rollback()
            logger.error(f"创建用户失败: {str(e)}")
            raise
    
    async def update_user(
        self, 
        db: AsyncSession, 
        user: User, 
        update_data: Dict[str, Any]
    ) -> User:
        """
        更新用户信息
        
        :param db: 数据库会话
        :param user: 用户对象
        :param update_data: 更新数据
        :return: 更新后的用户对象
        """
        try:
            # 更新用户属性
            for key, value in update_data.items():
                setattr(user, key, value)
            
            # 提交事务
            await db.commit()
            await db.refresh(user)
            
            return user
        except Exception as e:
            await db.rollback()
            logger.error(f"更新用户失败: {str(e)}")
            raise
    
    async def update_user_status(
        self, 
        db: AsyncSession, 
        user: User, 
        is_active: bool
    ) -> User:
        """
        更新用户状态
        
        :param db: 数据库会话
        :param user: 用户对象
        :param is_active: 是否启用
        :return: 更新后的用户对象
        """
        try:
            user.is_active = is_active
            
            # 提交事务
            await db.commit()
            await db.refresh(user)
            
            return user
        except Exception as e:
            await db.rollback()
            logger.error(f"更新用户状态失败: {str(e)}")
            raise
    
    async def delete_user(self, db: AsyncSession, user: User) -> None:
        """
        删除用户
        
        :param db: 数据库会话
        :param user: 用户对象
        """
        try:
            await db.delete(user)
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"删除用户失败: {str(e)}")
            raise
    
    async def get_user_roles(self, db: AsyncSession, user: User) -> List[Role]:
        """
        获取用户的角色列表
        
        :param db: 数据库会话
        :param user: 用户对象
        :return: 角色列表
        """
        try:
            # 使用run_sync在同步上下文中执行，避免greenlet错误
            def get_roles(session, user_obj):
                # 预加载user的roles关系
                session.refresh(user_obj, ["roles"])
                return list(user_obj.roles)
            
            return await db.run_sync(get_roles, user)
        except Exception as e:
            logger.error(f"获取用户角色失败: {str(e)}")
            raise
    
    async def update_user_roles(
        self, 
        db: AsyncSession, 
        user: User, 
        role_ids: List[int]
    ) -> None:
        """
        更新用户的角色
        
        :param db: 数据库会话
        :param user: 用户对象
        :param role_ids: 角色ID列表
        """
        try:
            # 使用run_sync在同步上下文中执行，避免greenlet错误
            def update_roles(session, user_obj, roles_list):
                # 清空用户的当前角色
                user_obj.roles = []
                # 添加新角色
                for role_id in roles_list:
                    role = session.get(Role, role_id)
                    if role:
                        user_obj.roles.append(role)
            
            await db.run_sync(update_roles, user, role_ids)
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"更新用户角色失败: {str(e)}")
            raise


# 创建用户仓库实例
user_repository = UserRepository() 