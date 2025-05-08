from typing import Annotated, List, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from backend.app.api.deps import get_current_active_user, get_current_admin_user, get_db, check_permissions
from backend.app.core.logger import logger
from backend.app.core.security import get_password_hash
from backend.app.models.user import User, Role, user_role
from backend.app.schemas.role import RoleResponse, UserRoleUpdate
from backend.app.schemas.user import UserCreate, UserResponse, UserUpdate

router = APIRouter()


@router.get("/", response_model=List[UserResponse])
async def read_users(
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)],
        skip: int = 0,
        limit: int = 100
):
    """
    获取所有用户列表
    """
    # 权限检查
    if not current_user.is_superuser:
        await check_permissions(db, current_user, ["system:user:list"])
    
    result = await db.execute(select(User).offset(skip).limit(limit))
    users = result.scalars().all()
    return users


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
        user_in: UserCreate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    创建新用户，同时支持角色分配
    """
    # 权限检查
    if not current_user.is_superuser:
        await check_permissions(db, current_user, ["system:user:create"])
    
    # 检查用户名是否已存在
    result = await db.execute(select(User).where(User.username == user_in.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="用户名已存在"
        )

    # 检查邮箱是否已存在
    if user_in.email:
        result = await db.execute(select(User).where(User.email == user_in.email))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="邮箱已存在"
            )

    # 检查手机号是否已存在
    if user_in.mobile:
        result = await db.execute(select(User).where(User.mobile == user_in.mobile))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="手机号已存在"
            )

    # 创建新用户
    db_user = User(
        username=user_in.username,
        email=user_in.email,
        mobile=user_in.mobile,
        hashed_password=get_password_hash(user_in.password),
        is_active=user_in.is_active,
        is_superuser=user_in.is_superuser
    )

    db.add(db_user)
    
    # 如果有角色ID，则验证并分配角色
    if user_in.role_ids:
        for role_id in user_in.role_ids:
            role = await db.get(Role, role_id)
            if not role:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"角色ID {role_id} 不存在"
                )
            db_user.roles.append(role)

    # 完成事务
    await db.commit()
    await db.refresh(db_user)

    return db_user


@router.get("/{user_id}", response_model=UserResponse)
async def read_user(
        user_id: int,
        current_user: Annotated[User, Depends(get_current_active_user)],
        db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    获取特定用户
    """
    # 普通用户只能获取自己的信息
    if not current_user.is_superuser and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有足够的权限"
        )

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
        user_id: int,
        user_in: UserUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新用户信息
    """
    # 权限检查：超级管理员、更新自己的信息，或拥有system:user:update权限的用户
    if not current_user.is_superuser and current_user.id != user_id:
        # 非超级管理员且不是更新自己的信息，检查是否有更新权限
        await check_permissions(db, current_user, ["system:user:update"])

    # 获取用户
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    # 检查用户名是否已存在
    if user_in.username and user_in.username != user.username:
        result = await db.execute(select(User).where(User.username == user_in.username))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="用户名已存在"
            )

    # 检查邮箱是否已存在
    if user_in.email and user_in.email != user.email:
        result = await db.execute(select(User).where(User.email == user_in.email))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="邮箱已存在"
            )

    # 检查手机号是否已存在
    if user_in.mobile and user_in.mobile != user.mobile:
        result = await db.execute(select(User).where(User.mobile == user_in.mobile))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="手机号已存在"
            )

    # 更新用户数据
    update_data = user_in.model_dump(exclude_unset=True)

    # 处理密码
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data["password"])
        del update_data["password"]

    # 非管理员不能修改管理员状态
    if not current_user.is_superuser and "is_superuser" in update_data:
        del update_data["is_superuser"]

    # 更新用户数据
    for key, value in update_data.items():
        setattr(user, key, value)

    await db.commit()
    await db.refresh(user)

    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
        user_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    删除用户
    """
    # 权限检查
    if not current_user.is_superuser:
        await check_permissions(db, current_user, ["system:user:delete"])
    
    # 获取用户
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    # 不能删除当前用户
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除当前登录用户"
        )

    # 删除用户
    await db.delete(user)
    await db.commit()

    return None


@router.get("/{user_id}/roles", response_model=List[RoleResponse])
async def read_user_roles(
        user_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取用户的角色
    """
    # 权限检查：超级管理员、查看自己的信息，或拥有system:user:query权限的用户
    if not current_user.is_superuser and current_user.id != user_id:
        # 非超级管理员且不是查看自己的信息，检查是否有查询权限
        await check_permissions(db, current_user, ["system:user:query"])

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    # 获取用户角色
    result = await db.execute(
        select(Role)
        .join(user_role, Role.id == user_role.c.role_id)
        .where(user_role.c.user_id == user_id)
    )
    roles = result.scalars().all()

    return roles


@router.put("/{user_id}/roles", response_model=Any)
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
            # 检查目标用户是否为超级管理员或其他特殊用户
            target_user = await db.get(User, user_id)
            if target_user and target_user.is_superuser:
                # 返回200状态码和明确的错误消息，而不是抛出403异常
                return {
                    "success": False,
                    "message": "权限不足：普通用户不能修改管理员用户的角色",
                    "roles": []
                }
            
            # 检查是否有更新权限
            try:
                await check_permissions(db, current_user, ["system:user:update"])
            except HTTPException as e:
                if e.status_code == status.HTTP_403_FORBIDDEN:
                    # 返回200状态码和明确的错误消息，而不是抛出403异常
                    return {
                        "success": False,
                        "message": e.detail,
                        "roles": []
                    }
                raise e
        
        # 获取用户
        user = await db.get(User, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )

        # 查询所有角色是否存在
        roles = []
        for role_id in roles_in.role_ids:
            role = await db.get(Role, role_id)
            if not role:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"角色ID {role_id} 不存在"
                )
            roles.append(role)
        
        # 定义一个同步函数来处理关系
        def update_user_roles_sync(session, user_obj, roles_list):
            # 清空用户的当前角色
            user_obj.roles = []
            # 添加新的角色
            for role in roles_list:
                user_obj.roles.append(role)
        
        # 使用run_sync在同步上下文中执行关系操作
        await db.run_sync(lambda session: update_user_roles_sync(session, user, roles))
        
        # 提交事务
        await db.commit()
        await db.refresh(user)

        # 查询更新后的用户角色
        result = await db.execute(
            select(Role)
            .join(user_role, Role.id == user_role.c.role_id)
            .where(user_role.c.user_id == user_id)
        )
        updated_roles = result.scalars().all()
        
        return {
            "success": True,
            "message": "角色更新成功",
            "roles": updated_roles
        }
    
    except HTTPException:
        # 重新抛出HTTP异常
        raise
    except Exception as e:
        # 记录并包装其他异常
        logger.error(f"更新用户角色失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新用户角色失败: {str(e)}"
        )
