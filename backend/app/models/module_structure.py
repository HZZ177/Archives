import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship

from backend.app.db.base import Base
from backend.app.db.utils import get_local_time


class ModuleStructureNode(Base):
    """模块结构节点模型，用于构建层级模块结构树"""
    __tablename__ = "module_structure_nodes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    parent_id = Column(Integer, ForeignKey("module_structure_nodes.id"), nullable=True)
    order_index = Column(Integer, default=0)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_content_page = Column(Boolean, default=False, nullable=False, comment="是否为内容页面类型")
    created_at = Column(DateTime, default=get_local_time)
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time)
    permission_id = Column(Integer, ForeignKey("permissions.id"), nullable=True, comment="关联的权限ID")

    # 关系
    parent = relationship("ModuleStructureNode", remote_side=[id], backref="children")
    creator = relationship("User", foreign_keys=[user_id])
    content = relationship("ModuleContent", back_populates="module_node", uselist=False, cascade="all, delete-orphan")
    permission = relationship("Permission", foreign_keys=[permission_id]) 