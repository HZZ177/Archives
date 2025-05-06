import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
from typing import List, Dict, Any
from sqlalchemy.orm import selectinload

from backend.app.core.security import get_password_hash
from backend.app.db.base import Base
from backend.app.db.session import engine
from backend.app.models.user import User, Role
from backend.app.models.permission import Permission
from backend.app.models.document import Document, Template, Section, Image, Relation

logger = logging.getLogger(__name__)


async def create_system_permissions(session: AsyncSession) -> None:
    """创建系统权限"""
    # 权限数据
    permissions_data = [
        # 系统管理权限
        {
            "code": "system",
            "name": "系统管理",
            "type": "menu",
            "path": "/system",
            "component": "Layout",
            "permission": "system:*:*",
            "sort": 100,
            "visible": True,
            "icon": "setting",
            "parent_id": None
        },
        # 用户管理
        {
            "code": "system:user",
            "name": "用户管理",
            "type": "menu",
            "path": "/system/user",
            "component": "system/user/index",
            "permission": "system:user:*",
            "sort": 101,
            "visible": True,
            "icon": "user",
            "parent_id": 1  # 系统管理
        },
        {
            "code": "system:user:list",
            "name": "用户列表",
            "type": "operation",
            "path": None,
            "component": None,
            "permission": "system:user:list",
            "sort": 102,
            "visible": True,
            "icon": None,
            "parent_id": 2  # 用户管理
        },
        {
            "code": "system:user:query",
            "name": "用户查询",
            "type": "operation",
            "path": None,
            "component": None,
            "permission": "system:user:query",
            "sort": 103,
            "visible": True,
            "icon": None,
            "parent_id": 2  # 用户管理
        },
        {
            "code": "system:user:create",
            "name": "用户创建",
            "type": "operation",
            "path": None,
            "component": None,
            "permission": "system:user:create",
            "sort": 104,
            "visible": True,
            "icon": None,
            "parent_id": 2  # 用户管理
        },
        {
            "code": "system:user:update",
            "name": "用户更新",
            "type": "operation",
            "path": None,
            "component": None,
            "permission": "system:user:update",
            "sort": 105,
            "visible": True,
            "icon": None,
            "parent_id": 2  # 用户管理
        },
        {
            "code": "system:user:delete",
            "name": "用户删除",
            "type": "operation",
            "path": None,
            "component": None,
            "permission": "system:user:delete",
            "sort": 106,
            "visible": True,
            "icon": None,
            "parent_id": 2  # 用户管理
        },

        # 角色管理
        {
            "code": "system:role",
            "name": "角色管理",
            "type": "menu",
            "path": "/system/role",
            "component": "system/role/index",
            "permission": "system:role:*",
            "sort": 107,
            "visible": True,
            "icon": "peoples",
            "parent_id": 1  # 系统管理
        },
        {
            "code": "system:role:list",
            "name": "角色列表",
            "type": "operation",
            "path": None,
            "component": None,
            "permission": "system:role:list",
            "sort": 108,
            "visible": True,
            "icon": None,
            "parent_id": 8  # 角色管理
        },
        {
            "code": "system:role:query",
            "name": "角色查询",
            "type": "operation",
            "path": None,
            "component": None,
            "permission": "system:role:query",
            "sort": 109,
            "visible": True,
            "icon": None,
            "parent_id": 8  # 角色管理
        },
        {
            "code": "system:role:create",
            "name": "角色创建",
            "type": "operation",
            "path": None,
            "component": None,
            "permission": "system:role:create",
            "sort": 110,
            "visible": True,
            "icon": None,
            "parent_id": 8  # 角色管理
        },
        {
            "code": "system:role:update",
            "name": "角色更新",
            "type": "operation",
            "path": None,
            "component": None,
            "permission": "system:role:update",
            "sort": 111,
            "visible": True,
            "icon": None,
            "parent_id": 8  # 角色管理
        },
        {
            "code": "system:role:delete",
            "name": "角色删除",
            "type": "operation",
            "path": None,
            "component": None,
            "permission": "system:role:delete",
            "sort": 112,
            "visible": True,
            "icon": None,
            "parent_id": 8  # 角色管理
        },

        # 权限管理
        {
            "code": "system:permission",
            "name": "权限管理",
            "type": "menu",
            "path": "/system/permission",
            "component": "system/permission/index",
            "permission": "system:permission:*",
            "sort": 113,
            "visible": True,
            "icon": "lock",
            "parent_id": 1  # 系统管理
        },
    ]

    # 检查是否已存在权限数据
    result = await session.execute(text("SELECT COUNT(*) FROM permissions"))
    permission_count = result.scalar()

    if permission_count == 0:
        logger.info("开始创建系统权限数据...")
        
        # 按顺序创建权限，确保父权限ID正确
        for data in permissions_data:
            permission = Permission(**data)
            session.add(permission)
        
        await session.commit()
        logger.info(f"系统权限数据创建成功，共 {len(permissions_data)} 条权限")
    else:
        logger.info(f"系统已存在权限数据，共 {permission_count} 条权限")


