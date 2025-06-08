from sqlalchemy import Column, Integer, String, Boolean, DateTime
from backend.app.db.base import Base
from backend.app.db.utils import get_local_time

class ModuleSectionConfig(Base):
    """模块配置模型"""
    __tablename__ = "module_section_config"

    id = Column(Integer, primary_key=True, index=True)
    section_key = Column(String(50), nullable=False, unique=True)
    section_name = Column(String(100), nullable=False)
    section_icon = Column(String(50), nullable=False)
    section_type = Column(Integer, nullable=False, default=0, server_default="0")
    is_enabled = Column(Boolean, default=True)
    display_order = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=get_local_time)
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time) 