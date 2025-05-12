from typing import Annotated, List, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from backend.app.api.deps import get_current_active_user, get_current_admin_user, get_db, check_permissions, success_response, error_response
from backend.app.core.logger import logger
from backend.app.core.security import get_password_hash
from backend.app.models.user import User, Role, user_role
from backend.app.schemas.response import APIResponse
from backend.app.schemas.role import RoleResponse, UserRoleUpdate
from backend.app.schemas.user import UserCreate, UserResponse, UserUpdate, UserStatusUpdate, UserPage

router = APIRouter()


@router.get("/", response_model=APIResponse[UserPage])
async def read_users(
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)],
        skip: int = 0,
        limit: int = 100,
        keyword: str = None,
        page: int = 1,
        page_size: int = 10
):
    """
    获取所有用户列表，支持根据用户名、邮箱或手机号搜索
    
    参数:
    - page: 页码，默认1
    - page_size: 每页数量，默认10
    - keyword: 搜索关键词（可搜索用户名、邮箱、手机号）
    """
    try:
        # 权限检查
        if not current_user.is_superuser:
            await check_permissions(db, current_user, ["system:user:list"])
        
        # 构建查询
        query = select(User)
        
        # 如果有关键词，添加搜索条件
        if keyword:
            # 使用 ilike 进行不区分大小写的模糊匹配，使用 or_ 连接多个搜索条件
            search_pattern = f"%{keyword}%"
            query = query.where(
                or_(
                    User.username.ilike(search_pattern),  # 用户名匹配
                    User.email.ilike(search_pattern),     # 邮箱匹配
                    User.mobile.ilike(search_pattern)     # 手机号匹配
                )
            )
        
        # 计算总数量
        count_query = select(User)
        if keyword:
            search_pattern = f"%{keyword}%"
            count_query = count_query.where(
                or_(
                    User.username.ilike(search_pattern),
                    User.email.ilike(search_pattern),
                    User.mobile.ilike(search_pattern)
                )
            )
        count_result = await db.execute(count_query)
        total_count = len(count_result.scalars().all())
        
        # 添加分页
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        
        # 执行查询
        result = await db.execute(query)
        users = result.scalars().all()
        
        # 返回分页格式的数据
        page_data = UserPage(
            items=users,
            total=total_count
        )
        
        return success_response(data=page_data)
    except Exception as e:
        logger.error(f"获取用户列表失败: {str(e)}")
        return error_response(message=f"获取用户列表失败: {str(e)}")


