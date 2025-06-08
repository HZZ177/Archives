import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, JSON
from sqlalchemy.orm import relationship

from backend.app.db.base import Base
from backend.app.db.utils import get_local_time


class ModuleContent(Base):
    """模块内容模型，存储模块的六个固定内容部分"""
    __tablename__ = "module_contents"

    id = Column(Integer, primary_key=True, index=True)
    module_node_id = Column(Integer, ForeignKey("module_structure_nodes.id", ondelete="CASCADE"), nullable=False, unique=True)
    overview_text = Column(Text, nullable=True)  # 模块功能概述
    diagram_data = Column(JSON)  # 存储流程图数据
    diagram_version = Column(Integer, default=1)  # 版本控制
    details_text = Column(Text, nullable=True)  # 功能详解
    database_tables_json = Column(JSON, nullable=True)  # 数据库表
    related_module_ids_json = Column(JSON, nullable=True)  # 关联模块
    api_interfaces_json = Column(JSON, nullable=True)  # 涉及接口
    terminology_json = Column(JSON, nullable=True)  # 术语表/名称解释
    table_relation_diagram = Column(JSON, nullable=True)  # 表关联关系图
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # 最后修改者
    created_at = Column(DateTime, default=get_local_time)
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time)
    created_by = Column(Integer, ForeignKey("users.id"))

    # 关系
    module_node = relationship("ModuleStructureNode", back_populates="content")
    last_editor = relationship("User", foreign_keys=[user_id]) 
    creator = relationship("User", foreign_keys=[created_by], back_populates="module_contents") 