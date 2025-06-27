from typing import List, Optional, Dict, Any, Tuple

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.models.workspace_table import WorkspaceTable
from backend.app.repositories.workspace_table_repository import workspace_table_repository
from backend.app.schemas.workspace_table import (
    WorkspaceTableCreate,
    WorkspaceTableUpdate,
    WorkspaceTableResponse,
    WorkspaceTableDetail
)
from backend.app.schemas.response import PaginatedResponse
from backend.app.services.workspace_service import workspace_service


class WorkspaceTableService:
    """
    工作区数据库表相关的业务逻辑服务
    """
    
    async def validate_workspace_access(
        self,
        db: AsyncSession,
        workspace_id: int,
        user: User,
        require_write: bool = False
    ) -> bool:
        """
        验证用户对工作区的访问权限
        
        :param db: 数据库会话
        :param workspace_id: 工作区ID
        :param user: 当前用户
        :param require_write: 是否需要写入权限
        :return: 如果有权限则返回True
        :raises: HTTPException 如果没有权限
        """
        # 超级用户拥有所有权限
        if user.is_superuser:
            return True
            
        # 调用工作区服务验证权限
        try:
            access_level = await workspace_service.get_user_workspace_access(db, user.id, workspace_id)
            if not access_level:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="您没有访问该工作区的权限"
                )
                
            if require_write and access_level == "read":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="您没有修改该工作区的权限"
                )
                
            return True
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"验证工作区访问权限失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"验证工作区访问权限失败: {str(e)}"
            )
    
    async def get_tables(
        self,
        db: AsyncSession,
        workspace_id: int,
        user: User
    ) -> List[WorkspaceTableResponse]:
        """
        获取工作区下的所有数据库表
        
        :param db: 数据库会话
        :param workspace_id: 工作区ID
        :param user: 当前用户
        :return: 数据库表列表
        """
        try:
            # 验证工作区访问权限
            await self.validate_workspace_access(db, workspace_id, user)
            
            # 获取数据库表
            tables = await workspace_table_repository.get_by_workspace_id(db, workspace_id)
            
            return [WorkspaceTableResponse.from_orm(table) for table in tables]
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取工作区数据库表失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取工作区数据库表失败: {str(e)}"
            )
    
    async def get_tables_paginated(
        self,
        db: AsyncSession,
        workspace_id: int,
        user: User,
        page: int = 1,
        page_size: int = 10,
        search: str = ""
    ) -> PaginatedResponse[WorkspaceTableResponse]:
        """
        获取工作区下的所有数据库表，支持分页和搜索
        
        :param db: 数据库会话
        :param workspace_id: 工作区ID
        :param user: 当前用户
        :param page: 页码，从1开始
        :param page_size: 每页数量
        :param search: 搜索关键词
        :return: 分页的数据库表列表
        """
        try:
            # 验证工作区访问权限
            await self.validate_workspace_access(db, workspace_id, user)
            
            # 获取分页数据库表
            tables, total = await workspace_table_repository.get_by_workspace_id_paginated(
                db, workspace_id, page, page_size, search
            )
            
            # 转换为响应模型
            items = [WorkspaceTableResponse.from_orm(table) for table in tables]
            
            # 构建分页响应
            return PaginatedResponse(
                items=items,
                total=total,
                page=page,
                page_size=page_size
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取工作区数据库表(分页)失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取工作区数据库表(分页)失败: {str(e)}"
            )
    
    async def get_table(
        self,
        db: AsyncSession,
        table_id: int,
        user: User
    ) -> WorkspaceTableDetail:
        """
        获取工作区数据库表详情
        
        :param db: 数据库会话
        :param table_id: 数据库表ID
        :param user: 当前用户
        :return: 数据库表详情
        """
        try:
            # 获取数据库表
            table = await workspace_table_repository.get_by_id(db, table_id)
            
            if not table:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="数据库表不存在"
                )
            
            # 验证工作区访问权限
            await self.validate_workspace_access(db, table.workspace_id, user)
            
            # 转换为详细响应
            response = WorkspaceTableResponse.from_orm(table)
            
            # 转换字段信息
            detail = WorkspaceTableDetail(
                **response.dict(),
                columns=table.columns_json
            )
            
            return detail
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取工作区数据库表详情失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取工作区数据库表详情失败: {str(e)}"
            )
    
    async def create_table(
        self,
        db: AsyncSession,
        workspace_id: int,
        table_data: WorkspaceTableCreate,
        user: User
    ) -> WorkspaceTableResponse:
        """
        创建工作区数据库表
        
        :param db: 数据库会话
        :param workspace_id: 工作区ID
        :param table_data: 数据库表数据
        :param user: 当前用户
        :return: 创建的数据库表
        """
        try:
            # 验证工作区访问权限
            await self.validate_workspace_access(db, workspace_id, user, require_write=True)
            
            # 检查是否已存在同名表
            table_exists = await workspace_table_repository.check_table_exists(
                db, workspace_id, table_data.name
            )
            
            if table_exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"工作区中已存在名为 '{table_data.name}' 的数据库表"
                )
            
            # 创建数据库表
            table_dict = table_data.dict(exclude={"workspace_id"})
            table = await workspace_table_repository.create_table(
                db, workspace_id, user.id, table_dict
            )
            
            return WorkspaceTableResponse.from_orm(table)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"创建工作区数据库表失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建工作区数据库表失败: {str(e)}"
            )
    
    async def update_table(
        self,
        db: AsyncSession,
        table_id: int,
        table_data: WorkspaceTableUpdate,
        user: User
    ) -> WorkspaceTableResponse:
        """
        更新工作区数据库表
        
        :param db: 数据库会话
        :param table_id: 数据库表ID
        :param table_data: 数据库表更新数据
        :param user: 当前用户
        :return: 更新后的数据库表
        """
        try:
            # 获取数据库表
            table = await workspace_table_repository.get_by_id(db, table_id)
            
            if not table:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="数据库表不存在"
                )
            
            # 验证工作区访问权限
            await self.validate_workspace_access(db, table.workspace_id, user, require_write=True)
            
            # 检查是否与其他表名冲突
            if table_data.name != table.name:
                table_exists = await workspace_table_repository.check_table_exists(
                    db, table.workspace_id, table_data.name, exclude_id=table_id
                )
                
                if table_exists:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"工作区中已存在名为 '{table_data.name}' 的数据库表"
                    )
            
            # 更新数据库表
            table_dict = table_data.dict()
            updated_table = await workspace_table_repository.update_table(
                db, table_id, user.id, table_dict
            )
            
            if not updated_table:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="数据库表不存在"
                )
            
            return WorkspaceTableResponse.from_orm(updated_table)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"更新工作区数据库表失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新工作区数据库表失败: {str(e)}"
            )
    
    async def delete_table(
        self,
        db: AsyncSession,
        table_id: int,
        user: User
    ) -> bool:
        """
        删除工作区数据库表
        
        :param db: 数据库会话
        :param table_id: 数据库表ID
        :param user: 当前用户
        :return: 是否成功删除
        """
        try:
            # 获取数据库表
            table = await workspace_table_repository.get_by_id(db, table_id)
            
            if not table:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="数据库表不存在"
                )
            
            # 验证工作区访问权限
            await self.validate_workspace_access(db, table.workspace_id, user, require_write=True)
            
            # 删除数据库表
            success = await workspace_table_repository.delete_table(db, table_id)
            
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="数据库表不存在"
                )
            
            return True
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"删除工作区数据库表失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除工作区数据库表失败: {str(e)}"
            )


# 创建工作区数据库表服务实例
workspace_table_service = WorkspaceTableService() 