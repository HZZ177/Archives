from typing import Optional, List, Tuple, Dict, Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.logger import logger
from backend.app.models.module_content import ModuleContent
from backend.app.models.user import User
from backend.app.repositories.module_content_repository import module_content_repository
from backend.app.repositories.workspace_table_repository import workspace_table_repository
from backend.app.repositories.workspace_interface_repository import workspace_interface_repository
from backend.app.schemas.module_content import ModuleContentUpdate


class ModuleContentService:
    """
    模块内容相关的业务逻辑服务
    """
    
    async def validate_module_node(
        self,
        db: AsyncSession,
        module_node_id: int
    ) -> bool:
        """
        验证模块节点是否存在
        
        :raises: HTTPException 如果节点不存在
        """
        node_exists = await module_content_repository.check_node_exists(db, module_node_id)
        if not node_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="模块节点不存在"
            )
        return True
    
    async def get_module_content(
        self,
        db: AsyncSession,
        module_node_id: int
    ) -> ModuleContent:
        """
        获取特定模块节点的内容
        
        :param db: 数据库会话
        :param module_node_id: 模块节点ID
        :return: 模块内容对象
        """
        try:
            # 验证模块节点存在
            await self.validate_module_node(db, module_node_id)
            
            # 获取模块内容
            content = await module_content_repository.get_by_node_id(db, module_node_id)
            
            if not content:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="模块内容不存在"
                )
            
            return content
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取模块内容失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取模块内容失败: {str(e)}"
            )
    
    async def upsert_module_content(
        self,
        db: AsyncSession,
        module_node_id: int,
        content_data: ModuleContentUpdate,
        user: User
    ) -> Tuple[ModuleContent, str]:
        """
        创建或更新特定模块节点的内容
        
        :param db: 数据库会话
        :param module_node_id: 模块节点ID
        :param content_data: 内容更新数据
        :param user: 当前用户
        :return: (模块内容对象, 操作消息)
        """
        try:
            # 验证模块节点存在
            await self.validate_module_node(db, module_node_id)
            
            # 检查是否已存在内容
            existing_content = await module_content_repository.get_by_node_id(db, module_node_id)
            
            # 执行更新或创建
            content = await module_content_repository.upsert_content(
                db, module_node_id, user.id, content_data
            )
            
            # 根据操作类型返回相应消息
            message = "模块内容更新成功" if existing_content else "模块内容创建成功"
            
            return content, message
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"更新模块内容失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新模块内容失败: {str(e)}"
            )
    
    async def get_referenced_tables(
        self,
        db: AsyncSession,
        module_node_id: int
    ) -> List[Dict[str, Any]]:
        """
        获取模块引用的工作区数据库表
        
        :param db: 数据库会话
        :param module_node_id: 模块节点ID
        :return: 引用的数据库表列表
        """
        try:
            # 获取模块内容
            content = await self.get_module_content(db, module_node_id)
            
            # 如果没有引用，返回空列表
            if not content.database_table_refs_json:
                return []
            
            # 获取引用的表
            tables = []
            for table_id in content.database_table_refs_json:
                table = await workspace_table_repository.get_by_id(db, table_id)
                if table:
                    tables.append({
                        "id": table.id,
                        "table_name": table.table_name,
                        "schema_name": table.schema_name,
                        "description": table.description,
                        "columns": table.columns_json,
                        "relationships": table.relationships_json
                    })
            
            return tables
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取引用的数据库表失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取引用的数据库表失败: {str(e)}"
            )
    
    async def get_referenced_interfaces(
        self,
        db: AsyncSession,
        module_node_id: int
    ) -> List[Dict[str, Any]]:
        """
        获取模块引用的工作区接口
        
        :param db: 数据库会话
        :param module_node_id: 模块节点ID
        :return: 引用的接口列表
        """
        try:
            # 获取模块内容
            content = await self.get_module_content(db, module_node_id)
            
            # 如果没有引用，返回空列表
            if not content.api_interface_refs_json:
                return []
            
            # 获取引用的接口
            interfaces = []
            for interface_id in content.api_interface_refs_json:
                interface = await workspace_interface_repository.get_by_id(db, interface_id)
                if interface:
                    interfaces.append({
                        "id": interface.id,
                        "path": interface.path,
                        "method": interface.method,
                        "description": interface.description,
                        "content_type": interface.content_type,
                        "request_params": interface.request_params_json,
                        "response_params": interface.response_params_json
                    })
            
            return interfaces
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取引用的接口失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取引用的接口失败: {str(e)}"
            )
    
    async def update_table_refs(
        self,
        db: AsyncSession,
        module_node_id: int,
        table_ids: List[int],
        user: User
    ) -> Tuple[ModuleContent, str]:
        """
        更新模块内容中的数据库表引用
        
        :param db: 数据库会话
        :param module_node_id: 模块节点ID
        :param table_ids: 数据库表ID列表
        :param user: 当前用户
        :return: (更新后的模块内容, 操作消息)
        """
        try:
            # 验证模块节点存在
            await self.validate_module_node(db, module_node_id)
            
            # 获取模块内容，如果不存在则创建
            content = await module_content_repository.get_by_node_id(db, module_node_id)
            if not content:
                # 创建新内容
                content = await module_content_repository.upsert_content(
                    db, module_node_id, user.id, ModuleContentUpdate()
                )
            
            # 更新表引用
            content = await module_content_repository.update_table_refs(
                db, module_node_id, user.id, table_ids
            )
            
            if not content:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="模块内容不存在"
                )
            
            return content, "数据库表引用更新成功"
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"更新数据库表引用失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新数据库表引用失败: {str(e)}"
            )
    
    async def update_interface_refs(
        self,
        db: AsyncSession,
        module_node_id: int,
        interface_ids: List[int],
        user: User
    ) -> Tuple[ModuleContent, str]:
        """
        更新模块内容中的接口引用
        
        :param db: 数据库会话
        :param module_node_id: 模块节点ID
        :param interface_ids: 接口ID列表
        :param user: 当前用户
        :return: (更新后的模块内容, 操作消息)
        """
        try:
            # 验证模块节点存在
            await self.validate_module_node(db, module_node_id)
            
            # 获取模块内容，如果不存在则创建
            content = await module_content_repository.get_by_node_id(db, module_node_id)
            if not content:
                # 创建新内容
                content = await module_content_repository.upsert_content(
                    db, module_node_id, user.id, ModuleContentUpdate()
                )
            
            # 更新接口引用
            content = await module_content_repository.update_interface_refs(
                db, module_node_id, user.id, interface_ids
            )
            
            if not content:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="模块内容不存在"
                )
            
            return content, "接口引用更新成功"
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"更新接口引用失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新接口引用失败: {str(e)}"
            )


# 创建模块内容服务实例
module_content_service = ModuleContentService() 