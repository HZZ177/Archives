from typing import Generator, Optional, Annotated, List
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


async def get_current_user(
        db: Annotated[AsyncSession, Depends(get_db)],
        token: Annotated[str, Depends(oauth2_scheme)]
) -> User:
    """
    获取当前用户
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        token_data = TokenPayload(user_id=user_id)
    except JWTError:
        raise credentials_exception

    # 根据ID获取用户
    user = await db.get(User, token_data.user_id)
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(
        current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """
    获取当前活动用户
    """
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="用户未激活")
    return current_user


async def get_current_admin_user(
        current_user: Annotated[User, Depends(get_current_active_user)]
) -> User:
    """
    获取当前管理员用户
    """
    if not current_user.is_superuser:
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
        User.id == user.id
    ).options(
        joinedload(Role.permissions)
    )
    
    result = await db.execute(stmt)
    roles = result.unique().scalars().all()
    
    permissions = []
    for role in roles:
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
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"权限不足：缺少 {permission} 权限"
            )
    return True
