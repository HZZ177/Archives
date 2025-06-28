import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, JSON, Table
from sqlalchemy.orm import relationship

from backend.app.db.base import Base
from backend.app.db.utils import get_local_time

# 模块内容-数据库表关联表
module_content_table = Table(
    "module_content_table",
    Base.metadata,
    Column("module_content_id", Integer, ForeignKey("module_contents.id", ondelete="CASCADE"), primary_key=True, comment="关联的模块内容ID"),
    Column("workspace_table_id", Integer, ForeignKey("workspace_tables.id", ondelete="CASCADE"), primary_key=True, comment="关联的工作区数据库表ID")
)

# 模块内容-接口关联表
module_content_interface = Table(
    "module_content_interface",
    Base.metadata,
    Column("module_content_id", Integer, ForeignKey("module_contents.id", ondelete="CASCADE"), primary_key=True, comment="关联的模块内容ID"),
    Column("workspace_interface_id", Integer, ForeignKey("workspace_interfaces.id", ondelete="CASCADE"), primary_key=True, comment="关联的工作区接口ID")
)


class ModuleContent(Base):
    """模块内容模型，存储模块的六个固定内容部分"""
    __tablename__ = "module_contents"

    id = Column(Integer, primary_key=True, index=True, comment="模块内容唯一标识符")
    module_node_id = Column(Integer, ForeignKey("module_structure_nodes.id", ondelete="CASCADE"), nullable=False, unique=True, comment="关联的模块结构节点ID")
    overview_text = Column(Text, nullable=True, comment="模块功能概述的富文本内容")
    diagram_data = Column(JSON, comment="存储图表(如流程图)的JSON数据")
    diagram_version = Column(Integer, default=1, comment="图表数据的版本号")
    details_text = Column(Text, nullable=True, comment="模块功能详解的富文本内容")
    database_tables_json = Column(JSON, nullable=True, comment="关联的数据库表ID列表 (JSON格式，已废弃)")
    related_module_ids_json = Column(JSON, nullable=True, comment="关联的模块ID列表 (JSON格式)")
    api_interfaces_json = Column(JSON, nullable=True, comment="关联的API接口ID列表 (JSON格式，已废弃)")
    terminology_json = Column(JSON, nullable=True, comment="术语和名称解释的JSON对象")
    table_relation_diagram = Column(JSON, nullable=True, comment="数据库表关联图的JSON数据")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, comment="最后修改者的用户ID")
    created_at = Column(DateTime, default=get_local_time, comment="创建时间")
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time, comment="最后更新时间")
    created_by = Column(Integer, ForeignKey("users.id"), comment="创建者的用户ID")

    # 关系
    module_node = relationship("ModuleStructureNode", back_populates="content")
    last_editor = relationship("User", foreign_keys=[user_id]) 
    creator = relationship("User", foreign_keys=[created_by], back_populates="module_contents") 
    
    # 新增关系 - 引用工作区级别的表和接口
    database_tables = relationship("WorkspaceTable", secondary=module_content_table, backref="module_contents")
    api_interfaces = relationship("WorkspaceInterface", secondary=module_content_interface, backref="module_contents") 