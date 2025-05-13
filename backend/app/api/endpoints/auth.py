from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_db, success_response, error_response
from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.schemas.response import APIResponse, LoginResult
from backend.app.schemas.user import UserResponse, ChangePasswordRequest
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
        - 成功: {"success": true, "message": "登录成功", "data": {"access_token": "...", "token_type": "bearer", "need_change_password": false}}
        - 失败: {"success": false, "message": "错误信息", "error_code": "AUTH_ERROR"}
    """
    try:
        # 调用认证服务进行用户认证
        is_authenticated, user, error_msg, need_change_password = await auth_service.authenticate_user(
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
        
        # 添加是否需要修改密码的标志
        token_data["need_change_password"] = need_change_password
        
        logger.info(f"用户登录成功: {user.id}, 是否需要修改密码: {need_change_password}")
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


@router.post("/change-password", response_model=APIResponse)
async def change_password(
        password_data: ChangePasswordRequest,
        current_user: Annotated[User, Depends(get_current_active_user)],
        db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    修改用户密码
    
    说明:
    - 首次登录时，可以设置is_first_login=true，此时不需要提供旧密码
    - 非首次登录时，需要提供旧密码
    - 新密码不能与手机号相同
    
    返回:
    - 成功: {"success": true, "message": "密码修改成功"}
    - 失败: {"success": false, "message": "错误信息"}
    """
    try:
        # 修改密码
        await auth_service.change_password(
            db=db,
            user_id=current_user.id,
            password_data=password_data
        )
        
        return success_response(message="密码修改成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"修改密码失败: {str(e)}")
        return error_response(message=f"修改密码失败: {str(e)}")
