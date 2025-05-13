from typing import List, Optional, Any
from pydantic import BaseModel
from datetime import datetime


class ModuleStructureNodeBase(BaseModel):
    """模块结构节点的基础模型"""
    name: str
    parent_id: Optional[int] = None
    order_index: Optional[int] = 0
    is_content_page: Optional[bool] = False


class ModuleStructureNodeCreate(ModuleStructureNodeBase):
    """创建模块结构节点的请求模型"""
    workspace_id: Optional[int] = None


class ModuleStructureNodeUpdate(BaseModel):
    """更新模块结构节点的请求模型"""
    name: Optional[str] = None
    parent_id: Optional[int] = None
    order_index: Optional[int] = None
    is_content_page: Optional[bool] = None
    workspace_id: Optional[int] = None


class ModuleStructureNodeResponse(ModuleStructureNodeBase):
    """模块结构节点的响应模型"""
    id: int
    user_id: int
    workspace_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    children: List["ModuleStructureNodeResponse"] = []
    has_content: bool = False
    permission_id: Optional[int] = None

    class Config:
        from_attributes = True


# 处理递归类型引用
ModuleStructureNodeResponse.update_forward_refs()


class ModuleTreeResponse(BaseModel):
    """模块结构树的响应模型"""
    items: List[ModuleStructureNodeResponse] 