async def assign_permissions_to_admin_role(session: AsyncSession) -> None:
    """将所有权限分配给管理员角色"""
    # 获取管理员角色，并预加载权限关系
    result = await session.execute(
        select(Role).where(Role.name == "admin").options(selectinload(Role.permissions))
    )
    admin_role = result.scalar_one_or_none()
    
    if not admin_role:
        logger.warning("管理员角色不存在，无法分配权限")
        return
    
    # 获取所有权限
    result = await session.execute(select(Permission))
    permissions = result.scalars().all()
    
    # 检查管理员角色是否已经有权限 - 使用预加载的权限，避免延迟加载
    existing_perm_ids = {p.id for p in admin_role.permissions}
    all_perm_ids = {p.id for p in permissions}
    
    if existing_perm_ids != all_perm_ids:
        # 分配所有权限给管理员角色
        admin_role.permissions = permissions
        await session.commit()
        logger.info(f"管理员角色分配权限成功，共 {len(permissions)} 条权限")
    else:
        logger.info("管理员角色已拥有所有权限")


async def assign_admin_role_to_admin_user(session: AsyncSession) -> None:
    """将管理员角色分配给管理员用户"""
    # 获取管理员用户，预加载roles关系
    result = await session.execute(
        select(User).where(User.username == "admin").options(selectinload(User.roles))
    )
    admin_user = result.scalar_one_or_none()
    
    if not admin_user:
        logger.warning("管理员用户不存在，无法分配角色")
        return
    
    # 获取管理员角色
    result = await session.execute(select(Role).where(Role.name == "admin"))
    admin_role = result.scalar_one_or_none()
    
    if not admin_role:
        logger.warning("管理员角色不存在，无法分配角色")
        return
    
    # 检查管理员用户是否已经有管理员角色
    admin_role_exists = any(role.id == admin_role.id for role in admin_user.roles)
    if not admin_role_exists:
        # 分配管理员角色给管理员用户
        admin_user.roles.append(admin_role)
        await session.commit()
        logger.info("管理员用户分配管理员角色成功")
    else:
        logger.info("管理员用户已拥有管理员角色")


async def init_db() -> None:
    """
    初始化数据库
    创建所有表并添加初始数据
    """
    try:
        # 创建所有表
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            logger.info("数据库表创建成功")

        # 创建初始角色和用户
        async with AsyncSession(engine) as session:
            # 检查是否已存在管理员角色
            result = await session.execute(text("SELECT COUNT(*) FROM roles WHERE name = 'admin'"))
            admin_count = result.scalar()

            if admin_count == 0:
                # 创建管理员角色
                admin_role = Role(
                    name="admin",
                    description="系统管理员",
                    is_default=False,
                    status=True
                )
                session.add(admin_role)
                await session.commit()
                logger.info("管理员角色创建成功")

            # 检查是否已存在管理员用户
            result = await session.execute(text("SELECT COUNT(*) FROM users WHERE username = 'admin'"))
            admin_user_count = result.scalar()

            if admin_user_count == 0:
                # 创建管理员用户
                admin_user = User(
                    username="admin",
                    email="admin@example.com",
                    full_name="Administrator",
                    hashed_password=get_password_hash("admin123"),
                    is_active=True,
                    is_superuser=True
                )
                session.add(admin_user)
                await session.commit()
                logger.info("管理员用户创建成功")
            else:
                # 查询并显示现有用户信息
                result = await session.execute(select(User).where(User.username == "admin"))
                existing_user = result.scalar_one_or_none()
                if existing_user:
                    logger.info(f"管理员用户已存在: {existing_user.username}")
            
            # 创建系统权限
            await create_system_permissions(session)
            
            # 分配权限给管理员角色
            await assign_permissions_to_admin_role(session)
            
            # 分配管理员角色给管理员用户
            await assign_admin_role_to_admin_user(session)

    except Exception as e:
        logger.error(f"数据库初始化失败: {str(e)}")
        raise
