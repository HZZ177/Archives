from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from backend.app.db.base import Base
from backend.app.db.utils import get_local_time

class ModuleSectionConfig(Base):
    """模块配置模型（全局模块定义）"""
    __tablename__ = "module_section_config"

    id = Column(Integer, primary_key=True, index=True, comment="配置项唯一标识符")
    section_key = Column(String(50), nullable=False, unique=True, comment="段落唯一标识键")
    section_name = Column(String(100), nullable=False, comment="段落显示名称")
    section_icon = Column(String(50), nullable=False, comment="段落图标")
    section_type = Column(Integer, nullable=False, default=0, server_default="0", comment="段落类型 (例如 0:富文本, 1:图表)")
    display_order = Column(Integer, nullable=False, comment="默认显示顺序")
    created_at = Column(DateTime, default=get_local_time, comment="创建时间")
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time, comment="最后更新时间")

    # 关系
    workspace_configs = relationship("WorkspaceModuleConfig", back_populates="module_config", cascade="all, delete-orphan")


class WorkspaceModuleConfig(Base):
    """工作区模块配置模型（工作区特定设置）"""
    __tablename__ = "workspace_module_config"

    id = Column(Integer, primary_key=True, index=True, comment="配置项唯一标识符")
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, comment="所属工作区ID")
    section_key = Column(String(50), ForeignKey("module_section_config.section_key", ondelete="CASCADE"), nullable=False, comment="模块标识键")
    is_enabled = Column(Boolean, default=True, comment="是否在该工作区启用")
    display_order = Column(Integer, nullable=False, comment="在该工作区的显示顺序")
    created_at = Column(DateTime, default=get_local_time, comment="创建时间")
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time, comment="最后更新时间")

    # 关系
    workspace = relationship("Workspace", back_populates="module_configs")
    module_config = relationship("ModuleSectionConfig", back_populates="workspace_configs")

    # 约束：同一工作区内section_key唯一
    __table_args__ = (
        UniqueConstraint('workspace_id', 'section_key', name='uq_workspace_section_key'),
    )