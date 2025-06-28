from sqlalchemy import Column, Integer, String, Boolean, DateTime
from backend.app.db.base import Base
from backend.app.db.utils import get_local_time

class ModuleSectionConfig(Base):
    """模块配置模型"""
    __tablename__ = "module_section_config"

    id = Column(Integer, primary_key=True, index=True, comment="配置项唯一标识符")
    section_key = Column(String(50), nullable=False, unique=True, comment="段落唯一标识键")
    section_name = Column(String(100), nullable=False, comment="段落显示名称")
    section_icon = Column(String(50), nullable=False, comment="段落图标")
    section_type = Column(Integer, nullable=False, default=0, server_default="0", comment="段落类型 (例如 0:富文本, 1:图表)")
    is_enabled = Column(Boolean, default=True, comment="是否启用该段落")
    display_order = Column(Integer, nullable=False, comment="显示顺序")
    created_at = Column(DateTime, default=get_local_time, comment="创建时间")
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time, comment="最后更新时间") 