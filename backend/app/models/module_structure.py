import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship

from backend.app.db.base import Base
from backend.app.db.utils import get_local_time


class ModuleStructureNode(Base):
    """模块结构节点模型，用于构建层级模块结构树"""
    __tablename__ = "module_structure_nodes"

    id = Column(Integer, primary_key=True, index=True, comment="节点唯一标识符")
    name = Column(String(255), nullable=False, comment="节点或模块的名称")
    parent_id = Column(Integer, ForeignKey("module_structure_nodes.id"), nullable=True, comment="父节点ID")
    order_index = Column(Integer, default=0, comment="在同级中的排序索引")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, comment="创建该节点的用户ID")
    is_content_page = Column(Boolean, default=False, nullable=False, comment="是否为内容页面类型")
    created_at = Column(DateTime, default=get_local_time, comment="创建时间")
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time, comment="最后更新时间")
    permission_id = Column(Integer, ForeignKey("permissions.id"), nullable=True, comment="关联的权限ID")
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=True, comment="关联的工作区ID")

    # 关系
    parent = relationship("ModuleStructureNode", remote_side=[id], backref="children")
    creator = relationship("User", foreign_keys=[user_id])
    content = relationship("ModuleContent", back_populates="module_node", uselist=False, cascade="all, delete-orphan")
    permission = relationship("Permission", foreign_keys=[permission_id])
    workspace = relationship("Workspace", back_populates="module_nodes") 