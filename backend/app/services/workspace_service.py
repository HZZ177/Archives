from typing import List, Optional, Tuple, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.models.workspace import Workspace, WorkspaceTable
from backend.app.repositories.workspace_repository import workspace_repository
from backend.app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate, WorkspaceAddUser, WorkspaceBatchAddUsers, WorkspaceBatchRemoveUsers, WorkspaceTableCreate, WorkspaceTableUpdate, WorkspaceInterface, WorkspaceInterfaceCreate, WorkspaceInterfaceUpdate
from backend.app.repositories.auth_repository import auth_repository


class WorkspaceService:
    """工作区服务类"""

    async def create_workspace(self, db: AsyncSession, workspace_in: WorkspaceCreate, current_user: User) -> Workspace:
        """创建新工作区"""
        # 如果将要创建的工作区设为默认，先将其他默认工作区取消默认状态
        if workspace_in.is_default:
            await workspace_repository.reset_default_workspaces(db)

        # 创建工作区
        workspace = await workspace_repository.create(db, workspace_in, current_user.id)
        
        # 将创建者添加为工作区管理员(如果不是超级管理员，则添加为普通管理员，否则添加为所有者)
        await workspace_repository.add_user_to_workspace(
            db, 
            workspace.id, 
            current_user.id, 
            "owner" if current_user.is_superuser else "admin"
        )
        
        # 确保admin账号(第一个超级管理员)被添加为工作区所有者
        try:
            # 获取第一个超级管理员用户
            admin_user = await auth_repository.get_first_superuser(db)
            
            # 如果找到admin用户，且不是当前用户，则将其添加为工作区所有者
            if admin_user and admin_user.id != current_user.id:
                # 检查admin是否已有权限及权限级别
                admin_access = await workspace_repository.get_user_access_level(db, workspace.id, admin_user.id)
                
                # 如果admin尚未添加或不是所有者，则设置为所有者
                if not admin_access or admin_access != "owner":
                    await workspace_repository.add_user_to_workspace(
                        db, workspace.id, admin_user.id, "owner"
                    )
                    logger.info(f"已将管理员(ID:{admin_user.id})添加为工作区(ID:{workspace.id})的所有者")
        except Exception as e:
            # 记录错误但不影响创建过程
            logger.error(f"将管理员添加到工作区失败: {str(e)}")
        
        return workspace

    async def get_workspace(self, db: AsyncSession, workspace_id: int) -> Workspace:
        """获取工作区详情"""
        workspace = await workspace_repository.get_by_id(db, workspace_id)
        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"工作区 ID {workspace_id} 不存在"
            )
        return workspace

    async def get_workspaces(self, db: AsyncSession, current_user: User) -> List[Workspace]:
        """获取当前用户有权限访问的所有工作区"""
        # 超级管理员可以访问所有工作区
        if current_user.is_superuser:
            return await workspace_repository.get_all_workspaces(db)

        # 普通用户只能访问被授权的工作区
        return await workspace_repository.get_user_workspaces(db, current_user.id)

    async def update_workspace(
        self, db: AsyncSession, workspace_id: int, workspace_in: WorkspaceUpdate, current_user: User
    ) -> Workspace:
        """更新工作区"""
        workspace = await self.get_workspace(db, workspace_id)

        # 检查权限: 只有超级管理员、工作区所有者或管理员可以更新
        if not current_user.is_superuser:
            user_access = await workspace_repository.get_user_access_level(db, workspace_id, current_user.id)
            if user_access not in ["admin", "owner"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="只有管理员或所有者可以更新工作区信息"
                )

        # 如果要将此工作区设为默认，先重置其他默认工作区
        if workspace_in.is_default and workspace_in.is_default != workspace.is_default:
            await workspace_repository.reset_default_workspaces(db)

        # 更新字段
        update_data = workspace_in.dict(exclude_unset=True)
        return await workspace_repository.update_workspace(db, workspace, update_data)

    async def delete_workspace(self, db: AsyncSession, workspace_id: int, current_user: User) -> Dict[str, Any]:
        """删除工作区"""
        workspace = await self.get_workspace(db, workspace_id)

        # 检查是否为默认工作区
        if workspace.is_default:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不能删除默认工作区"
            )

        # 检查权限: 超级管理员或工作区所有者可以删除工作区
        if not current_user.is_superuser:
            # 检查用户是否是工作区所有者
            user_access = await workspace_repository.get_user_access_level(db, workspace_id, current_user.id)
            if user_access != "owner":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="只有超级管理员或工作区所有者可以删除工作区"
                )

        # 删除工作区
        await workspace_repository.delete_workspace(db, workspace)
        return {"success": True}

    async def add_user_to_workspace(
        self, db: AsyncSession, workspace_id: int, user_data: WorkspaceAddUser, current_user: User
    ) -> Dict[str, Any]:
        """添加用户到工作区"""
        # 验证工作区是否存在
        workspace = await self.get_workspace(db, workspace_id)

        # 检查权限: 只有超级管理员或工作区管理员可以添加用户
        if not current_user.is_superuser:
            user_access = await workspace_repository.get_user_access_level(db, workspace_id, current_user.id)
            if user_access != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="只有工作区管理员可以添加用户"
                )
        
        # 检查用户是否已在工作区中
        user_access = await workspace_repository.get_user_access_level(db, workspace_id, user_data.user_id)
        if user_access:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户已存在于此工作区"
            )
        
        # 添加用户到工作区
        await workspace_repository.add_user_to_workspace(
            db, workspace_id, user_data.user_id, user_data.access_level
        )
        
        return {"success": True, "message": "用户已添加到工作区"}

    async def update_user_role(
        self, db: AsyncSession, workspace_id: int, user_id: int, role: str, current_user: User
    ) -> Dict[str, Any]:
        """更新用户在工作区中的角色"""
        # 验证工作区是否存在
        workspace = await self.get_workspace(db, workspace_id)

        # 检查权限: 只有超级管理员或工作区管理员可以更新用户角色
        if not current_user.is_superuser:
            user_access = await workspace_repository.get_user_access_level(db, workspace_id, current_user.id)
            if user_access != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="只有工作区管理员可以更新用户角色"
                )
        
        # 更新用户角色
        await workspace_repository.add_user_to_workspace(db, workspace_id, user_id, role)
        
        return {"success": True, "message": "用户角色已更新"}

    async def update_workspace_user_role(
        self, db: AsyncSession, workspace_id: int, user_id: int, access_level: str, current_user: User
    ) -> Dict[str, Any]:
        """更新用户在工作区中的角色，并返回完整的用户信息"""
        # 验证工作区是否存在
        workspace = await self.get_workspace(db, workspace_id)

        # 检查权限: 只有超级管理员或工作区管理员可以更新用户角色
        if not current_user.is_superuser:
            user_access = await workspace_repository.get_user_access_level(db, workspace_id, current_user.id)
            if user_access != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="只有工作区管理员可以更新用户角色"
                )
        
        # 检查要更新的用户是否存在
        target_user = await auth_repository.get_user_by_id(db, user_id)
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"用户ID {user_id} 不存在"
            )
        
        # 不能修改超级管理员的角色
        if target_user.is_superuser and access_level != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="不能修改超级管理员的工作区角色"
            )
        
        # 更新用户角色
        await workspace_repository.add_user_to_workspace(db, workspace_id, user_id, access_level)
        
        # 返回完整的用户信息，包括更新后的角色
        return {
            "user_id": target_user.id,
            "username": target_user.username,
            "email": target_user.email,
            "is_superuser": target_user.is_superuser,
            "access_level": access_level,
            "workspace_id": workspace_id,
            "created_at": target_user.created_at.isoformat() if target_user.created_at else None,
        }

    async def remove_user_from_workspace(
        self, db: AsyncSession, workspace_id: int, user_id: int, current_user: User
    ) -> Dict[str, Any]:
        """从工作区移除用户"""
        # 验证工作区是否存在
        workspace = await self.get_workspace(db, workspace_id)

        # 检查权限: 只有超级管理员或工作区管理员可以移除用户
        if not current_user.is_superuser:
            user_access = await workspace_repository.get_user_access_level(db, workspace_id, current_user.id)
            if user_access not in ["admin", "owner"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="只有工作区管理员或所有者可以移除用户"
                )
        
        # 检查要移除的用户是否是超级管理员
        target_user = await auth_repository.get_user_by_id(db, user_id)
        
        if target_user and target_user.is_superuser:
            # 超级管理员不能被移除
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无法移除超级管理员用户"
            )
        
        # 移除用户
        await workspace_repository.remove_user_from_workspace(db, workspace_id, user_id)
        return {"success": True, "message": "用户已从工作区移除"}

    async def get_workspace_users(self, db: AsyncSession, workspace_id: int, current_user: User) -> List[Dict[str, Any]]:
        """获取工作区用户列表"""
        # 验证工作区是否存在
        workspace = await self.get_workspace(db, workspace_id)
        
        # 检查用户是否有权访问此工作区
        if not current_user.is_superuser:
            user_access = await workspace_repository.get_user_access_level(db, workspace_id, current_user.id)
            if not user_access:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="没有权限访问此工作区"
                )
        
        # 获取工作区用户
        users = await workspace_repository.get_workspace_users(db, workspace_id)
        
        # 获取用户的完整信息
        # 扩展用户信息
        result = []
        for user_dict in users:
            # 获取完整的用户信息
            user = await auth_repository.get_user_by_id(db, user_dict["user_id"])
            if user:
                user_data = {
                    "id": user.id,
                    "user_id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "is_superuser": user.is_superuser,
                    "access_level": user_dict["access_level"],
                    "workspace_id": workspace_id,
                    "last_login": user.created_at.isoformat() if user.created_at else None,
                    "created_at": user.created_at.isoformat() if user.created_at else None,
                }
                result.append(user_data)
        
        return result

    async def set_user_default_workspace(
        self, db: AsyncSession, user_id: int, workspace_id: int, current_user: User
    ) -> User:
        """设置用户的默认工作区"""
        # 只允许用户设置自己的默认工作区，或由超级管理员设置
        if current_user.id != user_id and not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="不能设置其他用户的默认工作区"
            )

        # 确认工作区存在
        workspace = await self.get_workspace(db, workspace_id)

        # 确认用户有权限访问该工作区
        user_access = await workspace_repository.get_user_access_level(db, workspace_id, user_id)
        if not user_access and not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="用户没有权限访问此工作区"
            )

        # 设置默认工作区
        await workspace_repository.set_user_default_workspace(db, user_id, workspace_id)
        
        # 获取更新后的用户
        return await auth_repository.get_user_by_id(db, user_id)

    async def get_default_workspace(self, db: AsyncSession, current_user: User) -> Workspace:
        """获取用户的默认工作区"""
        # 如果用户有默认工作区，直接返回
        if current_user.default_workspace_id:
            workspace = await self.get_workspace(db, current_user.default_workspace_id)
            return workspace

        # 如果没有默认工作区，尝试获取系统默认工作区
        default_workspace = await workspace_repository.get_default_system_workspace(db)
        if default_workspace:
            # 自动设置为用户的默认工作区
            await workspace_repository.set_user_default_workspace(db, current_user.id, default_workspace.id)
            return default_workspace

        # 如果没有系统默认工作区，尝试获取用户可访问的第一个工作区
        workspaces = await self.get_workspaces(db, current_user)
        if workspaces:
            # 自动设置为用户的默认工作区
            await workspace_repository.set_user_default_workspace(db, current_user.id, workspaces[0].id)
            return workspaces[0]

        # 如果用户没有可访问的工作区，检查是否有任何工作区
        all_workspaces = await workspace_repository.get_all_workspaces(db)
        
        # 如果系统中存在工作区，但用户没有权限
        if all_workspaces:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="您没有权限访问任何工作区"
            )

        # 系统中不存在工作区的情况
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="系统中没有可用的工作区，请联系管理员初始化系统"
        )

    async def add_user_to_default_workspace(self, db: AsyncSession, user_id: int) -> Dict[str, Any]:
        """将用户添加到系统默认工作区"""
        # 获取系统默认工作区
        default_workspace = await workspace_repository.get_default_system_workspace(db)
        
        # 如果没有默认工作区，则获取第一个工作区
        if not default_workspace:
            all_workspaces = await workspace_repository.get_all_workspaces(db)
            if all_workspaces:
                default_workspace = all_workspaces[0]
        
        # 如果仍然没有工作区，则由超级管理员创建一个
        if not default_workspace:
            # 检查超级管理员是否存在
            admin_user = await auth_repository.get_first_superuser(db)
            
            if not admin_user:
                return {
                    "success": False,
                    "message": "系统中没有可用的工作区，且没有超级管理员可以创建工作区"
                }
            
            # 创建默认工作区
            default_workspace_data = {
                "name": "默认工作区",
                "description": "系统默认工作区", 
                "is_default": True
            }
            
            default_workspace = await workspace_repository.create_workspace(
                db, default_workspace_data, admin_user.id
            )
            
            # 将超级管理员添加到默认工作区作为所有者
            await workspace_repository.add_user_to_workspace(
                db, default_workspace.id, admin_user.id, "owner"
            )
        
        # 获取用户
        user = await auth_repository.get_user_by_id(db, user_id)
        if not user:
            return {
                "success": False,
                "message": f"用户ID {user_id} 不存在"
            }
        
        # 检查用户是否已在工作区中
        user_access = await workspace_repository.get_user_access_level(db, default_workspace.id, user_id)
        if user_access:
            return {
                "success": True,
                "message": f"用户已在{default_workspace.name}工作区中",
                "workspace_id": default_workspace.id
            }
        
        # 添加用户到默认工作区，默认为读写权限
        await workspace_repository.add_user_to_workspace(
            db, default_workspace.id, user_id, "write"  # 默认给予读写权限
        )
        
        # 设置为用户的默认工作区
        await workspace_repository.set_user_default_workspace(db, user_id, default_workspace.id)
        
        return {
            "success": True, 
            "message": f"用户已添加到{default_workspace.name}工作区",
            "workspace_id": default_workspace.id
        }

    async def batch_add_users_to_workspace(
        self, db: AsyncSession, workspace_id: int, batch_data: WorkspaceBatchAddUsers, current_user: User
    ) -> Dict[str, Any]:
        """批量添加用户到工作区，跳过已存在的用户和无效用户。"""
        # 验证工作区是否存在
        workspace = await self.get_workspace(db, workspace_id)

        # 检查权限: 只有超级管理员或工作区管理员/所有者可以添加用户
        if not current_user.is_superuser:
            user_access_level = await workspace_repository.get_user_access_level(db, workspace_id, current_user.id)
            if user_access_level not in ["admin", "owner"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="只有工作区管理员或所有者可以批量添加用户"
                )
        
        valid_users_to_process = []
        invalid_or_permission_skipped_user_ids = [] # 因用户不存在或权限问题跳过的ID
        processed_user_ids_in_request = set() # To avoid processing duplicates in input list

        for user_id in batch_data.user_ids:
            if user_id in processed_user_ids_in_request:
                logger.info(f"用户ID {user_id} 在请求中重复，已跳过后续处理。")
                # 不将重复ID计入invalid_or_permission_skipped_user_ids，因为它们不是因为无效或权限问题
                continue
            processed_user_ids_in_request.add(user_id)

            target_user = await auth_repository.get_user_by_id(db, user_id)
            if not target_user:
                invalid_or_permission_skipped_user_ids.append(user_id)
                logger.warning(f"批量添加用户到工作区({workspace_id})时，用户ID {user_id} 不存在，已跳过")
                continue
            
            if target_user.is_superuser and batch_data.access_level != "owner":
                 logger.warning(f"尝试将超级管理员(ID:{user_id})角色设置为 {batch_data.access_level} (非owner)，操作被阻止。")
                 invalid_or_permission_skipped_user_ids.append(user_id)
                 continue

            valid_users_to_process.append({"user_id": user_id, "access_level": batch_data.access_level})
        
        if not valid_users_to_process:
            error_detail = "没有有效的用户可供处理。"
            if invalid_or_permission_skipped_user_ids:
                error_detail += f" 无效或因权限问题被跳过的用户ID: {list(set(invalid_or_permission_skipped_user_ids))}"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_detail
            )

        # 批量添加用户到工作区 (仓库层现在只添加新用户，跳过已存在的)
        db_operation_result = await workspace_repository.batch_add_users_to_workspace_db(
            db, workspace_id, valid_users_to_process
        )
        
        # db_operation_result is now {"added": count, "skipped": count}
        # "skipped" here means skipped by DB layer because user was already in workspace_user table
        
        message_parts = []
        if db_operation_result['added'] > 0:
            message_parts.append(f"成功添加 {db_operation_result['added']} 个新用户。")
        else:
            message_parts.append("没有新用户被添加。")

        if db_operation_result['skipped'] > 0:
            message_parts.append(f"{db_operation_result['skipped']} 个用户因已存在于工作区中而被跳过。")

        skipped_due_to_invalid_or_permission = list(set(invalid_or_permission_skipped_user_ids))
        if skipped_due_to_invalid_or_permission:
            message_parts.append(f"{len(skipped_due_to_invalid_or_permission)} 个用户因ID无效或权限问题未处理: {skipped_due_to_invalid_or_permission}。")
        
        final_message = " ".join(message_parts)
        if not message_parts: # Should not happen if valid_users_to_process was not empty
            final_message = "批量操作已执行，但没有用户状态发生改变。"
            
        return {
            "success": True, 
            "message": final_message, 
            "details": {
                "users_added_to_workspace": db_operation_result['added'],
                "users_skipped_already_in_workspace": db_operation_result['skipped'],
                "users_skipped_invalid_or_permission": skipped_due_to_invalid_or_permission
            }
        }

    async def batch_remove_users_from_workspace(
        self, db: AsyncSession, workspace_id: int, data: WorkspaceBatchRemoveUsers, current_user: User
    ) -> Dict[str, Any]:
        """批量从工作区移除用户，会跳过超级管理员。"""
        # 验证工作区是否存在
        workspace = await self.get_workspace(db, workspace_id)

        # 检查权限: 只有超级管理员或工作区管理员/所有者可以移除用户
        if not current_user.is_superuser:
            user_access_level = await workspace_repository.get_user_access_level(db, workspace_id, current_user.id)
            if user_access_level not in ["admin", "owner"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="只有工作区管理员或所有者可以批量移除用户"
                )

        user_ids_to_remove = data.user_ids
        if not user_ids_to_remove:
            return {"success": True, "message": "没有提供需要移除的用户ID。", "details": {"removed_count": 0, "skipped_superuser_ids": []}}

        valid_user_ids_for_removal = []
        skipped_superuser_ids = []
        
        # 不能移除当前操作者自己 (如果他是通过批量操作移除自己)
        if current_user.id in user_ids_to_remove:
            logger.warning(f"用户 (ID:{current_user.id}) 尝试在批量操作中移除自己出工作区 (ID:{workspace_id})，此操作被阻止。")
            # 从列表中移除当前用户ID，但不计入 skipped_superuser_ids，除非他也是超管
            user_ids_to_remove = [uid for uid in user_ids_to_remove if uid != current_user.id]
            # 如果移除后列表为空，则提前返回
            if not user_ids_to_remove and not current_user.is_superuser: # 如果是超管把自己移除了，下面还会处理
                 return {"success": True, "message": "不能移除自己。没有其他用户被指定移除。", "details": {"removed_count": 0, "skipped_superuser_ids": []}}

        for user_id in user_ids_to_remove:
            target_user = await auth_repository.get_user_by_id(db, user_id)
            if target_user and target_user.is_superuser:
                skipped_superuser_ids.append(user_id)
                logger.warning(f"尝试批量移除超级管理员(ID:{user_id})出工作区({workspace_id})，操作被阻止。")
            elif target_user: # 用户存在且不是超级管理员
                valid_user_ids_for_removal.append(user_id)
            else:
                logger.warning(f"尝试批量移除不存在的用户(ID:{user_id})出工作区({workspace_id})，已跳过。")
                # 可以选择是否将不存在的用户ID也记录到某个skipped列表

        if not valid_user_ids_for_removal:
            message = "没有有效用户可供移除。"
            if skipped_superuser_ids:
                message += f" 超级管理员无法被移除: {skipped_superuser_ids}。"
            if current_user.id in data.user_ids and not skipped_superuser_ids: # 如果current_user是唯一要移除的且不是超管
                message = "不能移除自己。没有其他有效用户被指定移除。"
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

        removed_count = await workspace_repository.batch_remove_users_from_workspace_db(
            db, workspace_id, valid_user_ids_for_removal
        )

        message_parts = [f"成功从工作区移除了 {removed_count} 个用户。"]
        if skipped_superuser_ids:
            message_parts.append(f"超级管理员 (IDs: {skipped_superuser_ids}) 无法被移除，已跳过。")
        if current_user.id in data.user_ids and current_user.id not in valid_user_ids_for_removal and current_user.id not in skipped_superuser_ids:
             message_parts.append("您不能移除自己，该操作已被跳过。")

        final_message = " ".join(message_parts)
        return {
            "success": True, 
            "message": final_message, 
            "details": {"removed_count": removed_count, "skipped_superuser_ids": skipped_superuser_ids}
        }

    async def get_workspace_tables(self, db: AsyncSession, workspace_id: int, current_user: User) -> List[WorkspaceTable]:
        """获取工作区下的所有数据库表"""
        # 移除工作区成员权限检查，允许所有用户访问工作区表
        # 验证工作区存在
        await self.get_workspace(db, workspace_id)
        
        return await workspace_repository.get_tables_by_workspace_id(db, workspace_id)

    async def get_workspace_table(self, db: AsyncSession, table_id: int, current_user: User) -> WorkspaceTable:
        """获取单个工作区数据库表"""
        table = await workspace_repository.get_table_by_id(db, table_id)
        if not table:
            raise HTTPException(status_code=404, detail="数据库表不存在")
        # 移除权限检查，允许所有用户访问表
        return table

    async def create_workspace_table(self, db: AsyncSession, workspace_id: int, table_create: WorkspaceTableCreate, current_user: User) -> WorkspaceTable:
        """创建工作区数据库表"""
        await self.get_workspace(db, workspace_id)
        return await workspace_repository.create_workspace_table(db, table_create, current_user.id)

    async def update_workspace_table(self, db: AsyncSession, table_id: int, table_update: WorkspaceTableUpdate, current_user: User) -> WorkspaceTable:
        """更新工作区数据库表"""
        table_obj = await workspace_repository.get_table_by_id(db, table_id)
        if not table_obj:
            raise HTTPException(status_code=404, detail="数据库表不存在")

        # 移除工作区成员权限检查，允许所有用户更新数据库表
            
        return await workspace_repository.update_workspace_table(db, table_obj, table_update)

    async def delete_workspace_table(self, db: AsyncSession, table_id: int, current_user: User):
        """删除工作区数据库表"""
        # 获取表信息，确保表存在
        table = await workspace_repository.get_table_by_id(db, table_id)
        if not table:
            raise HTTPException(status_code=404, detail="数据库表不存在")
            
        # 移除管理员权限检查，允许所有用户删除数据库表
        
        await workspace_repository.delete_workspace_table(db, table_id)

    async def is_user_in_workspace(self, db: AsyncSession, workspace_id: int, user_id: int, require_admin: bool = False) -> bool:
        """检查用户是否在工作区中，并可选择是否要求管理员权限"""
        user = await auth_repository.get_user_by_id(db, user_id)
        if user.is_superuser:
            return True
        
        access_level = await workspace_repository.get_user_access_level(db, workspace_id, user_id)
        if not access_level:
            return False
        
        if require_admin and access_level not in ['admin', 'owner']:
            return False
            
        return True

    async def get_workspace_interfaces(self, db: AsyncSession, workspace_id: int, current_user: User) -> List[WorkspaceInterface]:
        """获取工作区下的所有接口"""
        # 移除工作区成员权限检查，允许所有用户访问工作区接口
        # 验证工作区存在
        await self.get_workspace(db, workspace_id)
        
        return await workspace_repository.get_interfaces_by_workspace_id(db, workspace_id)

    async def get_workspace_interface(self, db: AsyncSession, interface_id: int, current_user: User) -> WorkspaceInterface:
        """获取单个工作区接口"""
        interface = await workspace_repository.get_interface_by_id(db, interface_id)
        if not interface:
            raise HTTPException(status_code=404, detail="接口不存在")
        # 移除权限检查，允许所有用户访问接口
        return interface

    async def create_workspace_interface(self, db: AsyncSession, workspace_id: int, interface_create: WorkspaceInterfaceCreate, current_user: User) -> WorkspaceInterface:
        """创建工作区接口"""
        # 移除管理员权限检查，允许所有用户创建接口
        # 验证工作区存在
        await self.get_workspace(db, workspace_id)
        
        interface_create.workspace_id = workspace_id
        return await workspace_repository.create_workspace_interface(db, interface_create, current_user.id)

    async def update_workspace_interface(self, db: AsyncSession, interface_id: int, interface_update: WorkspaceInterfaceUpdate, current_user: User) -> WorkspaceInterface:
        """更新工作区接口"""
        # 获取接口信息，确保接口存在
        interface = await self.get_workspace_interface(db, interface_id, current_user)
        
        # 移除管理员权限检查，允许所有用户更新接口
        
        return await workspace_repository.update_workspace_interface(db, interface_id, interface_update)

    async def delete_workspace_interface(self, db: AsyncSession, interface_id: int, current_user: User):
        """删除工作区接口"""
        # 获取接口信息，确保接口存在
        interface = await self.get_workspace_interface(db, interface_id, current_user)
        
        # 移除管理员权限检查，允许所有用户删除接口
        
        await workspace_repository.delete_workspace_interface(db, interface_id)

# 工作区服务实例
workspace_service = WorkspaceService() 