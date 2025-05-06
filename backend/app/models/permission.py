import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table
from sqlalchemy.orm import relationship, backref

from backend.app.db.base import Base

# 角色权限关联表
role_permission = Table(
    "role_permission",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id"), primary_key=True),
)


class Permission(Base):
    """权限模型"""
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, index=True, nullable=False, comment="权限代码")
    name = Column(String(100), nullable=False, comment="权限名称")
    type = Column(String(20), nullable=False, comment="权限类型：menu-菜单权限, operation-操作权限")
    parent_id = Column(Integer, ForeignKey("permissions.id"), nullable=True, comment="父权限ID")
    path = Column(String(255), nullable=True, comment="路由路径")
    component = Column(String(255), nullable=True, comment="前端组件")
    permission = Column(String(255), nullable=True, comment="权限标识")
    icon = Column(String(100), nullable=True, comment="图标")
    sort = Column(Integer, default=0, comment="排序")
    visible = Column(Boolean, default=True, comment="是否可见")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # 关系
    roles = relationship("Role", secondary=role_permission, back_populates="permissions")
    children = relationship("Permission", 
                          backref="parent", remote_side=[id],
                          uselist=True) 