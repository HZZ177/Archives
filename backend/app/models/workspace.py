import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Text, Table
from sqlalchemy.orm import relationship

from backend.app.db.base import Base
from backend.app.db.utils import get_local_time

# 工作区-用户关联表
workspace_user = Table(
    "workspace_user",
    Base.metadata,
    Column("workspace_id", Integer, ForeignKey("workspaces.id"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("access_level", String(20), default="read")  # 可选值: read, write, admin
)


class Workspace(Base):
    """工作区模型 - 资料的顶级组织单元"""
    __tablename__ = "workspaces"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(255), nullable=True)  # 图标URL或图标名称
    color = Column(String(20), nullable=True)  # 主题色，格式如 #FFFFFF
    is_default = Column(Boolean, default=False)  # 是否为系统默认工作区
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=get_local_time)
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time)
    
    # 关系
    creator = relationship("User", foreign_keys=[created_by], back_populates="created_workspaces")
    users = relationship("User", secondary=workspace_user, back_populates="workspaces")
    module_nodes = relationship("ModuleStructureNode", back_populates="workspace") 
    tables = relationship("WorkspaceTable", back_populates="workspace", cascade="all, delete-orphan")
    interfaces = relationship("WorkspaceInterface", back_populates="workspace", cascade="all, delete-orphan") 