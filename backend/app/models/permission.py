import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table
from sqlalchemy.orm import relationship, backref

from backend.app.db.base import Base
from backend.app.db.utils import get_local_time

# 角色权限关联表
role_permission = Table(
    "role_permission",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True, comment="关联的角色ID"),
    Column("permission_id", Integer, ForeignKey("permissions.id"), primary_key=True, comment="关联的权限ID"),
)


class Permission(Base):
    """权限模型 - 页面级权限控制"""
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True, comment="权限唯一标识符")
    code = Column(String(100), unique=True, index=True, nullable=False, comment="权限代码")
    name = Column(String(100), nullable=False, comment="权限名称")
    page_path = Column(String(255), nullable=False, comment="页面路径")
    icon = Column(String(100), nullable=True, comment="图标")
    sort = Column(Integer, default=0, comment="排序")
    is_visible = Column(Boolean, default=True, comment="是否在菜单中可见")
    parent_id = Column(Integer, ForeignKey("permissions.id"), nullable=True, comment="父权限ID")
    description = Column(String(255), nullable=True, comment="权限描述")
    created_at = Column(DateTime, default=get_local_time, comment="创建时间")
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time, comment="最后更新时间")

    # 关系
    roles = relationship("Role", secondary=role_permission, back_populates="permissions")
    children = relationship("Permission", 
                          backref="parent", remote_side=[id],
                          uselist=True) 