from typing import List, Optional, Set, Tuple
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.logger import logger
from backend.app.models.permission import Permission
from backend.app.models.user import User
from backend.app.repositories.permission_repository import permission_repository
from backend.app.schemas.permission import PermissionCreate, PermissionResponse, PermissionTree, PermissionUpdate


class PermissionService:
    """
    权限相关业务逻辑服务
    """
    
    async def get_permissions_list(
        self, 
        db: AsyncSession, 
        skip: int = 0, 
        limit: int = 1000
    ) -> List[Permission]:
        """
        获取权限列表（扁平结构）
        """
        try:
            permissions = await permission_repository.get_all_permissions(db, skip, limit)
            return permissions
        except Exception as e:
            logger.error(f"获取权限列表服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="获取权限列表失败"
            )
    
    async def get_permissions_tree(self, db: AsyncSession) -> List[Permission]:
        """
        获取权限树（树形结构）
        """
        try:
            permissions_tree = await permission_repository.get_permissions_tree(db)
            return permissions_tree
        except Exception as e:
            logger.error(f"获取权限树服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="获取权限树失败"
            )
    
    async def create_permission(
        self, 
        db: AsyncSession, 
        permission_data: PermissionCreate
    ) -> Permission:
        """
        创建权限（含验证逻辑）
        """
        try:
            # 检查代码是否已存在
            if permission_data.code:
                code_exists = await permission_repository.check_code_exists(db, permission_data.code)
                if code_exists:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"权限代码 '{permission_data.code}' 已存在"
                    )
            
            # 检查页面路径是否已存在
            if permission_data.page_path:
                path_exists = await permission_repository.check_page_path_exists(db, permission_data.page_path)
                if path_exists:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"页面路径 '{permission_data.page_path}' 已存在"
                    )
            
            # 检查父权限是否存在
            if permission_data.parent_id:
                parent = await permission_repository.get_permission_by_id(db, permission_data.parent_id)
                if not parent:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"父权限 ID {permission_data.parent_id} 不存在"
                    )
            
            # 创建权限
            return await permission_repository.create_permission(db, permission_data)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"创建权限服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="创建权限失败"
            )
    
    async def get_permission(self, db: AsyncSession, permission_id: int) -> Permission:
        """
        获取单个权限（带错误处理）
        """
        try:
            permission = await permission_repository.get_permission_by_id(db, permission_id)
            if not permission:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"权限 ID {permission_id} 不存在"
                )
            return permission
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取权限服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="获取权限失败"
            )
    
    async def update_permission(
        self, 
        db: AsyncSession, 
        permission_id: int, 
        permission_data: PermissionUpdate
    ) -> Permission:
        """
        更新权限（含验证逻辑）
        """
        try:
            # 检查权限是否存在
            permission = await self.get_permission(db, permission_id)
            
            # 检查代码是否已存在
            if permission_data.code:
                code_exists = await permission_repository.check_code_exists(
                    db, permission_data.code, exclude_id=permission_id
                )
                if code_exists:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"权限代码 '{permission_data.code}' 已存在"
                    )
            
            # 检查页面路径是否已存在
            if permission_data.page_path:
                path_exists = await permission_repository.check_page_path_exists(
                    db, permission_data.page_path, exclude_id=permission_id
                )
                if path_exists:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"页面路径 '{permission_data.page_path}' 已存在"
                    )
            
            # 检查父权限是否存在，并防止递归
            if permission_data.parent_id:
                if permission_data.parent_id == permission_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="不能将自身设为父权限"
                    )
                
                parent = await permission_repository.get_permission_by_id(db, permission_data.parent_id)
                if not parent:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"父权限 ID {permission_data.parent_id} 不存在"
                    )
            
            # 更新权限
            return await permission_repository.update_permission(db, permission, permission_data)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"更新权限服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="更新权限失败"
            )
    
    async def delete_permission(self, db: AsyncSession, permission_id: int) -> Tuple[bool, str]:
        """
        删除权限（含验证逻辑）
        
        Returns:
            Tuple[bool, str]: (是否成功, 消息)
        """
        try:
            # 检查权限是否存在
            permission = await self.get_permission(db, permission_id)
            
            # 检查是否有子权限
            has_children = await permission_repository.check_has_children(db, permission_id)
            if has_children:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="无法删除有子权限的权限，请先删除子权限"
                )
            
            # 检查是否有角色使用该权限
            roles_using = await permission_repository.check_roles_using_permission(db, permission_id)
            if roles_using:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="无法删除正在使用的权限，请先解除与角色的关联"
                )
            
            # 删除权限
            await permission_repository.delete_permission(db, permission)
            return True, f"成功删除权限 ID {permission_id}"
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"删除权限服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="删除权限失败"
            )
    
    async def get_user_permissions(self, db: AsyncSession, user: User) -> Set[str]:
        """
        获取用户权限代码列表
        """
        try:
            return await permission_repository.get_user_permissions(db, user)
        except Exception as e:
            logger.error(f"获取用户权限服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="获取用户权限失败"
            )
    
    async def get_user_pages(self, db: AsyncSession, user: User) -> List[str]:
        """
        获取用户可访问的页面路径列表
        """
        try:
            return await permission_repository.get_user_pages(db, user)
        except Exception as e:
            logger.error(f"获取用户页面服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="获取用户页面失败"
            )


# 创建权限服务实例
permission_service = PermissionService() 