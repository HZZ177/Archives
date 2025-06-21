import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, JSON
from sqlalchemy.orm import relationship

from backend.app.db.base import Base
from backend.app.db.utils import get_local_time


class WorkspaceInterface(Base):
    """工作区API接口模型，用于在工作区级别统一管理API接口"""
    __tablename__ = "workspace_interfaces"
    
    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    path = Column(String(255), nullable=False)
    method = Column(String(10), nullable=False)  # GET, POST, PUT, DELETE等
    description = Column(Text, nullable=True)
    content_type = Column(String(100), nullable=True)
    request_params_json = Column(JSON, nullable=True)  # 请求参数
    response_params_json = Column(JSON, nullable=True)  # 响应参数
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # 最后修改者，设置为可为空
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)  # 创建者
    created_at = Column(DateTime, default=get_local_time)
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time)
    
    # 关系
    workspace = relationship("Workspace", back_populates="interfaces")
    last_editor = relationship("User", foreign_keys=[user_id])
    creator = relationship("User", foreign_keys=[created_by]) 