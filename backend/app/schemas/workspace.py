from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class WorkspaceBase(BaseModel):
    """工作区基础模型"""
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class WorkspaceCreate(WorkspaceBase):
    """创建工作区的请求模型"""
    is_default: bool = False


class WorkspaceUpdate(BaseModel):
    """更新工作区的请求模型"""
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_default: Optional[bool] = None


class WorkspaceResponse(WorkspaceBase):
    """工作区响应模型"""
    id: int
    is_default: bool
    created_by: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkspaceUserBase(BaseModel):
    """工作区用户基础模型"""
    user_id: int
    access_level: str = "read"


class WorkspaceAddUser(WorkspaceUserBase):
    """添加用户到工作区的请求模型"""
    pass


class WorkspaceBatchAddUsers(BaseModel):
    """批量添加用户到工作区的请求模型"""
    user_ids: List[int] = Field(..., description="要批量添加的用户ID列表")
    access_level: str = Field(default="read", description="统一设置的访问级别: read, write, admin")


class WorkspaceBatchRemoveUsers(BaseModel):
    """批量从工作区移除用户的请求模型"""
    user_ids: List[int] = Field(..., description="要批量移除的用户ID列表")


class WorkspaceUserResponse(WorkspaceUserBase):
    """工作区用户响应模型"""
    workspace_id: int
    username: str
    email: Optional[str] = None

    class Config:
        from_attributes = True


class WorkspaceWithUsers(WorkspaceResponse):
    """包含用户列表的工作区响应模型"""
    users: List[WorkspaceUserResponse] = []

    class Config:
        from_attributes = True


class UserDefaultWorkspace(BaseModel):
    """设置用户默认工作区的请求模型"""
    workspace_id: int


class WorkspaceUserRoleUpdate(BaseModel):
    """更新工作区用户角色的请求模型"""
    access_level: str = Field(..., description="用户访问级别: read, write, admin, owner等")