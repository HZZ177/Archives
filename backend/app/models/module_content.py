import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, JSON
from sqlalchemy.orm import relationship

from backend.app.db.base import Base


class ModuleContent(Base):
    """模块内容模型，存储模块的六个固定内容部分"""
    __tablename__ = "module_contents"

    id = Column(Integer, primary_key=True, index=True)
    module_node_id = Column(Integer, ForeignKey("module_structure_nodes.id", ondelete="CASCADE"), nullable=False, unique=True)
    overview_text = Column(Text, nullable=True)  # 模块功能概述
    diagram_image_path = Column(String(512), nullable=True)  # 逻辑图/数据流向图
    details_text = Column(Text, nullable=True)  # 功能详解
    database_tables_json = Column(JSON, nullable=True)  # 数据库表
    related_module_ids_json = Column(JSON, nullable=True)  # 关联模块
    api_interfaces_json = Column(JSON, nullable=True)  # 涉及接口
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # 最后修改者
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # 关系
    module_node = relationship("ModuleStructureNode", back_populates="content")
    last_editor = relationship("User", foreign_keys=[user_id]) 