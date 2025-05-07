from typing import List, Optional
from pydantic import BaseModel, EmailStr, validator, Field
from datetime import datetime


# 角色基础模型
class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None


# 创建角色时的模型
class RoleCreate(RoleBase):
    pass


# 更新角色时的模型
class RoleUpdate(RoleBase):
    name: Optional[str] = None


# 角色的数据库表示
class RoleInDB(RoleBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# 返回给API的角色模型
class Role(RoleInDB):
    pass


# 共享属性
class UserBase(BaseModel):
    """
    用户基础信息
    """
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = True
    is_superuser: Optional[bool] = False


# 创建用户时需要的属性
class UserCreate(UserBase):
    """
    创建用户模型
    """
    username: str
    password: str
    email: Optional[EmailStr] = None
    role_ids: Optional[List[int]] = None


# 更新用户时可以修改的属性
class UserUpdate(UserBase):
    """
    更新用户模型
    """
    password: Optional[str] = None


# 数据库中存储的用户模型
class UserInDB(UserBase):
    """
    数据库用户模型
    """
    id: int
    hashed_password: str

    class Config:
        orm_mode = True


# API响应中返回的用户模型
class UserResponse(UserBase):
    """
    用户响应模型
    """
    id: int

    class Config:
        orm_mode = True
        from_attributes = True


# 用户登录模型
class UserLogin(BaseModel):
    """用户登录请求模型"""
    username: str
    password: str


# 令牌模型
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# 令牌载荷模型
class TokenPayload(BaseModel):
    sub: Optional[int] = None


# 用户分页响应模型
class UserPage(BaseModel):
    items: List[UserResponse]
    total: int


class UserDetail(UserResponse):
    """用户详情响应模型"""
    roles: List[str] = []

    class Config:
        orm_mode = True
