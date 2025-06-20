from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime

from backend.app.schemas.module_content import ApiInterface, ApiInterfaceParameter


class WorkspaceInterfaceBase(BaseModel):
    """工作区API接口基础模型"""
    path: str
    method: str
    description: Optional[str] = None
    content_type: Optional[str] = None
    request_params_json: Optional[List[Dict[str, Any]]] = None  # 请求参数，与ApiInterfaceParameter兼容
    response_params_json: Optional[List[Dict[str, Any]]] = None  # 响应参数，与ApiInterfaceParameter兼容


class WorkspaceInterfaceCreate(WorkspaceInterfaceBase):
    """创建工作区API接口的请求模型"""
    workspace_id: int


class WorkspaceInterfaceUpdate(WorkspaceInterfaceBase):
    """更新工作区API接口的请求模型"""
    pass


class WorkspaceInterfaceInDB(WorkspaceInterfaceBase):
    """数据库中的工作区API接口模型"""
    id: int
    workspace_id: int
    user_id: int
    created_by: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class WorkspaceInterfaceResponse(WorkspaceInterfaceInDB):
    """工作区API接口的响应模型"""
    pass


class WorkspaceInterfaceDetail(WorkspaceInterfaceResponse):
    """带有完整参数信息的工作区API接口详情"""
    request_params: List[ApiInterfaceParameter]  # 转换后的请求参数
    response_params: List[ApiInterfaceParameter]  # 转换后的响应参数

    class Config:
        orm_mode = True 