@router.post("/", response_model=APIResponse[UserResponse], status_code=status.HTTP_201_CREATED)
async def create_user(
        user_in: UserCreate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    创建新用户，同时支持角色分配
    """
    try:
        # 权限检查
        if not current_user.is_superuser:
            await check_permissions(db, current_user, ["system:user:create"])
        
        # 检查用户名是否已存在
        result = await db.execute(select(User).where(User.username == user_in.username))
        if result.scalar_one_or_none():
            return error_response(message="用户名已存在")

        # 检查邮箱是否已存在
        if user_in.email:
            result = await db.execute(select(User).where(User.email == user_in.email))
            if result.scalar_one_or_none():
                return error_response(message="邮箱已存在")

        # 检查手机号是否已存在
        if user_in.mobile:
            result = await db.execute(select(User).where(User.mobile == user_in.mobile))
            if result.scalar_one_or_none():
                return error_response(message="手机号已存在")

        # 创建新用户 - 默认设置is_active为True
        db_user = User(
            username=user_in.username,
            email=user_in.email,
            mobile=user_in.mobile,
            hashed_password=get_password_hash(user_in.password),
            is_active=True,  # 默认启用用户
            is_superuser=user_in.is_superuser
        )

        db.add(db_user)
        
        # 如果有角色ID，则验证并分配角色
        if user_in.role_ids:
            for role_id in user_in.role_ids:
                role = await db.get(Role, role_id)
                if not role:
                    return error_response(message=f"角色ID {role_id} 不存在")
                db_user.roles.append(role)

        # 完成事务
        await db.commit()
        await db.refresh(db_user)

        return success_response(data=db_user, message="用户创建成功")
    except Exception as e:
        logger.error(f"创建用户失败: {str(e)}")
        return error_response(message=f"创建用户失败: {str(e)}")


@router.get("/{user_id}", response_model=APIResponse[UserResponse])
async def read_user(
        user_id: int,
        current_user: Annotated[User, Depends(get_current_active_user)],
        db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    获取特定用户
    """
    try:
        # 普通用户只能获取自己的信息
        if not current_user.is_superuser and current_user.id != user_id:
            return error_response(message="没有足够的权限")

        user = await db.get(User, user_id)
        if not user:
            return error_response(message="用户不存在")

        return success_response(data=user)
    except Exception as e:
        logger.error(f"获取用户详情失败: {str(e)}")
        return error_response(message=f"获取用户详情失败: {str(e)}")


@router.post("/update/{user_id}", response_model=APIResponse[UserResponse])
async def update_user(
        user_id: int,
        user_in: UserUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新用户信息
    """
    try:
        # 权限检查：超级管理员、更新自己的信息，或拥有system:user:update权限的用户
        if not current_user.is_superuser and current_user.id != user_id:
            # 非超级管理员且不是更新自己的信息，检查是否有更新权限
            await check_permissions(db, current_user, ["system:user:update"])

        # 获取用户
        user = await db.get(User, user_id)
        if not user:
            return error_response(message="用户不存在")

        # 检查用户名是否已存在
        if user_in.username and user_in.username != user.username:
            result = await db.execute(select(User).where(User.username == user_in.username))
            if result.scalar_one_or_none():
                return error_response(message="用户名已存在")

        # 检查邮箱是否已存在
        if user_in.email and user_in.email != user.email:
            result = await db.execute(select(User).where(User.email == user_in.email))
            if result.scalar_one_or_none():
                return error_response(message="邮箱已存在")

        # 检查手机号是否已存在
        if user_in.mobile and user_in.mobile != user.mobile:
            result = await db.execute(select(User).where(User.mobile == user_in.mobile))
            if result.scalar_one_or_none():
                return error_response(message="手机号已存在")

        # 更新用户数据
        update_data = user_in.model_dump(exclude_unset=True)
        if "password" in update_data:
            update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
        
        for key, value in update_data.items():
            setattr(user, key, value)

        await db.commit()
        await db.refresh(user)

        return success_response(data=user, message="用户更新成功")
    except Exception as e:
        logger.error(f"更新用户失败: {str(e)}")
        return error_response(message=f"更新用户失败: {str(e)}")


@router.post("/update_status/{user_id}", response_model=APIResponse[UserResponse])
async def update_user_status(
        user_id: int,
        status_update: UserStatusUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新用户状态
    """
    try:
        # 权限检查
        if not current_user.is_superuser:
            await check_permissions(db, current_user, ["system:user:update"])

        # 获取用户
        user = await db.get(User, user_id)
        if not user:
            return error_response(message="用户不存在")
            
        # 特殊保护：如果目标用户是超级管理员(admin)，则只允许其他超级管理员修改其状态
        if user.is_superuser and not current_user.is_superuser:
            return error_response(message="没有权限修改管理员用户的状态")
            
        # 特殊保护：如果是系统初始管理员(username='admin')，不允许被禁用
        if user.username == 'admin' and not status_update.is_active:
            return error_response(message="系统初始管理员账号不能被禁用")
            
        # 自我保护：防止用户禁用自己的账号
        if user_id == current_user.id and not status_update.is_active:
            return error_response(message="不能禁用自己的账号")

        # 更新状态
        user.is_active = status_update.is_active
        await db.commit()
        await db.refresh(user)

        return success_response(data=user, message="用户状态更新成功")
    except Exception as e:
        logger.error(f"更新用户状态失败: {str(e)}")
        return error_response(message=f"更新用户状态失败: {str(e)}")


@router.post("/delete/{user_id}", response_model=APIResponse)
async def delete_user(
        user_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    删除用户
    """
    try:
        # 权限检查
        if not current_user.is_superuser:
            await check_permissions(db, current_user, ["system:user:delete"])

        # 获取用户
        user = await db.get(User, user_id)
        if not user:
            return error_response(message="用户不存在")
            
        # 特殊保护：如果目标用户是超级管理员(admin)，则只允许其他超级管理员删除
        if user.is_superuser and not current_user.is_superuser:
            return error_response(message="没有权限删除管理员用户")
            
        # 特殊保护：如果是系统初始管理员(username='admin')，不允许被删除
        if user.username == 'admin':
            return error_response(message="系统初始管理员账号不能被删除")
            
        # 自我保护：防止用户删除自己的账号
        if user_id == current_user.id:
            return error_response(message="不能删除自己的账号")

        # 删除用户
        await db.delete(user)
        await db.commit()

        return success_response(message="用户删除成功")
    except Exception as e:
        logger.error(f"删除用户失败: {str(e)}")
        return error_response(message=f"删除用户失败: {str(e)}")


@router.get("/{user_id}/roles", response_model=APIResponse[List[RoleResponse]])
async def read_user_roles(
        user_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取用户的角色列表
    """
    try:
        # 权限检查
        if not current_user.is_superuser and current_user.id != user_id:
            await check_permissions(db, current_user, ["system:user:query"])

        # 获取用户
        user = await db.get(User, user_id)
        if not user:
            return error_response(message="用户不存在")

        # 获取用户角色 - 使用同步函数获取关系，避免greenlet错误
        def get_user_roles(session, user_obj):
            # 预加载user的roles关系
            session.refresh(user_obj, ["roles"])
            return list(user_obj.roles)
            
        # 使用run_sync在同步上下文中执行
        roles = await db.run_sync(get_user_roles, user)

        return success_response(data=roles)
    except Exception as e:
        logger.error(f"获取用户角色失败: {str(e)}")
        return error_response(message=f"获取用户角色失败: {str(e)}")


@router.post("/{user_id}/update_roles", response_model=APIResponse)
async def update_user_roles(
        user_id: int,
        roles_in: UserRoleUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新用户的角色
    """
    try:
        # 权限检查
        if not current_user.is_superuser:
            await check_permissions(db, current_user, ["system:user:update"])

        # 获取用户
        user = await db.get(User, user_id)
        if not user:
            return error_response(message="用户不存在")

        # 验证所有角色是否存在
        for role_id in roles_in.role_ids:
            role = await db.get(Role, role_id)
            if not role:
                return error_response(message=f"角色ID {role_id} 不存在")

        # 更新用户角色
        def update_user_roles_sync(session, user_obj, roles_list):
            # 清空用户的当前角色
            user_obj.roles = []
            # 添加新角色
            for role_id in roles_list:
                role = session.get(Role, role_id)
                if role:
                    user_obj.roles.append(role)

        await db.run_sync(update_user_roles_sync, user, roles_in.role_ids)
        await db.commit()

        return success_response(message="用户角色更新成功")
    except Exception as e:
        logger.error(f"更新用户角色失败: {str(e)}")
        return error_response(message=f"更新用户角色失败: {str(e)}")
