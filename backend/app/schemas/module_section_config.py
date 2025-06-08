from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class ModuleSectionConfigBase(BaseModel):
    """模块配置基础模型"""
    section_key: str
    section_name: str
    section_icon: str
    section_type: int = 0
    is_enabled: bool = True
    display_order: int

class ModuleSectionConfigCreate(ModuleSectionConfigBase):
    """创建模块配置模型"""
    pass

class ModuleSectionConfigUpdate(ModuleSectionConfigBase):
    """更新模块配置模型"""
    id: int
    section_key: Optional[str] = None
    section_name: Optional[str] = None
    section_icon: Optional[str] = None
    section_type: Optional[int] = None
    is_enabled: Optional[bool] = None
    display_order: Optional[int] = None

class ModuleSectionConfigResponse(ModuleSectionConfigBase):
    """模块配置响应模型"""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True 