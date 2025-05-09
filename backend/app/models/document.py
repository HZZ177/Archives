from enum import Enum
import datetime
from typing import List, Optional
from sqlalchemy import Column, DateTime, Integer, String, ForeignKey, Text, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship

from backend.app.db.base import Base
from backend.app.db.utils import get_local_time


class SectionTypeEnum(str, Enum):
    """部分类型枚举"""
    OVERVIEW = "overview"
    FLOW = "flow"
    CONTENT = "content"
    DATABASE = "database"
    API = "api"
    CODE = "code"
    CUSTOM = "custom"


class Document(Base):
    """文档模型"""
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=get_local_time)
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time)

    # 关系
    creator = relationship("User", back_populates="documents")
    template = relationship("Template", back_populates="documents")
    sections = relationship("Section", back_populates="document", cascade="all, delete-orphan")
    images = relationship("Image", back_populates="document", cascade="all, delete-orphan")
    source_relations = relationship(
        "Relation",
        foreign_keys="[Relation.source_id]",
        back_populates="source",
        cascade="all, delete-orphan"
    )
    target_relations = relationship(
        "Relation",
        foreign_keys="[Relation.target_id]",
        back_populates="target",
        cascade="all, delete-orphan"
    )


class Template(Base):
    """模板模型"""
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    structure = Column(Text, nullable=True)  # JSON字符串
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=get_local_time)
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time)

    # 关系
    creator = relationship("User", back_populates="templates")
    documents = relationship("Document", back_populates="template")


class Section(Base):
    """部分模型"""
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(100), nullable=False)
    content = Column(Text, nullable=True)
    type = Column(SQLEnum(SectionTypeEnum), default=SectionTypeEnum.CONTENT)
    order = Column(Integer, default=0)
    created_at = Column(DateTime, default=get_local_time)
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time)

    # 关系
    document = relationship("Document", back_populates="sections")
    images = relationship("Image", back_populates="section", cascade="all, delete-orphan")


class Image(Base):
    """图片模型"""
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id", ondelete="SET NULL"), nullable=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(255), nullable=False)
    url = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=get_local_time)

    # 关系
    document = relationship("Document", back_populates="images")
    section = relationship("Section", back_populates="images")


class Relation(Base):
    """关系模型"""
    __tablename__ = "relations"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    target_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    relation_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=get_local_time)

    # 关系
    source = relationship("Document", foreign_keys=[source_id], back_populates="source_relations")
    target = relationship("Document", foreign_keys=[target_id], back_populates="target_relations")
