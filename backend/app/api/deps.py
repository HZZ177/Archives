from typing import Generator, Optional, Annotated, List, TypeVar, Any, Dict, Callable
from functools import wraps

from jose import jwt, JWTError
from pydantic import ValidationError
from fastapi import Depends, HTTPException, status, Security
from fastapi.security import OAuth2PasswordBearer

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload, joinedload

from backend.app.db.session import SessionLocal, get_db
from backend.app.core.config import settings
from backend.app.core.security import ALGORITHM, has_permission
from backend.app.models.user import User, Role
from backend.app.models.permission import Permission
from backend.app.schemas.token import TokenPayload
from backend.app.schemas.response import APIResponse
from backend.app.core.logger import logger

# OAuth2 认证相关
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


async def get_db() -> AsyncSession:
    """
    获取数据库会话
    """
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# Repository和Service依赖函数
def get_repository(repo_type: Callable):
    """
    获取Repository实例的依赖函数
    
    :param repo_type: Repository类型
    :return: Repository实例
    """
    def _get_repo():
        return repo_type()
    return _get_repo


def get_service(service_type: Callable):
    """
    获取Service实例的依赖函数
    
    :param service_type: Service类型
    :return: Service实例
    """
    def _get_service():
        return service_type()
    return _get_service


async def get_current_user(
        db: Annotated[AsyncSession, Depends(get_db)],
        token: Annotated[str, Depends(oauth2_scheme)]
) -> User:
    """
    获取当前用户
    """
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise JWTError("无效的token")
        token_data = TokenPayload(user_id=user_id)
    except JWTError:
        logger.error("Token验证失败")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无法验证凭据",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 根据ID获取用户
    user = await db.get(User, token_data.user_id)
    if user is None:
        logger.error(f"用户不存在: {token_data.user_id}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def get_current_active_user(
        current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """
    获取当前活动用户
    """
    if not current_user.is_active:
        logger.error(f"用户未激活: {current_user.id}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户未激活"
        )
    return current_user


async def get_current_admin_user(
        current_user: Annotated[User, Depends(get_current_active_user)]
) -> User:
    """
    获取当前管理员用户
    """
    if not current_user.is_superuser:
        logger.error(f"权限不足: {current_user.id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足"
        )
    return current_user


async def get_user_permissions(
        db: AsyncSession, 
        user: User
) -> List[str]:
    """
    获取用户的所有权限
    
    :param db: 数据库会话
    :param user: 用户对象
    :return: 权限代码列表
    """
    # 超级管理员拥有所有权限
    if user.is_superuser:
        return ["*:*:*"]
    
    # 查询用户角色和权限
    stmt = select(Role).join(
        Role.users
    ).filter(
        User.id == user.id,
        Role.status == True  # 只获取启用状态的角色
    ).options(
        joinedload(Role.permissions)
    )
    
    result = await db.execute(stmt)
    roles = result.unique().scalars().all()
    
    permissions = []
    for role in roles:
        # 记录日志，便于调试
        logger.debug(f"用户 {user.id} 拥有角色 {role.id}:{role.name} (状态: {role.status})")
        for perm in role.permissions:
            if perm.code and perm.code not in permissions:
                permissions.append(perm.code)
    
    return permissions


def require_permissions(required_permissions: List[str]):
    """
    权限检查装饰器
    
    :param required_permissions: 需要的权限列表
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # 获取当前用户
            for name, value in kwargs.items():
                if isinstance(value, User):
                    user = value
                    break
            else:
                logger.error("无法获取当前用户")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="无法获取当前用户"
                )
            
            # 获取数据库会话
            for name, value in kwargs.items():
                if isinstance(value, AsyncSession):
                    db = value
                    break
            else:
                logger.error("无法获取数据库会话")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="无法获取数据库会话"
                )
            
            # 超级管理员拥有所有权限
            if user.is_superuser:
                return await func(*args, **kwargs)
            
            # 检查权限
            user_permissions = await get_user_permissions(db, user)
            for permission in required_permissions:
                if not has_permission(user_permissions, permission):
                    logger.error(f"权限不足: {user.id} 缺少 {permission} 权限")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"权限不足：缺少 {permission} 权限"
                    )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


async def check_permissions(db: AsyncSession, user: User, required_permissions: List[str]):
    """
    直接检查用户权限
    
    :param db: 数据库会话
    :param user: 用户对象
    :param required_permissions: 需要的权限列表
    :raises: HTTPException 如果用户没有所需权限
    """
    # 超级管理员拥有所有权限
    if user.is_superuser:
        return True
    
    # 检查权限
    user_permissions = await get_user_permissions(db, user)
    for permission in required_permissions:
        if not has_permission(user_permissions, permission):
            logger.error(f"权限不足: {user.id} 缺少 {permission} 权限")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"权限不足：缺少 {permission} 权限"
            )
    return True


def success_response(data: Any = None, message: str = "操作成功") -> APIResponse:
    """
    成功响应
    """
    return APIResponse(
        success=True,
        message=message,
        data=data
    )


def error_response(message: str, error_code: str = None) -> APIResponse:
    """
    错误响应
    """
    return APIResponse(
        success=False,
        message=message,
        error_code=error_code
    )
