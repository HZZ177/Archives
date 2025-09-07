from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.app.db.base import Base
from backend.app.db.utils import get_local_time


class MonthlyReport(Base):
    """月度报告模型"""
    __tablename__ = "monthly_reports"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True)
    
    # 报告内容
    prompt_template = Column(Text, nullable=True)  # 生成时使用的提示词
    report_data = Column(JSON, nullable=True)  # JSON格式的完整报告数据
    
    # 状态管理
    status = Column(String(20), default="draft", nullable=False)  # draft/generating/completed/failed
    generation_progress = Column(JSON, nullable=True)  # 生成进度信息
    error_message = Column(Text, nullable=True)  # 错误信息
    
    # 元数据
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=get_local_time)
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time)
    
    # 关系
    workspace = relationship("Workspace", back_populates="monthly_reports")
    creator = relationship("User")


class PromptTemplate(Base):
    """提示词模板模型"""
    __tablename__ = "prompt_templates"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False, index=True)
    template_name = Column(String(100), nullable=False)
    template_content = Column(Text, nullable=False)  # 兼容旧版本或存储JSON格式
    is_active = Column(Boolean, default=True, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)
    
    # 元数据
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=get_local_time)
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time)
    
    # 关系
    workspace = relationship("Workspace", foreign_keys=[workspace_id])
    creator = relationship("User")
