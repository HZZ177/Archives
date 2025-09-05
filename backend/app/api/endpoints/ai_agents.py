from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_db
from backend.app.models.user import User
from backend.app.services.ai_agent_service import AIAgentService
from backend.app.schemas.ai_agents import (
    DefectAnalysisRequest,
    DefectAnalysisResult,
    AIAgentExecutionResponse
)
from backend.app.schemas.response import APIResponse, PaginatedResponse
from backend.app.core.exceptions import AIServiceException, AgentExecutionException
from backend.app.core.logger import logger
router = APIRouter()


@router.post("/defect-analysis", response_model=APIResponse[DefectAnalysisResult])
async def execute_defect_analysis(
    request: DefectAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """执行缺陷分析"""
    try:
        ai_agent_service = AIAgentService()
        result = await ai_agent_service.execute_defect_analysis(db, request, current_user.id)
        
        return APIResponse(
            success=True,
            message="缺陷分析执行成功",
            data=result
        )
    except AgentExecutionException as e:
        logger.error(f"缺陷分析执行失败: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"缺陷分析执行异常: {str(e)}")
        raise HTTPException(status_code=500, detail="内部服务器错误")


@router.get("/executions", response_model=APIResponse[PaginatedResponse[AIAgentExecutionResponse]])
async def list_agent_executions(
    workspace_id: int = Query(..., description="工作空间ID"),
    agent_type: str = Query(None, description="Agent类型"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取Agent执行历史"""
    try:
        ai_agent_service = AIAgentService()
        result = await ai_agent_service.get_execution_history(
            db, workspace_id, page, page_size
        )
        
        execution_responses = [
            AIAgentExecutionResponse.model_validate(execution) 
            for execution in result["executions"]
        ]
        
        return APIResponse(
            success=True,
            message="获取执行历史成功",
            data=PaginatedResponse(
                items=execution_responses,
                total=result["total"],
                page=page,
                page_size=page_size
            )
        )
    except Exception as e:
        logger.error(f"获取执行历史异常: {str(e)}")
        raise HTTPException(status_code=500, detail="内部服务器错误")


@router.get("/executions/{execution_id}", response_model=APIResponse[AIAgentExecutionResponse])
async def get_agent_execution_detail(
    execution_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取Agent执行详情"""
    try:
        from sqlalchemy import select
        from backend.app.models.ai_agent_execution import AIAgentExecution
        
        result = await db.execute(
            select(AIAgentExecution).where(AIAgentExecution.id == execution_id)
        )
        execution = result.scalar_one_or_none()
        
        if not execution:
            raise HTTPException(status_code=404, detail="执行记录不存在")
        
        return APIResponse(
            success=True,
            message="获取执行详情成功",
            data=AIAgentExecutionResponse.model_validate(execution)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取执行详情异常: {str(e)}")
        raise HTTPException(status_code=500, detail="内部服务器错误")
