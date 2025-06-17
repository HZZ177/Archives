import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table
from sqlalchemy.orm import relationship

from backend.app.db.base import Base
from backend.app.db.utils import get_local_time
from backend.app.models.permission import role_permission
from backend.app.models.workspace import workspace_user
from backend.app.models.module_content import ModuleContent  # 新增导入

# 用户角色关联表
user_role = Table(
    "user_role",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
)


class User(Base):
    """用户模型"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=True)
    mobile = Column(String(20), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=get_local_time)
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time)
    # 添加默认工作区
    default_workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=True)

    # 关系
    roles = relationship("Role", secondary=user_role, back_populates="users")
    # 添加工作区关系
    default_workspace = relationship("Workspace", foreign_keys=[default_workspace_id])
    workspaces = relationship("Workspace", secondary=workspace_user, back_populates="users")
    created_workspaces = relationship("Workspace", foreign_keys="[Workspace.created_by]", back_populates="creator")
    module_contents = relationship("ModuleContent", foreign_keys=[ModuleContent.created_by], back_populates="creator")  # 用户创建的模块内容列表


class Role(Base):
    """角色模型"""
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True, nullable=False)
    description = Column(String(255), nullable=True)
    is_default = Column(Boolean, default=False, comment="是否为默认角色")
    status = Column(Boolean, default=True, comment="状态：True-启用，False-禁用")
    created_at = Column(DateTime, default=get_local_time)
    updated_at = Column(DateTime, default=get_local_time, onupdate=get_local_time)

    # 关系
    users = relationship("User", secondary=user_role, back_populates="roles")
    permissions = relationship("Permission", secondary=role_permission, back_populates="roles")
