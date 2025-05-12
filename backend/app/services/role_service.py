from typing import List, Optional, Dict, Any, Tuple
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.logger import logger
from backend.app.models.user import Role
from backend.app.repositories.role_repository import role_repository
from backend.app.schemas.role import RoleCreate, RoleUpdate, RoleWithPermissions


class RoleService:
    """
    角色相关业务逻辑服务
    """
    
    async def get_roles_list(
        self, 
        db: AsyncSession, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[Role]:
        """
        获取角色列表
        """
        try:
            roles = await role_repository.get_all_roles(db, skip, limit)
            return roles
        except Exception as e:
            logger.error(f"获取角色列表服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="获取角色列表失败"
            )
    
    async def create_role(
        self, 
        db: AsyncSession, 
        role_data: RoleCreate
    ) -> Role:
        """
        创建角色（含验证逻辑）
        """
        try:
            # 检查角色名是否已存在
            name_exists = await role_repository.check_role_name_exists(db, role_data.name)
            if name_exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="角色名已存在"
                )
            
            # 创建角色
            role_dict = role_data.model_dump(exclude={'permission_ids'})
            permission_ids = role_data.permission_ids if role_data.permission_ids else None
            
            return await role_repository.create_role(db, role_dict, permission_ids)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"创建角色服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建角色失败: {str(e)}"
            )
    
    async def get_role(self, db: AsyncSession, role_id: int) -> Role:
        """
        获取单个角色（带错误处理）
        """
        try:
            role = await role_repository.get_role_by_id(db, role_id)
            if not role:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="角色不存在"
                )
            return role
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取角色服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取角色失败: {str(e)}"
            )
    
    async def get_role_with_permissions(self, db: AsyncSession, role_id: int) -> Dict[str, Any]:
        """
        获取带权限的角色详情
        """
        try:
            role_with_permissions = await role_repository.get_role_with_permissions(db, role_id)
            if not role_with_permissions:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="角色不存在"
                )
            
            # 在角色对象上设置权限列表的浅拷贝，避免延迟加载问题
            permissions_list = []
            for perm in role_with_permissions.permissions:
                # 创建权限对象的浅拷贝，避免延迟加载children
                perm_dict = {
                    "id": perm.id,
                    "code": perm.code,
                    "name": perm.name,
                    "page_path": perm.page_path,
                    "icon": perm.icon,
                    "sort": perm.sort,
                    "is_visible": perm.is_visible,
                    "parent_id": perm.parent_id,
                    "description": perm.description,
                    "created_at": perm.created_at,
                    "updated_at": perm.updated_at,
                    "children": []  # 不包含children，避免递归问题
                }
                permissions_list.append(perm_dict)
            
            # 设置结果
            result = {
                "id": role_with_permissions.id,
                "name": role_with_permissions.name,
                "description": role_with_permissions.description,
                "is_default": role_with_permissions.is_default,
                "status": role_with_permissions.status,
                "created_at": role_with_permissions.created_at,
                "updated_at": role_with_permissions.updated_at,
                "permissions": permissions_list
            }
            
            return result
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取角色详情服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取角色详情失败: {str(e)}"
            )
    
    async def update_role(
        self, 
        db: AsyncSession, 
        role_id: int, 
        role_data: RoleUpdate
    ) -> Role:
        """
        更新角色（含验证逻辑）
        """
        try:
            # 检查角色是否存在
            role = await self.get_role(db, role_id)
            
            # 检查角色名是否已存在
            if role_data.name and role_data.name != role.name:
                name_exists = await role_repository.check_role_name_exists(db, role_data.name, exclude_id=role_id)
                if name_exists:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="角色名已存在"
                    )
            
            # 检查是否要禁用角色，并且该角色已分配给用户
            if role_data.status is False and role.status is True:
                # 检查是否有用户使用该角色
                has_users = await role_repository.check_role_has_users(db, role_id)
                if has_users:
                    logger.warning(f"尝试禁用已分配给用户的角色: {role_id}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="该角色已分配给用户，无法禁用。请先解除用户与该角色的关联。"
                    )
            
            # 更新角色
            role_dict = role_data.model_dump(exclude={'permission_ids'}, exclude_unset=True)
            permission_ids = role_data.permission_ids if hasattr(role_data, 'permission_ids') and role_data.permission_ids is not None else None
            
            return await role_repository.update_role(db, role, role_dict, permission_ids)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"更新角色服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新角色失败: {str(e)}"
            )
    
    async def delete_role(self, db: AsyncSession, role_id: int) -> str:
        """
        删除角色（含验证逻辑）
        """
        try:
            # 检查角色是否存在
            role = await self.get_role(db, role_id)
            
            # 检查是否为默认角色
            if role.is_default:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="不能删除默认角色"
                )
            
            # 检查是否有用户使用该角色
            has_users = await role_repository.check_role_has_users(db, role_id)
            if has_users:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="该角色正在被用户使用，无法删除"
                )
            
            # 删除角色
            await role_repository.delete_role(db, role)
            
            return "角色删除成功"
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"删除角色服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除角色失败: {str(e)}"
            )
    
    async def get_role_permissions(self, db: AsyncSession, role_id: int) -> List[int]:
        """
        获取角色权限ID列表
        """
        try:
            # 检查角色是否存在
            role = await self.get_role(db, role_id)
            
            # 获取权限ID列表
            return await role_repository.get_role_permissions(db, role_id)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取角色权限服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取角色权限失败: {str(e)}"
            )
    
    async def update_role_permissions(
        self, 
        db: AsyncSession, 
        role_id: int, 
        permission_ids: List[int]
    ) -> str:
        """
        更新角色权限
        """
        try:
            # 检查角色是否存在
            role = await self.get_role(db, role_id)
            
            # 更新权限
            await role_repository.update_role_permissions(db, role, permission_ids)
            await db.commit()
            
            return "角色权限更新成功"
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"更新角色权限服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新角色权限失败: {str(e)}"
            )


# 创建服务实例
role_service = RoleService() 