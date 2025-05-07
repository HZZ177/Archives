from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.api.deps import get_current_active_user, get_current_admin_user, get_db, get_user_permissions
from backend.app.models.user import User
from backend.app.models.permission import Permission
from backend.app.schemas.permission import PermissionCreate, PermissionResponse, PermissionUpdate, PermissionTree
from backend.app.models.user import Role

router = APIRouter()


@router.get("/", response_model=List[PermissionResponse])
async def read_permissions(
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)],
        skip: int = 0,
        limit: int = 1000
):
    """
    获取所有页面权限列表（扁平结构）
    """
    result = await db.execute(
        select(Permission)
        .options(selectinload(Permission.children))
        .offset(skip)
        .limit(limit)
    )
    permissions = result.scalars().all()
    return permissions


@router.get("/tree", response_model=List[PermissionTree])
async def read_permissions_tree(
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取页面权限树（树形结构）
    """
    # 查询所有顶级权限
    result = await db.execute(
        select(Permission)
        .options(selectinload(Permission.children))
        .where(Permission.parent_id.is_(None))
        .order_by(Permission.sort)
    )
    
    permissions = result.unique().scalars().all()
    return permissions


@router.post("/", response_model=PermissionResponse, status_code=status.HTTP_201_CREATED)
async def create_permission(
        permission_in: PermissionCreate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_admin_user)]
):
    """
    创建新页面权限
    """
    # 检查权限代码是否已存在
    result = await db.execute(select(Permission).where(Permission.code == permission_in.code))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="权限代码已存在"
        )

    # 检查页面路径是否已存在
    result = await db.execute(select(Permission).where(Permission.page_path == permission_in.page_path))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="页面路径已存在"
        )

    # 如果有父权限，检查是否存在
    if permission_in.parent_id:
        parent = await db.get(Permission, permission_in.parent_id)
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="父权限不存在"
            )

    # 创建新权限
    db_permission = Permission(**permission_in.model_dump())

    db.add(db_permission)
    await db.commit()
    await db.refresh(db_permission)

    return db_permission


@router.get("/{permission_id}", response_model=PermissionResponse)
async def read_permission(
        permission_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取特定页面权限详情
    """
    permission = await db.get(Permission, permission_id)
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="权限不存在"
        )

    return permission


@router.put("/{permission_id}", response_model=PermissionResponse)
async def update_permission(
        permission_id: int,
        permission_in: PermissionUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_admin_user)]
):
    """
    更新页面权限信息
    """
    # 获取权限
    permission = await db.get(Permission, permission_id)
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="权限不存在"
        )

    # 检查权限代码是否已存在
    if permission_in.code and permission_in.code != permission.code:
        result = await db.execute(select(Permission).where(Permission.code == permission_in.code))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="权限代码已存在"
            )
    
    # 检查页面路径是否已存在
    if permission_in.page_path and permission_in.page_path != permission.page_path:
        result = await db.execute(select(Permission).where(Permission.page_path == permission_in.page_path))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="页面路径已存在"
            )

    # 如果更新了父权限，检查是否存在
    if permission_in.parent_id and permission_in.parent_id != permission.parent_id:
        # 不能将自己设为自己的父级
        if permission_in.parent_id == permission_id:
            raise HTTPException(
                status_code=400,
                detail="不能将自己设为自己的父级"
            )
        
        parent = await db.get(Permission, permission_in.parent_id)
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="父权限不存在"
            )

    # 更新权限数据
    update_data = permission_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(permission, key, value)

    await db.commit()
    await db.refresh(permission)

    return permission


@router.delete("/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_permission(
        permission_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_admin_user)]
):
    """
    删除页面权限
    """
    # 获取权限
    permission = await db.get(Permission, permission_id)
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="权限不存在"
        )

    # 检查是否有子权限
    result = await db.execute(select(Permission).where(Permission.parent_id == permission_id))
    if result.first():
        raise HTTPException(
            status_code=400,
            detail="该权限下有子权限，无法删除"
        )

    # 删除权限
    await db.delete(permission)
    await db.commit()

    return None


@router.get("/user/pages", response_model=List[str])
async def read_current_user_pages(
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取当前用户可访问的所有页面路径
    """
    # 超级管理员可以访问所有页面
    if current_user.is_superuser:
        result = await db.execute(select(Permission.page_path))
        pages = [row[0] for row in result.all()]
        return pages
    
    # 查询用户角色及对应的页面权限
    stmt = select(Permission.page_path).join(
        Permission.roles
    ).join(
        Role.users
    ).filter(
        User.id == current_user.id
    ).distinct()
    
    result = await db.execute(stmt)
    pages = [row[0] for row in result.all()]
    
    return pages


@router.get("/user/current", response_model=List[str])
async def read_current_user_permissions(
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取当前用户的所有权限（兼容旧接口）
    """
    user_permissions = await get_user_permissions(db, current_user)
    return user_permissions 