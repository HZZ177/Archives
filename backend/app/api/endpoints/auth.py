from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_db
from backend.app.core.config import settings
from backend.app.core.security import create_access_token, verify_password
from backend.app.models.user import User
from backend.app.schemas.token import Token
from backend.app.schemas.user import UserResponse
from backend.app.schemas.response import APIResponse, LoginResult

router = APIRouter()


@router.post("/login", response_model=APIResponse[LoginResult])
async def login_access_token(
        form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
        db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    用户登录接口
    
    返回:
        - 成功: {"success": true, "message": "登录成功", "data": {"access_token": "...", "token_type": "bearer"}}
        - 失败: {"success": false, "message": "错误信息", "error_code": "AUTH_ERROR"}
    """
    # 查询用户
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalar_one_or_none()

    # 验证用户和密码
    if not user or not verify_password(form_data.password, user.hashed_password):
        return APIResponse(
            success=False,
            message="用户名或密码错误",
            error_code="AUTH_FAILED"
        )

    # 验证用户是否激活
    if not user.is_active:
        return APIResponse(
            success=False, 
            message="用户未激活",
            error_code="USER_INACTIVE"
        )

    # 创建访问令牌
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=access_token_expires
    )

    return APIResponse(
        success=True,
        message="登录成功",
        data={
        "access_token": access_token,
        "token_type": "bearer"
    }
    )


@router.get("/profile", response_model=UserResponse)
async def read_users_me(
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取当前登录用户信息
    """
    return current_user
