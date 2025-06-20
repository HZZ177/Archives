from typing import Annotated, List, Optional, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.api.deps import get_current_active_user, get_db, success_response, error_response
from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.models.module_content import ModuleContent
from backend.app.schemas.module_content import (
    ModuleContentResponse,
    ModuleContentUpdate,
    DiagramData
)
from backend.app.schemas.response import APIResponse
from backend.app.services.module_content_service import module_content_service

router = APIRouter()


@router.get("/by-node/{module_node_id}", response_model=APIResponse[ModuleContentResponse])
async def read_module_content(
        module_node_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取特定模块节点的内容
    """
    try:
        # 调用服务层获取模块内容
        content = await module_content_service.get_module_content(
            db, module_node_id
        )
        
        return success_response(data=content)
    except Exception as e:
        logger.error(f"获取模块内容失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"获取模块内容失败: {str(e)}")


@router.post("/update/by-node/{module_node_id}", response_model=APIResponse[ModuleContentResponse])
async def upsert_module_content(
        module_node_id: int,
        content_in: ModuleContentUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    创建或更新特定模块节点的内容
    """
    try:
        # 调用服务层创建或更新模块内容
        content, message = await module_content_service.upsert_module_content(
            db, module_node_id, content_in, current_user
        )
        
        return success_response(data=content, message=message)
    except Exception as e:
        logger.error(f"更新模块内容失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"更新模块内容失败: {str(e)}")


@router.put("/{module_node_id}/diagram", response_model=APIResponse[ModuleContentResponse])
async def update_diagram(
    module_node_id: int,
    diagram_data: DiagramData,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    创建或更新模块节点的流程图数据
    """
    try:
        # 使用业务层upsert，确保内容记录存在
        update_data = ModuleContentUpdate(diagram_data=diagram_data)
        content, message = await module_content_service.upsert_module_content(
            db, module_node_id, update_data, current_user
        )
        return success_response(data=content, message=message)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新流程图失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"更新流程图失败: {str(e)}")

@router.get("/{module_node_id}/diagram", response_model=APIResponse[Any])
async def get_diagram(
    module_node_id: int,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    获取模块节点的流程图数据
    """
    try:
        content = await module_content_service.get_module_content(db, module_node_id)
        return success_response(data={
            "diagram_data": content.diagram_data,
            "version": content.diagram_version
        })
    except HTTPException:
        # 如果内容不存在，可以返回空数据或404
        raise
    except Exception as e:
        logger.error(f"获取流程图失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"获取流程图失败: {str(e)}")

@router.put("/{module_node_id}/table-relation-diagram", response_model=APIResponse[ModuleContentResponse])
async def update_table_relation_diagram(
    module_node_id: int,
    diagram_data: DiagramData,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    创建或更新模块节点的表关联关系图数据
    """
    try:
        # 使用业务层upsert，确保内容记录存在，但是更新表关联关系图字段
        update_data = ModuleContentUpdate(table_relation_diagram=diagram_data.model_dump())
        content, message = await module_content_service.upsert_module_content(
            db, module_node_id, update_data, current_user
        )
        return success_response(data=content, message=message)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新表关联关系图失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"更新表关联关系图失败: {str(e)}")

@router.get("/{module_node_id}/table-relation-diagram", response_model=APIResponse[Any])
async def get_table_relation_diagram(
    module_node_id: int,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    获取模块节点的表关联关系图数据
    """
    try:
        content = await module_content_service.get_module_content(db, module_node_id)
        return success_response(data={
            "diagram_data": content.table_relation_diagram,
            "version": content.diagram_version  # 使用相同的版本号
        })
    except HTTPException:
        # 如果内容不存在，可以返回空数据或404
        raise
    except Exception as e:
        logger.error(f"获取表关联关系图失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"获取表关联关系图失败: {str(e)}")

# 添加引用相关的API端点

@router.get("/{module_node_id}/referenced-tables", response_model=APIResponse[List[Any]])
async def get_referenced_tables(
    module_node_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取模块引用的工作区数据库表
    """
    try:
        tables = await module_content_service.get_referenced_tables(db, module_node_id)
        return success_response(data=tables)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取引用的数据库表失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"获取引用的数据库表失败: {str(e)}")

@router.put("/{module_node_id}/table-refs", response_model=APIResponse[ModuleContentResponse])
async def update_table_refs(
    module_node_id: int,
    table_ids: List[int],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新模块内容中的数据库表引用
    """
    try:
        content, message = await module_content_service.update_table_refs(
            db, module_node_id, table_ids, current_user
        )
        return success_response(data=content, message=message)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新数据库表引用失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"更新数据库表引用失败: {str(e)}")

@router.get("/{module_node_id}/referenced-interfaces", response_model=APIResponse[List[Any]])
async def get_referenced_interfaces(
    module_node_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取模块引用的工作区接口
    """
    try:
        interfaces = await module_content_service.get_referenced_interfaces(db, module_node_id)
        return success_response(data=interfaces)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取引用的接口失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"获取引用的接口失败: {str(e)}")

@router.put("/{module_node_id}/interface-refs", response_model=APIResponse[ModuleContentResponse])
async def update_interface_refs(
    module_node_id: int,
    interface_ids: List[int],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新模块内容中的接口引用
    """
    try:
        content, message = await module_content_service.update_interface_refs(
            db, module_node_id, interface_ids, current_user
        )
        return success_response(data=content, message=message)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新接口引用失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"更新接口引用失败: {str(e)}") 