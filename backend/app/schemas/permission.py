from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime


# 权限基础模型
class PermissionBase(BaseModel):
    code: str
    name: str
    type: str
    parent_id: Optional[int] = None
    path: Optional[str] = None
    component: Optional[str] = None
    permission: Optional[str] = None
    icon: Optional[str] = None
    sort: Optional[int] = 0
    visible: Optional[bool] = True


# 创建权限请求模型
class PermissionCreate(PermissionBase):
    pass


# 更新权限请求模型
class PermissionUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    type: Optional[str] = None
    parent_id: Optional[int] = None
    path: Optional[str] = None
    component: Optional[str] = None
    permission: Optional[str] = None
    icon: Optional[str] = None
    sort: Optional[int] = None
    visible: Optional[bool] = None


# 权限响应模型
class PermissionResponse(PermissionBase):
    id: int
    created_at: datetime
    updated_at: datetime
    children: Optional[List['PermissionResponse']] = []

    class Config:
        from_attributes = True


# 树形权限响应模型
class PermissionTree(PermissionResponse):
    children: List['PermissionTree'] = []


# 更新角色权限
class RolePermissionUpdate(BaseModel):
    permission_ids: List[int]


# 用于解决循环引用问题
PermissionResponse.model_rebuild()
PermissionTree.model_rebuild() 