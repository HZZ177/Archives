import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, update
from typing import List, Dict, Any
from sqlalchemy.orm import selectinload
from backend.app.core.logger import logger
from backend.app.core.security import get_password_hash
from backend.app.db.base import Base
from backend.app.db.session import engine
from backend.app.models.user import User, Role
from backend.app.models.permission import Permission
from backend.app.models.workspace import Workspace, workspace_user
from backend.app.models.module_section_config import ModuleSectionConfig


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
        # 系统管理分组 - 作为父节点，但添加实际页面路径
        {
            "code": "system",
            "name": "系统管理",
            "page_path": "/system", # 添加系统管理的路径
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
            "page_path": "/system/users",
            "sort": 101,
            "is_visible": True,
            "icon": "user",
            "parent_id": 2,  # 系统管理分组
            "description": "用户管理页面"
        },
        # 角色管理 - 实际页面
        {
            "code": "system:role",
            "name": "角色管理",
            "page_path": "/system/roles",
            "sort": 102,
            "is_visible": True,
            "icon": "peoples",
            "parent_id": 2,  # 系统管理分组
            "description": "角色管理页面"
        },
        # 结构管理 - 作为父节点，添加实际页面路径
        {
            "code": "system:structure",
            "name": "结构管理",
            "page_path": "/structure-management", # 添加结构管理的路径
            "sort": 110,
            "is_visible": True,
            "icon": "tree",
            "parent_id": None,
            "description": "结构管理模块分组"
        },
        # 结构树配置 - 作为结构管理的子页面
        {
            "code": "system:structure:tree-editor",
            "name": "结构树配置",
            "page_path": "/structure-management/tree",
            "sort": 111,
            "is_visible": True,
            "icon": "apartment",
            "parent_id": 5,  # 结构管理节点
            "description": "配置系统模块结构树"
        },
        # 页面模块配置 - 作为结构管理的子页面
        {
            "code": "system:structure:module-config",
            "name": "页面模块配置",
            "page_path": "/structure-management/module-config",
            "sort": 112,
            "is_visible": True,
            "icon": "appstore",
            "parent_id": 5,  # 结构管理节点
            "description": "配置页面模块的显示和顺序"
        }
    ]

    logger.info("开始检查系统权限数据...")
    
    # 获取现有的所有权限记录
    result = await session.execute(select(Permission))
    existing_permissions = result.scalars().all()
    
    # 创建现有权限的代码集合，用于快速查找
    existing_codes = {permission.code for permission in existing_permissions}
    
    # 创建ID映射，用于处理parent_id引用
    id_mapping = {}
    for perm in existing_permissions:
        id_mapping[perm.code] = perm.id
    
    # 计数器
    added_count = 0
    updated_count = 0
    
    # 按顺序处理权限，确保父权限先创建
    for idx, data in enumerate(permissions_data):
        # 检查权限是否已存在
        if data["code"] not in existing_codes:
            # 处理parent_id引用，如果是数字引用，转换为实际ID
            if data["parent_id"] is not None and isinstance(data["parent_id"], int):
                # 找到对应索引的权限代码
                if data["parent_id"] <= len(permissions_data):
                    parent_code = permissions_data[data["parent_id"]-1]["code"]
                    # 如果父权限已经在数据库中，使用其实际ID
                    if parent_code in id_mapping:
                        data["parent_id"] = id_mapping[parent_code]
            
            # 创建新权限
            permission = Permission(**data)
            session.add(permission)
            await session.flush()  # 立即获取新创建权限的ID
            
            # 更新ID映射
            id_mapping[data["code"]] = permission.id
            added_count += 1
        else:
            # 权限已存在，可以选择更新名称、图标等非关键字段
            existing_perm = next(p for p in existing_permissions if p.code == data["code"])
            # 只更新可能变化的字段
            if existing_perm.name != data["name"] or existing_perm.icon != data["icon"] or existing_perm.description != data["description"]:
                existing_perm.name = data["name"]
                existing_perm.icon = data["icon"]
                existing_perm.description = data["description"]
                updated_count += 1
    
    # 如果有新增或更新，提交事务
    if added_count > 0 or updated_count > 0:
        await session.commit()
        if added_count > 0:
            logger.info(f"新增了 {added_count} 条权限")
        if updated_count > 0:
            logger.info(f"更新了 {updated_count} 条权限")
    else:
        logger.info("所有权限已存在且无需更新")


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


