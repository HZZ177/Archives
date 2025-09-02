from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_db, success_response, error_response, check_permissions
from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.schemas.bug import (
    BugProfileCreate, BugProfileUpdate, BugLogCreate,
    BugModuleLinkCreate, BugListParams, BugLogListParams,
    BugAnalysisParams, BugProfileResponse, BugProfileDetailResponse,
    BugLogResponse, BugModuleLinkResponse, BugAnalysisResponse
)
from backend.app.schemas.response import APIResponse
from backend.app.services.bug_service import bug_service
from backend.app.services.workspace_service import workspace_service

router = APIRouter()


@router.post("/", response_model=APIResponse[BugProfileResponse], status_code=status.HTTP_201_CREATED)
async def create_bug_profile(
        bug_data: BugProfileCreate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)],
        workspace_id: Optional[int] = Query(None, description="工作区ID，不指定则使用用户默认工作区")
):
    """
    创建新的Bug档案
    """
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs:create"])
        
        # 如果未指定工作区，使用用户的默认工作区
        if workspace_id is None and current_user.default_workspace_id:
            workspace_id = current_user.default_workspace_id
        elif workspace_id is None:
            default_workspace = await workspace_service.get_default_workspace(db, current_user)
            workspace_id = default_workspace.id
        
        bug_profile = await bug_service.create_bug_profile(db, bug_data, current_user, workspace_id)
        
        # 转换为响应格式
        response_data = {
            "id": bug_profile.id,
            "title": bug_profile.title,
            "description": bug_profile.description,
            "severity": bug_profile.severity,
            "tags": bug_profile.tags,
            "reporter_id": bug_profile.reporter_id,
            "workspace_id": bug_profile.workspace_id,
            "created_at": bug_profile.created_at,
            "updated_at": bug_profile.updated_at,
            "occurrence_count": 1,  # 创建时自动生成一条日志
            "last_occurrence": bug_profile.created_at
        }
        
        return success_response(data=response_data, message="Bug档案创建成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"创建Bug档案失败: {str(e)}")
        return error_response(message=f"创建Bug档案失败: {str(e)}")


@router.get("/", response_model=APIResponse[dict])
async def get_bug_profiles(
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)],
        page: int = Query(1, ge=1, description="页码"),
        page_size: int = Query(10, ge=1, le=100, description="每页数量"),
        keyword: Optional[str] = Query(None, description="搜索关键词"),
        severity: Optional[str] = Query(None, description="严重程度筛选"),
        status: Optional[str] = Query(None, description="状态筛选 (OPEN/IN_PROGRESS/RESOLVED/CLOSED)"),
        workspace_id: Optional[int] = Query(None, description="工作区ID，不指定则使用用户默认工作区")
):
    """
    获取Bug档案列表
    """
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs:view"])
        
        # 如果未指定工作区，使用用户的默认工作区
        if workspace_id is None and current_user.default_workspace_id:
            workspace_id = current_user.default_workspace_id
        elif workspace_id is None:
            default_workspace = await workspace_service.get_default_workspace(db, current_user)
            workspace_id = default_workspace.id
        
        params = BugListParams(
            page=page,
            page_size=page_size,
            keyword=keyword,
            severity=severity,
            status=status,
            workspace_id=workspace_id
        )
        
        result = await bug_service.get_bug_profiles(db, params, current_user, workspace_id)
        return success_response(data=result)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取Bug档案列表失败: {str(e)}")
        return error_response(message=f"获取Bug档案列表失败: {str(e)}")


