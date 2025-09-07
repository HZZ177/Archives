from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

from backend.app.schemas.module_content import DatabaseTableColumn, TableRelationship
from backend.app.schemas.user import UserSimpleRead


# 定义ApiParam模型，因为module_content中没有这个模型
class ApiParam(BaseModel):
    """API参数模型"""
    name: str
    type: str
    required: bool = False
    description: Optional[str] = None
    example: Optional[str] = None
    children: Optional[List['ApiParam']] = None


class WorkspaceBase(BaseModel):
    """工作区基础模型"""
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_default: Optional[bool] = False


class WorkspaceCreate(WorkspaceBase):
    """创建工作区请求模型"""
    pass


class WorkspaceUpdate(BaseModel):
    """更新工作区请求模型"""
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_default: Optional[bool] = None
    default_prompt_template_id: Optional[int] = None


class WorkspaceInDB(WorkspaceBase):
    """数据库中的工作区模型"""
    id: int
    created_by: int
    created_at: datetime
    updated_at: datetime
    default_prompt_template_id: Optional[int] = None

    class Config:
        orm_mode = True


class Workspace(WorkspaceInDB):
    """工作区响应模型"""
    pass


# 工作区表模型
class WorkspaceTableBase(BaseModel):
    """工作区表基础模型"""
    name: str
    schema_name: Optional[str] = None
    description: Optional[str] = None
    columns_json: List[DatabaseTableColumn]
    relationships_json: Optional[List[TableRelationship]] = None


class WorkspaceTableCreate(WorkspaceTableBase):
    """创建工作区表请求模型"""
    workspace_id: int


class WorkspaceTableUpdate(BaseModel):
    """更新工作区表请求模型"""
    name: Optional[str] = None
    schema_name: Optional[str] = None
    description: Optional[str] = None
    columns_json: Optional[List[DatabaseTableColumn]] = None
    relationships_json: Optional[List[TableRelationship]] = None


class WorkspaceTableInDB(WorkspaceTableBase):
    """数据库中的工作区表模型"""
    id: int
    workspace_id: int
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkspaceTable(WorkspaceTableInDB):
    """工作区表响应模型"""
    pass


class WorkspaceTableRead(WorkspaceTableBase):
    """用于读取的工作区表响应模型，包含创建者信息"""
    id: int
    created_at: datetime
    updated_at: datetime
    creator: Optional[UserSimpleRead] = None

    class Config:
        from_attributes = True


# 工作区接口模型
class WorkspaceInterfaceBase(BaseModel):
    """工作区接口基础模型"""
    path: str
    method: str
    description: Optional[str] = None
    content_type: Optional[str] = None
    request_params_json: Optional[List[ApiParam]] = None
    response_params_json: Optional[List[ApiParam]] = None
    request_example: Optional[str] = None  # 请求示例
    response_example: Optional[str] = None  # 响应示例


class WorkspaceInterfaceCreate(WorkspaceInterfaceBase):
    """创建工作区接口请求模型"""
    workspace_id: int


class WorkspaceInterfaceUpdate(BaseModel):
    """更新工作区接口请求模型"""
    path: Optional[str] = None
    method: Optional[str] = None
    description: Optional[str] = None
    content_type: Optional[str] = None
    request_params_json: Optional[List[ApiParam]] = None
    response_params_json: Optional[List[ApiParam]] = None
    request_example: Optional[str] = None  # 请求示例
    response_example: Optional[str] = None  # 响应示例


class WorkspaceInterfaceInDB(WorkspaceInterfaceBase):
    """数据库中的工作区接口模型"""
    id: int
    workspace_id: int
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkspaceInterface(WorkspaceInterfaceInDB):
    """工作区接口响应模型"""
    pass


# 添加WorkspaceResponse别名以保持向后兼容
WorkspaceResponse = Workspace


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