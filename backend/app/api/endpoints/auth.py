from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_db, success_response, error_response
from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.schemas.response import APIResponse, LoginResult
from backend.app.schemas.user import UserResponse
from backend.app.services.auth_service import auth_service

router = APIRouter()


@router.post("/login", response_model=APIResponse[LoginResult])
async def login_access_token(
        form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
        db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    用户登录接口
    
    支持使用用户名或手机号登录
    
    返回:
        - 成功: {"success": true, "message": "登录成功", "data": {"access_token": "...", "token_type": "bearer"}}
        - 失败: {"success": false, "message": "错误信息", "error_code": "AUTH_ERROR"}
    """
    try:
        # 调用认证服务进行用户认证
        is_authenticated, user, error_msg = await auth_service.authenticate_user(
            db, form_data.username, form_data.password
        )
        
        # 认证失败
        if not is_authenticated:
            return error_response(
                message=error_msg,
                error_code="AUTH_FAILED"
            )
        
        # 创建访问令牌
        token_data = auth_service.create_user_token(str(user.id))
        
        logger.info(f"用户登录成功: {user.id}")
        return success_response(
            message="登录成功",
            data=token_data
        )
    except Exception as e:
        logger.error(f"登录过程发生错误: {str(e)}")
        return error_response(
            message="登录失败，请稍后重试",
            error_code="AUTH_ERROR"
        )


@router.get("/profile", response_model=APIResponse[UserResponse])
async def read_users_me(
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取当前登录用户信息
    """
    try:
        return success_response(data=current_user)
    except Exception as e:
        logger.error(f"获取用户信息失败: {str(e)}")
        return error_response(message="获取用户信息失败")
