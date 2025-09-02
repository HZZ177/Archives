import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, JSON, Enum
from sqlalchemy.orm import relationship

from backend.app.db.base import Base
from backend.app.db.utils import get_local_time


class BugProfile(Base):
    """Bug档案模型 - 代表一个唯一的Bug类型"""
    __tablename__ = "bug_profiles"
    
    id = Column(Integer, primary_key=True, index=True, comment="Bug档案唯一标识符")
    title = Column(String(255), nullable=False, comment="Bug标题")
    description = Column(Text, nullable=True, comment="Bug详细描述")
    severity = Column(Enum('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', name='bug_severity'), 
                     nullable=False, default='MEDIUM', comment="严重程度")
    status = Column(Enum('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', name='bug_status'),
                    nullable=False, default='OPEN', index=True, comment="Bug状态")
    tags = Column(JSON, nullable=True, comment="标签数组")
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False, comment="首次报告者ID")
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), 
                         nullable=False, comment="所属工作区ID")
    created_at = Column(DateTime, default=get_local_time, comment="创建时间")
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time, comment="更新时间")
    
    # 关系
    reporter = relationship("User", foreign_keys=[reporter_id])
    workspace = relationship("Workspace", back_populates="bug_profiles")
    logs = relationship("BugLog", back_populates="bug_profile", cascade="all, delete-orphan")
    module_links = relationship("BugModuleLink", back_populates="bug_profile", cascade="all, delete-orphan")


class BugLog(Base):
    """Bug发生日志模型 - 记录Bug的每一次具体发生"""
    __tablename__ = "bug_logs"
    
    id = Column(Integer, primary_key=True, index=True, comment="日志唯一标识符")
    bug_id = Column(Integer, ForeignKey("bug_profiles.id", ondelete="CASCADE"), 
                   nullable=False, comment="关联的Bug档案ID")
    occurred_at = Column(DateTime, default=get_local_time, comment="发生时间")
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False, comment="报告者ID")
    notes = Column(Text, nullable=True, comment="补充说明")
    created_at = Column(DateTime, default=get_local_time, comment="创建时间")
    module_id = Column(Integer, ForeignKey("module_structure_nodes.id"), nullable=True, comment="发生所在模块ID")
    
    # 关系
    bug_profile = relationship("BugProfile", back_populates="logs")
    reporter = relationship("User", foreign_keys=[reporter_id])
    module = relationship("ModuleStructureNode")


class BugModuleLink(Base):
    """Bug与模块关联模型 - 多对多关系"""
    __tablename__ = "bug_module_links"
    
    id = Column(Integer, primary_key=True, index=True, comment="关联唯一标识符")
    module_id = Column(Integer, ForeignKey("module_structure_nodes.id", ondelete="CASCADE"), 
                      nullable=False, comment="关联模块ID")
    bug_id = Column(Integer, ForeignKey("bug_profiles.id", ondelete="CASCADE"), 
                   nullable=False, comment="关联Bug档案ID")
    manifestation_description = Column(Text, nullable=True, comment="在该模块下的特定表现描述")
    created_at = Column(DateTime, default=get_local_time, comment="创建时间")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, comment="创建者ID")
    
    # 关系
    module = relationship("ModuleStructureNode")
    bug_profile = relationship("BugProfile", back_populates="module_links")
    creator = relationship("User")
