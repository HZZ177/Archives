from datetime import datetime, timedelta
from typing import Any, Union, Optional, List

from jose import jwt
from passlib.context import CryptContext

from backend.app.core.config import settings

# 密码加密上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT相关
ALGORITHM = "HS256"


def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    创建访问令牌
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    验证密码
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    获取密码哈希
    """
    return pwd_context.hash(password)


def has_permission(user_permissions: List[str], required_permission: str) -> bool:
    """
    检查用户是否拥有指定权限
    
    :param user_permissions: 用户拥有的权限列表
    :param required_permission: 需要检查的权限
    :return: 是否拥有权限
    """
    # 超级管理员拥有所有权限
    if "*:*:*" in user_permissions:
        return True
    
    # 检查具体权限
    if required_permission in user_permissions:
        return True
    
    # 支持通配符
    parts = required_permission.split(":")
    if len(parts) == 3:
        # 检查模块级别权限 module:*:*
        module_wildcard = f"{parts[0]}:*:*"
        if module_wildcard in user_permissions:
            return True
        
        # 检查操作级别权限 module:operation:*
        operation_wildcard = f"{parts[0]}:{parts[1]}:*"
        if operation_wildcard in user_permissions:
            return True
    
    return False
