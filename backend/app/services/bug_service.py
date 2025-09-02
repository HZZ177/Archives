from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, case
from sqlalchemy.orm import selectinload, joinedload
from fastapi import HTTPException, status

from backend.app.core.logger import logger
from backend.app.models.bug import BugProfile, BugLog, BugModuleLink
from backend.app.models.user import User
from backend.app.models.module_structure import ModuleStructureNode
from backend.app.schemas.bug import (
    BugProfileCreate, BugProfileUpdate, BugLogCreate,
    BugModuleLinkCreate, BugListParams, BugLogListParams,
    BugAnalysisParams, BugAnalysisResponse, ModuleHealthScore,
    BugTrendData
)


class BugService:
    """Bug管理服务类"""
    
    async def create_bug_profile(
        self, 
        db: AsyncSession, 
        bug_data: BugProfileCreate, 
        current_user: User,
        workspace_id: int
    ) -> BugProfile:
        """创建Bug档案"""
        try:
            # 创建工作区权限验证
            await self._verify_workspace_access(db, current_user, workspace_id)
            
            # 创建Bug档案
            bug_profile = BugProfile(
                title=bug_data.title,
                description=bug_data.description,
                severity=bug_data.severity,
                status=bug_data.status,
                tags=bug_data.tags or [],
                reporter_id=current_user.id,
                workspace_id=workspace_id
            )
            
            db.add(bug_profile)
            await db.flush()  # 获取ID
            
            # 创建阶段不再自动生成发生记录；首次发生请通过 log-occurrence 接口记录
            
            # 创建模块关联
            if bug_data.module_ids:
                for i, module_id in enumerate(bug_data.module_ids):
                    manifestation_desc = None
                    if bug_data.manifestation_descriptions and i < len(bug_data.manifestation_descriptions):
                        manifestation_desc = bug_data.manifestation_descriptions[i]
                    
                    module_link = BugModuleLink(
                        module_id=module_id,
                        bug_id=bug_profile.id,
                        manifestation_description=manifestation_desc,
                        created_by=current_user.id
                    )
                    db.add(module_link)
            
            await db.commit()
            await db.refresh(bug_profile)
            
            logger.info(f"Bug档案创建成功: {bug_profile.id}")
            return bug_profile
            
        except Exception as e:
            await db.rollback()
            logger.error(f"创建Bug档案失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建Bug档案失败: {str(e)}"
            )
    
    async def get_bug_profiles(
        self, 
        db: AsyncSession, 
        params: BugListParams,
        current_user: User,
        workspace_id: int
    ) -> Dict[str, Any]:
        """获取Bug档案列表"""
        try:
            # 工作区权限验证
            await self._verify_workspace_access(db, current_user, workspace_id)
            
            # 构建查询
            query = select(BugProfile).where(BugProfile.workspace_id == workspace_id)
            
            # 搜索条件
            if params.keyword:
                keyword_filter = or_(
                    BugProfile.title.ilike(f"%{params.keyword}%"),
                    BugProfile.description.ilike(f"%{params.keyword}%")
                )
                query = query.where(keyword_filter)
            
            # 严重程度筛选
            if params.severity:
                query = query.where(BugProfile.severity == params.severity)
            
            # 状态筛选
            if params.status:
                query = query.where(BugProfile.status == params.status)
            
            # 获取总数
            count_query = select(func.count()).select_from(query.subquery())
            total_result = await db.execute(count_query)
            total = total_result.scalar()
            
            # 分页和排序
            offset = (params.page - 1) * params.page_size
            query = query.order_by(desc(BugProfile.created_at)).offset(offset).limit(params.page_size)
            
            # 执行查询
            result = await db.execute(query)
            bug_profiles = result.scalars().all()
            
            # 获取每个Bug的发生次数和最近发生时间
            bug_list = []
            for bug in bug_profiles:
                # 获取发生次数
                log_count_query = select(func.count()).where(BugLog.bug_id == bug.id)
                log_count_result = await db.execute(log_count_query)
                occurrence_count = log_count_result.scalar()
                
                # 获取最近发生时间
                last_log_query = select(BugLog.occurred_at).where(
                    BugLog.bug_id == bug.id
                ).order_by(desc(BugLog.occurred_at)).limit(1)
                last_log_result = await db.execute(last_log_query)
                last_occurrence = last_log_result.scalar_one_or_none()
                
                bug_dict = {
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
                    "occurrence_count": occurrence_count,
                    "last_occurrence": last_occurrence
                }
                bug_list.append(bug_dict)
            
            return {
                "items": bug_list,
                "total": total,
                "page": params.page,
                "page_size": params.page_size
            }
            
        except Exception as e:
            logger.error(f"获取Bug档案列表失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取Bug档案列表失败: {str(e)}"
            )
    
    async def get_bug_profile_detail(
        self, 
        db: AsyncSession, 
        bug_id: int,
        current_user: User
    ) -> BugProfile:
        """获取Bug档案详情"""
        try:
            # 查询Bug档案及其关联数据
            query = select(BugProfile).options(
                selectinload(BugProfile.logs).joinedload(BugLog.reporter),
                selectinload(BugProfile.module_links).joinedload(BugModuleLink.module)
            ).where(BugProfile.id == bug_id)
            
            result = await db.execute(query)
            bug_profile = result.scalar_one_or_none()
            
            if not bug_profile:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Bug档案不存在"
                )
            
            # 工作区权限验证
            await self._verify_workspace_access(db, current_user, bug_profile.workspace_id)
            
            return bug_profile
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取Bug档案详情失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取Bug档案详情失败: {str(e)}"
            )
    
    async def update_bug_profile(
        self, 
        db: AsyncSession, 
        bug_id: int,
        bug_data: BugProfileUpdate,
        current_user: User
    ) -> BugProfile:
        """更新Bug档案"""
        try:
            # 获取Bug档案
            bug_profile = await self.get_bug_profile_detail(db, bug_id, current_user)
            
            # 更新字段
            if bug_data.title is not None:
                bug_profile.title = bug_data.title
            if bug_data.description is not None:
                bug_profile.description = bug_data.description
            if bug_data.severity is not None:
                bug_profile.severity = bug_data.severity
            if bug_data.status is not None:
                bug_profile.status = bug_data.status
            if bug_data.tags is not None:
                bug_profile.tags = bug_data.tags
            
            bug_profile.updated_at = datetime.now()
            
            await db.commit()
            await db.refresh(bug_profile)
            
            logger.info(f"Bug档案更新成功: {bug_id}")
            return bug_profile
            
        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"更新Bug档案失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新Bug档案失败: {str(e)}"
            )
    
    async def delete_bug_profile(
        self, 
        db: AsyncSession, 
        bug_id: int,
        current_user: User
    ) -> str:
        """删除Bug档案"""
        try:
            # 获取Bug档案
            bug_profile = await self.get_bug_profile_detail(db, bug_id, current_user)
            
            # 删除Bug档案（级联删除日志和关联）
            await db.delete(bug_profile)
            await db.commit()
            
            logger.info(f"Bug档案删除成功: {bug_id}")
            return "Bug档案删除成功"
            
        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"删除Bug档案失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除Bug档案失败: {str(e)}"
            )
    
    async def log_bug_occurrence(
        self, 
        db: AsyncSession, 
        bug_id: int,
        log_data: BugLogCreate,
        current_user: User
    ) -> BugLog:
        """记录Bug发生"""
        try:
            # 获取Bug档案
            bug_profile = await self.get_bug_profile_detail(db, bug_id, current_user)
            
            # 创建日志记录
            bug_log = BugLog(
                bug_id=bug_id,
                occurred_at=datetime.now(),
                reporter_id=current_user.id,
                notes=log_data.notes,
                module_id=log_data.module_id
            )
            
            db.add(bug_log)

            # 如果携带 module_id，则自动建立关联（若不存在）
            if log_data.module_id:
                # 检查模块是否存在
                module_query = select(ModuleStructureNode).where(
                    ModuleStructureNode.id == log_data.module_id
                )
                module_result = await db.execute(module_query)
                module = module_result.scalar_one_or_none()
                if not module:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="模块不存在"
                    )

                # 工作区一致性校验
                if module.workspace_id != bug_profile.workspace_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="模块与Bug不属于同一工作区"
                    )

                # 检查是否已有关联
                existing_link_query = select(BugModuleLink).where(
                    and_(
                        BugModuleLink.bug_id == bug_id,
                        BugModuleLink.module_id == log_data.module_id
                    )
                )
                existing_result = await db.execute(existing_link_query)
                existing_link = existing_result.scalar_one_or_none()

                if not existing_link:
                    module_link = BugModuleLink(
                        module_id=log_data.module_id,
                        bug_id=bug_id,
                        manifestation_description=None,
                        created_by=current_user.id
                    )
                    db.add(module_link)
            await db.commit()
            await db.refresh(bug_log)
            
            logger.info(f"Bug发生记录创建成功: {bug_log.id}")
            return bug_log
            
        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"记录Bug发生失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"记录Bug发生失败: {str(e)}"
            )
    
    async def get_bug_logs(
        self, 
        db: AsyncSession, 
        bug_id: int,
        params: BugLogListParams,
        current_user: User
    ) -> Dict[str, Any]:
        """获取Bug发生历史"""
        try:
            # 获取Bug档案
            bug_profile = await self.get_bug_profile_detail(db, bug_id, current_user)
            
            # 构建查询
            query = select(BugLog).options(
                joinedload(BugLog.reporter),
                joinedload(BugLog.module)
            ).where(BugLog.bug_id == bug_id)
            
            # 获取总数
            count_query = select(func.count()).select_from(query.subquery())
            total_result = await db.execute(count_query)
            total = total_result.scalar()
            
            # 分页和排序
            offset = (params.page - 1) * params.page_size
            query = query.order_by(desc(BugLog.occurred_at)).offset(offset).limit(params.page_size)
            
            # 执行查询
            result = await db.execute(query)
            logs = result.unique().scalars().all()
            
            return {
                "items": logs,
                "total": total,
                "page": params.page,
                "page_size": params.page_size
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取Bug发生历史失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取Bug发生历史失败: {str(e)}"
            )
    
    async def link_bug_to_module(
        self, 
        db: AsyncSession, 
        bug_id: int,
        link_data: BugModuleLinkCreate,
        current_user: User
    ) -> BugModuleLink:
        """关联Bug到模块"""
        try:
            # 获取Bug档案
            bug_profile = await self.get_bug_profile_detail(db, bug_id, current_user)
            
            # 检查模块是否存在
            module_query = select(ModuleStructureNode).where(
                ModuleStructureNode.id == link_data.module_id
            )
            module_result = await db.execute(module_query)
            module = module_result.scalar_one_or_none()
            
            if not module:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="模块不存在"
                )
            
            # 检查是否已关联
            existing_link_query = select(BugModuleLink).where(
                and_(
                    BugModuleLink.bug_id == bug_id,
                    BugModuleLink.module_id == link_data.module_id
                )
            )
            existing_result = await db.execute(existing_link_query)
            existing_link = existing_result.scalar_one_or_none()
            
            if existing_link:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Bug已关联到该模块"
                )
            
            # 创建关联
            module_link = BugModuleLink(
                module_id=link_data.module_id,
                bug_id=bug_id,
                manifestation_description=link_data.manifestation_description,
                created_by=current_user.id
            )
            
            db.add(module_link)
            await db.commit()
            await db.refresh(module_link)
            
            logger.info(f"Bug模块关联创建成功: {module_link.id}")
            return module_link
            
        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"关联Bug到模块失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"关联Bug到模块失败: {str(e)}"
            )
    
    async def get_module_bugs(
        self, 
        db: AsyncSession, 
        module_id: int,
        params: BugLogListParams,
        current_user: User
    ) -> Dict[str, Any]:
        """获取模块关联的所有Bug"""
        try:
            # 检查模块是否存在
            module_query = select(ModuleStructureNode).where(
                ModuleStructureNode.id == module_id
            )
            module_result = await db.execute(module_query)
            module = module_result.scalar_one_or_none()
            
            if not module:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="模块不存在"
                )
            
            # 工作区权限验证
            await self._verify_workspace_access(db, current_user, module.workspace_id)
            
            # 构建查询
            query = select(BugProfile).join(BugModuleLink).where(
                BugModuleLink.module_id == module_id
            )
            
            # 获取总数
            count_query = select(func.count()).select_from(query.subquery())
            total_result = await db.execute(count_query)
            total = total_result.scalar()
            
            # 分页和排序
            offset = (params.page - 1) * params.page_size
            query = query.order_by(desc(BugProfile.created_at)).offset(offset).limit(params.page_size)
            
            # 执行查询
            result = await db.execute(query)
            bugs = result.scalars().all()
            
            return {
                "items": bugs,
                "total": total,
                "page": params.page,
                "page_size": params.page_size
            }
            
        except Exception as e:
            logger.error(f"获取模块关联Bug失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取模块关联Bug失败: {str(e)}"
            )
    
    async def unlink_bug_from_module(
        self, 
        db: AsyncSession, 
        bug_id: int,
        module_id: int,
        current_user: User
    ) -> str:
        """取消Bug与模块的关联"""
        try:
            # 获取Bug档案
            bug_profile = await self.get_bug_profile_detail(db, bug_id, current_user)
            
            # 查找关联
            link_query = select(BugModuleLink).where(
                and_(
                    BugModuleLink.bug_id == bug_id,
                    BugModuleLink.module_id == module_id
                )
            )
            link_result = await db.execute(link_query)
            module_link = link_result.scalar_one_or_none()
            
            if not module_link:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="关联不存在"
                )
            
            # 删除关联
            await db.delete(module_link)
            await db.commit()
            
            logger.info(f"Bug模块关联删除成功: bug_id={bug_id}, module_id={module_id}")
            return "关联删除成功"
            
        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"取消Bug模块关联失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"取消Bug模块关联失败: {str(e)}"
            )
    
    async def get_bug_analysis(
        self, 
        db: AsyncSession, 
        workspace_id: int,
        params: BugAnalysisParams,
        current_user: User
    ) -> BugAnalysisResponse:
        """获取Bug分析结果"""
        try:
            # 工作区权限验证
            await self._verify_workspace_access(db, current_user, workspace_id)
            
            # 计算时间范围
            end_date = datetime.now()
            if params.time_range == "7d":
                start_date = end_date - timedelta(days=7)
            elif params.time_range == "30d":
                start_date = end_date - timedelta(days=30)
            elif params.time_range == "90d":
                start_date = end_date - timedelta(days=90)
            else:
                start_date = end_date - timedelta(days=30)
            
            # 获取模块健康分（基础：按严重度统计）
            module_health_query = select(
                ModuleStructureNode.id,
                ModuleStructureNode.name,
                func.count(BugProfile.id).label('total_bugs'),
                func.sum(case((BugProfile.severity == 'CRITICAL', 1), else_=0)).label('critical_count'),
                func.sum(case((BugProfile.severity == 'HIGH', 1), else_=0)).label('high_count'),
                func.sum(case((BugProfile.severity == 'MEDIUM', 1), else_=0)).label('medium_count'),
                func.sum(case((BugProfile.severity == 'LOW', 1), else_=0)).label('low_count')
            ).select_from(
                ModuleStructureNode
            ).outerjoin(
                BugModuleLink, ModuleStructureNode.id == BugModuleLink.module_id
            ).outerjoin(
                BugProfile, BugModuleLink.bug_id == BugProfile.id
            ).where(
                ModuleStructureNode.workspace_id == workspace_id
            ).group_by(
                ModuleStructureNode.id, ModuleStructureNode.name
            )
            
            module_result = await db.execute(module_health_query)
            module_health_data = module_result.all()
            
            # 发生频率：统计时间范围内每个模块的日志次数
            occurrences_query = select(
                ModuleStructureNode.id.label('module_id'),
                func.count(BugLog.id).label('occ_count')
            ).select_from(
                ModuleStructureNode
            ).outerjoin(
                BugModuleLink, ModuleStructureNode.id == BugModuleLink.module_id
            ).outerjoin(
                BugLog, BugModuleLink.bug_id == BugLog.bug_id
            ).where(
                and_(
                    ModuleStructureNode.workspace_id == workspace_id,
                    BugLog.occurred_at >= start_date,
                    BugLog.occurred_at <= end_date
                )
            ).group_by(ModuleStructureNode.id)

            occ_result = await db.execute(occurrences_query)
            occ_rows = occ_result.all()
            module_to_occ_count = {row.module_id: (row.occ_count or 0) for row in occ_rows}

            # 时间衰减：按日志时间做线性衰减求和（0~30天线性下降到0，>30天为0）
            window_days = 30

            decay_query = select(
                ModuleStructureNode.id.label('module_id'),
                BugLog.occurred_at
            ).select_from(
                ModuleStructureNode
            ).outerjoin(
                BugModuleLink, ModuleStructureNode.id == BugModuleLink.module_id
            ).outerjoin(
                BugLog, BugModuleLink.bug_id == BugLog.bug_id
            ).where(
                and_(
                    ModuleStructureNode.workspace_id == workspace_id,
                    BugLog.occurred_at >= start_date,
                    BugLog.occurred_at <= end_date
                )
            )

            decay_result = await db.execute(decay_query)
            decay_rows = decay_result.all()
            module_to_decay_sum: Dict[int, float] = {}
            for row in decay_rows:
                module_id = row.module_id
                occurred_at = row.occurred_at
                # 兼容可能的字符串/日期类型
                if isinstance(occurred_at, str):
                    # 若为字符串（YYYY-MM-DD 或含时间），仅用于相对天数估算，此处转为日期部分
                    try:
                        # 尝试按标准格式解析
                        occurred_dt = datetime.fromisoformat(occurred_at)
                    except Exception:
                        # 回退：仅取日期部分
                        occurred_dt = datetime.strptime(occurred_at[:10], '%Y-%m-%d')
                else:
                    occurred_dt = occurred_at
                days_since = max(0, (end_date - occurred_dt).days)
                # 线性权重：0天=1，30天=0，超过即0
                weight = max(0.0, 1.0 - (days_since / window_days))
                module_to_decay_sum[module_id] = module_to_decay_sum.get(module_id, 0.0) + weight

            # 权重参数（可按需调整/配置）
            severity_weights = {
                'CRITICAL': 10,
                'HIGH': 5,
                'MEDIUM': 2,
                'LOW': 1
            }
            alpha_freq = 1.0   # 频率扣分系数
            beta_decay = 2.0   # 时间线性衰减扣分系数

            module_health_scores = []
            for row in module_health_data:
                # 基于严重度的基础扣分（按关联 Bug 档案数量统计）
                # 使用关联 Bug 档案的严重度统计
                critical = row.critical_count or 0
                high = row.high_count or 0
                medium = row.medium_count or 0
                low = row.low_count or 0
                base_penalty = (
                    severity_weights['CRITICAL'] * critical +
                    severity_weights['HIGH'] * high +
                    severity_weights['MEDIUM'] * medium +
                    severity_weights['LOW'] * low
                )

                # 发生频率扣分（时间范围内日志数量）
                occ_count = module_to_occ_count.get(row.id, 0)
                freq_penalty = alpha_freq * occ_count

                # 时间衰减权重扣分（越近影响越大）
                decay_sum = module_to_decay_sum.get(row.id, 0.0)
                recency_penalty = beta_decay * decay_sum

                total_penalty = base_penalty + freq_penalty + recency_penalty
                health_score = max(0, 100 - total_penalty)
                
                health_score_obj = ModuleHealthScore(
                    module_id=row.id,
                    module_name=row.name,
                    health_score=health_score,
                    critical_count=row.critical_count or 0,
                    high_count=row.high_count or 0,
                    medium_count=row.medium_count or 0,
                    low_count=row.low_count or 0
                )
                module_health_scores.append(health_score_obj)
            
            # 获取Bug趋势数据
            trend_query = select(
                func.date(BugLog.occurred_at).label('date'),
                func.count(BugLog.id).label('count')
            ).select_from(
                BugLog
            ).join(
                BugProfile, BugLog.bug_id == BugProfile.id
            ).where(
                and_(
                    BugProfile.workspace_id == workspace_id,
                    BugLog.occurred_at >= start_date,
                    BugLog.occurred_at <= end_date
                )
            ).group_by(
                func.date(BugLog.occurred_at)
            ).order_by(
                func.date(BugLog.occurred_at)
            )
            
            trend_result = await db.execute(trend_query)
            trend_data = trend_result.all()
            
            bug_trends = []
            for row in trend_data:
                # SQLite 的 date() 可能直接返回字符串；PostgreSQL 可能返回 date/datetime
                raw_date = row.date
                if isinstance(raw_date, str):
                    date_str = raw_date
                else:
                    date_str = raw_date.strftime('%Y-%m-%d')
                trend_obj = BugTrendData(
                    date=date_str,
                    count=row.count
                )
                bug_trends.append(trend_obj)
            
            # 获取严重程度分布
            severity_query = select(
                BugProfile.severity,
                func.count(BugProfile.id).label('count')
            ).where(
                BugProfile.workspace_id == workspace_id
            ).group_by(
                BugProfile.severity
            )
            
            severity_result = await db.execute(severity_query)
            severity_data = severity_result.all()
            
            severity_distribution = {}
            for row in severity_data:
                severity_distribution[row.severity] = row.count
            
            # 获取总Bug数量和总发生次数
            total_bugs_query = select(func.count()).where(BugProfile.workspace_id == workspace_id)
            total_bugs_result = await db.execute(total_bugs_query)
            total_bugs = total_bugs_result.scalar()
            
            total_occurrences_query = select(func.count()).select_from(
                BugLog
            ).join(
                BugProfile, BugLog.bug_id == BugProfile.id
            ).where(
                BugProfile.workspace_id == workspace_id
            )
            total_occurrences_result = await db.execute(total_occurrences_query)
            total_occurrences = total_occurrences_result.scalar()
            
            return BugAnalysisResponse(
                module_health_scores=module_health_scores,
                bug_trends=bug_trends,
                severity_distribution=severity_distribution,
                total_bugs=total_bugs,
                total_occurrences=total_occurrences
            )
            
        except Exception as e:
            logger.error(f"获取Bug分析结果失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取Bug分析结果失败: {str(e)}"
            )
    
    async def _verify_workspace_access(
        self, 
        db: AsyncSession, 
        user: User, 
        workspace_id: int
    ) -> None:
        """验证用户对工作区的访问权限"""
        # 超级管理员拥有所有权限
        if user.is_superuser:
            return
        
        # 检查用户是否属于该工作区
        from backend.app.models.workspace import workspace_user
        user_workspace_query = select(workspace_user).where(
            and_(
                workspace_user.c.user_id == user.id,
                workspace_user.c.workspace_id == workspace_id
            )
        )
        result = await db.execute(user_workspace_query)
        user_workspace = result.first()
        
        if not user_workspace:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权限访问该工作区"
            )


# 创建服务实例
bug_service = BugService()
