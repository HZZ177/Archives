import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, JSON
from sqlalchemy.orm import relationship

from backend.app.db.base import Base
from backend.app.db.utils import get_local_time


class WorkspaceTable(Base):
    """工作区数据库表模型，用于在工作区级别统一管理数据库表"""
    __tablename__ = "workspace_tables"
    
    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    table_name = Column(String(255), nullable=False)
    schema_name = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    columns_json = Column(JSON, nullable=False)  # 存储字段信息
    relationships_json = Column(JSON, nullable=True)  # 存储关系信息
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # 最后修改者
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)  # 创建者
    created_at = Column(DateTime, default=get_local_time)
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time)
    
    # 关系
    workspace = relationship("Workspace", back_populates="tables")
    last_editor = relationship("User", foreign_keys=[user_id])
    creator = relationship("User", foreign_keys=[created_by]) 