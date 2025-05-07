import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship

from backend.app.db.base import Base


class ModuleStructureNode(Base):
    """模块结构节点模型，用于构建层级模块结构树"""
    __tablename__ = "module_structure_nodes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    parent_id = Column(Integer, ForeignKey("module_structure_nodes.id"), nullable=True)
    order_index = Column(Integer, default=0)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_content_page = Column(Boolean, default=False, nullable=False, comment="是否为内容页面类型")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # 关系
    parent = relationship("ModuleStructureNode", remote_side=[id], backref="children")
    creator = relationship("User", foreign_keys=[user_id])
    content = relationship("ModuleContent", back_populates="module_node", uselist=False, cascade="all, delete-orphan") 