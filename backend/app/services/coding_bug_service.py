"""
Coding缺陷数据库操作服务
"""

from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc
from sqlalchemy.orm import selectinload
from datetime import datetime
from fastapi import HTTPException, status

from backend.app.core.logger import logger
from backend.app.models.coding_bug import CodingBug, CodingBugModuleLink
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
        status_name: Optional[str] = None
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
            
            # 获取总数
            total_query = select(func.count(CodingBug.id)).where(and_(*conditions))
            total_result = await db.execute(total_query)
            total = total_result.scalar()
            
            # 获取分页数据
            offset = (page - 1) * page_size
            bugs_query = (
                select(CodingBug)
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
            
            # 获取模块关联信息
            links_query = (
                select(CodingBugModuleLink)
                .where(CodingBugModuleLink.coding_bug_id == coding_bug_id)
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
                .join(CodingBugModuleLink, CodingBug.coding_bug_id == CodingBugModuleLink.coding_bug_id)
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
                .join(CodingBugModuleLink, CodingBug.coding_bug_id == CodingBugModuleLink.coding_bug_id)
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


# 创建全局服务实例
coding_bug_service = CodingBugService()
