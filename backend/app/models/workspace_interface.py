import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, JSON
from sqlalchemy.orm import relationship

from backend.app.db.base import Base
from backend.app.db.utils import get_local_time


class WorkspaceInterface(Base):
    """工作区API接口模型，用于在工作区级别统一管理API接口"""
    __tablename__ = "workspace_interfaces"
    
    id = Column(Integer, primary_key=True, index=True, comment="接口唯一标识符")
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, comment="所属工作区ID")
    path = Column(String(255), nullable=False, comment="接口请求路径")
    method = Column(String(10), nullable=False, comment="HTTP请求方法 (如GET, POST)")
    description = Column(Text, nullable=True, comment="接口描述")
    content_type = Column(String(100), nullable=True, comment="请求或响应的Content-Type")
    request_params_json = Column(JSON, nullable=True, comment="存储请求参数定义的JSON对象")
    response_params_json = Column(JSON, nullable=True, comment="存储响应内容定义的JSON对象")
    request_example = Column(Text, nullable=True, comment="整体请求示例")
    response_example = Column(Text, nullable=True, comment="整体响应示例")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, comment="最后修改者的用户ID")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, comment="创建者的用户ID")
    created_at = Column(DateTime, default=get_local_time, comment="创建时间")
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time, comment="最后更新时间")
    
    # 关系
    workspace = relationship("Workspace", back_populates="interfaces")
    last_editor = relationship("User", foreign_keys=[user_id])
    creator = relationship("User", foreign_keys=[created_by]) 