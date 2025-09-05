from typing import Annotated, List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from backend.app.api.deps import get_current_active_user, get_db, success_response, error_response, check_permissions
from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.schemas.coding_bug import (
    CodingBugListParams, CodingBugResponse, CodingBugDetailResponse,
    PaginatedCodingBugResponse, CodingBugAnalysisResponse,
    UnlinkCodingBugFromModuleRequest,
    CodingBugSyncParams, ModuleCodingBugParams,
    WorkspaceCodingConfigCreate, WorkspaceCodingConfigUpdate, WorkspaceCodingConfigResponse
)
from backend.app.schemas.response import APIResponse
from backend.app.services.coding_service import coding_service
from backend.app.services.coding_config_service import coding_config_service
from backend.app.services.coding_bug_service import coding_bug_service
from backend.app.services.workspace_service import workspace_service

router = APIRouter()


@router.post("/sync-from-coding", response_model=APIResponse[Dict[str, Any]])
async def sync_bugs_from_coding(
    sync_params: CodingBugSyncParams,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """从Coding平台同步缺陷数据"""
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs"])
        
        workspace_id = sync_params.workspace_id
        
        # 获取工作区Coding配置
        config = await coding_config_service.get_config_by_workspace(db, workspace_id)
        if not config:
            return error_response(message="未找到该工作区的Coding配置，请先配置API Token和项目名称")

        
        # 从Coding API获取所有缺陷数据
        sync_result = await coding_service.sync_all_bugs_from_coding(
            api_token=config.api_token,
            project_name=config.project_name,
            conditions=sync_params.conditions or config.sync_conditions
        )

        # 将数据保存到本地数据库
        db_result = await coding_bug_service.sync_bugs_to_database(
            db=db,
            workspace_id=workspace_id,
            bugs_data=sync_result["bugs"]
        )

        # 更新配置的最后同步时间
        config.last_sync_at = datetime.now()
        await db.commit()

        result = {
            "synced_count": db_result["total_processed"],
            "created_count": db_result["created_count"],
            "updated_count": db_result["updated_count"],
            "total_available": sync_result["total_count"],
            "sync_time": datetime.now().isoformat(),
            "project_name": sync_result["project_name"]
        }
        
        return success_response(data=result, message="同步成功")
        
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"同步Coding缺陷数据失败: {str(e)}")
        return error_response(message=f"同步失败: {str(e)}")


@router.get("/", response_model=APIResponse[PaginatedCodingBugResponse])
async def get_coding_bugs(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    keyword: Optional[str] = Query(None, description="搜索关键词"),
    priority: Optional[str] = Query(None, description="严重程度筛选"),
    status_name: Optional[str] = Query(None, description="状态筛选"),
    workspace_id: Optional[int] = Query(None, description="工作区ID，不指定则使用用户默认工作区")
):
    """从本地数据库获取Coding缺陷列表"""
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs"])

        # 如果未指定工作区，使用用户的默认工作区
        if workspace_id is None and current_user.default_workspace_id:
            workspace_id = current_user.default_workspace_id
        elif workspace_id is None:
            default_workspace = await workspace_service.get_default_workspace(db, current_user)
            workspace_id = default_workspace.id

        # 从本地数据库获取分页数据
        result = await coding_bug_service.get_bugs_paginated(
            db=db,
            workspace_id=workspace_id,
            page=page,
            page_size=page_size,
            keyword=keyword,
            priority=priority,
            status_name=status_name
        )

        return success_response(data=result)

    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取Coding缺陷列表失败: {str(e)}")
        return error_response(message=f"获取缺陷列表失败: {str(e)}")


