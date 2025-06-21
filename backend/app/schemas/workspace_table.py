from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime

from backend.app.schemas.module_content import DatabaseTable, DatabaseTableColumn


class WorkspaceTableBase(BaseModel):
    """工作区数据库表基础模型"""
    name: str
    schema_name: Optional[str] = None
    description: Optional[str] = None
    columns_json: List[Dict[str, Any]]  # 字段信息，与DatabaseTableColumn兼容
    relationships_json: Optional[List[Dict[str, Any]]] = None  # 表关系信息


class WorkspaceTableCreate(WorkspaceTableBase):
    """创建工作区数据库表的请求模型"""
    workspace_id: int


class WorkspaceTableUpdate(WorkspaceTableBase):
    """更新工作区数据库表的请求模型"""
    pass


class WorkspaceTableInDB(WorkspaceTableBase):
    """数据库中的工作区数据库表模型"""
    id: int
    workspace_id: int
    user_id: int
    created_by: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class WorkspaceTableResponse(WorkspaceTableInDB):
    """工作区数据库表的响应模型"""
    pass


class WorkspaceTableDetail(WorkspaceTableResponse):
    """带有完整字段信息的工作区数据库表详情"""
    columns: List[DatabaseTableColumn]  # 转换后的字段信息

    class Config:
        orm_mode = True 