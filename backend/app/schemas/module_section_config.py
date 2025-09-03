from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

# 全局模块配置相关Schema
class ModuleSectionConfigBase(BaseModel):
    """模块配置基础模型"""
    section_key: str
    section_name: str
    section_icon: str
    section_type: int = 0
    display_order: int

class ModuleSectionConfigCreate(ModuleSectionConfigBase):
    """创建模块配置模型"""
    pass

class ModuleSectionConfigUpdate(BaseModel):
    """更新模块配置模型"""
    id: int
    section_key: Optional[str] = None
    section_name: Optional[str] = None
    section_icon: Optional[str] = None
    section_type: Optional[int] = None
    display_order: Optional[int] = None

class ModuleSectionConfigResponse(ModuleSectionConfigBase):
    """模块配置响应模型"""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

# 工作区模块配置相关Schema
class WorkspaceModuleConfigBase(BaseModel):
    """工作区模块配置基础模型"""
    workspace_id: int
    section_key: str
    is_enabled: bool = True
    display_order: int

class WorkspaceModuleConfigCreate(WorkspaceModuleConfigBase):
    """创建工作区模块配置模型"""
    pass

class WorkspaceModuleConfigUpdate(BaseModel):
    """更新工作区模块配置模型"""
    id: int
    is_enabled: Optional[bool] = None
    display_order: Optional[int] = None

class WorkspaceModuleConfigResponse(WorkspaceModuleConfigBase):
    """工作区模块配置响应模型"""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# 组合响应模型（用于前端显示）
class ModuleConfigForWorkspaceResponse(BaseModel):
    """工作区模块配置组合响应模型"""
    id: int  # workspace_module_config的id
    section_key: str
    section_name: str
    section_icon: str
    section_type: int
    is_enabled: bool
    display_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True