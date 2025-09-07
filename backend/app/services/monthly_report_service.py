import asyncio
import json
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, func
from sqlalchemy.orm import selectinload

from backend.app.models.monthly_report import MonthlyReport, PromptTemplate
from backend.app.models.coding_bug import CodingBug
from backend.app.schemas.monthly_report import (
    MonthlyReportCreate, MonthlyReportUpdate, MonthlyReportResponse,
    PromptTemplateCreate, PromptTemplateUpdate, PromptTemplateResponse,
    GenerationProgress, ReportData, GenerateReportRequest
)
from backend.app.schemas.ai_agents import DefectAnalysisRequest
from backend.app.services.ai_agent_service import AIAgentService
from backend.app.core.exceptions import AIServiceException
from backend.app.core.logger import logger


class MonthlyReportService:
    """月度报告服务"""

    def __init__(self):
        self.generation_tasks = {}  # 存储生成任务的状态
        self.ai_agent_service = AIAgentService()  # AI Agent服务
    
    async def create_report(self, db: AsyncSession, report_data: MonthlyReportCreate, user_id: int) -> MonthlyReportResponse:
        """创建月度报告"""
        try:
            # 直接创建新报告，支持同一月份的多个版本
            db_report = MonthlyReport(
                workspace_id=report_data.workspace_id,
                year=report_data.year,
                month=report_data.month,
                prompt_template=report_data.prompt_template,
                status="generating",  # 直接设置为生成中
                created_by=user_id
            )

            db.add(db_report)
            await db.commit()
            await db.refresh(db_report)

            logger.info(f"创建月度报告成功: {report_data.year}-{report_data.month}, ID: {db_report.id}")
            return MonthlyReportResponse.from_orm(db_report)

        except Exception as e:
            await db.rollback()
            logger.error(f"创建月度报告失败: {str(e)}")
            raise AIServiceException(f"创建报告失败: {str(e)}")
    
    async def get_report(self, db: AsyncSession, report_id: int) -> Optional[MonthlyReportResponse]:
        """获取单个报告"""
        try:
            result = await db.execute(
                select(MonthlyReport).where(MonthlyReport.id == report_id)
            )
            report = result.scalar_one_or_none()
            
            if not report:
                return None
                
            return MonthlyReportResponse.from_orm(report)
            
        except Exception as e:
            logger.error(f"获取报告失败: {str(e)}")
            raise AIServiceException(f"获取报告失败: {str(e)}")
    
    async def get_report_by_month(self, db: AsyncSession, workspace_id: int, year: int, month: int) -> Optional[MonthlyReportResponse]:
        """根据年月获取最新报告"""
        try:
            result = await db.execute(
                select(MonthlyReport).where(
                    and_(
                        MonthlyReport.workspace_id == workspace_id,
                        MonthlyReport.year == year,
                        MonthlyReport.month == month
                    )
                ).order_by(desc(MonthlyReport.created_at))  # 获取最新的报告
                .limit(1)
            )
            report = result.scalar_one_or_none()

            if not report:
                return None

            return MonthlyReportResponse.from_orm(report)

        except Exception as e:
            logger.error(f"获取报告失败: {str(e)}")
            raise AIServiceException(f"获取报告失败: {str(e)}")
    
    async def list_reports(self, db: AsyncSession, workspace_id: int, limit: int = 50) -> List[MonthlyReportResponse]:
        """获取报告列表"""
        try:
            result = await db.execute(
                select(MonthlyReport)
                .where(MonthlyReport.workspace_id == workspace_id)
                .order_by(desc(MonthlyReport.created_at))
                .limit(limit)
            )
            reports = result.scalars().all()
            
            return [MonthlyReportResponse.from_orm(report) for report in reports]
            
        except Exception as e:
            logger.error(f"获取报告列表失败: {str(e)}")
            raise AIServiceException(f"获取报告列表失败: {str(e)}")
    
    async def update_report(self, db: AsyncSession, report_id: int, update_data: MonthlyReportUpdate) -> MonthlyReportResponse:
        """更新报告"""
        try:
            result = await db.execute(
                select(MonthlyReport).where(MonthlyReport.id == report_id)
            )
            report = result.scalar_one_or_none()
            
            if not report:
                raise AIServiceException("报告不存在")
            
            # 更新字段
            if update_data.prompt_template is not None:
                report.prompt_template = update_data.prompt_template
            if update_data.report_data is not None:
                report.report_data = update_data.report_data.dict()
            if update_data.status is not None:
                report.status = update_data.status
            
            await db.commit()
            await db.refresh(report)
            
            logger.info(f"更新报告成功: {report_id}")
            return MonthlyReportResponse.from_orm(report)
            
        except Exception as e:
            await db.rollback()
            logger.error(f"更新报告失败: {str(e)}")
            raise AIServiceException(f"更新报告失败: {str(e)}")
    
    async def delete_report(self, db: AsyncSession, report_id: int) -> bool:
        """删除报告"""
        try:
            result = await db.execute(
                select(MonthlyReport).where(MonthlyReport.id == report_id)
            )
            report = result.scalar_one_or_none()
            
            if not report:
                raise AIServiceException("报告不存在")
            
            await db.delete(report)
            await db.commit()
            
            logger.info(f"删除报告成功: {report_id}")
            return True
            
        except Exception as e:
            await db.rollback()
            logger.error(f"删除报告失败: {str(e)}")
            raise AIServiceException(f"删除报告失败: {str(e)}")
    
    async def get_generation_progress(self, db: AsyncSession, report_id: int) -> Optional[GenerationProgress]:
        """获取生成进度"""
        try:
            # 首先从数据库查询报告状态和进度
            result = await db.execute(
                select(MonthlyReport).where(MonthlyReport.id == report_id)
            )
            report = result.scalar_one_or_none()

            if not report:
                return None

            # 如果报告已完成
            if report.status == "completed":
                return GenerationProgress(
                    current_step=5,
                    total_steps=5,
                    step_name="完成",
                    step_description="报告生成完成",
                    progress_percentage=100.0
                )

            # 如果报告生成失败
            elif report.status == "failed":
                # 尝试从错误信息中推断失败的步骤
                failed_step = 1  # 默认第1步失败
                if report.error_message:
                    if "AI智能分析失败" in report.error_message:
                        failed_step = 4
                    elif "构建分析数据" in report.error_message:
                        failed_step = 3
                    elif "准备分析模板" in report.error_message:
                        failed_step = 2
                    elif "获取缺陷数据" in report.error_message:
                        failed_step = 1

                return GenerationProgress(
                    current_step=failed_step,
                    total_steps=5,
                    step_name="失败",
                    step_description=f"生成失败: {report.error_message}",
                    progress_percentage=0.0
                )

            # 如果报告正在生成中，返回数据库中的进度
            elif report.status == "generating":
                if report.generation_progress:
                    # 从数据库中恢复进度对象
                    return GenerationProgress(**report.generation_progress)
                else:
                    # 如果数据库中没有进度，检查内存
                    if report_id in self.generation_tasks:
                        return self.generation_tasks[report_id].get("progress")
                    else:
                        # 返回初始状态
                        return GenerationProgress(
                            current_step=0,
                            total_steps=5,
                            step_name="初始化",
                            step_description="准备生成报告",
                            progress_percentage=0.0
                        )

        except Exception as e:
            logger.error(f"查询报告进度失败: {str(e)}")

        return None
    
    def _get_default_prompt_template(self) -> str:
        """获取默认提示词模板"""
        return """你是一个专业的软件质量分析师，请基于以下缺陷数据生成月度分析报告。

分析要点：
1. 缺陷趋势和分布情况
2. 高频问题和根因分析  
3. 质量改进建议
4. 风险预警和预测

请以专业、客观的语调生成报告，包含具体的数据支撑和可执行的建议。

数据范围：{year}年{month}月
工作区：{workspace_name}
缺陷总数：{total_bugs}

请生成结构化的分析报告。"""

    async def generate_report(self, db: AsyncSession, request: GenerateReportRequest, user_id: int) -> MonthlyReportResponse:
        """生成月度报告"""
        try:
            # 检查是否有正在生成的报告
            existing_report = await self.get_report_by_month(
                db, request.workspace_id, request.year, request.month
            )

            if existing_report and existing_report.status == "generating":
                raise AIServiceException("该月份报告正在生成中，请稍后再试")

            # 总是创建新的报告记录（支持历史版本）
            report_create = MonthlyReportCreate(
                workspace_id=request.workspace_id,
                year=request.year,
                month=request.month,
                prompt_template=request.prompt_template
            )
            report = await self.create_report(db, report_create, user_id)

            # 启动异步生成任务
            task = asyncio.create_task(
                self._generate_report_async(db, report.id, request)
            )
            self.generation_tasks[report.id] = {
                "task": task,
                "progress": GenerationProgress(
                    current_step=0,
                    total_steps=5,
                    step_name="初始化",
                    step_description="准备生成报告",
                    progress_percentage=0.0
                )
            }

            return report

        except Exception as e:
            logger.error(f"启动报告生成失败: {str(e)}")
            raise AIServiceException(f"启动报告生成失败: {str(e)}")

    async def _generate_report_async(self, db: AsyncSession, report_id: int, request: GenerateReportRequest):
        """异步生成报告的核心逻辑"""
        # 创建新的数据库会话用于异步任务
        from backend.app.db.session import SessionLocal

        async with SessionLocal() as async_db:
            try:
                # 步骤1: 获取缺陷数据
                await self._update_progress(report_id, 1, "获取缺陷数据", "正在从数据库获取现网问题数据...")
                await asyncio.sleep(2)  # 确保前端能看到这个状态
                bugs_data = await self._fetch_bugs_data(async_db, request.workspace_id, request.year, request.month)
                logger.info(f"获取到 {len(bugs_data)} 条缺陷数据")

                # 步骤2: 准备提示词模板
                await self._update_progress(report_id, 2, "准备分析模板", "正在准备AI分析提示词模板...")
                await asyncio.sleep(2)
                prompt_template = request.prompt_template or self._get_default_prompt_template()
                logger.info("提示词模板准备完成")

                # 步骤3: 构建分析数据
                await self._update_progress(report_id, 3, "构建分析数据", "正在构建AI分析所需的数据结构...")
                await asyncio.sleep(2)
                analysis_context = await self._build_analysis_context(bugs_data, request, prompt_template)
                logger.info("分析数据构建完成")

                # 步骤4: AI智能分析
                await self._update_progress(report_id, 4, "AI智能分析", "正在调用AI Agent进行深度智能分析...")
                await asyncio.sleep(1)

                try:
                    # 使用独立的数据库连接进行AI分析，避免阻塞进度查询
                    ai_result = await self._call_ai_for_analysis_async(analysis_context, request)
                    logger.info("AI智能分析完成")
                except Exception as ai_error:
                    logger.error(f"AI智能分析失败: {str(ai_error)}")
                    await self._handle_generation_error(async_db, report_id, f"AI智能分析失败: {str(ai_error)}")
                    return

                # 步骤5: 生成最终报告
                await self._update_progress(report_id, 5, "生成报告", "正在基于AI分析结果生成最终报告...")
                await asyncio.sleep(2)

                try:
                    report_data = await self._compile_ai_report(bugs_data, ai_result, request)
                    logger.info("最终报告生成完成")
                except Exception as compile_error:
                    logger.error(f"报告编译失败: {str(compile_error)}")
                    await self._handle_generation_error(async_db, report_id, f"报告编译失败: {str(compile_error)}")
                    return

                # 更新报告状态
                await self._finalize_report(async_db, report_id, report_data)

                # 延迟清理任务，让前端有时间查询最终状态
                await asyncio.sleep(10)  # 保留10秒让前端查询
                if report_id in self.generation_tasks:
                    del self.generation_tasks[report_id]

                logger.info(f"报告生成完成: {report_id}")

            except Exception as e:
                logger.error(f"报告生成失败: {report_id}, 错误: {str(e)}")
                await self._handle_generation_error(async_db, report_id, str(e))

    async def _update_progress(self, report_id: int, step: int, step_name: str, description: str, data_count: Optional[int] = None):
        """更新生成进度"""
        progress = GenerationProgress(
            current_step=step,
            total_steps=5,
            step_name=step_name,
            step_description=description,
            progress_percentage=(step / 5) * 100,
            data_count=data_count
        )

        # 更新内存中的进度（如果任务存在）
        if report_id in self.generation_tasks:
            self.generation_tasks[report_id]["progress"] = progress

        # 同时将进度持久化到数据库
        try:
            from backend.app.db.session import SessionLocal
            async with SessionLocal() as db:
                result = await db.execute(
                    select(MonthlyReport).where(MonthlyReport.id == report_id)
                )
                report = result.scalar_one_or_none()

                if report:
                    report.generation_progress = progress.model_dump()
                    await db.commit()
                    logger.info(f"报告{report_id}进度已持久化: {step}/5 - {step_name}")
        except Exception as e:
            logger.error(f"持久化进度失败: {str(e)}")

        logger.info(f"报告{report_id}生成进度: {step}/5 - {step_name}")

    async def _handle_generation_error(self, db: AsyncSession, report_id: int, error_message: str):
        """处理生成错误"""
        try:
            # 更新报告状态为失败
            result = await db.execute(
                select(MonthlyReport).where(MonthlyReport.id == report_id)
            )
            report = result.scalar_one_or_none()

            if report:
                report.status = "failed"
                report.error_message = error_message
                report.generation_progress = None
                await db.commit()
                logger.info(f"报告{report_id}状态已更新为失败: {error_message}")

            # 清理内存中的任务
            if report_id in self.generation_tasks:
                del self.generation_tasks[report_id]

        except Exception as e:
            logger.error(f"处理生成错误失败: {str(e)}")

    async def _fetch_bugs_data(self, db: AsyncSession, workspace_id: int, year: int, month: int) -> List[Dict[str, Any]]:
        """获取指定月份的缺陷数据"""
        try:
            # 计算月份的开始和结束时间（转换为时间戳）
            start_date = datetime(year, month, 1)
            if month == 12:
                end_date = datetime(year + 1, 1, 1)
            else:
                end_date = datetime(year, month + 1, 1)

            # 转换为毫秒时间戳（Coding平台使用毫秒时间戳）
            start_timestamp = int(start_date.timestamp() * 1000)
            end_timestamp = int(end_date.timestamp() * 1000)

            # 查询缺陷数据 - 使用coding_created_at字段
            result = await db.execute(
                select(CodingBug).where(
                    and_(
                        CodingBug.workspace_id == workspace_id,
                        CodingBug.coding_created_at >= start_timestamp,
                        CodingBug.coding_created_at < end_timestamp
                    )
                )
            )
            bugs = result.scalars().all()

            # 转换为字典格式，包含更多详细信息
            bugs_data = []
            for bug in bugs:
                # 转换时间戳为可读格式
                coding_created_at = None
                if bug.coding_created_at:
                    coding_created_at = datetime.fromtimestamp(bug.coding_created_at / 1000).isoformat()

                coding_updated_at = None
                if bug.coding_updated_at:
                    coding_updated_at = datetime.fromtimestamp(bug.coding_updated_at / 1000).isoformat()

                bugs_data.append({
                    "id": bug.id,
                    "coding_bug_id": bug.coding_bug_id,
                    "coding_bug_code": bug.coding_bug_code,
                    "title": bug.title,
                    "description": bug.description,
                    "priority": bug.priority,
                    "status_name": bug.status_name,
                    "project_name": bug.project_name,
                    "assignees": bug.assignees or [],
                    "labels": bug.labels or [],
                    "iteration_name": bug.iteration_name,
                    "coding_created_at": coding_created_at,
                    "coding_updated_at": coding_updated_at,
                    "synced_at": bug.synced_at.isoformat() if bug.synced_at else None
                })

            logger.info(f"获取到{len(bugs_data)}个缺陷数据")
            return bugs_data

        except Exception as e:
            logger.error(f"获取缺陷数据失败: {str(e)}")
            raise AIServiceException(f"获取缺陷数据失败: {str(e)}")

    async def _build_analysis_context(self, bugs_data: List[Dict[str, Any]], request: GenerateReportRequest, prompt_template: str) -> Dict[str, Any]:
        """构建AI分析所需的上下文数据"""
        try:
            # 基础统计
            total_bugs = len(bugs_data)

            # 简单的优先级统计
            priority_stats = {}
            status_stats = {}
            for bug in bugs_data:
                priority = bug.get("priority", "未指定")
                status = bug.get("status_name", "未知")
                priority_stats[priority] = priority_stats.get(priority, 0) + 1
                status_stats[status] = status_stats.get(status, 0) + 1

            # 构建分析上下文
            context = {
                "year": request.year,
                "month": request.month,
                "workspace_id": request.workspace_id,
                "total_bugs": total_bugs,
                "bugs_data": bugs_data,  # 完整的原始数据
                "priority_distribution": priority_stats,
                "status_distribution": status_stats,
                "prompt_template": prompt_template,
                "analysis_request": {
                    "focus_areas": ["问题分析", "趋势识别", "根因分析", "改进建议"],
                    "output_format": "markdown"
                }
            }

            logger.info(f"构建分析上下文完成: {total_bugs}个缺陷数据")
            return context

        except Exception as e:
            logger.error(f"构建分析上下文失败: {str(e)}")
            raise AIServiceException(f"构建分析上下文失败: {str(e)}")

    async def _call_ai_for_analysis(self, db: AsyncSession, context: Dict[str, Any], request: GenerateReportRequest) -> Dict[str, Any]:
        """调用AI进行分析"""
        try:
            # 如果没有数据，返回简单分析
            if context["total_bugs"] == 0:
                return {
                    "ai_analysis": f"""基于{request.year}年{request.month}月的缺陷数据分析：

## 关键发现
1. 本月未发现现网问题，系统运行稳定
2. 这是一个积极的信号，表明系统质量良好

## 趋势分析
- 无缺陷数据，系统运行平稳
- 建议继续保持当前的质量控制水平

## 改进建议
1. 继续保持现有的质量控制流程
2. 定期进行预防性检查和维护
3. 关注系统性能和用户体验

此分析基于AI智能算法生成，建议结合实际情况进行判断。""",
                    "analysis_metadata": {
                        "total_bugs": 0,
                        "analysis_type": "no_data_analysis",
                        "generated_at": datetime.now().isoformat()
                    }
                }

            # 调用AI Agent进行真正的智能分析
            logger.info("开始调用AI Agent进行缺陷分析")

            # 构建AI Agent请求
            ai_request = DefectAnalysisRequest(
                workspace_id=request.workspace_id,
                year=request.year,
                month=request.month
            )

            # 调用AI Agent服务
            ai_result = await self.ai_agent_service.execute_defect_analysis(
                db=db,
                request=ai_request,
                user_id=1  # TODO: 从请求中获取用户ID
            )

            # 提取AI分析结果
            ai_analysis = ai_result.root_cause_analysis.get("analysis", "AI分析暂时不可用")

            logger.info("AI Agent分析完成")

            return {
                "ai_analysis": ai_analysis,
                "analysis_metadata": {
                    "total_bugs": context["total_bugs"],
                    "analysis_type": "ai_agent_analysis",
                    "execution_id": ai_result.execution_id,
                    "generated_at": datetime.now().isoformat()
                },
                "ai_result": ai_result  # 保存完整的AI结果
            }

        except Exception as e:
            logger.error(f"AI分析失败: {str(e)}")
            # 抛出异常，中断流程
            raise AIServiceException(f"缺陷分析执行失败: {str(e)}")

    async def _call_ai_for_analysis_async(self, analysis_context: Dict[str, Any], request: GenerateReportRequest) -> Dict[str, Any]:
        """使用独立数据库连接进行AI分析，避免阻塞其他操作"""
        try:
            # 解析提示词模板配置
            agent_config = None
            task_config = None

            if "prompt_template" in analysis_context:
                prompt_template = analysis_context["prompt_template"]

                # 检查是否为空字符串或None
                if prompt_template and prompt_template.strip():
                    try:
                        # 尝试解析JSON格式的提示词模板
                        import json
                        template_data = json.loads(prompt_template)

                        if "agent" in template_data and template_data["agent"]:
                            from backend.app.schemas.monthly_report import AgentPromptConfig
                            agent_config = AgentPromptConfig(**template_data["agent"])

                        if "task" in template_data and template_data["task"]:
                            from backend.app.schemas.monthly_report import TaskPromptConfig
                            task_config = TaskPromptConfig(**template_data["task"])

                        logger.info("成功解析提示词模板配置")
                    except (json.JSONDecodeError, KeyError, ValueError, TypeError) as e:
                        logger.warning(f"提示词模板格式不正确，使用默认配置: {str(e)}")
                else:
                    logger.info("提示词模板为空，使用默认配置")

            # 如果没有数据，返回简单分析
            if analysis_context["total_bugs"] == 0:
                return {
                    "ai_analysis": f"""基于{request.year}年{request.month}月的缺陷数据分析：

## 关键发现
1. 本月未发现现网问题，系统运行稳定
2. 这是一个积极的信号，表明系统质量良好

## 趋势分析
- 无缺陷数据，系统运行平稳
- 建议继续保持当前的质量控制水平

## 改进建议
1. 继续保持现有的质量控制流程
2. 定期进行预防性检查和维护
3. 关注系统性能和用户体验

此分析基于AI智能算法生成，建议结合实际情况进行判断。""",
                    "analysis_metadata": {
                        "total_bugs": 0,
                        "analysis_type": "no_data_analysis",
                        "generated_at": datetime.now().isoformat()
                    }
                }

            # 使用独立的数据库连接调用AI Agent
            logger.info("开始调用AI Agent进行缺陷分析")

            from backend.app.db.session import SessionLocal
            async with SessionLocal() as independent_db:
                # 构建AI Agent请求
                ai_request = DefectAnalysisRequest(
                    workspace_id=request.workspace_id,
                    year=request.year,
                    month=request.month
                )

                # 调用AI Agent服务，传递提示词配置
                ai_result = await self.ai_agent_service.execute_defect_analysis(
                    db=independent_db,
                    request=ai_request,
                    user_id=1,  # TODO: 从请求中获取用户ID
                    agent_config=agent_config,
                    task_config=task_config
                )

                # 提取AI分析结果
                ai_analysis = ai_result.root_cause_analysis.get("analysis", "AI分析暂时不可用")

                logger.info("AI Agent分析完成")

                return {
                    "ai_analysis": ai_analysis,
                    "analysis_metadata": {
                        "total_bugs": analysis_context["total_bugs"],
                        "analysis_type": "ai_agent_analysis",
                        "execution_id": ai_result.execution_id,
                        "generated_at": datetime.now().isoformat()
                    },
                    "ai_result": ai_result  # 保存完整的AI结果
                }

        except Exception as e:
            logger.error(f"AI分析失败: {str(e)}")
            # 抛出异常，中断流程
            raise AIServiceException(f"缺陷分析执行失败: {str(e)}")

    async def _generate_priority_trend_data(self, bugs_data: List[Dict[str, Any]], year: int, month: int) -> List[Dict[str, Any]]:
        """生成优先级趋势数据"""
        try:
            from datetime import datetime, timedelta
            import calendar

            # 获取月份的天数
            days_in_month = calendar.monthrange(year, month)[1]

            # 按日期分组缺陷数据
            daily_priority_counts = {}

            # 初始化每一天的数据
            for day in range(1, days_in_month + 1):
                date_str = f"{year}-{month:02d}-{day:02d}"
                daily_priority_counts[date_str] = {}

            # 统计每天各优先级的缺陷数量
            processed_bugs = 0
            for bug in bugs_data:
                # 使用coding_created_at字段，这是实际存储的字段名
                created_at = bug.get('coding_created_at')
                if not created_at:
                    continue

                # 解析创建日期 - coding_created_at是毫秒时间戳
                try:
                    if isinstance(created_at, (int, float)):
                        # 毫秒时间戳转换为datetime
                        created_date = datetime.fromtimestamp(created_at / 1000)
                    elif isinstance(created_at, str):
                        # 如果是字符串，尝试解析为ISO格式
                        created_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    elif hasattr(created_at, 'date'):
                        created_date = created_at
                    else:
                        continue
                except Exception:
                    continue

                # 检查是否在当前月份
                if created_date.year == year and created_date.month == month:
                    date_str = created_date.strftime('%Y-%m-%d')
                    priority = bug.get('priority', '未指定')

                    if date_str in daily_priority_counts:
                        if priority not in daily_priority_counts[date_str]:
                            daily_priority_counts[date_str][priority] = 0
                        daily_priority_counts[date_str][priority] += 1
                        processed_bugs += 1

            # 获取所有优先级
            all_priorities = set()
            for daily_counts in daily_priority_counts.values():
                all_priorities.update(daily_counts.keys())

            # 转换为前端需要的格式 - 显示累计总数
            trend_data = []
            cumulative_counts = {priority: 0 for priority in all_priorities}

            for day in range(1, days_in_month + 1):
                date_str = f"{year}-{month:02d}-{day:02d}"
                day_data = {"date": date_str}

                # 累加当天的新增数量到总数中
                daily_counts = daily_priority_counts.get(date_str, {})
                for priority in all_priorities:
                    daily_new = daily_counts.get(priority, 0)
                    cumulative_counts[priority] += daily_new
                    day_data[priority] = cumulative_counts[priority]

                trend_data.append(day_data)

            return trend_data

        except Exception as e:
            logger.error(f"生成优先级趋势数据失败: {str(e)}")
            return []

    async def _generate_priority_trend_data_from_bugs(self, bugs_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """从缺陷数据推断年月并生成优先级趋势数据"""
        try:
            from datetime import datetime

            if not bugs_data:
                return []

            # 从第一个缺陷的创建时间推断年月
            first_bug = bugs_data[0]
            created_at = first_bug.get('coding_created_at')
            if not created_at:
                return []

            # 解析创建日期 - coding_created_at是毫秒时间戳
            try:
                if isinstance(created_at, (int, float)):
                    # 毫秒时间戳转换为datetime
                    created_date = datetime.fromtimestamp(created_at / 1000)
                elif isinstance(created_at, str):
                    # 如果是字符串，尝试解析为ISO格式
                    created_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                elif hasattr(created_at, 'date'):
                    created_date = created_at
                else:
                    return []
            except Exception:
                return []

            year = created_date.year
            month = created_date.month

            result = await self._generate_priority_trend_data(bugs_data, year, month)
            return result

        except Exception as e:
            logger.error(f"从缺陷数据生成优先级趋势数据失败: {str(e)}")
            return []

    async def _compile_ai_report(self, bugs_data: List[Dict[str, Any]], ai_result: Dict[str, Any], request: GenerateReportRequest) -> ReportData:
        """基于AI分析结果编译最终报告"""
        try:
            total_bugs = len(bugs_data)
            ai_analysis = ai_result.get("ai_analysis", "AI分析不可用")

            # 基础统计
            resolved_bugs = sum(1 for bug in bugs_data if bug.get("status_name") in ["已解决", "已关闭"])
            resolution_rate = (resolved_bugs / total_bugs * 100) if total_bugs > 0 else 0

            # 优先级统计
            critical_bugs = sum(1 for bug in bugs_data if bug.get("priority") in ["紧急", "最高"])
            critical_rate = (critical_bugs / total_bugs * 100) if total_bugs > 0 else 0

            # 简单的优先级和状态分布
            priority_dist = {}
            status_dist = {}
            for bug in bugs_data:
                priority = bug.get("priority", "未指定")
                status = bug.get("status_name", "未知")
                priority_dist[priority] = priority_dist.get(priority, 0) + 1
                status_dist[status] = status_dist.get(status, 0) + 1

            # 生成丰富的执行摘要
            if total_bugs == 0:
                executive_summary = "本月系统运行稳定，未发现现网问题。建议继续保持现有的质量控制流程，定期进行预防性检查。"
            else:
                # 计算额外统计信息
                high_priority_bugs = sum(1 for bug in bugs_data if bug.get("priority") in ["紧急", "最高", "高"])
                pending_bugs = total_bugs - resolved_bugs

                # 构建更丰富的摘要
                summary_parts = [
                    f"本月共处理{total_bugs}个现网问题",
                    f"解决率{resolution_rate:.1f}%"
                ]

                if critical_bugs > 0:
                    summary_parts.append(f"其中严重问题{critical_bugs}个")

                if high_priority_bugs > 0:
                    summary_parts.append(f"高优先级问题{high_priority_bugs}个")

                if pending_bugs > 0:
                    summary_parts.append(f"待处理问题{pending_bugs}个")

                # 添加趋势描述
                if resolution_rate >= 90:
                    summary_parts.append("整体解决效率良好")
                elif resolution_rate >= 70:
                    summary_parts.append("解决效率有待提升")
                else:
                    summary_parts.append("需要重点关注问题解决效率")

                executive_summary = "，".join(summary_parts) + "。"

            # 热点分析（基于AI结果或简单统计）- 必须是列表格式
            hotspot_analysis = []

            # 优先使用AI结果中的模块分布
            if "ai_result" in ai_result and hasattr(ai_result["ai_result"], "module_distribution"):
                module_dist = ai_result["ai_result"].module_distribution
                if isinstance(module_dist, dict):
                    total_issues = sum(module_dist.values())
                    for module, count in sorted(module_dist.items(), key=lambda x: x[1], reverse=True)[:10]:
                        percentage = round((count / total_issues) * 100, 1) if total_issues > 0 else 0
                        hotspot_analysis.append({
                            "module": module,
                            "count": count,
                            "percentage": percentage
                        })

            # 如果AI结果没有模块分布，使用标签统计
            if not hotspot_analysis:
                label_stats = {}
                for bug in bugs_data:
                    labels = bug.get("labels", [])
                    for label in labels:
                        label_stats[label] = label_stats.get(label, 0) + 1

                # 转换为前端期望的格式
                total_labels = sum(label_stats.values())
                for label, count in sorted(label_stats.items(), key=lambda x: x[1], reverse=True)[:10]:
                    percentage = round((count / total_labels) * 100, 1) if total_labels > 0 else 0
                    hotspot_analysis.append({
                        "module": label,  # 使用label作为module名称
                        "count": count,
                        "percentage": percentage
                    })

            # 如果还是没有数据，尝试从优先级分布生成热点
            if not hotspot_analysis and priority_dist:
                total_priority = sum(priority_dist.values())
                for priority, count in sorted(priority_dist.items(), key=lambda x: x[1], reverse=True):
                    if count > 0:  # 只显示有数据的优先级
                        percentage = round((count / total_priority) * 100, 1) if total_priority > 0 else 0
                        hotspot_analysis.append({
                            "module": f"{priority}优先级问题",
                            "count": count,
                            "percentage": percentage
                        })

            # 构建简化的详细数据 - 只包含摘要信息，不包含原始缺陷列表
            detailed_data = {
                "analysis_summary": {
                    "total_analyzed": total_bugs,
                    "priority_breakdown": priority_dist,
                    "status_breakdown": status_dist
                },
                "trend_summary": {
                    "resolution_rate": resolution_rate,
                    "critical_rate": critical_rate
                }
            }

            # 构建报告数据
            report_data = ReportData(
                executive_summary=executive_summary,
                key_metrics={
                    "total_bugs": total_bugs,
                    "resolution_rate": round(resolution_rate, 1),
                    "critical_bugs": critical_bugs,
                    "critical_rate": round(critical_rate, 1)
                },
                trend_analysis=await self._generate_priority_trend_data(
                    bugs_data, request.year, request.month
                ),
                hotspot_analysis=hotspot_analysis,
                detailed_data=detailed_data,  # 添加详细数据字段
                ai_insights=ai_analysis,  # 使用AI的完整分析结果
                generation_metadata={
                    "generated_at": datetime.now().isoformat(),
                    "data_source": "coding_platform",
                    "analysis_method": ai_result.get("analysis_metadata", {}).get("analysis_type", "unknown"),
                    "total_bugs_analyzed": total_bugs
                }
            )

            logger.info(f"基于AI分析结果编译报告完成: {total_bugs}个缺陷")
            return report_data

        except Exception as e:
            logger.error(f"编译AI报告失败: {str(e)}")
            raise AIServiceException(f"编译报告失败: {str(e)}")

    def _get_default_prompt_template(self) -> str:
        """获取默认的提示词模板"""
        return """请基于以下{year}年{month}月的缺陷数据进行深度分析：

## 分析要求
1. **问题概览**：总结本月缺陷的整体情况
2. **趋势分析**：分析缺陷的时间分布和变化趋势
3. **优先级分析**：重点关注高优先级问题的分布和特征
4. **根因分析**：识别问题的根本原因和模式
5. **改进建议**：提供具体可行的改进措施

## 数据概要
- 工作区：{workspace_name}
- 时间范围：{year}年{month}月
- 缺陷总数：{total_bugs}个
- 详细数据：{data_summary}

请以专业的技术分析报告形式输出，使用Markdown格式，包含清晰的章节结构和具体的数据支撑。"""





    def _analyze_trend_direction(self, trend_data: Dict[str, int]) -> str:
        """分析趋势方向"""
        if not trend_data:
            return "平稳"

        values = list(trend_data.values())
        if len(values) < 2:
            return "平稳"

        # 简单的趋势分析
        first_half = sum(values[:len(values)//2])
        second_half = sum(values[len(values)//2:])

        if second_half > first_half * 1.2:
            return "上升"
        elif second_half < first_half * 0.8:
            return "下降"
        else:
            return "平稳"

    async def _compile_final_report(self, bugs_data: List[Dict[str, Any]], analysis_data: Dict[str, Any],
                                  trend_data: Dict[str, Any], ai_insights: str) -> ReportData:
        """编译最终报告"""
        try:
            # 计算关键指标
            total_bugs = len(bugs_data)
            resolved_bugs = sum(1 for bug in bugs_data if bug.get("status") in ["已解决", "已关闭"])
            resolution_rate = (resolved_bugs / total_bugs * 100) if total_bugs > 0 else 0
            critical_bugs = len(trend_data["critical_issues"])
            critical_rate = (critical_bugs / total_bugs * 100) if total_bugs > 0 else 0

            # 生成丰富的执行摘要
            if total_bugs == 0:
                executive_summary = "本月系统运行稳定，未发现现网问题。建议继续保持现有的质量控制流程，定期进行预防性检查。"
            else:
                # 计算额外统计信息
                high_priority_bugs = sum(1 for bug in bugs_data if bug.get("priority") in ["紧急", "最高", "高"])
                pending_bugs = total_bugs - resolved_bugs

                # 构建更丰富的摘要
                summary_parts = [
                    f"本月共处理{total_bugs}个现网问题",
                    f"解决率{resolution_rate:.1f}%"
                ]

                if critical_bugs > 0:
                    summary_parts.append(f"其中严重问题{critical_bugs}个")

                if high_priority_bugs > 0:
                    summary_parts.append(f"高优先级问题{high_priority_bugs}个")

                if pending_bugs > 0:
                    summary_parts.append(f"待处理问题{pending_bugs}个")

                # 添加趋势描述
                if resolution_rate >= 90:
                    summary_parts.append("整体解决效率良好")
                elif resolution_rate >= 70:
                    summary_parts.append("解决效率有待提升")
                else:
                    summary_parts.append("需要重点关注问题解决效率")

                executive_summary = "，".join(summary_parts) + "。"

            # 安全计算热点分析，避免除零错误
            hotspot_analysis = []
            if total_bugs > 0 and analysis_data["labels_distribution"]:
                hotspot_analysis = [
                    {
                        "module": label,
                        "count": count,
                        "percentage": round(count / total_bugs * 100, 1)
                    }
                    for label, count in sorted(
                        analysis_data["labels_distribution"].items(),
                        key=lambda x: x[1],
                        reverse=True
                    )[:10]
                ]

            # 构建报告数据
            report_data = ReportData(
                executive_summary=executive_summary,
                key_metrics={
                    "total_bugs": total_bugs,
                    "resolution_rate": round(resolution_rate, 1),
                    "critical_bugs": critical_bugs,
                    "critical_rate": round(critical_rate, 1)
                },
                trend_analysis=await self._generate_priority_trend_data_from_bugs(bugs_data),
                hotspot_analysis=hotspot_analysis,
                ai_insights=ai_insights,
                detailed_data={
                    "raw_bugs": bugs_data[:100],  # 限制数量避免数据过大
                    "analysis_summary": analysis_data,
                    "trend_summary": trend_data
                },
                generation_metadata={
                    "generated_at": datetime.now().isoformat(),
                    "data_range": f"{len(bugs_data)} bugs analyzed",
                    "version": "1.0"
                }
            )

            return report_data

        except Exception as e:
            logger.error(f"编译最终报告失败: {str(e)}")
            raise AIServiceException(f"编译最终报告失败: {str(e)}")

    async def _finalize_report(self, db: AsyncSession, report_id: int, report_data: ReportData):
        """完成报告生成"""
        try:
            result = await db.execute(
                select(MonthlyReport).where(MonthlyReport.id == report_id)
            )
            report = result.scalar_one_or_none()

            if not report:
                raise AIServiceException("报告不存在")

            report.report_data = report_data.model_dump()
            report.status = "completed"
            report.generation_progress = None
            report.error_message = None

            await db.commit()
            logger.info(f"报告生成完成并保存: {report_id}")

        except Exception as e:
            await db.rollback()
            logger.error(f"完成报告失败: {str(e)}")
            raise AIServiceException(f"完成报告失败: {str(e)}")

    async def _handle_generation_error(self, db: AsyncSession, report_id: int, error_message: str):
        """处理生成错误"""
        try:
            result = await db.execute(
                select(MonthlyReport).where(MonthlyReport.id == report_id)
            )
            report = result.scalar_one_or_none()

            if report:
                report.status = "failed"
                report.error_message = error_message
                report.generation_progress = None
                await db.commit()

            # 清理任务
            if report_id in self.generation_tasks:
                del self.generation_tasks[report_id]

        except Exception as e:
            logger.error(f"处理生成错误失败: {str(e)}")
            # 确保任务被清理
            if report_id in self.generation_tasks:
                del self.generation_tasks[report_id]

    # 提示词模板相关方法
    async def create_prompt_template(self, db: AsyncSession, template_data: PromptTemplateCreate, user_id: int) -> PromptTemplateResponse:
        """创建提示词模板"""
        try:
            # 如果设置为默认模板，先取消其他默认模板
            if template_data.is_default:
                await db.execute(
                    select(PromptTemplate).where(
                        and_(
                            PromptTemplate.workspace_id == template_data.workspace_id,
                            PromptTemplate.is_default == True
                        )
                    ).update({"is_default": False})
                )

            db_template = PromptTemplate(
                workspace_id=template_data.workspace_id,
                template_name=template_data.template_name,
                template_content=template_data.template_content,
                is_active=template_data.is_active,
                is_default=template_data.is_default,
                created_by=user_id
            )

            db.add(db_template)
            await db.commit()
            await db.refresh(db_template)

            logger.info(f"创建提示词模板成功: {template_data.template_name}")
            return PromptTemplateResponse.from_orm(db_template)

        except Exception as e:
            await db.rollback()
            logger.error(f"创建提示词模板失败: {str(e)}")
            raise AIServiceException(f"创建提示词模板失败: {str(e)}")

    async def list_prompt_templates(self, db: AsyncSession, workspace_id: int) -> List[PromptTemplateResponse]:
        """获取提示词模板列表"""
        try:
            result = await db.execute(
                select(PromptTemplate)
                .where(PromptTemplate.workspace_id == workspace_id)
                .order_by(desc(PromptTemplate.is_default), desc(PromptTemplate.created_at))
            )
            templates = result.scalars().all()

            return [PromptTemplateResponse.from_orm(template) for template in templates]

        except Exception as e:
            logger.error(f"获取提示词模板列表失败: {str(e)}")
            raise AIServiceException(f"获取提示词模板列表失败: {str(e)}")

    async def delete_prompt_template(self, db: AsyncSession, template_id: int, user_id: int) -> bool:
        """删除提示词模板"""
        try:
            # 获取模板
            result = await db.execute(
                select(PromptTemplate).where(PromptTemplate.id == template_id)
            )
            template = result.scalar_one_or_none()

            if not template:
                raise AIServiceException("模板不存在")

            # 删除模板
            await db.delete(template)
            await db.commit()

            logger.info(f"删除提示词模板成功: {template.template_name}")
            return True

        except AIServiceException:
            raise
        except Exception as e:
            logger.error(f"删除提示词模板失败: {str(e)}")
            raise AIServiceException(f"删除提示词模板失败: {str(e)}")

    async def set_workspace_default_template(self, db: AsyncSession, workspace_id: int, template_id: int = None) -> bool:
        """设置工作区默认智能体模板"""
        try:
            from backend.app.models.workspace import Workspace

            # 获取工作区
            result = await db.execute(
                select(Workspace).where(Workspace.id == workspace_id)
            )
            workspace = result.scalar_one_or_none()

            if not workspace:
                raise AIServiceException("工作区不存在")

            # 如果指定了模板ID，验证模板是否存在且属于该工作区
            if template_id:
                result = await db.execute(
                    select(PromptTemplate).where(
                        and_(
                            PromptTemplate.id == template_id,
                            PromptTemplate.workspace_id == workspace_id
                        )
                    )
                )
                template = result.scalar_one_or_none()

                if not template:
                    raise AIServiceException("模板不存在或不属于该工作区")

            # 更新工作区的默认模板
            workspace.default_prompt_template_id = template_id
            await db.commit()

            logger.info(f"设置工作区 {workspace_id} 默认智能体模板: {template_id}")
            return True

        except AIServiceException:
            raise
        except Exception as e:
            logger.error(f"设置工作区默认智能体模板失败: {str(e)}")
            raise AIServiceException(f"设置工作区默认智能体模板失败: {str(e)}")

    async def get_workspace_default_template(self, db: AsyncSession, workspace_id: int) -> int | None:
        """获取工作区默认智能体模板ID"""
        try:
            from backend.app.models.workspace import Workspace

            result = await db.execute(
                select(Workspace.default_prompt_template_id).where(Workspace.id == workspace_id)
            )
            template_id = result.scalar_one_or_none()

            return template_id

        except Exception as e:
            logger.error(f"获取工作区默认智能体模板失败: {str(e)}")
            return None
