import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
from typing import List, Dict, Any
from sqlalchemy.orm import selectinload
from backend.app.core.logger import logger
from backend.app.core.security import get_password_hash
from backend.app.db.base import Base
from backend.app.db.session import engine
from backend.app.models.user import User, Role
from backend.app.models.permission import Permission
from backend.app.models.document import Document, Template, Section, Image, Relation


async def create_system_permissions(session: AsyncSession) -> None:
    """创建系统权限"""
    # 权限数据
    permissions_data = [
        # 首页 - 顶级页面
        {
            "code": "dashboard",
            "name": "首页",
            "page_path": "/",
            "sort": 1,
            "is_visible": True,
            "icon": "home",
            "parent_id": None,
            "description": "系统首页"
        },
        # 系统管理分组 - 作为父节点，不包含实际页面路径
        {
            "code": "system",
            "name": "系统管理",
            "page_path": "", # 空字符串表示不是实际页面
            "sort": 100,
            "is_visible": True,
            "icon": "setting",
            "parent_id": None,
            "description": "系统管理模块分组"
        },
        # 用户管理 - 实际页面
        {
            "code": "system:user",
            "name": "用户管理",
            "page_path": "/users",
            "sort": 101,
            "is_visible": True,
            "icon": "user",
            "parent_id": 1,  # 系统管理分组
            "description": "用户管理页面"
        },
        # 角色管理 - 实际页面
        {
            "code": "system:role",
            "name": "角色管理",
            "page_path": "/roles",
            "sort": 102,
            "is_visible": True,
            "icon": "peoples",
            "parent_id": 1,  # 系统管理分组
            "description": "角色管理页面"
        },
        # 结构管理 - 实际页面，顶级节点
        {
            "code": "system:structure",
            "name": "结构管理",
            "page_path": "/structure-management",
            "sort": 110,
            "is_visible": True,
            "icon": "tree",
            "parent_id": None,
            "description": "结构管理页面"
        }
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
