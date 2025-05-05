from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field
from datetime import datetime

from backend.app.models.document import SectionTypeEnum


# 图片基础模型
class ImageBase(BaseModel):
    original_name: str
    file_path: str
    mime_type: str
    file_size: int


# 创建图片时的模型
class ImageCreate(ImageBase):
    pass


# 更新图片时的模型
class ImageUpdate(ImageBase):
    pass


# 图片的数据库表示
class ImageInDB(ImageBase):
    id: int
    section_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# 返回给API的图片模型
class Image(ImageInDB):
    pass


# 部分基础模型
class SectionBase(BaseModel):
    """
    部分基础模型
    """
    title: Optional[str] = None
    content: Optional[str] = None
    order: Optional[int] = 0


class SectionCreate(SectionBase):
    """
    创建部分模型
    """
    title: str


class SectionUpdate(SectionBase):
    """
    更新部分模型
    """
    pass


class SectionResponse(SectionBase):
    """
    部分响应模型
    """
    id: int
    document_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True
        from_attributes = True


# 关联基础模型
class RelationBase(BaseModel):
    target_doc_id: int
    relation_type: str
    description: Optional[str] = None


# 创建关联时的模型
class RelationCreate(RelationBase):
    pass


# 更新关联时的模型
class RelationUpdate(RelationBase):
    pass


# 关联的数据库表示
class RelationInDB(RelationBase):
    id: int
    source_doc_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# 返回给API的关联模型
class Relation(RelationInDB):
    target_doc_title: Optional[str] = None


# 模板基础模型
class TemplateBase(BaseModel):
    name: str
    description: Optional[str] = None


# 创建模板时的模型
class TemplateCreate(TemplateBase):
    pass


# 更新模板时的模型
class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


# 模板的数据库表示
class TemplateInDB(TemplateBase):
    id: int
    created_by: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# 返回给API的模板模型
class Template(TemplateInDB):
    pass


# 文档基础模型
class DocumentBase(BaseModel):
    """
    文档基础模型
    """
    title: Optional[str] = None
    description: Optional[str] = None
    template_id: Optional[int] = None


class DocumentCreate(DocumentBase):
    """
    创建文档模型
    """
    title: str


class DocumentUpdate(DocumentBase):
    """
    更新文档模型
    """
    pass


class DocumentResponse(DocumentBase):
    """
    文档响应模型
    """
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    sections: List[SectionResponse] = []
    
    class Config:
        orm_mode = True
        from_attributes = True


# 返回给API的文档详情模型
class DocumentDetail(DocumentResponse):
    sections: List[SectionResponse] = []
    source_relations: List[Relation] = []


# 文档分页响应模型
class DocumentPage(BaseModel):
    items: List[DocumentResponse]
    total: int


# 模板分页响应模型
class TemplatePage(BaseModel):
    items: List[Template]
    total: int 