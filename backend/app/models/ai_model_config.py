import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, DECIMAL
from sqlalchemy.orm import relationship

from backend.app.db.base import Base
from backend.app.db.utils import get_local_time


class AIModelConfig(Base):
    """AI模型配置模型"""
    __tablename__ = "ai_model_configs"

    id = Column(Integer, primary_key=True, index=True, comment="配置唯一标识符")
    name = Column(String(100), nullable=False, comment="配置名称")
    model_provider = Column(String(50), nullable=False, comment="模型提供商")
    model_name = Column(String(100), nullable=False, comment="模型名称")
    api_key = Column(Text, nullable=False, comment="API密钥")
    base_url = Column(String(255), nullable=True, comment="API基础URL")
    max_tokens = Column(Integer, default=4000, comment="最大token数")
    temperature = Column(DECIMAL(3, 2), default=0.7, comment="温度参数")
    is_active = Column(Boolean, default=False, comment="是否为活跃配置")
    is_enabled = Column(Boolean, default=True, comment="是否启用")
    description = Column(Text, nullable=True, comment="配置描述")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True, comment="创建者ID")
    created_at = Column(DateTime, default=get_local_time, comment="创建时间")
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time, comment="最后更新时间")

    # 关系
    creator = relationship("User", foreign_keys=[created_by])
    usage_stats = relationship("AIModelUsageStats", back_populates="config", cascade="all, delete-orphan")


class AIModelUsageStats(Base):
    """AI模型使用统计模型"""
    __tablename__ = "ai_model_usage_stats"

    id = Column(Integer, primary_key=True, index=True, comment="统计记录唯一标识符")
    config_id = Column(Integer, ForeignKey("ai_model_configs.id"), nullable=False, comment="配置ID")
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False, comment="工作空间ID")
    usage_date = Column(DateTime, nullable=False, comment="使用日期")
    request_count = Column(Integer, default=0, comment="请求次数")
    token_count = Column(Integer, default=0, comment="token使用量")
    success_count = Column(Integer, default=0, comment="成功次数")
    error_count = Column(Integer, default=0, comment="错误次数")
    avg_response_time = Column(DECIMAL(10, 3), default=0, comment="平均响应时间(毫秒)")
    created_at = Column(DateTime, default=get_local_time, comment="创建时间")
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time, comment="最后更新时间")

    # 关系
    config = relationship("AIModelConfig", back_populates="usage_stats")
    workspace = relationship("Workspace")