@router.post("/get-detail", response_model=APIResponse[BugProfileDetailResponse])
async def get_bug_detail(
        request_data: dict,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取Bug档案详情
    """
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs:view"])
        
        bug_id = request_data.get("bug_id")
        if not bug_id:
            return error_response(message="缺少bug_id参数")
        
        bug_profile = await bug_service.get_bug_profile_detail(db, bug_id, current_user)
        
        # 转换为响应格式
        response_data = {
            "id": bug_profile.id,
            "title": bug_profile.title,
            "description": bug_profile.description,
            "severity": bug_profile.severity,
            "tags": bug_profile.tags,
            "reporter_id": bug_profile.reporter_id,
            "workspace_id": bug_profile.workspace_id,
            "created_at": bug_profile.created_at,
            "updated_at": bug_profile.updated_at,
            "occurrence_count": len(bug_profile.logs),
            "last_occurrence": bug_profile.logs[0].occurred_at if bug_profile.logs else None,
            "logs": [
                {
                    "id": log.id,
                    "bug_id": log.bug_id,
                    "occurred_at": log.occurred_at,
                    "reporter_id": log.reporter_id,
                    "notes": log.notes,
                    "created_at": log.created_at,
                    "module_id": getattr(log, 'module_id', None),
                    "module_name": getattr(log, 'module').name if getattr(log, 'module', None) else None
                } for log in bug_profile.logs
            ],
            "module_links": [
                {
                    "id": link.id,
                    "module_id": link.module_id,
                    "bug_id": link.bug_id,
                    "manifestation_description": link.manifestation_description,
                    "created_at": link.created_at,
                    "module_name": link.module.name if link.module else None
                } for link in bug_profile.module_links
            ]
        }
        
        return success_response(data=response_data)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取Bug档案详情失败: {str(e)}")
        return error_response(message=f"获取Bug档案详情失败: {str(e)}")


@router.post("/update", response_model=APIResponse[BugProfileResponse])
async def update_bug_profile(
        request_data: dict,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新Bug档案
    """
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs:edit"])
        
        bug_id = request_data.get("bug_id")
        data = request_data.get("data")
        
        if not bug_id or not data:
            return error_response(message="缺少必要参数")
        
        bug_data = BugProfileUpdate(**data)
        bug_profile = await bug_service.update_bug_profile(db, bug_id, bug_data, current_user)
        
        # 转换为响应格式
        response_data = {
            "id": bug_profile.id,
            "title": bug_profile.title,
            "description": bug_profile.description,
            "severity": bug_profile.severity,
            "tags": bug_profile.tags,
            "reporter_id": bug_profile.reporter_id,
            "workspace_id": bug_profile.workspace_id,
            "created_at": bug_profile.created_at,
            "updated_at": bug_profile.updated_at,
            "occurrence_count": 0,  # 需要单独查询
            "last_occurrence": None
        }
        
        return success_response(data=response_data, message="Bug档案更新成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"更新Bug档案失败: {str(e)}")
        return error_response(message=f"更新Bug档案失败: {str(e)}")


@router.post("/delete", response_model=APIResponse)
async def delete_bug_profile(
        request_data: dict,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    删除Bug档案
    """
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs:delete"])
        
        bug_id = request_data.get("bug_id")
        if not bug_id:
            return error_response(message="缺少bug_id参数")
        
        message = await bug_service.delete_bug_profile(db, bug_id, current_user)
        return success_response(message=message)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"删除Bug档案失败: {str(e)}")
        return error_response(message=f"删除Bug档案失败: {str(e)}")


@router.post("/log-occurrence", response_model=APIResponse[BugLogResponse])
async def log_bug_occurrence(
        request_data: dict,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    记录Bug发生
    """
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs:log"])
        
        bug_id = request_data.get("bug_id")
        notes = request_data.get("notes")
        module_id = request_data.get("module_id")
        
        if not bug_id:
            return error_response(message="缺少bug_id参数")
        
        log_data = BugLogCreate(notes=notes, module_id=module_id)
        bug_log = await bug_service.log_bug_occurrence(db, bug_id, log_data, current_user)
        
        # 转换为响应格式
        response_data = {
            "id": bug_log.id,
            "bug_id": bug_log.bug_id,
            "occurred_at": bug_log.occurred_at,
            "reporter_id": bug_log.reporter_id,
            "notes": bug_log.notes,
            "created_at": bug_log.created_at
        }
        
        return success_response(data=response_data, message="Bug发生记录创建成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"记录Bug发生失败: {str(e)}")
        return error_response(message=f"记录Bug发生失败: {str(e)}")


@router.post("/get-logs", response_model=APIResponse[dict])
async def get_bug_logs(
        request_data: dict,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取Bug发生历史
    """
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs:view"])
        
        bug_id = request_data.get("bug_id")
        page = request_data.get("page", 1)
        page_size = request_data.get("page_size", 10)
        
        if not bug_id:
            return error_response(message="缺少bug_id参数")
        
        params = BugLogListParams(page=page, page_size=page_size)
        result = await bug_service.get_bug_logs(db, bug_id, params, current_user)
        
        # 转换为响应格式
        response_data = {
            "items": [
                {
                    "id": log.id,
                    "bug_id": log.bug_id,
                    "occurred_at": log.occurred_at,
                    "reporter_id": log.reporter_id,
                    "notes": log.notes,
                    "created_at": log.created_at,
                    "module_id": getattr(log, 'module_id', None),
                    "module_name": getattr(log, 'module').name if getattr(log, 'module', None) else None
                } for log in result["items"]
            ],
            "total": result["total"],
            "page": result["page"],
            "page_size": result["page_size"]
        }
        
        return success_response(data=response_data)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取Bug发生历史失败: {str(e)}")
        return error_response(message=f"获取Bug发生历史失败: {str(e)}")


@router.post("/link-module", response_model=APIResponse[BugModuleLinkResponse])
async def link_bug_to_module(
        request_data: dict,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    关联Bug到模块
    """
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs:link"])
        
        bug_id = request_data.get("bug_id")
        module_id = request_data.get("module_id")
        manifestation_description = request_data.get("manifestation_description")
        
        if not bug_id or not module_id:
            return error_response(message="缺少必要参数")
        
        link_data = BugModuleLinkCreate(
            module_id=module_id,
            manifestation_description=manifestation_description
        )
        
        module_link = await bug_service.link_bug_to_module(db, bug_id, link_data, current_user)
        
        # 转换为响应格式
        response_data = {
            "id": module_link.id,
            "module_id": module_link.module_id,
            "bug_id": module_link.bug_id,
            "manifestation_description": module_link.manifestation_description,
            "created_at": module_link.created_at,
            "module_name": None  # 需要单独查询
        }
        
        return success_response(data=response_data, message="Bug模块关联创建成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"关联Bug到模块失败: {str(e)}")
        return error_response(message=f"关联Bug到模块失败: {str(e)}")


@router.post("/get-module-bugs", response_model=APIResponse[dict])
async def get_module_bugs(
        request_data: dict,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取模块关联的所有Bug
    """
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs:view"])
        
        module_id = request_data.get("module_id")
        page = request_data.get("page", 1)
        page_size = request_data.get("page_size", 10)
        
        if not module_id:
            return error_response(message="缺少module_id参数")
        
        params = BugLogListParams(page=page, page_size=page_size)
        result = await bug_service.get_module_bugs(db, module_id, params, current_user)
        
        # 转换为响应格式
        response_data = {
            "items": [
                {
                    "id": bug.id,
                    "title": bug.title,
                    "description": bug.description,
                    "severity": bug.severity,
                    "status": bug.status,
                    "tags": bug.tags,
                    "reporter_id": bug.reporter_id,
                    "workspace_id": bug.workspace_id,
                    "created_at": bug.created_at,
                    "updated_at": bug.updated_at,
                    "occurrence_count": 0,  # 需要单独查询
                    "last_occurrence": None
                } for bug in result["items"]
            ],
            "total": result["total"],
            "page": result["page"],
            "page_size": result["page_size"]
        }
        
        return success_response(data=response_data)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取模块关联Bug失败: {str(e)}")
        return error_response(message=f"获取模块关联Bug失败: {str(e)}")


@router.post("/unlink-module", response_model=APIResponse)
async def unlink_bug_from_module(
        request_data: dict,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    取消Bug与模块的关联
    """
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs:link"])
        
        bug_id = request_data.get("bug_id")
        module_id = request_data.get("module_id")
        
        if not bug_id or not module_id:
            return error_response(message="缺少必要参数")
        
        message = await bug_service.unlink_bug_from_module(db, bug_id, module_id, current_user)
        return success_response(message=message)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"取消Bug模块关联失败: {str(e)}")
        return error_response(message=f"取消Bug模块关联失败: {str(e)}")


@router.post("/analysis", response_model=APIResponse[BugAnalysisResponse])
async def get_bug_analysis(
        request_data: dict,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取Bug分析结果
    """
    try:
        # 权限检查
        await check_permissions(db, current_user, ["workspace:resources:bugs:analysis"])
        
        workspace_id = request_data.get("workspace_id")
        time_range = request_data.get("time_range", "30d")
        analysis_type = request_data.get("analysis_type", "overview")
        
        if not workspace_id:
            return error_response(message="缺少workspace_id参数")
        
        params = BugAnalysisParams(time_range=time_range, analysis_type=analysis_type)
        result = await bug_service.get_bug_analysis(db, workspace_id, params, current_user)
        
        return success_response(data=result)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取Bug分析结果失败: {str(e)}")
        return error_response(message=f"获取Bug分析结果失败: {str(e)}")
