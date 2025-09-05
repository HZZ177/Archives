import json
import time
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert
from crewai import Crew

from backend.app.models.ai_agent_execution import AIAgent, AIAgentExecution
from backend.app.services.llm_pool_service import LLMPoolService
from backend.app.services.ai_agent_factory import AIAgentFactory
from backend.app.services.ai_task_factory import AITaskFactory
from backend.app.services.coding_bug_service import CodingBugService
from backend.app.schemas.ai_agents import DefectAnalysisRequest, DefectAnalysisResult
from backend.app.core.exceptions import AIServiceException, AgentExecutionException
from backend.app.core.logger import logger


class AIAgentService:
    """AI Agent执行服务"""
    
    def __init__(self):
        self.llm_pool = LLMPoolService()
        self.agent_factory = AIAgentFactory()
        self.task_factory = AITaskFactory()
        self.coding_bug_service = CodingBugService()
    
    async def execute_defect_analysis(
        self,
        db: AsyncSession,
        request: DefectAnalysisRequest,
        user_id: int
    ) -> DefectAnalysisResult:
        """执行缺陷分析"""
        
        execution_record = None
        llm = None
        
        try:
            # 1. 创建执行记录
            execution_record = await self._create_execution_record(
                db=db,
                agent_type="defect_analysis",
                task_type="monthly_analysis",
                input_data=request.model_dump_json(),
                workspace_id=request.workspace_id,
                user_id=user_id
            )
            
            # 2. 获取缺陷数据
            logger.info(f"开始获取缺陷数据: {request.year}-{request.month}")
            defect_data = await self._get_defect_data(db, request)
            
            # 3. 获取LLM实例
            logger.info("获取LLM实例")
            llm = await self.llm_pool.acquire_llm(db)
            
            # 4. 创建Agent和Task
            logger.info("创建分析Agent和任务")
            analysis_agent = self.agent_factory.create_defect_analysis_agent(llm)
            analysis_task = self.task_factory.create_defect_analysis_task(analysis_agent, defect_data)
            
            # 5. 执行分析任务
            logger.info("开始执行缺陷分析任务")
            start_time = time.time()
            
            crew = Crew(
                agents=[analysis_agent],
                tasks=[analysis_task],
                verbose=True
            )
            
            analysis_result = crew.kickoff()
            
            duration_ms = int((time.time() - start_time) * 1000)
            logger.info(f"缺陷分析任务完成，耗时: {duration_ms}ms")
            
            # 6. 处理分析结果
            processed_result = await self._process_analysis_result(
                str(analysis_result),
                defect_data,
                execution_record.id
            )
            
            # 7. 更新执行记录
            await self._update_execution_record(
                db=db,
                execution_id=execution_record.id,
                status="completed",
                output_data=json.dumps(processed_result, ensure_ascii=False),
                duration_ms=duration_ms
            )
            
            return DefectAnalysisResult(**processed_result)
            
        except Exception as e:
            logger.error(f"执行缺陷分析失败: {str(e)}")
            
            # 更新执行记录为失败状态
            if execution_record:
                await self._update_execution_record(
                    db=db,
                    execution_id=execution_record.id,
                    status="failed",
                    error_message=str(e)
                )
            
            raise AgentExecutionException(f"缺陷分析执行失败: {str(e)}")
            
        finally:
            # 释放LLM实例
            if llm:
                await self.llm_pool.release_llm(llm)
    
    async def _get_defect_data(self, db: AsyncSession, request: DefectAnalysisRequest) -> Dict[str, Any]:
        """获取缺陷数据"""
        try:
            # 获取月度统计数据
            statistics = await self.coding_bug_service.get_module_statistics(
                db=db,
                workspace_id=request.workspace_id,
                start_date=f"{request.year}-{request.month:02d}-01",
                end_date=f"{request.year}-{request.month:02d}-31"
            )
            
            # 获取趋势数据
            trend_data = await self.coding_bug_service.get_bug_trend_analysis(
                db=db,
                workspace_id=request.workspace_id,
                start_date=f"{request.year}-{request.month:02d}-01",
                end_date=f"{request.year}-{request.month:02d}-31"
            )
            
            # 获取模块健康分析
            health_analysis = await self.coding_bug_service.get_module_health_analysis(
                db=db,
                workspace_id=request.workspace_id,
                start_date=f"{request.year}-{request.month:02d}-01",
                end_date=f"{request.year}-{request.month:02d}-31"
            )
            
            return {
                "year": request.year,
                "month": request.month,
                "workspace_id": request.workspace_id,
                "statistics": statistics,
                "trend_data": trend_data,
                "health_analysis": health_analysis,
                "analysis_date": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"获取缺陷数据失败: {str(e)}")
            raise AIServiceException(f"获取缺陷数据失败: {str(e)}")
    
    async def _process_analysis_result(
        self,
        analysis_result: str,
        defect_data: Dict[str, Any],
        execution_id: int
    ) -> Dict[str, Any]:
        """处理分析结果"""
        try:
            return {
                "execution_id": execution_id,
                "analysis_summary": analysis_result[:500] + "..." if len(analysis_result) > 500 else analysis_result,
                "time_distribution": defect_data.get("trend_data", {}),
                "module_distribution": defect_data.get("health_analysis", {}).get("module_tree", {}),
                "defect_type_analysis": defect_data.get("statistics", {}),
                "root_cause_analysis": {"analysis": analysis_result},
                "recurring_issues": [],  # TODO: 实现重复问题识别
                "improvement_suggestions": [
                    "加强代码审查流程",
                    "完善自动化测试覆盖",
                    "建立缺陷预防机制",
                    "优化问题跟踪流程"
                ],
                "generated_at": datetime.now()
            }
            
        except Exception as e:
            logger.error(f"处理分析结果失败: {str(e)}")
            raise AIServiceException(f"处理分析结果失败: {str(e)}")
    
    async def _create_execution_record(
        self,
        db: AsyncSession,
        agent_type: str,
        task_type: str,
        input_data: str,
        workspace_id: int,
        user_id: int
    ) -> AIAgentExecution:
        """创建执行记录"""
        try:
            execution = AIAgentExecution(
                agent_id=1,  # TODO: 从数据库获取对应的agent_id
                task_type=task_type,
                input_data=input_data,
                execution_status="running",
                start_time=datetime.now(),
                workspace_id=workspace_id,
                created_by=user_id
            )
            
            db.add(execution)
            await db.commit()
            await db.refresh(execution)
            
            logger.info(f"创建执行记录成功: ID {execution.id}")
            return execution
            
        except Exception as e:
            await db.rollback()
            logger.error(f"创建执行记录失败: {str(e)}")
            raise AIServiceException(f"创建执行记录失败: {str(e)}")
    
    async def _update_execution_record(
        self,
        db: AsyncSession,
        execution_id: int,
        status: str,
        output_data: str = None,
        error_message: str = None,
        duration_ms: int = None
    ):
        """更新执行记录"""
        try:
            result = await db.execute(
                select(AIAgentExecution).where(AIAgentExecution.id == execution_id)
            )
            execution = result.scalar_one_or_none()
            
            if execution:
                execution.execution_status = status
                execution.end_time = datetime.now()
                
                if output_data:
                    execution.output_data = output_data
                if error_message:
                    execution.error_message = error_message
                if duration_ms:
                    execution.duration_ms = duration_ms
                
                await db.commit()
                logger.info(f"更新执行记录成功: ID {execution_id}, 状态: {status}")
            
        except Exception as e:
            await db.rollback()
            logger.error(f"更新执行记录失败: {str(e)}")
    
    async def get_execution_history(
        self,
        db: AsyncSession,
        workspace_id: int,
        page: int = 1,
        page_size: int = 10
    ) -> Dict[str, Any]:
        """获取执行历史"""
        try:
            offset = (page - 1) * page_size
            
            result = await db.execute(
                select(AIAgentExecution)
                .where(AIAgentExecution.workspace_id == workspace_id)
                .order_by(AIAgentExecution.created_at.desc())
                .offset(offset)
                .limit(page_size)
            )
            executions = result.scalars().all()
            
            # 获取总数
            count_result = await db.execute(
                select(AIAgentExecution)
                .where(AIAgentExecution.workspace_id == workspace_id)
                .with_only_columns([AIAgentExecution.id])
            )
            total = len(count_result.scalars().all())
            
            return {
                "executions": list(executions),
                "total": total,
                "page": page,
                "page_size": page_size
            }
            
        except Exception as e:
            logger.error(f"获取执行历史失败: {str(e)}")
            raise AIServiceException(f"获取执行历史失败: {str(e)}")
