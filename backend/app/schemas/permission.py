from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime


# 权限基础模型
class PermissionBase(BaseModel):
    code: str
    name: str
    page_path: str
    parent_id: Optional[int] = None
    icon: Optional[str] = None
    sort: Optional[int] = 0
    is_visible: Optional[bool] = True
    description: Optional[str] = None


# 创建权限请求模型
class PermissionCreate(PermissionBase):
    pass


# 更新权限请求模型
class PermissionUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    page_path: Optional[str] = None
    parent_id: Optional[int] = None
    icon: Optional[str] = None
    sort: Optional[int] = None
    is_visible: Optional[bool] = None
    description: Optional[str] = None


# 权限响应模型
class PermissionResponse(PermissionBase):
    id: int
    created_at: datetime
    updated_at: datetime
    workspace_id: Optional[int] = None
    workspace_name: Optional[str] = None
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