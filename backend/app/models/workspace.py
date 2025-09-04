import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Text, Table
from sqlalchemy.orm import relationship

from backend.app.db.base import Base
from backend.app.db.utils import get_local_time
from backend.app.models.workspace_table import WorkspaceTable
from backend.app.models.workspace_interface import WorkspaceInterface

# 工作区-用户关联表
workspace_user = Table(
    "workspace_user",
    Base.metadata,
    Column("workspace_id", Integer, ForeignKey("workspaces.id"), primary_key=True, comment="关联的工作区ID"),
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True, comment="关联的用户ID"),
    Column("access_level", String(20), default="read", comment="访问级别 (read, write, admin)")
)


class Workspace(Base):
    """工作区模型 - 资料的顶级组织单元"""
    __tablename__ = "workspaces"
    
    id = Column(Integer, primary_key=True, index=True, comment="工作区唯一标识符")
    name = Column(String(100), nullable=False, comment="工作区名称")
    description = Column(Text, nullable=True, comment="工作区描述")
    icon = Column(String(255), nullable=True, comment="工作区图标")
    color = Column(String(20), nullable=True, comment="工作区主题色 (如 #FFFFFF)")
    is_default = Column(Boolean, default=False, comment="是否为用户的默认工作区")
    created_by = Column(Integer, ForeignKey("users.id"), comment="创建者的用户ID")
    created_at = Column(DateTime, default=get_local_time, comment="创建时间")
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time, comment="最后更新时间")
    
    # 关系
    creator = relationship("User", foreign_keys=[created_by], back_populates="created_workspaces")
    users = relationship("User", secondary=workspace_user, back_populates="workspaces")
    module_nodes = relationship("ModuleStructureNode", back_populates="workspace") 
    
    # 使用导入的模型定义关系
    tables = relationship("WorkspaceTable", back_populates="workspace", cascade="all, delete-orphan")
    interfaces = relationship("WorkspaceInterface", back_populates="workspace", cascade="all, delete-orphan")
    module_configs = relationship("WorkspaceModuleConfig", back_populates="workspace", cascade="all, delete-orphan")
    coding_bugs = relationship("CodingBug", back_populates="workspace", cascade="all, delete-orphan")
    coding_config = relationship("WorkspaceCodingConfig", back_populates="workspace", uselist=False, cascade="all, delete-orphan")