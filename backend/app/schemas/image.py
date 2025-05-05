from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ImageBase(BaseModel):
    """
    图片基础模型
    """
    filename: Optional[str] = None
    file_path: Optional[str] = None
    url: Optional[str] = None
    document_id: Optional[int] = None


class ImageCreate(ImageBase):
    """
    创建图片模型
    """
    filename: str
    document_id: int


class ImageResponse(ImageBase):
    """
    图片响应模型
    """
    id: int
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True
