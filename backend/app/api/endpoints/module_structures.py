from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_db, success_response, error_response
from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.schemas.module_structure import (
    ModuleStructureNodeCreate,
    ModuleStructureNodeResponse,
    ModuleStructureNodeUpdate,
    ModuleTreeResponse,
    ModuleStructureNodeOrderUpdate,
    ModuleStructureNodeOrderBatchUpdate
)
from backend.app.schemas.response import APIResponse
from backend.app.services.module_structure_service import module_structure_service
from backend.app.services.workspace_service import workspace_service

router = APIRouter()


@router.post("/", response_model=APIResponse[ModuleStructureNodeResponse], status_code=status.HTTP_201_CREATED)
async def create_module_node(
        node_in: ModuleStructureNodeCreate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)],
        workspace_id: Optional[int] = Query(None, description="工作区ID，不指定则使用用户默认工作区")
):
    """
    创建模块结构节点
    """
    try:
        # 如果未指定工作区，使用用户的默认工作区
        if workspace_id is None and current_user.default_workspace_id:
            workspace_id = current_user.default_workspace_id
        # 如果用户没有默认工作区，尝试获取
        elif workspace_id is None:
            default_workspace = await workspace_service.get_default_workspace(db, current_user)
            workspace_id = default_workspace.id
            
        node = await module_structure_service.create_module_node(db, node_in, current_user, workspace_id)
        return success_response(data=node, message="模块节点创建成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"创建模块节点失败: {str(e)}")
        return error_response(message=f"创建模块节点失败: {str(e)}")


@router.get("/", response_model=APIResponse[ModuleTreeResponse])
async def read_module_tree(
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)],
        parent_id: Optional[int] = None,
        workspace_id: Optional[int] = Query(None, description="工作区ID，不指定则使用用户默认工作区")
):
    """
    获取模块结构树
    如果指定了parent_id，则只返回该节点的子树
    否则返回所有顶级节点及其子树
    """
    try:
        # 如果未指定工作区，使用用户的默认工作区
        if workspace_id is None and current_user.default_workspace_id:
            workspace_id = current_user.default_workspace_id
        # 如果用户没有默认工作区，尝试获取
        elif workspace_id is None:
            default_workspace = await workspace_service.get_default_workspace(db, current_user)
            workspace_id = default_workspace.id
            
        tree = await module_structure_service.get_module_tree(db, parent_id, workspace_id)
        return success_response(data=tree)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取模块结构树失败: {str(e)}")
        return error_response(message=f"获取模块结构树失败: {str(e)}")


@router.get("/{node_id}", response_model=APIResponse[ModuleStructureNodeResponse])
async def read_module_node(
        node_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取特定模块节点的详细信息
    """
    try:
        node = await module_structure_service.get_module_node(db, node_id)
        return success_response(data=node)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取模块节点详情失败: {str(e)}")
        return error_response(message=f"获取模块节点详情失败: {str(e)}")


@router.post("/update/{node_id}", response_model=APIResponse[ModuleStructureNodeResponse])
async def update_module_node(
        node_id: int,
        node_in: ModuleStructureNodeUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新模块结构节点
    """
    try:
        node = await module_structure_service.update_module_node(db, node_id, node_in, current_user)
        return success_response(data=node, message="模块节点更新成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"更新模块节点失败: {str(e)}")
        return error_response(message=f"更新模块节点失败: {str(e)}")


@router.post("/delete/{node_id}", response_model=APIResponse)
async def delete_module_node(
        node_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    删除模块结构节点及其所有子节点
    """
    try:
        message = await module_structure_service.delete_module_node(db, node_id, current_user)
        return success_response(message=message)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"删除模块节点失败: {str(e)}")
        return error_response(message=f"删除模块节点失败: {str(e)}")


@router.post("/update-order/{node_id}", response_model=APIResponse[ModuleStructureNodeResponse])
async def update_node_order(
        node_id: int,
        order_data: ModuleStructureNodeOrderUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新模块结构节点的排序顺序
    """
    try:
        node = await module_structure_service.update_node_order(db, node_id, order_data.order_index, current_user)
        return success_response(data=node, message="节点顺序更新成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"更新节点顺序失败: {str(e)}")
        return error_response(message=f"更新节点顺序失败: {str(e)}")


@router.post("/batch-update-order", response_model=APIResponse[List[ModuleStructureNodeResponse]])
async def batch_update_node_order(
        order_data: ModuleStructureNodeOrderBatchUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    批量更新模块结构节点的排序顺序
    """
    try:
        nodes = await module_structure_service.batch_update_node_order(db, order_data.updates, current_user)
        return success_response(data=nodes, message="节点顺序批量更新成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"批量更新节点顺序失败: {str(e)}")
        return error_response(message=f"批量更新节点顺序失败: {str(e)}") 