async def create_default_workspace(session: AsyncSession) -> None:
    """创建默认工作区并分配给超级管理员"""
    # 检查是否已存在工作区
    result = await session.execute(text("SELECT COUNT(*) FROM workspaces"))
    workspace_count = result.scalar()

    if workspace_count == 0:
        logger.info("开始创建默认工作区...")
        
        # 获取管理员用户 - 使用text查询直接获取id而不是ORM对象
        result = await session.execute(text("SELECT id FROM users WHERE username = 'admin'"))
        admin_id = result.scalar_one_or_none()
        
        if not admin_id:
            logger.warning("管理员用户不存在，跳过创建默认工作区")
            return
        
        # 创建默认工作区
        default_workspace = Workspace(
            name="默认工作区",
            description="系统默认工作区",
            is_default=True,
            created_by=admin_id
        )
        session.add(default_workspace)
        await session.commit()
        await session.refresh(default_workspace)
        
        # 立即保存ID到本地变量，避免后续隐式加载
        workspace_id = default_workspace.id
        
        # 添加管理员用户到工作区
        await session.execute(
            workspace_user.insert().values(
                workspace_id=workspace_id,
                user_id=admin_id,
                access_level="owner"
            )
        )
        
        # 设置为管理员用户的默认工作区 - 使用直接更新而不是通过ORM对象
        await session.execute(
            update(User)
            .where(User.id == admin_id)
            .values(default_workspace_id=workspace_id)
        )
        
        await session.commit()
        logger.info(f"默认工作区创建成功，ID: {workspace_id}")
    else:
        logger.info(f"系统已存在工作区，共 {workspace_count} 个工作区")


async def init_module_section_configs(session: AsyncSession) -> None:
    """初始化模块配置数据"""
    logger.info("开始检查模块配置...")
    
    # 定义默认配置
    default_configs = [
        {
            "section_key": "overview",
            "section_name": "功能概述",
            "section_icon": "📝",
            "section_type": 1,
            "is_enabled": True,
            "display_order": 1
        },
        {
            "section_key": "terminology",
            "section_name": "名称解释",
            "section_icon": "📖",
            "section_type": 10,
            "is_enabled": True,
            "display_order": 2
        },
        {
            "section_key": "keyTech",
            "section_name": "功能详解",
            "section_icon": "🔍",
            "section_type": 1,
            "is_enabled": True,
            "display_order": 3
        },
        {
            "section_key": "diagram",
            "section_name": "业务流程图",
            "section_icon": "📊",
            "section_type": 3,
            "is_enabled": True,
            "display_order": 4
        },
        {
            "section_key": "tableRelation",
            "section_name": "表关联关系图",
            "section_icon": "🔄",
            "section_type": 3,
            "is_enabled": True,
            "display_order": 5
        },
        {
            "section_key": "database",
            "section_name": "数据库表",
            "section_icon": "💾",
            "section_type": 6,
            "is_enabled": True,
            "display_order": 6
        },
        {
            "section_key": "related",
            "section_name": "关联模块",
            "section_icon": "🔗",
            "section_type": 8,
            "is_enabled": True,
            "display_order": 7
        },
        {
            "section_key": "interface",
            "section_name": "涉及接口",
            "section_icon": "🔌",
            "section_type": 7,
            "is_enabled": True,
            "display_order": 8
        }
    ]
    
    # 获取现有的所有配置记录
    result = await session.execute(select(ModuleSectionConfig))
    existing_configs = result.scalars().all()
    
    # 创建现有配置的键集合，用于快速查找
    existing_keys = {config.section_key for config in existing_configs}
    
    # 计数器
    added_count = 0
    
    # 检查每个默认配置，如果不存在则添加
    for config in default_configs:
        if config["section_key"] not in existing_keys:
            db_config = ModuleSectionConfig(**config)
            session.add(db_config)
            added_count += 1
    
    # 如果有新增配置，提交事务
    if added_count > 0:
        await session.commit()
        logger.info(f"新增了 {added_count} 条模块配置")
    else:
        logger.info("所有模块配置已存在，无需新增")


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
            
            # 创建默认工作区
            await create_default_workspace(session)

            # 调用新函数来初始化数据
            await init_module_section_configs(session)

    except Exception as e:
        logger.error(f"数据库初始化失败: {str(e)}")
        raise
