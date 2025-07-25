from typing import Annotated, List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_db, success_response, error_response
from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceResponse,
    WorkspaceUpdate,
    WorkspaceAddUser,
    WorkspaceBatchAddUsers,
    WorkspaceBatchRemoveUsers,
    WorkspaceUserResponse,
    UserDefaultWorkspace,
    WorkspaceUserRoleUpdate,
    Workspace,
    WorkspaceTable,
    WorkspaceTableCreate,
    WorkspaceTableUpdate,
    WorkspaceTableRead,
    WorkspaceInterface,
    WorkspaceInterfaceCreate,
    WorkspaceInterfaceUpdate
)
from backend.app.schemas.response import APIResponse, PaginatedResponse
from backend.app.services.workspace_service import WorkspaceService

router = APIRouter()
workspace_service = WorkspaceService()


@router.get("/", response_model=APIResponse[List[WorkspaceResponse]])
async def get_workspaces(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取用户可访问的工作区列表
    """
    try:
        workspaces = await workspace_service.get_workspaces(db, current_user)
        return success_response(data=workspaces)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取工作区列表失败: {str(e)}")
        return error_response(message=f"获取工作区列表失败: {str(e)}")


@router.get("/default", response_model=APIResponse[WorkspaceResponse])
async def get_default_workspace(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取用户的默认工作区
    """
    try:
        workspace = await workspace_service.get_default_workspace(db, current_user)
        return success_response(data=workspace)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取默认工作区失败: {str(e)}")
        return error_response(message=f"获取默认工作区失败: {str(e)}")


@router.post("/", response_model=APIResponse[WorkspaceResponse], status_code=status.HTTP_201_CREATED)
async def create_workspace(
    workspace_in: WorkspaceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    创建新工作区（仅管理员）
    """
    try:
        if not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="只有超级管理员可以创建工作区"
            )
        workspace = await workspace_service.create_workspace(db, workspace_in, current_user)
        return success_response(data=workspace, message="工作区创建成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"创建工作区失败: {str(e)}")
        return error_response(message=f"创建工作区失败: {str(e)}")


@router.get("/{workspace_id}", response_model=APIResponse[WorkspaceResponse])
async def read_workspace(
    workspace_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取工作区详情
    """
    try:
        workspace = await workspace_service.get_workspace(db, workspace_id)
        return success_response(data=workspace)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取工作区详情失败: {str(e)}")
        return error_response(message=f"获取工作区详情失败: {str(e)}")


@router.post("/update/{workspace_id}", response_model=APIResponse[WorkspaceResponse])
async def update_workspace(
    workspace_id: int,
    workspace_in: WorkspaceUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新工作区信息
    """
    try:
        workspace = await workspace_service.update_workspace(db, workspace_id, workspace_in, current_user)
        return success_response(data=workspace, message="工作区更新成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"更新工作区失败: {str(e)}")
        return error_response(message=f"更新工作区失败: {str(e)}")


@router.post("/delete/{workspace_id}", response_model=APIResponse)
async def delete_workspace(
    workspace_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    删除工作区（仅超级管理员）
    """
    try:
        result = await workspace_service.delete_workspace(db, workspace_id, current_user)
        return success_response(message="工作区删除成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"删除工作区失败: {str(e)}")
        return error_response(message=f"删除工作区失败: {str(e)}")


@router.get("/{workspace_id}/users", response_model=APIResponse[List[WorkspaceUserResponse]])
async def get_workspace_users(
    workspace_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取工作区用户列表
    """
    try:
        users = await workspace_service.get_workspace_users(db, workspace_id, current_user)
        return success_response(data=users)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取工作区用户列表失败: {str(e)}")
        return error_response(message=f"获取工作区用户列表失败: {str(e)}")


@router.post("/{workspace_id}/users", response_model=APIResponse)
async def add_user_to_workspace(
    workspace_id: int,
    user_data: WorkspaceAddUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    添加用户到工作区
    """
    try:
        result = await workspace_service.add_user_to_workspace(db, workspace_id, user_data, current_user)
        return success_response(message="用户已添加到工作区")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"添加用户到工作区失败: {str(e)}")
        return error_response(message=f"添加用户到工作区失败: {str(e)}")


@router.post("/{workspace_id}/users/batch", response_model=APIResponse)
async def batch_add_users_to_workspace_endpoint(
    workspace_id: int,
    batch_data: WorkspaceBatchAddUsers,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    批量添加用户到工作区
    """
    try:
        result = await workspace_service.batch_add_users_to_workspace(
            db, workspace_id, batch_data, current_user
        )
        return success_response(message=result.get("message", "批量操作成功"), data=result)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"批量添加用户到工作区失败: {str(e)}")
        return error_response(message=f"批量添加用户到工作区失败: {str(e)}")


@router.post("/{workspace_id}/users/batch-remove", response_model=APIResponse)
async def batch_remove_users_from_workspace_endpoint(
    workspace_id: int,
    data: WorkspaceBatchRemoveUsers,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    批量从工作区移除用户
    """
    try:
        result = await workspace_service.batch_remove_users_from_workspace(
            db, workspace_id, data, current_user
        )
        return success_response(message=result.get("message", "批量移除操作成功"), data=result)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"批量从工作区移除用户失败: {str(e)}")
        return error_response(message=f"批量从工作区移除用户失败: {str(e)}")


@router.post("/{workspace_id}/users/{user_id}/remove", response_model=APIResponse)
async def remove_user_from_workspace(
    workspace_id: int,
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    从工作区移除用户
    """
    try:
        result = await workspace_service.remove_user_from_workspace(db, workspace_id, user_id, current_user)
        return success_response(message="用户已从工作区移除")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"从工作区移除用户失败: {str(e)}")
        return error_response(message=f"从工作区移除用户失败: {str(e)}")


@router.post("/{workspace_id}/users/{user_id}", response_model=APIResponse[WorkspaceUserResponse])
async def update_workspace_user_role(
    workspace_id: int,
    user_id: int,
    role_data: WorkspaceUserRoleUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新工作区用户角色
    """
    try:
        user = await workspace_service.update_workspace_user_role(
            db, workspace_id, user_id, role_data.access_level, current_user
        )
        return success_response(data=user, message="用户角色已更新")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"更新工作区用户角色失败: {str(e)}")
        return error_response(message=f"更新工作区用户角色失败: {str(e)}")


@router.post("/users/{user_id}/default", response_model=APIResponse)
async def set_user_default_workspace(
    user_id: int,
    workspace_data: UserDefaultWorkspace,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    设置用户的默认工作区
    """
    try:
        user = await workspace_service.set_user_default_workspace(
            db, user_id, workspace_data.workspace_id, current_user
        )
        return success_response(message="默认工作区设置成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"设置默认工作区失败: {str(e)}")
        return error_response(message=f"设置默认工作区失败: {str(e)}")


@router.post("/add_to_default/{user_id}", response_model=APIResponse)
async def add_user_to_default_workspace(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    将用户添加到系统默认工作区
    
    当用户首次登录发现没有任何工作区访问权限时，可以使用此API自动分配默认工作区
    - 如果用户已有工作区访问权限，则不执行任何操作
    - 如果没有默认工作区，则分配第一个可用工作区
    """
    try:
        # 检查权限：只有超级管理员或自己才能执行此操作
        if not current_user.is_superuser and current_user.id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="您没有权限执行此操作"
            )
            
        result = await workspace_service.add_user_to_default_workspace(db, user_id)
        return success_response(
            data={"workspace_id": result.get("workspace_id")},
            message=result.get("message", "用户已添加到默认工作区")
        )
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"添加用户到默认工作区失败: {str(e)}")
        return error_response(message=f"添加用户到默认工作区失败: {str(e)}") 


# 工作区表相关接口
@router.get("/{workspace_id}/tables", response_model=APIResponse[PaginatedResponse[WorkspaceTableRead]])
async def get_workspace_tables(
    workspace_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    page: int = Query(1, description="页码，从1开始", ge=1),
    page_size: int = Query(10, description="每页数量", ge=1, le=100),
    search: str = Query('', description="搜索关键词，可搜索表名和描述")
):
    """获取工作区所有表，带分页和搜索"""
    try:
        tables = await workspace_service.get_workspace_tables(
            db, workspace_id, current_user, page=page, page_size=page_size, search=search
        )
        return success_response(data=tables)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取工作区表失败: {e}")
        return error_response(f"获取工作区表失败: {e}")


@router.get("/{workspace_id}/tables/{table_id}", response_model=APIResponse[WorkspaceTableRead])
async def get_workspace_table(
    workspace_id: int,
    table_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """获取单个工作区表"""
    try:
        table = await workspace_service.get_workspace_table(db, table_id, current_user)
        return success_response(data=table)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取工作区表失败: {e}")
        return error_response(f"获取工作区表失败: {e}")


@router.post("/{workspace_id}/tables", response_model=APIResponse[WorkspaceTableRead])
async def create_workspace_table(
    workspace_id: int,
    table_create: WorkspaceTableCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """创建工作区表"""
    try:
        table = await workspace_service.create_workspace_table(db, workspace_id, table_create, current_user)
        return success_response(data=table)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"创建工作区表失败: {e}")
        return error_response(f"创建工作区表失败: {e}")


@router.put("/{workspace_id}/tables/{table_id}", response_model=APIResponse[WorkspaceTableRead])
async def update_workspace_table(
    workspace_id: int,
    table_id: int,
    table_update: WorkspaceTableUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """更新工作区表"""
    try:
        # TODO: 验证 workspace_id 是否与 table_id 匹配
        updated_table = await workspace_service.update_workspace_table(db, table_id, table_update, current_user)
        return success_response(data=updated_table, message="表更新成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"更新工作区表失败: {str(e)}")
        return error_response(message=f"更新工作区表失败: {str(e)}")


@router.delete("/{workspace_id}/tables/{table_id}", response_model=APIResponse)
async def delete_workspace_table(
    workspace_id: int,
    table_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    删除工作区数据库表
    """
    try:
        await workspace_service.delete_workspace_table(db, table_id, current_user)
        return success_response(message="数据库表删除成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"删除工作区数据库表失败: {str(e)}")
        return error_response(message=f"删除工作区数据库表失败: {str(e)}")


# 工作区接口相关接口
@router.get("/{workspace_id}/interfaces", response_model=APIResponse[PaginatedResponse[WorkspaceInterface]])
async def get_workspace_interfaces(
    workspace_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    page: int = Query(1, description="页码，从1开始", ge=1),
    page_size: int = Query(10, description="每页数量", ge=1, le=100),
    search: str = Query('', description="搜索关键词，可搜索路径和描述")
):
    """获取工作区下的所有接口，带分页和搜索"""
    try:
        workspace = await workspace_service.get_workspace(db, workspace_id)
        if not workspace:
            raise HTTPException(status_code=404, detail=f"ID为{workspace_id}的工作区不存在")
        
        result = await workspace_service.get_workspace_interfaces(
            db, workspace_id, current_user, page=page, page_size=page_size, search=search
        )
        return success_response(data=result)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取工作区下的所有接口失败: {str(e)}")
        return error_response(message=f"获取工作区下的所有接口失败: {str(e)}")


@router.get("/{workspace_id}/interfaces/{interface_id}", response_model=APIResponse[WorkspaceInterface])
async def get_workspace_interface(
    workspace_id: int,
    interface_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """获取工作区下的特定接口"""
    try:
        workspace = await workspace_service.get_workspace(db, workspace_id)
        if not workspace:
            raise HTTPException(status_code=404, detail=f"ID为{workspace_id}的工作区不存在")
        
        interface = await workspace_service.get_workspace_interface(db, interface_id, current_user)
        if not interface:
            raise HTTPException(status_code=404, detail=f"ID为{interface_id}的接口不存在")
        
        return success_response(data=interface)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取工作区下的特定接口失败: {str(e)}")
        return error_response(message=f"获取工作区下的特定接口失败: {str(e)}")


@router.post("/{workspace_id}/interfaces", response_model=APIResponse[WorkspaceInterface])
async def create_workspace_interface(
    workspace_id: int,
    interface_create: WorkspaceInterfaceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """创建工作区接口"""
    try:
        workspace = await workspace_service.get_workspace(db, workspace_id)
        if not workspace:
            raise HTTPException(status_code=404, detail=f"ID为{workspace_id}的工作区不存在")
        
        # 确保workspace_id匹配
        if interface_create.workspace_id != workspace_id:
            interface_create.workspace_id = workspace_id
        
        # 添加日志，记录请求数据中的request_example和response_example字段
        logger.info(f"创建接口请求数据: path={interface_create.path}, method={interface_create.method}")
        logger.info(f"创建接口请求示例字段: request_example={interface_create.request_example}")
        logger.info(f"创建接口响应示例字段: response_example={interface_create.response_example}")
        
        interface = await workspace_service.create_workspace_interface(db, workspace_id, interface_create, current_user)
        
        # 添加日志，记录返回数据中的request_example和response_example字段
        logger.info(f"创建接口返回数据: id={interface.id}, path={interface.path}")
        logger.info(f"创建接口返回数据中的请求示例: request_example={interface.request_example}")
        logger.info(f"创建接口返回数据中的响应示例: response_example={interface.response_example}")
        
        return success_response(data=interface, message="接口创建成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"创建工作区接口失败: {str(e)}")
        return error_response(message=f"创建工作区接口失败: {str(e)}")


@router.put("/{workspace_id}/interfaces/{interface_id}", response_model=APIResponse[WorkspaceInterface])
async def update_workspace_interface(
    workspace_id: int,
    interface_id: int,
    interface_update: WorkspaceInterfaceUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """更新工作区接口"""
    try:
        workspace = await workspace_service.get_workspace(db, workspace_id)
        if not workspace:
            raise HTTPException(status_code=404, detail=f"ID为{workspace_id}的工作区不存在")
        
        interface = await workspace_service.get_workspace_interface(db, interface_id, current_user)
        if not interface:
            raise HTTPException(status_code=404, detail=f"ID为{interface_id}的接口不存在")
        
        # 添加日志，记录请求数据中的request_example和response_example字段
        logger.info(f"更新接口请求数据: id={interface_id}, path={interface_update.path}, method={interface_update.method}")
        logger.info(f"更新接口请求示例字段: request_example={interface_update.request_example}")
        logger.info(f"更新接口响应示例字段: response_example={interface_update.response_example}")
        
        updated_interface = await workspace_service.update_workspace_interface(db, interface_id, interface_update, current_user)
        
        # 添加日志，记录返回数据中的request_example和response_example字段
        logger.info(f"更新接口返回数据: id={updated_interface.id}, path={updated_interface.path}")
        logger.info(f"更新接口返回数据中的请求示例: request_example={updated_interface.request_example}")
        logger.info(f"更新接口返回数据中的响应示例: response_example={updated_interface.response_example}")
        
        return success_response(data=updated_interface, message="接口更新成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"更新工作区接口失败: {str(e)}")
        return error_response(message=f"更新工作区接口失败: {str(e)}")


@router.delete("/{workspace_id}/interfaces/{interface_id}", response_model=APIResponse)
async def delete_workspace_interface(
    workspace_id: int,
    interface_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """删除工作区接口"""
    try:
        workspace = await workspace_service.get_workspace(db, workspace_id)
        if not workspace:
            raise HTTPException(status_code=404, detail=f"ID为{workspace_id}的工作区不存在")
        
        interface = await workspace_service.get_workspace_interface(db, interface_id, current_user)
        if not interface:
            raise HTTPException(status_code=404, detail=f"ID为{interface_id}的接口不存在")
        
        await workspace_service.delete_workspace_interface(db, interface_id, current_user)
        return success_response(message="接口已删除")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"删除工作区接口失败: {str(e)}")
        return error_response(message=f"删除工作区接口失败: {str(e)}") 