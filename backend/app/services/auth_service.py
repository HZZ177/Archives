from datetime import timedelta
from typing import Optional, Tuple, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from backend.app.core.security import verify_password, create_access_token, get_password_hash
from backend.app.core.config import settings
from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.repositories.auth_repository import auth_repository
from backend.app.schemas.user import ChangePasswordRequest


class AuthService:
    """
    认证相关的业务逻辑服务
    """
    
    async def authenticate_user(
        self, 
        db: AsyncSession, 
        username_or_mobile: str, 
        password: str
    ) -> Tuple[bool, Optional[User], Optional[str], Optional[bool]]:
        """
        用户认证
        
        :param db: 数据库会话
        :param username_or_mobile: 用户名或手机号
        :param password: 密码
        :return: (认证成功标志, 用户对象, 错误消息, 是否需要修改密码)
        """
        try:
            # 查询用户
            user = await auth_repository.get_by_username_or_mobile(db, username_or_mobile)
            
            # 验证用户和密码
            if not user or not verify_password(password, user.hashed_password):
                logger.warning(f"登录失败: 用户名/手机号或密码错误 - {username_or_mobile}")
                return False, None, "用户名/手机号或密码错误", None
            
            # 验证用户是否激活
            if not user.is_active:
                logger.warning(f"登录失败: 用户未激活 - {user.id}")
                return False, None, "用户未激活", None
            
            # 检查密码是否与手机号相同
            need_change_password = False
            if user.mobile:
                need_change_password = await self.check_password_match_mobile(user, password)
                
            return True, user, None, need_change_password
            
        except Exception as e:
            logger.error(f"用户认证过程发生错误: {str(e)}")
            return False, None, "认证过程发生错误", None
    
    async def check_password_match_mobile(self, user: User, password: str) -> bool:
        """
        检查密码是否与手机号匹配
        
        :param user: 用户对象
        :param password: 明文密码
        :return: 密码是否与手机号匹配
        """
        try:
            # 如果没有手机号，则无法比较
            if not user.mobile:
                return False
                
            # 检查密码是否与手机号相同
            return password == user.mobile
        except Exception as e:
            logger.error(f"检查密码是否与手机号匹配失败: {str(e)}")
            return False
    
    async def change_password(
        self,
        db: AsyncSession,
        user_id: int,
        password_data: ChangePasswordRequest
    ) -> bool:
        """
        修改用户密码
        
        :param db: 数据库会话
        :param user_id: 用户ID
        :param password_data: 密码修改数据
        :return: 是否成功修改密码
        """
        try:
            # 获取用户
            user = await auth_repository.get_user_by_id(db, user_id)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="用户不存在"
                )
            
            # 如果不是首次登录模式，则验证旧密码
            if not password_data.is_first_login:
                if not password_data.old_password:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="旧密码不能为空"
                    )
                
                # 验证旧密码
                if not verify_password(password_data.old_password, user.hashed_password):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="旧密码不正确"
                    )
            
            # 检查新密码是否与手机号相同
            if user.mobile and password_data.new_password == user.mobile:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="新密码不能与手机号相同"
                )
            
            # 更新密码
            new_hashed_password = get_password_hash(password_data.new_password)
            await auth_repository.update_password(db, user, new_hashed_password)
            
            return True
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"修改密码失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"修改密码失败: {str(e)}"
            )
    
    def create_user_token(self, user_id: str) -> Dict[str, Any]:
        """
        创建用户访问令牌
        
        :param user_id: 用户ID
        :return: 包含token信息的字典
        """
        try:
            access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
            access_token = create_access_token(
                subject=user_id,
                expires_delta=access_token_expires
            )
            
            return {
                "access_token": access_token,
                "token_type": "bearer"
            }
            
        except Exception as e:
            logger.error(f"创建用户令牌失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="创建访问令牌失败"
            )


# 创建认证服务实例
auth_service = AuthService() 