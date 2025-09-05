from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_db
from backend.app.models.user import User
from backend.app.services.monthly_report_service import MonthlyReportService
from backend.app.schemas.monthly_report import (
    MonthlyReportResponse, MonthlyReportCreate, MonthlyReportUpdate,
    PromptTemplateResponse, PromptTemplateCreate, PromptTemplateUpdate,
    GenerateReportRequest, GenerationProgress, ReportHistoryResponse
)
from backend.app.schemas.response import APIResponse
from backend.app.core.exceptions import AIServiceException
from backend.app.core.logger import logger

router = APIRouter()


@router.post("/generate", response_model=APIResponse[MonthlyReportResponse])
async def generate_monthly_report(
    request: GenerateReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """生成月度报告"""
    try:
        service = MonthlyReportService()
        report = await service.generate_report(db, request, current_user.id)
        
        return APIResponse(
            success=True,
            message="报告生成已启动",
            data=report
        )
    except AIServiceException as e:
        logger.error(f"生成月度报告失败: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"生成月度报告异常: {str(e)}")
        raise HTTPException(status_code=500, detail="内部服务器错误")


@router.get("/progress/{report_id}", response_model=APIResponse[Optional[GenerationProgress]])
async def get_generation_progress(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取报告生成进度"""
    try:
        service = MonthlyReportService()
        progress = await service.get_generation_progress(db, report_id)

        if not progress:
            return APIResponse(
                success=True,
                message="未找到生成任务或任务已完成",
                data=None
            )

        return APIResponse(
            success=True,
            message="获取进度成功",
            data=progress
        )
    except Exception as e:
        logger.error(f"获取生成进度异常: {str(e)}")
        raise HTTPException(status_code=500, detail="内部服务器错误")


@router.get("/history", response_model=APIResponse[List[MonthlyReportResponse]])
async def get_report_history(
    workspace_id: int = Query(..., description="工作区ID"),
    limit: int = Query(50, ge=1, le=100, description="返回数量限制"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取报告历史"""
    try:
        service = MonthlyReportService()
        reports = await service.list_reports(db, workspace_id, limit)
        
        return APIResponse(
            success=True,
            message="获取报告历史成功",
            data=reports
        )
    except Exception as e:
        logger.error(f"获取报告历史异常: {str(e)}")
        raise HTTPException(status_code=500, detail="内部服务器错误")


@router.get("/{report_id}", response_model=APIResponse[Optional[MonthlyReportResponse]])
async def get_monthly_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取单个月度报告"""
    try:
        service = MonthlyReportService()
        report = await service.get_report(db, report_id)

        if not report:
            return APIResponse(
                success=True,
                message="报告不存在",
                data=None
            )

        return APIResponse(
            success=True,
            message="获取报告成功",
            data=report
        )
    except Exception as e:
        logger.error(f"获取报告异常: {str(e)}")
        raise HTTPException(status_code=500, detail="内部服务器错误")


@router.get("/by-month/{workspace_id}/{year}/{month}", response_model=APIResponse[Optional[MonthlyReportResponse]])
async def get_report_by_month(
    workspace_id: int,
    year: int,
    month: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """根据年月获取报告"""
    try:
        service = MonthlyReportService()
        report = await service.get_report_by_month(db, workspace_id, year, month)

        if not report:
            return APIResponse(
                success=True,
                message="报告不存在",
                data=None
            )

        return APIResponse(
            success=True,
            message="获取报告成功",
            data=report
        )
    except Exception as e:
        logger.error(f"获取报告异常: {str(e)}")
        raise HTTPException(status_code=500, detail="内部服务器错误")


@router.put("/{report_id}", response_model=APIResponse[MonthlyReportResponse])
async def update_monthly_report(
    report_id: int,
    update_data: MonthlyReportUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """更新月度报告"""
    try:
        service = MonthlyReportService()
        report = await service.update_report(db, report_id, update_data)
        
        return APIResponse(
            success=True,
            message="更新报告成功",
            data=report
        )
    except AIServiceException as e:
        logger.error(f"更新报告失败: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"更新报告异常: {str(e)}")
        raise HTTPException(status_code=500, detail="内部服务器错误")


@router.delete("/{report_id}", response_model=APIResponse[bool])
async def delete_monthly_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """删除月度报告"""
    try:
        service = MonthlyReportService()
        success = await service.delete_report(db, report_id)
        
        return APIResponse(
            success=True,
            message="删除报告成功",
            data=success
        )
    except AIServiceException as e:
        logger.error(f"删除报告失败: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"删除报告异常: {str(e)}")
        raise HTTPException(status_code=500, detail="内部服务器错误")


# 提示词模板相关端点
@router.post("/prompt-templates", response_model=APIResponse[PromptTemplateResponse])
async def create_prompt_template(
    template_data: PromptTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """创建提示词模板"""
    try:
        service = MonthlyReportService()
        template = await service.create_prompt_template(db, template_data, current_user.id)
        
        return APIResponse(
            success=True,
            message="创建提示词模板成功",
            data=template
        )
    except AIServiceException as e:
        logger.error(f"创建提示词模板失败: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"创建提示词模板异常: {str(e)}")
        raise HTTPException(status_code=500, detail="内部服务器错误")


@router.get("/prompt-templates/{workspace_id}", response_model=APIResponse[List[PromptTemplateResponse]])
async def list_prompt_templates(
    workspace_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取提示词模板列表"""
    try:
        service = MonthlyReportService()
        templates = await service.list_prompt_templates(db, workspace_id)
        
        return APIResponse(
            success=True,
            message="获取提示词模板列表成功",
            data=templates
        )
    except Exception as e:
        logger.error(f"获取提示词模板列表异常: {str(e)}")
        raise HTTPException(status_code=500, detail="内部服务器错误")
