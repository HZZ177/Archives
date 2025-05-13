from typing import Generic, TypeVar, Optional, Any
from pydantic import BaseModel

# 定义泛型类型变量T，表示响应数据的类型
T = TypeVar('T')

class APIResponse(BaseModel, Generic[T]):
    """
    统一API响应格式
    """
    success: bool = True  # 请求是否成功
    message: str = "操作成功"  # 响应消息
    data: Optional[T] = None  # 响应数据，泛型类型
    error_code: Optional[str] = None  # 错误代码，仅在success=False时有值

class LoginResult(BaseModel):
    """
    登录成功的响应数据格式
    """
    access_token: str
    token_type: str
    need_change_password: Optional[bool] = False  # 是否需要修改密码 