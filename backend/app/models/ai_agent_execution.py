import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from backend.app.db.base import Base
from backend.app.db.utils import get_local_time


class AIAgent(Base):
    """AI Agent配置模型"""
    __tablename__ = "ai_agents"

    id = Column(Integer, primary_key=True, index=True, comment="Agent唯一标识符")
    name = Column(String(100), nullable=False, comment="Agent名称")
    role = Column(String(100), nullable=False, comment="Agent角色")
    goal = Column(Text, nullable=False, comment="Agent目标")
    backstory = Column(Text, nullable=False, comment="Agent背景故事")
    system_prompt = Column(Text, nullable=True, comment="系统提示词")
    agent_type = Column(String(50), nullable=False, comment="Agent类型")
    is_enabled = Column(Boolean, default=True, comment="是否启用")
    config_json = Column(Text, nullable=True, comment="额外配置JSON")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True, comment="创建者ID")
    created_at = Column(DateTime, default=get_local_time, comment="创建时间")
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time, comment="最后更新时间")

    # 关系
    creator = relationship("User", foreign_keys=[created_by])
    executions = relationship("AIAgentExecution", back_populates="agent", cascade="all, delete-orphan")


class AIAgentExecution(Base):
    """AI Agent任务执行记录模型"""
    __tablename__ = "ai_agent_executions"

    id = Column(Integer, primary_key=True, index=True, comment="执行记录唯一标识符")
    agent_id = Column(Integer, ForeignKey("ai_agents.id"), nullable=False, comment="Agent ID")
    task_type = Column(String(50), nullable=False, comment="任务类型")
    input_data = Column(Text, nullable=True, comment="输入数据")
    output_data = Column(Text, nullable=True, comment="输出数据")
    execution_status = Column(String(20), nullable=False, comment="执行状态")
    start_time = Column(DateTime, nullable=False, comment="开始时间")
    end_time = Column(DateTime, nullable=True, comment="结束时间")
    duration_ms = Column(Integer, nullable=True, comment="执行时长(毫秒)")
    error_message = Column(Text, nullable=True, comment="错误信息")
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=True, comment="工作空间ID")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True, comment="执行者ID")
    created_at = Column(DateTime, default=get_local_time, comment="创建时间")

    # 关系
    agent = relationship("AIAgent", back_populates="executions")
    workspace = relationship("Workspace")
    creator = relationship("User", foreign_keys=[created_by])
