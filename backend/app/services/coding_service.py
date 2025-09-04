import asyncio
import aiohttp
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from fastapi import HTTPException, status

from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.models.workspace import Workspace


class CodingService:
    """Coding平台API集成服务"""
    
    def __init__(self):
        self.api_base_url = "https://e.coding.net/open-api"
        self.timeout = 30
    
    async def fetch_bugs_from_coding(
        self, 
        api_token: str, 
        project_name: str, 
        offset: int = 0, 
        limit: int = 50,
        conditions: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        从Coding API获取缺陷数据
        
        Args:
            api_token: API访问令牌
            project_name: 项目名称
            offset: 偏移量
            limit: 限制数量
            conditions: 查询条件
            
        Returns:
            Coding API返回的原始数据
        """
        try:
            headers = {
                "Content-Type": "application/json;charset=UTF-8",
                "Accept": "application/json",
                "Authorization": f"Bearer {api_token}"
            }
            
            params = {
                "Action": "DescribeIssueList"
            }
            
            data = {
                "ProjectName": project_name,
                "IssueType": "DEFECT",
                "Offset": str(offset),
                "Limit": str(limit),
                "SortKey": "CODE",
                "SortValue": "DESC"
            }
            
            if conditions:
                data["Conditions"] = conditions
            
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
                async with session.post(
                    self.api_base_url,
                    params=params,
                    json=data,
                    headers=headers
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"Coding API请求失败: {response.status}, {error_text}")
                        raise HTTPException(
                            status_code=status.HTTP_502_BAD_GATEWAY,
                            detail=f"Coding API请求失败: {response.status}"
                        )
                    
                    result = await response.json()
                    
                    if "Response" not in result:
                        logger.error(f"Coding API返回格式异常: {result}")
                        raise HTTPException(
                            status_code=status.HTTP_502_BAD_GATEWAY,
                            detail="Coding API返回格式异常"
                        )
                    
                    return result["Response"]
                    
        except aiohttp.ClientError as e:
            logger.error(f"Coding API网络请求失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"网络请求失败: {str(e)}"
            )
        except Exception as e:
            logger.error(f"获取Coding缺陷数据失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取缺陷数据失败: {str(e)}"
            )
    
    def transform_coding_bug_data(self, coding_bug: Dict[str, Any], project_name: str) -> Dict[str, Any]:
        """
        转换Coding API返回的缺陷数据为标准格式
        
        Args:
            coding_bug: Coding API返回的单个缺陷数据
            project_name: 项目名称
            
        Returns:
            转换后的标准格式数据
        """
        try:
            # 优先级映射
            priority_map = {
                "0": "低",
                "1": "中",
                "2": "高",
                "3": "紧急",
                "": "未指定"
            }

            # 获取优先级（从Priority字段）
            priority = "未指定"  # 默认值
            if coding_bug.get("Priority") is not None:
                priority_value = str(coding_bug["Priority"]) if coding_bug["Priority"] != "" else ""
                priority = priority_map.get(priority_value, "未指定")
            
            return {
                "coding_bug_id": coding_bug.get("Id"),
                "coding_bug_code": coding_bug.get("Code"),
                "title": coding_bug.get("Name", ""),
                "description": coding_bug.get("Description", ""),
                "priority": priority,
                "status_name": coding_bug.get("IssueStatusName", ""),
                "creator_id": coding_bug.get("CreatorId"),
                "coding_created_at": coding_bug.get("CreatedAt"),
                "project_name": project_name,
                "assignees": [assignee.get("Name", "") for assignee in coding_bug.get("Assignees", [])],
                "labels": [label.get("Name", "") for label in coding_bug.get("Labels", [])],
                "iteration_name": coding_bug.get("Iteration", {}).get("Name", ""),
                "updated_at": coding_bug.get("UpdatedAt")
            }
            
        except Exception as e:
            logger.error(f"转换Coding缺陷数据失败: {str(e)}, 原始数据: {coding_bug}")
            # 返回基本数据，避免转换失败导致整个同步失败
            return {
                "coding_bug_id": coding_bug.get("Id"),
                "coding_bug_code": coding_bug.get("Code"),
                "title": coding_bug.get("Name", "数据转换失败"),
                "description": coding_bug.get("Description", ""),
                "priority": "中",
                "status_name": coding_bug.get("IssueStatusName", ""),
                "creator_id": coding_bug.get("CreatorId"),
                "coding_created_at": coding_bug.get("CreatedAt"),
                "project_name": project_name,
                "assignees": [],
                "labels": [],
                "iteration_name": "",
                "updated_at": coding_bug.get("UpdatedAt")
            }
    
    async def sync_all_bugs_from_coding(
        self,
        api_token: str,
        project_name: str,
        conditions: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        从Coding API同步所有缺陷数据

        Args:
            api_token: API访问令牌
            project_name: 项目名称
            conditions: 查询条件

        Returns:
            同步结果统计
        """
        try:
            all_bugs = []
            page_size = 50  # 每次拉取50条
            offset = 0

            logger.info(f"开始同步Coding项目 {project_name} 的缺陷数据")

            while True:
                # 获取当前页数据
                response_data = await self.fetch_bugs_from_coding(
                    api_token=api_token,
                    project_name=project_name,
                    offset=offset,
                    limit=page_size,
                    conditions=conditions
                )

                issue_list = response_data.get("IssueList", [])
                logger.info(f"获取到 {len(issue_list)} 条数据，偏移量: {offset}")

                if not issue_list:
                    # 没有数据了，结束循环
                    break

                # 转换数据格式
                for bug in issue_list:
                    transformed_bug = self.transform_coding_bug_data(bug, project_name)
                    all_bugs.append(transformed_bug)

                # 如果返回的数据量小于页面大小，说明已经是最后一页
                if len(issue_list) < page_size:
                    break

                # 准备下一页
                offset += page_size

            logger.info(f"同步完成，共获取 {len(all_bugs)} 条缺陷数据")

            return {
                "bugs": all_bugs,
                "total_count": len(all_bugs),
                "project_name": project_name
            }

        except Exception as e:
            logger.error(f"同步Coding缺陷数据失败: {str(e)}")
            raise

    async def fetch_iterations_from_coding(
        self,
        api_token: str,
        project_name: str
    ) -> List[Dict[str, Any]]:
        """
        从Coding API获取迭代列表

        Args:
            api_token: API访问令牌
            project_name: 项目名称

        Returns:
            迭代列表
        """
        try:
            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": f"Bearer {api_token}"
            }

            data = {
                "Action": "DescribeIterationList",
                "Offset": 0,
                "Limit": 100,
                "ProjectName": project_name,
                "Status": ["PROCESSING", "WAIT_PROCESS"]
            }

            logger.info(f"请求Coding迭代列表: project_name={project_name}")

            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30.0)) as session:
                async with session.post(
                    "https://e.coding.net/open-api",
                    headers=headers,
                    json=data
                ) as response:
                    response.raise_for_status()
                    result = await response.json()

                logger.info(f"Coding迭代列表完整响应: {result}")

                # Coding API返回的数据结构是 {"Response": {"Data": {"List": [...]}}}
                if "Response" in result and "Data" in result["Response"]:
                    iterations_data = result["Response"]["Data"].get("List", [])

                    # 转换为前端需要的格式
                    iterations = []
                    for iteration in iterations_data:
                        iterations.append({
                            "id": str(iteration.get("Code")),  # 使用Code作为id，这是同步条件需要的值
                            "name": iteration.get("Name"),     # 使用大写的Name
                            "status": iteration.get("Status"),
                            "start_date": iteration.get("StartAt"),
                            "end_date": iteration.get("EndAt"),
                            "internal_id": iteration.get("Id")  # 保留内部ID以备后用
                        })

                    logger.info(f"成功获取 {len(iterations)} 个迭代")
                    return iterations
                else:
                    # 如果没有Response结构，说明API调用失败
                    error_msg = result.get("msg", result.get("message", "API响应格式异常"))
                    logger.error(f"Coding API返回错误: {error_msg}")
                    raise Exception(f"Coding API错误: {error_msg}")

        except aiohttp.ClientResponseError as e:
            logger.error(f"HTTP请求失败: {e.status} - {e.message}")
            raise Exception(f"请求Coding API失败: HTTP {e.status}")
        except Exception as e:
            logger.error(f"从Coding获取迭代列表失败: {str(e)}")
            raise Exception(f"从Coding获取迭代列表失败: {str(e)}")


# 创建全局服务实例
coding_service = CodingService()
