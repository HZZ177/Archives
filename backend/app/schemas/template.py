from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class TemplateBase(BaseModel):
    """
    模板基础模型
    """
    name: Optional[str] = None
    description: Optional[str] = None
    structure: Optional[Dict] = None


class TemplateCreate(TemplateBase):
    """
    创建模板模型
    """
    name: str
    structure: Dict


class TemplateUpdate(TemplateBase):
    """
    更新模板模型
    """
    pass


class TemplateResponse(TemplateBase):
    """
    模板响应模型
    """
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True
        from_attributes = True 