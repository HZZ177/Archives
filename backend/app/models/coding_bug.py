import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, JSON, BigInteger, Boolean
from sqlalchemy.orm import relationship

from backend.app.db.base import Base
from backend.app.db.utils import get_local_time


class CodingBug(Base):
    """Coding平台缺陷数据模型"""
    __tablename__ = "coding_bugs"
    
    id = Column(Integer, primary_key=True, index=True, comment="本地唯一标识符")
    coding_bug_id = Column(Integer, nullable=False, comment="Coding平台缺陷ID")
    coding_bug_code = Column(Integer, nullable=False, comment="Coding平台缺陷编号")
    title = Column(String(500), nullable=False, comment="缺陷标题")
    description = Column(Text, nullable=True, comment="缺陷描述")
    priority = Column(String(20), nullable=False, comment="优先级")
    status_name = Column(String(100), nullable=False, comment="状态名称")
    creator_id = Column(Integer, nullable=True, comment="Coding平台创建人ID")
    coding_created_at = Column(BigInteger, nullable=True, comment="Coding平台创建时间戳")
    coding_updated_at = Column(BigInteger, nullable=True, comment="Coding平台更新时间戳")
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), 
                         nullable=False, comment="所属工作区ID")
    project_name = Column(String(200), nullable=True, comment="Coding项目名称")
    assignees = Column(JSON, nullable=True, comment="指派人列表")
    labels = Column(JSON, nullable=True, comment="标签列表")
    iteration_name = Column(String(200), nullable=True, comment="迭代名称")
    synced_at = Column(DateTime, default=get_local_time, comment="同步时间")
    created_at = Column(DateTime, default=get_local_time, comment="本地创建时间")
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time, comment="本地更新时间")
    
    # 关系
    workspace = relationship("Workspace", back_populates="coding_bugs")
    module_links = relationship("CodingBugModuleLink", back_populates="coding_bug", cascade="all, delete-orphan")


class CodingBugModuleLink(Base):
    """Coding缺陷与模块关联模型"""
    __tablename__ = "coding_bug_module_links"
    
    id = Column(Integer, primary_key=True, index=True, comment="关联唯一标识符")
    module_id = Column(Integer, ForeignKey("module_structure_nodes.id", ondelete="CASCADE"), 
                      nullable=False, comment="关联模块ID")
    coding_bug_id = Column(Integer, ForeignKey("coding_bugs.id", ondelete="CASCADE"), 
                          nullable=False, comment="关联Coding缺陷ID")
    manifestation_description = Column(Text, nullable=True, comment="在该模块下的特定表现描述")
    created_at = Column(DateTime, default=get_local_time, comment="创建时间")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, comment="创建者ID")
    
    # 关系
    module = relationship("ModuleStructureNode")
    coding_bug = relationship("CodingBug", back_populates="module_links")
    creator = relationship("User")


class WorkspaceCodingConfig(Base):
    """工作区Coding配置模型"""
    __tablename__ = "workspace_coding_configs"
    
    id = Column(Integer, primary_key=True, index=True, comment="配置唯一标识符")
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), 
                         nullable=False, unique=True, comment="工作区ID")
    api_token = Column(String(500), nullable=False, comment="Coding API Token")
    project_name = Column(String(200), nullable=False, comment="Coding项目名称")
    api_base_url = Column(String(500), default="https://e.coding.net/open-api", comment="API基础URL")
    is_enabled = Column(Boolean, default=True, comment="是否启用")
    last_sync_at = Column(DateTime, nullable=True, comment="最后同步时间")
    sync_conditions = Column(JSON, nullable=True, comment="同步条件配置")
    selected_iteration = Column(String(100), nullable=True, comment="选中的迭代ID")
    created_at = Column(DateTime, default=get_local_time, comment="创建时间")
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time, comment="更新时间")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, comment="创建者ID")
    
    # 关系
    workspace = relationship("Workspace", back_populates="coding_config")
    creator = relationship("User")
