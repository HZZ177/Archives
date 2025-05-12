from datetime import timedelta
from typing import Optional, Tuple, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from backend.app.core.security import verify_password, create_access_token
from backend.app.core.config import settings
from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.repositories.auth_repository import auth_repository


class AuthService:
    """
    认证相关的业务逻辑服务
    """
    
    async def authenticate_user(
        self, 
        db: AsyncSession, 
        username_or_mobile: str, 
        password: str
    ) -> Tuple[bool, Optional[User], Optional[str]]:
        """
        用户认证
        
        :param db: 数据库会话
        :param username_or_mobile: 用户名或手机号
        :param password: 密码
        :return: (认证成功标志, 用户对象, 错误消息)
        """
        try:
            # 查询用户
            user = await auth_repository.get_by_username_or_mobile(db, username_or_mobile)
            
            # 验证用户和密码
            if not user or not verify_password(password, user.hashed_password):
                logger.warning(f"登录失败: 用户名/手机号或密码错误 - {username_or_mobile}")
                return False, None, "用户名/手机号或密码错误"
            
            # 验证用户是否激活
            if not user.is_active:
                logger.warning(f"登录失败: 用户未激活 - {user.id}")
                return False, None, "用户未激活"
                
            return True, user, None
            
        except Exception as e:
            logger.error(f"用户认证过程发生错误: {str(e)}")
            return False, None, "认证过程发生错误"
    
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