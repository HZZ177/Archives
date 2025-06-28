import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, JSON
from sqlalchemy.orm import relationship

from backend.app.db.base import Base
from backend.app.db.utils import get_local_time


class WorkspaceTable(Base):
    """工作区数据库表模型，用于在工作区级别统一管理数据库表"""
    __tablename__ = "workspace_tables"
    
    id = Column(Integer, primary_key=True, index=True, comment="表唯一标识符")
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, comment="所属工作区ID")
    name = Column(String(255), nullable=False, comment="表名称")
    schema_name = Column(String(255), nullable=True, comment="数据库模式名称")
    description = Column(Text, nullable=True, comment="表描述")
    columns_json = Column(JSON, nullable=False, comment="存储表列定义信息的JSON数组")
    relationships_json = Column(JSON, nullable=True, comment="存储表关系信息的JSON数组")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, comment="最后修改者的用户ID")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, comment="创建者的用户ID")
    created_at = Column(DateTime, default=get_local_time, comment="创建时间")
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time, comment="最后更新时间")
    
    # 关系
    workspace = relationship("Workspace", back_populates="tables")
    last_editor = relationship("User", foreign_keys=[user_id])
    creator = relationship("User", foreign_keys=[created_by]) 