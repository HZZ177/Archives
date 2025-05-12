from typing import List, Optional, Dict, Any, Tuple
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.logger import logger
from backend.app.core.security import get_password_hash
from backend.app.models.user import User, Role
from backend.app.repositories.user_repository import user_repository
from backend.app.schemas.user import UserCreate, UserUpdate, UserStatusUpdate, UserPage
from backend.app.schemas.role import UserRoleUpdate, RoleResponse
from backend.app.api.deps import check_permissions


class UserService:
    """
    用户相关业务逻辑服务
    """
    
    async def get_users_page(
        self, 
        db: AsyncSession, 
        current_user: User,
        skip: int = 0, 
        limit: int = 100,
        keyword: Optional[str] = None,
        page: int = 1,
        page_size: int = 10
    ) -> Dict[str, Any]:
        """
        获取用户分页列表
        
        :param db: 数据库会话
        :param current_user: 当前用户
        :param skip: 跳过记录数
        :param limit: 限制记录数
        :param keyword: 搜索关键词
        :param page: 页码
        :param page_size: 每页数量
        :return: 用户分页数据
        """
        try:
            # 获取用户列表和总数
            result = await user_repository.get_users_list(
                db, skip, limit, keyword, page, page_size
            )
            
            # 构造分页响应
            page_data = {
                "items": result["items"],
                "total": result["total"],
                "page": page,
                "page_size": page_size
            }
            
            return page_data
        except Exception as e:
            logger.error(f"获取用户列表服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取用户列表失败: {str(e)}"
            )
    
    async def create_user(
        self, 
        db: AsyncSession, 
        user_data: UserCreate,
        current_user: User
    ) -> User:
        """
        创建新用户
        
        :param db: 数据库会话
        :param user_data: 用户创建数据
        :param current_user: 当前用户
        :return: 创建的用户对象
        """
        try:
            # 检查用户名是否已存在
            username_exists = await user_repository.check_username_exists(db, user_data.username)
            if username_exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="用户名已存在"
                )
            
            # 检查邮箱是否已存在
            if user_data.email:
                email_exists = await user_repository.check_email_exists(db, user_data.email)
                if email_exists:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="邮箱已存在"
                    )
            
            # 检查手机号是否已存在
            if user_data.mobile:
                mobile_exists = await user_repository.check_mobile_exists(db, user_data.mobile)
                if mobile_exists:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="手机号已存在"
                    )
            
            # 准备用户数据
            user_dict = user_data.model_dump(exclude={"password", "role_ids"})
            user_dict["hashed_password"] = get_password_hash(user_data.password)
            role_ids = user_data.role_ids if user_data.role_ids else None
            
            # 创建用户
            user = await user_repository.create_user(db, user_dict, role_ids)
            return user
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"创建用户服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建用户失败: {str(e)}"
            )
    
    async def get_user(
        self, 
        db: AsyncSession, 
        user_id: int,
        current_user: User
    ) -> User:
        """
        获取用户信息
        
        :param db: 数据库会话
        :param user_id: 用户ID
        :param current_user: 当前用户
        :return: 用户对象
        """
        try:
            # 权限检查：
            # 1. 超级管理员可以查看任何用户
            # 2. 用户可以查看自己
            # 3. 具有system:user:query权限的用户可以查看其他用户
            if not current_user.is_superuser and current_user.id != user_id:
                try:
                    # 检查是否有查询用户的权限
                    await check_permissions(db, current_user, ["system:user:query"])
                except HTTPException:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="没有足够的权限"
                    )
            
            # 获取用户
            user = await user_repository.get_user_by_id(db, user_id)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="用户不存在"
                )
                
            return user
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取用户详情服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取用户详情失败: {str(e)}"
            )
    
    async def update_user(
        self, 
        db: AsyncSession, 
        user_id: int,
        user_data: UserUpdate,
        current_user: User
    ) -> User:
        """
        更新用户信息
        
        :param db: 数据库会话
        :param user_id: 用户ID
        :param user_data: 更新数据
        :param current_user: 当前用户
        :return: 更新后的用户对象
        """
        try:
            # 获取用户
            user = await user_repository.get_user_by_id(db, user_id)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="用户不存在"
                )
            
            # 特殊保护：如果是系统初始管理员(username='admin')，则只有超级管理员可以编辑
            if user.username == 'admin' and not current_user.is_superuser:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="只有超级管理员可以编辑系统初始管理员账号"
                )
            
            # 权限检查：
            # 1. 超级管理员可以更新任何用户
            # 2. 用户可以更新自己
            # 3. 具有system:user:update权限的用户可以更新其他用户
            if not current_user.is_superuser and current_user.id != user_id:
                try:
                    # 检查是否有更新用户的权限
                    await check_permissions(db, current_user, ["system:user:update"])
                except HTTPException:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="没有足够的权限"
                    )
            
            # 检查用户名是否已存在
            if user_data.username and user_data.username != user.username:
                username_exists = await user_repository.check_username_exists(
                    db, user_data.username, user_id
                )
                if username_exists:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="用户名已存在"
                    )
            
            # 检查邮箱是否已存在
            if user_data.email and user_data.email != user.email:
                email_exists = await user_repository.check_email_exists(
                    db, user_data.email, user_id
                )
                if email_exists:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="邮箱已存在"
                    )
            
            # 检查手机号是否已存在
            if user_data.mobile and user_data.mobile != user.mobile:
                mobile_exists = await user_repository.check_mobile_exists(
                    db, user_data.mobile, user_id
                )
                if mobile_exists:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="手机号已存在"
                    )
            
            # 准备更新数据
            update_data = user_data.model_dump(exclude_unset=True)
            if "password" in update_data:
                update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
            
            # 更新用户
            updated_user = await user_repository.update_user(db, user, update_data)
            return updated_user
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"更新用户服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新用户失败: {str(e)}"
            )
    
    async def update_user_status(
        self, 
        db: AsyncSession, 
        user_id: int,
        status_data: UserStatusUpdate,
        current_user: User
    ) -> User:
        """
        更新用户状态
        
        :param db: 数据库会话
        :param user_id: 用户ID
        :param status_data: 状态更新数据
        :param current_user: 当前用户
        :return: 更新后的用户对象
        """
        try:
            # 获取用户
            user = await user_repository.get_user_by_id(db, user_id)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="用户不存在"
                )
            
            # 特殊保护：如果目标用户是超级管理员，则只允许其他超级管理员修改其状态
            if user.is_superuser and not current_user.is_superuser:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="没有权限修改管理员用户的状态"
                )
            
            # 特殊保护：如果是系统初始管理员(username='admin')，不允许被禁用
            if user.username == 'admin' and not status_data.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="系统初始管理员账号不能被禁用"
                )
            
            # 自我保护：防止用户禁用自己的账号
            if user_id == current_user.id and not status_data.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="不能禁用自己的账号"
                )
            
            # 更新用户状态
            updated_user = await user_repository.update_user_status(
                db, user, status_data.is_active
            )
            return updated_user
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"更新用户状态服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新用户状态失败: {str(e)}"
            )
    
    async def delete_user(
        self, 
        db: AsyncSession, 
        user_id: int,
        current_user: User
    ) -> str:
        """
        删除用户
        
        :param db: 数据库会话
        :param user_id: 用户ID
        :param current_user: 当前用户
        :return: 成功消息
        """
        try:
            # 获取用户
            user = await user_repository.get_user_by_id(db, user_id)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="用户不存在"
                )
            
            # 特殊保护：如果目标用户是超级管理员，则只允许其他超级管理员删除
            if user.is_superuser and not current_user.is_superuser:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="没有权限删除管理员用户"
                )
            
            # 特殊保护：如果是系统初始管理员(username='admin')，不允许被删除
            if user.username == 'admin':
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="系统初始管理员账号不能被删除"
                )
            
            # 自我保护：防止用户删除自己的账号
            if user_id == current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="不能删除自己的账号"
                )
            
            # 删除用户
            await user_repository.delete_user(db, user)
            return "用户删除成功"
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"删除用户服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除用户失败: {str(e)}"
            )
    
    async def get_user_roles(
        self, 
        db: AsyncSession, 
        user_id: int,
        current_user: User
    ) -> List[Role]:
        """
        获取用户角色
        
        :param db: 数据库会话
        :param user_id: 用户ID
        :param current_user: 当前用户
        :return: 角色列表
        """
        try:
            # 获取用户
            user = await user_repository.get_user_by_id(db, user_id)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="用户不存在"
                )
            
            # 权限检查：
            # 1. 超级管理员可以查看任何用户的角色
            # 2. 用户可以查看自己的角色
            # 3. 具有system:user:query权限的用户可以查看其他用户的角色
            if not current_user.is_superuser and current_user.id != user_id:
                try:
                    # 检查是否有查询用户的权限
                    await check_permissions(db, current_user, ["system:user:query"])
                except HTTPException:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="没有足够的权限"
                    )
            
            # 获取用户角色
            roles = await user_repository.get_user_roles(db, user)
            return roles
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取用户角色服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取用户角色失败: {str(e)}"
            )
    
    async def update_user_roles(
        self, 
        db: AsyncSession, 
        user_id: int,
        roles_data: UserRoleUpdate,
        current_user: User
    ) -> str:
        """
        更新用户角色
        
        :param db: 数据库会话
        :param user_id: 用户ID
        :param roles_data: 角色更新数据
        :param current_user: 当前用户
        :return: 成功消息
        """
        try:
            # 获取用户
            user = await user_repository.get_user_by_id(db, user_id)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="用户不存在"
                )
            
            # 特殊保护：如果是系统初始管理员(username='admin')，则只有超级管理员可以编辑角色
            if user.username == 'admin' and not current_user.is_superuser:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="只有超级管理员可以编辑系统初始管理员的角色"
                )
            
            # 验证所有角色是否存在
            for role_id in roles_data.role_ids:
                role = await db.get(Role, role_id)
                if not role:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"角色ID {role_id} 不存在"
                    )
            
            # 更新用户角色
            await user_repository.update_user_roles(db, user, roles_data.role_ids)
            return "用户角色更新成功"
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"更新用户角色服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新用户角色失败: {str(e)}"
            )


# 创建用户服务实例
user_service = UserService() 