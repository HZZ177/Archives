import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, JSON, Table
from sqlalchemy.orm import relationship

from backend.app.db.base import Base
from backend.app.db.utils import get_local_time

# 模块内容-数据库表关联表
module_content_table = Table(
    "module_content_table",
    Base.metadata,
    Column("module_content_id", Integer, ForeignKey("module_contents.id", ondelete="CASCADE"), primary_key=True),
    Column("workspace_table_id", Integer, ForeignKey("workspace_tables.id", ondelete="CASCADE"), primary_key=True)
)

# 模块内容-接口关联表
module_content_interface = Table(
    "module_content_interface",
    Base.metadata,
    Column("module_content_id", Integer, ForeignKey("module_contents.id", ondelete="CASCADE"), primary_key=True),
    Column("workspace_interface_id", Integer, ForeignKey("workspace_interfaces.id", ondelete="CASCADE"), primary_key=True)
)


class ModuleContent(Base):
    """模块内容模型，存储模块的六个固定内容部分"""
    __tablename__ = "module_contents"

    id = Column(Integer, primary_key=True, index=True)
    module_node_id = Column(Integer, ForeignKey("module_structure_nodes.id", ondelete="CASCADE"), nullable=False, unique=True)
    overview_text = Column(Text, nullable=True)  # 模块功能概述
    diagram_data = Column(JSON)  # 存储流程图数据
    diagram_version = Column(Integer, default=1)  # 版本控制
    details_text = Column(Text, nullable=True)  # 功能详解
    database_tables_json = Column(JSON, nullable=True)  # 数据库表 (旧格式，保留向后兼容)
    related_module_ids_json = Column(JSON, nullable=True)  # 关联模块
    api_interfaces_json = Column(JSON, nullable=True)  # 涉及接口 (旧格式，保留向后兼容)
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
    
    # 新增关系 - 引用工作区级别的表和接口
    database_tables = relationship("WorkspaceTable", secondary=module_content_table, backref="module_contents")
    api_interfaces = relationship("WorkspaceInterface", secondary=module_content_interface, backref="module_contents") 