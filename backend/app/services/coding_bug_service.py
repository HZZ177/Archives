"""
Coding缺陷数据库操作服务
"""

from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc, text
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from dateutil.relativedelta import relativedelta
from fastapi import HTTPException, status

from backend.app.core.logger import logger
from backend.app.models.coding_bug import CodingBug, CodingBugModuleLink
from backend.app.models.module_structure import ModuleStructureNode
from backend.app.schemas.coding_bug import (
    CodingBugResponse,
    CodingBugDetailResponse,
    PaginatedCodingBugResponse,
    CodingBugModuleLinkResponse
)


class CodingBugService:
    """Coding缺陷数据库操作服务"""
    
    async def sync_bugs_to_database(
        self,
        db: AsyncSession,
        workspace_id: int,
        bugs_data: List[Dict[str, Any]]
    ) -> Dict[str, int]:
        """
        将同步的缺陷数据保存到数据库
        
        Args:
            db: 数据库会话
            workspace_id: 工作区ID
            bugs_data: 缺陷数据列表
            
        Returns:
            同步统计信息
        """
        try:
            created_count = 0
            updated_count = 0
            
            for bug_data in bugs_data:
                # 检查是否已存在（根据coding_bug_id和workspace_id）
                existing_bug = await db.execute(
                    select(CodingBug).where(
                        and_(
                            CodingBug.coding_bug_id == bug_data["coding_bug_id"],
                            CodingBug.workspace_id == workspace_id
                        )
                    )
                )
                existing_bug = existing_bug.scalar_one_or_none()
                
                if existing_bug:
                    # 更新现有记录
                    existing_bug.title = bug_data["title"]
                    existing_bug.description = bug_data["description"]
                    existing_bug.priority = bug_data["priority"]
                    existing_bug.status_name = bug_data["status_name"]
                    existing_bug.creator_id = bug_data.get("creator_id")
                    existing_bug.coding_created_at = bug_data.get("coding_created_at")
                    existing_bug.coding_updated_at = bug_data.get("coding_updated_at")
                    existing_bug.project_name = bug_data["project_name"]
                    existing_bug.assignees = bug_data.get("assignees", [])
                    existing_bug.labels = bug_data.get("labels", [])
                    existing_bug.iteration_name = bug_data.get("iteration_name")
                    existing_bug.synced_at = datetime.now()
                    existing_bug.updated_at = datetime.now()
                    
                    updated_count += 1
                else:
                    # 创建新记录
                    new_bug = CodingBug(
                        coding_bug_id=bug_data["coding_bug_id"],
                        coding_bug_code=bug_data["coding_bug_code"],
                        title=bug_data["title"],
                        description=bug_data["description"],
                        priority=bug_data["priority"],
                        status_name=bug_data["status_name"],
                        creator_id=bug_data.get("creator_id"),
                        coding_created_at=bug_data.get("coding_created_at"),
                        coding_updated_at=bug_data.get("coding_updated_at"),
                        workspace_id=workspace_id,
                        project_name=bug_data["project_name"],
                        assignees=bug_data.get("assignees", []),
                        labels=bug_data.get("labels", []),
                        iteration_name=bug_data.get("iteration_name"),
                        synced_at=datetime.now()
                    )
                    db.add(new_bug)
                    created_count += 1
            
            await db.commit()
            
            logger.info(f"缺陷数据同步完成: 新增 {created_count} 条，更新 {updated_count} 条")
            
            return {
                "created_count": created_count,
                "updated_count": updated_count,
                "total_processed": len(bugs_data)
            }
            
        except Exception as e:
            await db.rollback()
            logger.error(f"缺陷数据同步失败: {str(e)}")
            raise
    
    async def get_bugs_paginated(
        self,
        db: AsyncSession,
        workspace_id: int,
        page: int = 1,
        page_size: int = 20,
        keyword: Optional[str] = None,
        priority: Optional[str] = None,
        status_name: Optional[str] = None,
        labels: Optional[List[str]] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> PaginatedCodingBugResponse:
        """
        分页获取工作区的缺陷数据

        Args:
            db: 数据库会话
            workspace_id: 工作区ID
            page: 页码
            page_size: 每页数量
            keyword: 搜索关键词
            priority: 优先级筛选
            status_name: 状态筛选
            labels: 标签筛选
            start_date: 开始日期 YYYY-MM-DD
            end_date: 结束日期 YYYY-MM-DD

        Returns:
            分页的缺陷数据
        """
        try:
            # 构建查询条件
            conditions = [CodingBug.workspace_id == workspace_id]
            
            if keyword:
                keyword_condition = or_(
                    CodingBug.title.ilike(f"%{keyword}%"),
                    CodingBug.description.ilike(f"%{keyword}%")
                )
                conditions.append(keyword_condition)
            
            if priority:
                conditions.append(CodingBug.priority == priority)
            
            if status_name:
                conditions.append(CodingBug.status_name == status_name)

            # 标签筛选
            if labels:
                label_conditions = []
                for label in labels:
                    label_conditions.append(CodingBug.labels.contains([label]))
                if label_conditions:
                    conditions.append(or_(*label_conditions))

            # 时间筛选
            if start_date:
                start_timestamp = int(datetime.strptime(start_date, '%Y-%m-%d').timestamp() * 1000)
                conditions.append(CodingBug.coding_created_at >= start_timestamp)
            if end_date:
                end_timestamp = int(datetime.strptime(end_date, '%Y-%m-%d').timestamp() * 1000)
                conditions.append(CodingBug.coding_created_at <= end_timestamp)

            # 获取总数
            total_query = select(func.count(CodingBug.id)).where(and_(*conditions))
            total_result = await db.execute(total_query)
            total = total_result.scalar()
            
            # 获取分页数据，包含关联信息
            offset = (page - 1) * page_size
            bugs_query = (
                select(CodingBug)
                .options(selectinload(CodingBug.module_links))
                .where(and_(*conditions))
                .order_by(desc(CodingBug.coding_created_at))
                .offset(offset)
                .limit(page_size)
            )

            bugs_result = await db.execute(bugs_query)
            bugs = bugs_result.scalars().all()

            # 转换为响应格式
            items = []
            for bug in bugs:
                # 获取关联的模块信息
                module_links = []
                for link in bug.module_links:
                    # 获取模块名称
                    module_query = select(ModuleStructureNode).where(ModuleStructureNode.id == link.module_id)
                    module_result = await db.execute(module_query)
                    module = module_result.scalar_one_or_none()

                    module_links.append({
                        'id': link.id,
                        'module_id': link.module_id,
                        'module_name': module.name if module else '未知模块',
                        'manifestation_description': link.manifestation_description
                    })

                bug_response = CodingBugResponse(
                    id=bug.id,
                    coding_bug_id=bug.coding_bug_id,
                    coding_bug_code=bug.coding_bug_code,
                    title=bug.title,
                    description=bug.description,
                    priority=bug.priority,
                    status_name=bug.status_name,
                    creator_id=bug.creator_id,
                    coding_created_at=bug.coding_created_at,
                    coding_updated_at=bug.coding_updated_at,
                    workspace_id=bug.workspace_id,
                    project_name=bug.project_name,
                    assignees=bug.assignees,
                    labels=bug.labels,
                    iteration_name=bug.iteration_name,
                    synced_at=bug.synced_at,
                    created_at=bug.created_at,
                    updated_at=bug.updated_at
                )
                # 添加关联信息
                bug_response.module_links = module_links
                items.append(bug_response)
            
            return PaginatedCodingBugResponse(
                items=items,
                total=total,
                page=page,
                page_size=page_size
            )
            
        except Exception as e:
            logger.error(f"获取缺陷分页数据失败: {str(e)}")
            raise
    
    async def get_bug_detail(
        self,
        db: AsyncSession,
        coding_bug_id: int,
        workspace_id: int
    ) -> Optional[CodingBugDetailResponse]:
        """
        获取缺陷详情
        
        Args:
            db: 数据库会话
            coding_bug_id: Coding缺陷ID
            workspace_id: 工作区ID
            
        Returns:
            缺陷详情
        """
        try:
            # 获取缺陷基本信息
            bug_query = select(CodingBug).where(
                and_(
                    CodingBug.coding_bug_id == coding_bug_id,
                    CodingBug.workspace_id == workspace_id
                )
            )
            bug_result = await db.execute(bug_query)
            bug = bug_result.scalar_one_or_none()
            
            if not bug:
                return None
            
            # 获取模块关联信息（使用数据库主键）
            links_query = (
                select(CodingBugModuleLink)
                .where(CodingBugModuleLink.coding_bug_id == bug.id)
                .options(selectinload(CodingBugModuleLink.module))
            )
            links_result = await db.execute(links_query)
            links = links_result.scalars().all()
            
            # 转换模块关联信息
            module_links = []
            for link in links:
                link_response = CodingBugModuleLinkResponse(
                    id=link.id,
                    module_id=link.module_id,
                    coding_bug_id=link.coding_bug_id,
                    manifestation_description=link.manifestation_description,
                    created_at=link.created_at,
                    module_name=getattr(link.module, 'name', None) if link.module else None
                )
                module_links.append(link_response)
            
            # 构建详情响应
            detail_response = CodingBugDetailResponse(
                id=bug.id,
                coding_bug_id=bug.coding_bug_id,
                coding_bug_code=bug.coding_bug_code,
                title=bug.title,
                description=bug.description,
                priority=bug.priority,
                status_name=bug.status_name,
                creator_id=bug.creator_id,
                coding_created_at=bug.coding_created_at,
                coding_updated_at=bug.coding_updated_at,
                workspace_id=bug.workspace_id,
                project_name=bug.project_name,
                assignees=bug.assignees,
                labels=bug.labels,
                iteration_name=bug.iteration_name,
                synced_at=bug.synced_at,
                created_at=bug.created_at,
                updated_at=bug.updated_at,
                module_links=module_links
            )
            
            return detail_response
            
        except Exception as e:
            logger.error(f"获取缺陷详情失败: {str(e)}")
            raise

    async def get_module_bugs_paginated(
        self,
        db: AsyncSession,
        module_id: int,
        workspace_id: int,
        page: int = 1,
        page_size: int = 10
    ) -> Dict[str, Any]:
        """
        分页获取模块关联的缺陷数据

        Args:
            db: 数据库会话
            module_id: 模块ID
            workspace_id: 工作区ID
            page: 页码
            page_size: 每页数量

        Returns:
            分页的模块关联缺陷数据
        """
        try:
            # 构建查询：通过关联表获取模块的缺陷
            from sqlalchemy.orm import joinedload

            # 获取总数
            total_query = (
                select(func.count(CodingBug.id))
                .select_from(CodingBug)
                .join(CodingBugModuleLink, CodingBug.id == CodingBugModuleLink.coding_bug_id)
                .where(
                    and_(
                        CodingBugModuleLink.module_id == module_id,
                        CodingBug.workspace_id == workspace_id
                    )
                )
            )
            total_result = await db.execute(total_query)
            total = total_result.scalar()

            # 获取分页数据
            offset = (page - 1) * page_size
            bugs_query = (
                select(CodingBug)
                .join(CodingBugModuleLink, CodingBug.id == CodingBugModuleLink.coding_bug_id)
                .where(
                    and_(
                        CodingBugModuleLink.module_id == module_id,
                        CodingBug.workspace_id == workspace_id
                    )
                )
                .order_by(desc(CodingBug.coding_created_at))
                .offset(offset)
                .limit(page_size)
            )

            bugs_result = await db.execute(bugs_query)
            bugs = bugs_result.scalars().all()

            # 转换为响应格式
            items = []
            for bug in bugs:
                bug_response = CodingBugResponse(
                    id=bug.id,
                    coding_bug_id=bug.coding_bug_id,
                    coding_bug_code=bug.coding_bug_code,
                    title=bug.title,
                    description=bug.description,
                    priority=bug.priority,
                    status_name=bug.status_name,
                    project_name=bug.project_name,
                    iteration_name=bug.iteration_name,
                    assignees=bug.assignees or [],
                    labels=bug.labels or [],
                    coding_created_at=int(bug.coding_created_at.timestamp()) if bug.coding_created_at and hasattr(bug.coding_created_at, 'timestamp') else (bug.coding_created_at if isinstance(bug.coding_created_at, int) else 0),
                    coding_updated_at=int(bug.coding_updated_at.timestamp()) if bug.coding_updated_at and hasattr(bug.coding_updated_at, 'timestamp') else (bug.coding_updated_at if isinstance(bug.coding_updated_at, int) else 0),
                    workspace_id=bug.workspace_id,
                    synced_at=bug.synced_at,
                    created_at=bug.created_at,
                    updated_at=bug.updated_at
                )
                items.append(bug_response)

            return {
                "items": [item.dict() for item in items],
                "total": total,
                "page": page,
                "page_size": page_size
            }

        except Exception as e:
            logger.error(f"获取模块关联缺陷失败: {str(e)}")
            raise

    async def delete_bug(
        self,
        db: AsyncSession,
        coding_bug_id: int,
        workspace_id: int
    ) -> str:
        """删除单个Coding缺陷"""
        try:
            # 查找缺陷
            bug_query = select(CodingBug).where(
                and_(
                    CodingBug.coding_bug_id == coding_bug_id,
                    CodingBug.workspace_id == workspace_id
                )
            )
            bug_result = await db.execute(bug_query)
            bug = bug_result.scalar_one_or_none()

            if not bug:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="缺陷不存在"
                )

            # 删除缺陷（关联的模块链接会因为外键约束自动删除）
            await db.delete(bug)
            await db.commit()

            logger.info(f"删除Coding缺陷成功: coding_bug_id={coding_bug_id}")
            return f"缺陷 #{bug.coding_bug_code} 删除成功"

        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"删除Coding缺陷失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除缺陷失败: {str(e)}"
            )

    async def batch_delete_bugs(
        self,
        db: AsyncSession,
        coding_bug_ids: List[int],
        workspace_id: int
    ) -> str:
        """批量删除Coding缺陷"""
        try:
            # 查找要删除的缺陷
            bugs_query = select(CodingBug).where(
                and_(
                    CodingBug.coding_bug_id.in_(coding_bug_ids),
                    CodingBug.workspace_id == workspace_id
                )
            )
            bugs_result = await db.execute(bugs_query)
            bugs = bugs_result.scalars().all()

            if not bugs:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="未找到要删除的缺陷"
                )

            deleted_count = len(bugs)

            # 批量删除缺陷
            for bug in bugs:
                await db.delete(bug)

            await db.commit()

            logger.info(f"批量删除Coding缺陷成功: 删除了 {deleted_count} 个缺陷")
            return f"成功删除 {deleted_count} 个缺陷"

        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"批量删除Coding缺陷失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"批量删除缺陷失败: {str(e)}"
            )

    def calculate_health_score(self, bugs: List[CodingBug], current_time: datetime = None, return_details: bool = False):
        """
        计算模块健康分
        基础分100分，根据bug影响扣分

        Args:
            bugs: 缺陷列表
            current_time: 当前时间，用于计算时间衰减
            return_details: 是否返回计算详情

        Returns:
            健康分数 (0-100) 或 (分数, 计算详情)
        """
        if current_time is None:
            current_time = datetime.now()

        base_score = 100.0
        total_deduction = 0.0
        calculation_details = []

        # 优先级扣分规则
        priority_scores = {
            '紧急': 10,
            '高': 8,
            '中': 5,
            '低': 2,
            '未指定': 1
        }

        for bug in bugs:
            # 基础扣分
            base_deduction = priority_scores.get(bug.priority, 1)

            # 时间衰减计算
            if bug.coding_created_at:
                bug_created = datetime.fromtimestamp(bug.coding_created_at / 1000)
                days_passed = (current_time - bug_created).days

                if days_passed >= 30:
                    decay_factor = 0  # 30天后影响归零
                else:
                    decay_factor = max(0, 1 - (days_passed / 30))
            else:
                decay_factor = 1.0  # 如果没有创建时间，按满分计算
                days_passed = 0

            # 状态调整（已解决的bug影响减半）
            status_factor = 0.5 if bug.status_name in ['已解决', '已关闭'] else 1.0

            current_deduction = base_deduction * decay_factor * status_factor
            total_deduction += current_deduction

            # 记录计算详情
            if return_details:
                calculation_details.append({
                    'title': bug.title[:30] + ('...' if len(bug.title) > 30 else ''),
                    'priority': bug.priority,
                    'status': bug.status_name,
                    'days_passed': days_passed,
                    'base_deduction': base_deduction,
                    'decay_factor': round(decay_factor, 3),
                    'status_factor': status_factor,
                    'deduction': round(current_deduction, 1)
                })

        final_score = max(0, base_score - total_deduction)

        if return_details:
            return round(final_score, 1), {
                'base_score': base_score,
                'total_deduction': round(total_deduction, 1),
                'final_score': round(final_score, 1),
                'details': calculation_details
            }
        else:
            return round(final_score, 1)

    async def get_module_tree_with_health(
        self,
        db: AsyncSession,
        workspace_id: int,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        labels: Optional[List[str]] = None,
        priority: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        获取带健康分的模块树

        Args:
            db: 数据库会话
            workspace_id: 工作区ID
            start_date: 开始日期
            end_date: 结束日期
            labels: 标签筛选
            priority: 优先级筛选
            status: 状态筛选

        Returns:
            模块树数据
        """
        try:
            # 构建缺陷查询条件
            bug_conditions = [CodingBug.workspace_id == workspace_id]

            # 时间筛选
            if start_date:
                start_timestamp = int(datetime.strptime(start_date, '%Y-%m-%d').timestamp() * 1000)
                bug_conditions.append(CodingBug.coding_created_at >= start_timestamp)
            if end_date:
                end_timestamp = int(datetime.strptime(end_date, '%Y-%m-%d').timestamp() * 1000)
                bug_conditions.append(CodingBug.coding_created_at <= end_timestamp)

            # 优先级筛选
            if priority:
                bug_conditions.append(CodingBug.priority == priority)

            # 状态筛选
            if status:
                bug_conditions.append(CodingBug.status_name == status)

            # 标签筛选
            if labels:
                label_conditions = []
                for label in labels:
                    label_conditions.append(CodingBug.labels.contains([label]))
                if label_conditions:
                    bug_conditions.append(or_(*label_conditions))

            # 获取所有模块节点
            modules_query = select(ModuleStructureNode).where(
                ModuleStructureNode.workspace_id == workspace_id
            ).order_by(ModuleStructureNode.order_index)

            modules_result = await db.execute(modules_query)
            all_modules = modules_result.scalars().all()

            # 获取所有相关的缺陷数据
            # 注意：CodingBugModuleLink.coding_bug_id 关联的是 CodingBug.id，不是 CodingBug.coding_bug_id
            bugs_query = select(CodingBug, CodingBugModuleLink.module_id).join(
                CodingBugModuleLink, CodingBug.id == CodingBugModuleLink.coding_bug_id
            ).where(and_(*bug_conditions))

            bugs_result = await db.execute(bugs_query)
            bug_module_pairs = bugs_result.all()

            # 按模块ID分组缺陷
            module_bugs = {}
            for bug, module_id in bug_module_pairs:
                if module_id not in module_bugs:
                    module_bugs[module_id] = []
                module_bugs[module_id].append(bug)

            # 调试日志
            logger.info(f"模块健康分析 - 工作区ID: {workspace_id}")
            logger.info(f"找到 {len(bug_module_pairs)} 个缺陷-模块关联")
            logger.info(f"模块缺陷分组: {[(mid, len(bugs)) for mid, bugs in module_bugs.items()]}")
            logger.info(f"总模块数: {len(all_modules)}")

            # 构建模块树并计算健康分
            def build_tree_node(module: ModuleStructureNode) -> Dict[str, Any]:
                bugs = module_bugs.get(module.id, [])
                health_score, calculation_details = self.calculate_health_score(bugs, return_details=True)

                node = {
                    'id': module.id,
                    'name': module.name,
                    'isContentPage': module.is_content_page,
                    'healthScore': health_score,
                    'bugCount': len(bugs),
                    'calculationDetails': calculation_details,
                    'children': [],
                    'isAggregated': False,  # 标记是否为汇总计算
                    'aggregationDetails': []  # 汇总计算详情
                }

                # 递归构建子节点
                child_modules = [m for m in all_modules if m.parent_id == module.id]
                child_nodes_with_bugs = []

                for child in child_modules:
                    child_node = build_tree_node(child)
                    node['children'].append(child_node)

                    # 收集有缺陷的子节点
                    if child_node['bugCount'] > 0:
                        child_nodes_with_bugs.append(child_node)

                # 如果是结构节点且有子节点包含缺陷，进行汇总计算
                if not module.is_content_page and child_nodes_with_bugs:
                    # 计算加权平均健康分
                    total_weighted_score = sum(
                        child['healthScore'] * child['bugCount']
                        for child in child_nodes_with_bugs
                    )
                    total_bugs = sum(child['bugCount'] for child in child_nodes_with_bugs)

                    if total_bugs > 0:
                        weighted_health_score = total_weighted_score / total_bugs

                        # 设置汇总结果
                        node['healthScore'] = round(weighted_health_score, 1)
                        node['bugCount'] = total_bugs
                        node['isAggregated'] = True

                        # 记录汇总详情（一步到位的计算）
                        calculation_parts = [f"{child['healthScore']} × {child['bugCount']}" for child in child_nodes_with_bugs]
                        calculation_formula = f"({' + '.join(calculation_parts)}) ÷ {total_bugs}"

                        node['aggregationDetails'] = [{
                            'childNodes': [
                                {
                                    'name': child['name'],
                                    'score': child['healthScore'],
                                    'bugCount': child['bugCount']
                                }
                                for child in child_nodes_with_bugs
                            ],
                            'calculation': calculation_formula,
                            'result': round(weighted_health_score, 1),
                            'totalBugCount': total_bugs
                        }]

                return node

            # 构建根节点
            root_modules = [m for m in all_modules if m.parent_id is None]
            tree = []
            for root in root_modules:
                tree.append(build_tree_node(root))

            return tree

        except Exception as e:
            logger.error(f"获取模块树健康分析失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取模块树失败: {str(e)}"
            )

    async def get_module_statistics(
        self,
        db: AsyncSession,
        workspace_id: int,
        module_id: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        labels: Optional[List[str]] = None,
        priority: Optional[str] = None,
        status: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取模块缺陷统计数据

        Args:
            db: 数据库会话
            workspace_id: 工作区ID
            module_id: 模块ID，为空时统计全部
            start_date: 开始日期
            end_date: 结束日期
            labels: 标签筛选
            priority: 优先级筛选
            status: 状态筛选

        Returns:
            统计数据
        """
        try:
            # 构建基础查询条件
            bug_conditions = [CodingBug.workspace_id == workspace_id]

            # 模块筛选 - 只有当指定了module_id时才添加模块关联限制
            # 当module_id为None时，查询所有bug（包括未关联到任何模块的bug）
            if module_id:
                # 获取模块信息
                module_query = select(ModuleStructureNode).where(ModuleStructureNode.id == module_id)
                module_result = await db.execute(module_query)
                module = module_result.scalar_one_or_none()

                if not module:
                    raise HTTPException(status_code=404, detail="模块不存在")

                if module.is_content_page:
                    # 内容节点，直接筛选
                    bug_conditions.append(
                        CodingBug.id.in_(
                            select(CodingBugModuleLink.coding_bug_id).where(
                                CodingBugModuleLink.module_id == module_id
                            )
                        )
                    )
                else:
                    # 结构节点，需要递归获取所有子节点
                    def get_all_child_modules(parent_id: int, all_modules: List[ModuleStructureNode]) -> List[int]:
                        child_ids = []
                        for m in all_modules:
                            if m.parent_id == parent_id:
                                child_ids.append(m.id)
                                child_ids.extend(get_all_child_modules(m.id, all_modules))
                        return child_ids

                    # 获取所有模块
                    all_modules_query = select(ModuleStructureNode).where(
                        ModuleStructureNode.workspace_id == workspace_id
                    )
                    all_modules_result = await db.execute(all_modules_query)
                    all_modules = all_modules_result.scalars().all()

                    # 获取所有子模块ID（包括内容节点）
                    child_module_ids = get_all_child_modules(module_id, all_modules)
                    content_module_ids = [
                        m.id for m in all_modules
                        if m.id in child_module_ids and m.is_content_page
                    ]

                    if content_module_ids:
                        bug_conditions.append(
                            CodingBug.id.in_(
                                select(CodingBugModuleLink.coding_bug_id).where(
                                    CodingBugModuleLink.module_id.in_(content_module_ids)
                                )
                            )
                        )
                    else:
                        # 没有内容子节点，返回空统计
                        return {
                            'totalBugs': 0,
                            'newBugs': 0,
                            'resolvedBugs': 0,
                            'pendingBugs': 0,
                            'priorityDistribution': {},
                            'statusDistribution': {}
                        }

            # 时间筛选
            if start_date:
                start_timestamp = int(datetime.strptime(start_date, '%Y-%m-%d').timestamp() * 1000)
                bug_conditions.append(CodingBug.coding_created_at >= start_timestamp)
            if end_date:
                end_timestamp = int(datetime.strptime(end_date, '%Y-%m-%d').timestamp() * 1000)
                bug_conditions.append(CodingBug.coding_created_at <= end_timestamp)

            # 优先级筛选
            if priority:
                bug_conditions.append(CodingBug.priority == priority)

            # 状态筛选
            if status:
                bug_conditions.append(CodingBug.status_name == status)

            # 标签筛选
            if labels:
                label_conditions = []
                for label in labels:
                    label_conditions.append(CodingBug.labels.contains([label]))
                if label_conditions:
                    bug_conditions.append(or_(*label_conditions))

            # 获取所有符合条件的缺陷
            bugs_query = select(CodingBug).where(and_(*bug_conditions))
            bugs_result = await db.execute(bugs_query)
            bugs = bugs_result.scalars().all()

            # 调试日志
            logger.info(f"模块统计查询 - 工作区ID: {workspace_id}, 模块ID: {module_id}")
            logger.info(f"查询条件数量: {len(bug_conditions)}")
            logger.info(f"找到符合条件的缺陷数量: {len(bugs)}")
            if module_id:
                # 检查模块关联
                link_query = select(CodingBugModuleLink).where(CodingBugModuleLink.module_id == module_id)
                link_result = await db.execute(link_query)
                links = link_result.scalars().all()
                logger.info(f"模块 {module_id} 的关联数量: {len(links)}")
                logger.info(f"关联的缺陷ID: {[link.coding_bug_id for link in links]}")

            # 计算统计数据
            total_bugs = len(bugs)

            # 计算新增缺陷（最近7天）
            seven_days_ago = datetime.now() - timedelta(days=7)
            seven_days_timestamp = int(seven_days_ago.timestamp() * 1000)
            new_bugs = len([b for b in bugs if b.coding_created_at and b.coding_created_at >= seven_days_timestamp])

            # 按状态统计
            resolved_bugs = len([b for b in bugs if b.status_name in ['已解决', '已关闭']])
            pending_bugs = len([b for b in bugs if b.status_name in ['待处理', '处理中']])

            # 优先级分布
            priority_distribution = {}
            for bug in bugs:
                priority = bug.priority or '未指定'
                priority_distribution[priority] = priority_distribution.get(priority, 0) + 1

            # 状态分布
            status_distribution = {}
            for bug in bugs:
                status = bug.status_name or '未知'
                status_distribution[status] = status_distribution.get(status, 0) + 1

            return {
                'totalBugs': total_bugs,
                'newBugs': new_bugs,
                'resolvedBugs': resolved_bugs,
                'pendingBugs': pending_bugs,
                'priorityDistribution': priority_distribution,
                'statusDistribution': status_distribution
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取模块统计数据失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取统计数据失败: {str(e)}"
            )

    async def get_bug_trend_analysis(
        self,
        db: AsyncSession,
        workspace_id: int,
        module_id: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        labels: Optional[List[str]] = None,
        priority: Optional[str] = None,
        status: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取缺陷趋势分析数据

        Args:
            db: 数据库会话
            workspace_id: 工作区ID
            module_id: 模块ID，为空时统计全部
            start_date: 开始日期
            end_date: 结束日期
            labels: 标签筛选
            priority: 优先级筛选
            status: 状态筛选

        Returns:
            趋势数据
        """
        try:
            # 只有当指定了结束日期但没有开始日期时，才设置默认开始日期
            # 如果都没有指定，则查询所有历史数据
            if end_date and not start_date:
                start_datetime = datetime.now() - timedelta(days=30)
                start_date = start_datetime.strftime('%Y-%m-%d')

            # 构建基础查询条件
            bug_conditions = [CodingBug.workspace_id == workspace_id]

            # 模块筛选（与统计方法相同的逻辑）
            # 只有当指定了module_id时才添加模块关联限制
            # 当module_id为None时，查询所有bug（包括未关联到任何模块的bug）
            if module_id:
                module_query = select(ModuleStructureNode).where(ModuleStructureNode.id == module_id)
                module_result = await db.execute(module_query)
                module = module_result.scalar_one_or_none()

                if not module:
                    raise HTTPException(status_code=404, detail="模块不存在")

                if module.is_content_page:
                    bug_conditions.append(
                        CodingBug.id.in_(
                            select(CodingBugModuleLink.coding_bug_id).where(
                                CodingBugModuleLink.module_id == module_id
                            )
                        )
                    )
                else:
                    # 结构节点逻辑
                    def get_all_child_modules(parent_id: int, all_modules: List[ModuleStructureNode]) -> List[int]:
                        child_ids = []
                        for m in all_modules:
                            if m.parent_id == parent_id:
                                child_ids.append(m.id)
                                child_ids.extend(get_all_child_modules(m.id, all_modules))
                        return child_ids

                    all_modules_query = select(ModuleStructureNode).where(
                        ModuleStructureNode.workspace_id == workspace_id
                    )
                    all_modules_result = await db.execute(all_modules_query)
                    all_modules = all_modules_result.scalars().all()

                    child_module_ids = get_all_child_modules(module_id, all_modules)
                    content_module_ids = [
                        m.id for m in all_modules
                        if m.id in child_module_ids and m.is_content_page
                    ]

                    if content_module_ids:
                        bug_conditions.append(
                            CodingBug.id.in_(
                                select(CodingBugModuleLink.coding_bug_id).where(
                                    CodingBugModuleLink.module_id.in_(content_module_ids)
                                )
                            )
                        )
                    else:
                        return {'trendData': []}

            # 优先级筛选
            if priority:
                bug_conditions.append(CodingBug.priority == priority)

            # 状态筛选
            if status:
                bug_conditions.append(CodingBug.status_name == status)

            # 标签筛选
            if labels:
                label_conditions = []
                for label in labels:
                    label_conditions.append(CodingBug.labels.contains([label]))
                if label_conditions:
                    bug_conditions.append(or_(*label_conditions))

            # 获取所有符合条件的缺陷
            bugs_query = select(CodingBug).where(and_(*bug_conditions))
            bugs_result = await db.execute(bugs_query)
            bugs = bugs_result.scalars().all()

            # 如果没有指定时间范围，根据实际数据确定范围
            if not start_date or not end_date:
                if not bugs:
                    # 没有数据时返回空趋势
                    return {'trendData': []}

                # 从实际数据中获取时间范围
                timestamps = [bug.coding_created_at for bug in bugs if bug.coding_created_at]
                if not timestamps:
                    return {'trendData': []}

                min_timestamp = min(timestamps)
                max_timestamp = max(timestamps)

                # 按月的第一天开始，最后一天结束
                start_datetime = datetime.fromtimestamp(min_timestamp / 1000).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                end_datetime = datetime.fromtimestamp(max_timestamp / 1000)
                # 获取该月的最后一天
                end_datetime = end_datetime.replace(day=1) + relativedelta(months=1) - timedelta(days=1)
                end_datetime = end_datetime.replace(hour=23, minute=59, second=59, microsecond=999999)
            else:
                # 使用指定的时间范围，按月对齐
                start_datetime = datetime.strptime(start_date, '%Y-%m-%d').replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                end_datetime = datetime.strptime(end_date, '%Y-%m-%d')
                # 获取结束月份的最后一天
                end_datetime = end_datetime.replace(day=1) + relativedelta(months=1) - timedelta(days=1)
                end_datetime = end_datetime.replace(hour=23, minute=59, second=59, microsecond=999999)

            trend_data = []
            current_date = start_datetime

            while current_date <= end_datetime:
                # 使用年-月格式
                date_str = current_date.strftime('%Y-%m')

                # 计算当月的开始和结束时间戳
                month_start = current_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                month_end = (month_start + relativedelta(months=1)) - timedelta(microseconds=1)

                month_start_timestamp = int(month_start.timestamp() * 1000)
                month_end_timestamp = int(month_end.timestamp() * 1000)

                # 统计当月的新增数据
                month_bugs = [
                    b for b in bugs
                    if b.coding_created_at and month_start_timestamp <= b.coding_created_at <= month_end_timestamp
                ]

                # 统计截止当月的累计数据
                cumulative_bugs = [
                    b for b in bugs
                    if b.coding_created_at and b.coding_created_at <= month_end_timestamp
                ]

                resolved_bugs = len([
                    b for b in cumulative_bugs
                    if b.status_name in ['已解决', '已关闭']
                ])

                pending_bugs = len([
                    b for b in cumulative_bugs
                    if b.status_name in ['待处理', '处理中']
                ])

                trend_data.append({
                    'date': date_str,
                    'newBugs': len(month_bugs),
                    'totalBugs': len(cumulative_bugs),
                    'resolvedBugs': resolved_bugs,
                    'pendingBugs': pending_bugs
                })

                # 移动到下一个月
                current_date = current_date + relativedelta(months=1)

            return {'trendData': trend_data}

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取缺陷趋势分析失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取趋势分析失败: {str(e)}"
            )

    async def get_available_labels(
        self,
        db: AsyncSession,
        workspace_id: int
    ) -> List[str]:
        """
        获取工作区中所有可用的标签

        Args:
            db: 数据库会话
            workspace_id: 工作区ID

        Returns:
            标签列表
        """
        try:
            # 查询所有缺陷的标签
            bugs_query = select(CodingBug.labels).where(
                and_(
                    CodingBug.workspace_id == workspace_id,
                    CodingBug.labels.isnot(None),
                    CodingBug.labels != []
                )
            )
            bugs_result = await db.execute(bugs_query)
            all_labels_arrays = bugs_result.scalars().all()

            # 收集所有唯一的标签
            unique_labels = set()
            for labels_array in all_labels_arrays:
                if labels_array:
                    for label in labels_array:
                        if label and label.strip():
                            unique_labels.add(label.strip())

            # 返回排序后的标签列表
            return sorted(list(unique_labels))

        except Exception as e:
            logger.error(f"获取可用标签失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取标签失败: {str(e)}"
            )

    async def get_module_health_analysis(
        self,
        db: AsyncSession,
        workspace_id: int,
        module_id: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        labels: Optional[List[str]] = None,
        priority: Optional[str] = None,
        status: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取模块健康分析的完整数据

        Args:
            db: 数据库会话
            workspace_id: 工作区ID
            module_id: 选中的模块ID
            start_date: 开始日期
            end_date: 结束日期
            labels: 标签筛选
            priority: 优先级筛选
            status: 状态筛选

        Returns:
            完整的分析数据
        """
        try:
            # 获取模块树（带健康分）
            module_tree = await self.get_module_tree_with_health(
                db, workspace_id, start_date, end_date, labels, priority, status
            )

            # 获取统计数据
            statistics = await self.get_module_statistics(
                db, workspace_id, module_id, start_date, end_date, labels, priority, status
            )

            # 获取趋势数据
            trend_analysis = await self.get_bug_trend_analysis(
                db, workspace_id, module_id, start_date, end_date, labels, priority, status
            )

            # 生成AI总结占位数据
            ai_summaries = self._generate_ai_summary_placeholder()

            return {
                'moduleTree': module_tree,
                'statistics': statistics,
                'trendData': trend_analysis['trendData'],
                'aiSummaries': ai_summaries,
                'selectedModuleId': module_id
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取模块健康分析失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取健康分析失败: {str(e)}"
            )

    def _generate_ai_summary_placeholder(self) -> List[Dict[str, Any]]:
        """
        生成AI总结占位数据

        Returns:
            AI总结占位数据
        """
        current_date = datetime.now()
        summaries = []

        # 生成最近6个月的占位数据
        for i in range(6):
            month_date = current_date - timedelta(days=30 * i)
            month_str = month_date.strftime('%Y年%m月')

            summaries.append({
                'month': month_str,
                'title': f'{month_str}缺陷分析报告',
                'summary': '此功能正在开发中，将提供基于AI的智能缺陷分析和建议...',
                'keyPoints': [
                    '缺陷趋势分析',
                    '问题热点识别',
                    '改进建议',
                    '风险评估'
                ],
                'status': 'placeholder'
            })

        return summaries


# 创建全局服务实例
coding_bug_service = CodingBugService()
