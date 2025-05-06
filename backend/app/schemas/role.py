from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from backend.app.schemas.permission import PermissionResponse


# 角色基础模型
class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_default: Optional[bool] = False
    status: Optional[bool] = True


# 创建角色请求模型
class RoleCreate(RoleBase):
    pass


# 更新角色请求模型
class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_default: Optional[bool] = None
    status: Optional[bool] = None


# 角色响应模型
class RoleResponse(RoleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# 带权限的角色响应模型
class RoleWithPermissions(RoleResponse):
    permissions: List[PermissionResponse] = []


# 用户分配角色
class UserRoleUpdate(BaseModel):
    role_ids: List[int] 