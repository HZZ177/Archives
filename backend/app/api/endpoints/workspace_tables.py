from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_db, success_response, error_response
from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.schemas.workspace_table import (
    WorkspaceTableCreate,
    WorkspaceTableUpdate,
    WorkspaceTableResponse,
    WorkspaceTableDetail
)
from backend.app.schemas.response import APIResponse, PaginatedResponse
from backend.app.services.workspace_table_service import workspace_table_service

router = APIRouter()


@router.get("/workspace/{workspace_id}", response_model=APIResponse[List[WorkspaceTableResponse]])
async def get_workspace_tables(
    workspace_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取工作区下的所有数据库表
    """
    try:
        tables = await workspace_table_service.get_tables(db, workspace_id, current_user)
        return success_response(data=tables)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取工作区数据库表失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"获取工作区数据库表失败: {str(e)}")


@router.get("/workspace/{workspace_id}/paginated", response_model=APIResponse[PaginatedResponse[WorkspaceTableResponse]])
async def get_workspace_tables_paginated(
    workspace_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    page: int = Query(1, description="页码，从1开始", ge=1),
    page_size: int = Query(10, description="每页数量", ge=1, le=100),
    search: str = Query('', description="搜索关键词，可搜索表名和描述")
):
    """
    获取工作区下的所有数据库表，支持分页和搜索
    """
    try:
        result = await workspace_table_service.get_tables_paginated(
            db, workspace_id, current_user, page, page_size, search
        )
        return success_response(data=result)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取工作区数据库表(分页)失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"获取工作区数据库表(分页)失败: {str(e)}")


@router.get("/{table_id}", response_model=APIResponse[WorkspaceTableDetail])
async def get_table(
    table_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取工作区数据库表详情
    """
    try:
        table = await workspace_table_service.get_table(db, table_id, current_user)
        return success_response(data=table)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取数据库表详情失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"获取数据库表详情失败: {str(e)}")


@router.post("/workspace/{workspace_id}", response_model=APIResponse[WorkspaceTableResponse])
async def create_table(
    workspace_id: int,
    table_data: WorkspaceTableCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    创建工作区数据库表
    """
    try:
        table = await workspace_table_service.create_table(db, workspace_id, table_data, current_user)
        return success_response(data=table, message="数据库表创建成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"创建数据库表失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"创建数据库表失败: {str(e)}")


@router.put("/{table_id}", response_model=APIResponse[WorkspaceTableResponse])
async def update_table(
    table_id: int,
    table_data: WorkspaceTableUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新工作区数据库表
    """
    try:
        table = await workspace_table_service.update_table(db, table_id, table_data, current_user)
        return success_response(data=table, message="数据库表更新成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"更新数据库表失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"更新数据库表失败: {str(e)}")


@router.delete("/{table_id}", response_model=APIResponse)
async def delete_table(
    table_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    删除工作区数据库表
    """
    try:
        success = await workspace_table_service.delete_table(db, table_id, current_user)
        return success_response(message="数据库表删除成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"删除数据库表失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"删除数据库表失败: {str(e)}") 