@router.post("/get-detail", response_model=APIResponse[CodingBugDetailResponse])
async def get_coding_bug_detail(
    request_data: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """从本地数据库获取Coding缺陷详情"""
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs"])

        coding_bug_id = request_data.get("coding_bug_id")
        if not coding_bug_id:
            return error_response(message="缺少coding_bug_id参数")

        # 获取用户工作区
        workspace_id = current_user.default_workspace_id
        if not workspace_id:
            default_workspace = await workspace_service.get_default_workspace(db, current_user)
            workspace_id = default_workspace.id

        # 从本地数据库获取详情
        detail = await coding_bug_service.get_bug_detail(
            db=db,
            coding_bug_id=coding_bug_id,
            workspace_id=workspace_id
        )

        if not detail:
            return error_response(message="未找到该缺陷")

        return success_response(data=detail)

    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取Coding缺陷详情失败: {str(e)}")
        return error_response(message=f"获取缺陷详情失败: {str(e)}")


@router.post("/link-module", response_model=APIResponse[Dict[str, Any]])
async def link_bug_to_module(
    request_data: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """关联缺陷到模块"""
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs"])

        coding_bug_id = request_data.get("coding_bug_id")
        module_id = request_data.get("module_id")
        manifestation_description = request_data.get("manifestation_description", "")

        if not coding_bug_id or not module_id:
            return error_response(message="缺少必要参数")

        # 获取用户工作区
        workspace_id = current_user.default_workspace_id
        if not workspace_id:
            default_workspace = await workspace_service.get_default_workspace(db, current_user)
            workspace_id = default_workspace.id

        # 检查缺陷是否存在
        bug = await coding_bug_service.get_bug_detail(
            db=db,
            coding_bug_id=coding_bug_id,
            workspace_id=workspace_id
        )

        if not bug:
            return error_response(message="缺陷不存在")

        # 检查是否已经关联过
        from backend.app.models.coding_bug import CodingBugModuleLink
        existing_link = await db.execute(
            select(CodingBugModuleLink).where(
                and_(
                    CodingBugModuleLink.coding_bug_id == coding_bug_id,
                    CodingBugModuleLink.module_id == module_id
                )
            )
        )
        existing_link = existing_link.scalar_one_or_none()

        if existing_link:
            return error_response(message="该缺陷已关联到此模块")

        # 创建关联
        new_link = CodingBugModuleLink(
            coding_bug_id=coding_bug_id,
            module_id=module_id,
            manifestation_description=manifestation_description,
            created_by=current_user.id
        )
        db.add(new_link)
        await db.commit()

        return success_response(data={"message": "关联成功"})

    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"关联缺陷到模块失败: {str(e)}")
        return error_response(message=f"关联失败: {str(e)}")



@router.post("/unlink-from-module", response_model=APIResponse[str])
async def unlink_coding_bug_from_module(
    request_data: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """取消Coding缺陷与模块关联"""
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs"])

        coding_bug_id = request_data.get("coding_bug_id")
        module_id = request_data.get("module_id")

        if not coding_bug_id or not module_id:
            return error_response(message="缺少必要参数")

        # 查找并删除关联记录
        from backend.app.models.coding_bug import CodingBugModuleLink
        link_query = select(CodingBugModuleLink).where(
            and_(
                CodingBugModuleLink.coding_bug_id == coding_bug_id,
                CodingBugModuleLink.module_id == module_id
            )
        )
        link_result = await db.execute(link_query)
        link = link_result.scalar_one_or_none()

        if not link:
            return error_response(message="未找到关联记录")

        # 删除关联记录
        await db.delete(link)
        await db.commit()

        return success_response(data="取消关联成功", message="已取消缺陷与模块的关联")

    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"取消Coding缺陷与模块关联失败: {str(e)}")
        return error_response(message=f"取消关联失败: {str(e)}")


@router.post("/get-module-bugs", response_model=APIResponse[Dict[str, Any]])
async def get_module_coding_bugs(
    request_data: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """获取模块关联的Coding缺陷"""
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs"])

        module_id = request_data.get("module_id")
        page = request_data.get("page", 1)
        page_size = request_data.get("page_size", 10)

        if not module_id:
            return error_response(message="缺少module_id参数")

        # 获取用户工作区
        workspace_id = current_user.default_workspace_id
        if not workspace_id:
            default_workspace = await workspace_service.get_default_workspace(db, current_user)
            workspace_id = default_workspace.id

        # 获取模块关联的缺陷
        result = await coding_bug_service.get_module_bugs_paginated(
            db=db,
            module_id=module_id,
            workspace_id=workspace_id,
            page=page,
            page_size=page_size
        )

        return success_response(data=result)

    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取模块关联Coding缺陷失败: {str(e)}")
        return error_response(message=f"获取模块缺陷失败: {str(e)}")


@router.post("/get-iterations", response_model=APIResponse[List[Dict[str, Any]]])
async def get_coding_iterations(
    request_data: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """获取Coding项目的迭代列表"""
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs"])

        # 获取用户工作区
        workspace_id = current_user.default_workspace_id
        if not workspace_id:
            default_workspace = await workspace_service.get_default_workspace(db, current_user)
            workspace_id = default_workspace.id

        # 获取Coding配置
        config = await coding_config_service.get_config_by_workspace(db, workspace_id)
        if not config:
            return error_response(message="请先配置Coding API")

        project_name = request_data.get("project_name")
        if not project_name:
            return error_response(message="项目名称不能为空")

        # 调用Coding API获取迭代列表
        iterations = await coding_service.fetch_iterations_from_coding(
            api_token=config.api_token,
            project_name=project_name
        )

        return success_response(data=iterations)

    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取Coding迭代列表失败: {str(e)}")
        return error_response(message=f"获取迭代列表失败: {str(e)}")


@router.delete("/{coding_bug_id}", response_model=APIResponse[str])
async def delete_coding_bug(
    coding_bug_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """删除单个Coding缺陷"""
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs"])

        # 获取用户工作区
        workspace_id = current_user.default_workspace_id
        if not workspace_id:
            default_workspace = await workspace_service.get_default_workspace(db, current_user)
            workspace_id = default_workspace.id

        # 删除缺陷
        result = await coding_bug_service.delete_bug(db, coding_bug_id, workspace_id)

        return success_response(data="删除成功", message=result)

    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"删除Coding缺陷失败: {str(e)}")
        return error_response(message=f"删除缺陷失败: {str(e)}")


@router.post("/batch-delete", response_model=APIResponse[str])
async def batch_delete_coding_bugs(
    request_data: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """批量删除Coding缺陷"""
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs"])

        coding_bug_ids = request_data.get("coding_bug_ids", [])
        if not coding_bug_ids:
            return error_response(message="请选择要删除的缺陷")

        # 获取用户工作区
        workspace_id = current_user.default_workspace_id
        if not workspace_id:
            default_workspace = await workspace_service.get_default_workspace(db, current_user)
            workspace_id = default_workspace.id

        # 批量删除缺陷
        result = await coding_bug_service.batch_delete_bugs(db, coding_bug_ids, workspace_id)

        return success_response(data="批量删除成功", message=result)

    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"批量删除Coding缺陷失败: {str(e)}")
        return error_response(message=f"批量删除缺陷失败: {str(e)}")


# Coding配置管理相关接口
@router.post("/config", response_model=APIResponse[WorkspaceCodingConfigResponse])
async def create_coding_config(
    config_data: WorkspaceCodingConfigCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """创建工作区Coding配置"""
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs"])

        config = await coding_config_service.create_config(db, config_data, current_user)

        response_data = WorkspaceCodingConfigResponse(
            id=config.id,
            workspace_id=config.workspace_id,
            api_token=config.api_token,
            project_name=config.project_name,
            api_base_url=config.api_base_url,
            is_enabled=config.is_enabled,
            sync_conditions=config.sync_conditions,
            last_sync_at=config.last_sync_at,
            created_at=config.created_at,
            updated_at=config.updated_at,
            created_by=config.created_by
        )

        return success_response(data=response_data, message="Coding配置创建成功")

    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"创建Coding配置失败: {str(e)}")
        return error_response(message=f"创建配置失败: {str(e)}")


@router.get("/config/{workspace_id}", response_model=APIResponse[WorkspaceCodingConfigResponse])
async def get_coding_config(
    workspace_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """获取工作区Coding配置"""
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs"])

        config = await coding_config_service.get_config_by_workspace(db, workspace_id)
        if not config:
            # 返回空配置而不是错误，前端可以根据此状态显示配置界面
            return success_response(data=None, message="未配置Coding API")

        response_data = WorkspaceCodingConfigResponse(
            id=config.id,
            workspace_id=config.workspace_id,
            api_token=config.api_token,
            project_name=config.project_name,
            api_base_url=config.api_base_url,
            is_enabled=config.is_enabled,
            sync_conditions=config.sync_conditions,
            last_sync_at=config.last_sync_at,
            created_at=config.created_at,
            updated_at=config.updated_at,
            created_by=config.created_by
        )

        return success_response(data=response_data)

    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取Coding配置失败: {str(e)}")
        return error_response(message=f"获取配置失败: {str(e)}")


@router.put("/config/{workspace_id}", response_model=APIResponse[WorkspaceCodingConfigResponse])
async def update_coding_config(
    workspace_id: int,
    config_data: WorkspaceCodingConfigUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """更新工作区Coding配置"""
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs"])

        config = await coding_config_service.update_config(db, workspace_id, config_data, current_user)

        response_data = WorkspaceCodingConfigResponse(
            id=config.id,
            workspace_id=config.workspace_id,
            api_token=config.api_token,
            project_name=config.project_name,
            api_base_url=config.api_base_url,
            is_enabled=config.is_enabled,
            sync_conditions=config.sync_conditions,
            last_sync_at=config.last_sync_at,
            created_at=config.created_at,
            updated_at=config.updated_at,
            created_by=config.created_by
        )

        return success_response(data=response_data, message="Coding配置更新成功")

    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"更新Coding配置失败: {str(e)}")
        return error_response(message=f"更新配置失败: {str(e)}")


@router.delete("/config/{workspace_id}", response_model=APIResponse[str])
async def delete_coding_config(
    workspace_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """删除工作区Coding配置"""
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs"])

        message = await coding_config_service.delete_config(db, workspace_id, current_user)
        return success_response(data=message, message=message)

    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"删除Coding配置失败: {str(e)}")
        return error_response(message=f"删除配置失败: {str(e)}")


@router.post("/config/{workspace_id}/test", response_model=APIResponse[Dict[str, Any]])
async def test_coding_config(
    workspace_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """测试工作区Coding配置连接"""
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs"])

        result = await coding_config_service.test_config(db, workspace_id)
        return success_response(data=result, message="连接测试成功")

    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"测试Coding配置失败: {str(e)}")
        return error_response(message=f"连接测试失败: {str(e)}")


@router.get("/module-health-analysis", response_model=APIResponse[Dict[str, Any]])
async def get_module_health_analysis(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    workspace_id: int = Query(..., description="工作区ID"),
    module_id: Optional[int] = Query(None, description="选中的模块ID，为空时返回全部数据"),
    start_date: Optional[str] = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
    labels: Optional[str] = Query(None, description="标签筛选，多个用逗号分隔"),
    priority: Optional[str] = Query(None, description="优先级筛选"),
    status: Optional[str] = Query(None, description="状态筛选")
):
    """获取模块健康分析数据"""
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs"])

        # 解析标签参数
        label_list = None
        if labels:
            label_list = [label.strip() for label in labels.split(',') if label.strip()]

        # 调用服务获取分析数据
        result = await coding_bug_service.get_module_health_analysis(
            db=db,
            workspace_id=workspace_id,
            module_id=module_id,
            start_date=start_date,
            end_date=end_date,
            labels=label_list,
            priority=priority,
            status=status
        )

        return success_response(data=result, message="获取健康分析数据成功")

    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取模块健康分析数据失败: {str(e)}")
        return error_response(message=f"获取分析数据失败: {str(e)}")


@router.get("/trend-analysis", response_model=APIResponse[Dict[str, Any]])
async def get_bug_trend_analysis(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    workspace_id: int = Query(..., description="工作区ID"),
    module_id: Optional[int] = Query(None, description="选中的模块ID"),
    start_date: Optional[str] = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
    labels: Optional[str] = Query(None, description="标签筛选，多个用逗号分隔"),
    priority: Optional[str] = Query(None, description="优先级筛选"),
    status: Optional[str] = Query(None, description="状态筛选")
):
    """获取缺陷趋势分析数据"""
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs"])

        # 解析标签参数
        label_list = None
        if labels:
            label_list = [label.strip() for label in labels.split(',') if label.strip()]

        # 调用服务获取趋势数据
        result = await coding_bug_service.get_bug_trend_analysis(
            db=db,
            workspace_id=workspace_id,
            module_id=module_id,
            start_date=start_date,
            end_date=end_date,
            labels=label_list,
            priority=priority,
            status=status
        )

        return success_response(data=result, message="获取趋势分析数据成功")

    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取缺陷趋势分析数据失败: {str(e)}")
        return error_response(message=f"获取趋势分析数据失败: {str(e)}")
