from typing import List, Optional, Dict, Any, Tuple

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.models.workspace_interface import WorkspaceInterface
from backend.app.repositories.workspace_interface_repository import workspace_interface_repository
from backend.app.schemas.workspace_interface import (
    WorkspaceInterfaceCreate,
    WorkspaceInterfaceUpdate,
    WorkspaceInterfaceResponse,
    WorkspaceInterfaceDetail
)
from backend.app.schemas.response import APIResponse
from backend.app.services.workspace_service import workspace_service


class WorkspaceInterfaceService:
    """
    工作区API接口相关的业务逻辑服务
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
    
    async def get_interfaces(
        self,
        db: AsyncSession,
        workspace_id: int,
        user: User,
        page: int = 1,
        page_size: int = 10,
        search: str = ''
    ) -> Dict[str, Any]:
        """
        获取工作区下的接口，带分页和搜索
        
        :param db: 数据库会话
        :param workspace_id: 工作区ID
        :param user: 当前用户
        :param page: 页码，从1开始
        :param page_size: 每页数量
        :param search: 搜索关键词，可搜索路径和描述
        :return: 带有分页信息的接口列表
        """
        try:
            # 验证工作区访问权限
            await self.validate_workspace_access(db, workspace_id, user)
            
            # 计算分页参数
            skip = (page - 1) * page_size
            
            # 获取接口
            interfaces = await workspace_interface_repository.get_by_workspace_id(
                db, workspace_id, skip=skip, limit=page_size, search=search
            )
            
            # 获取接口总数
            total = await workspace_interface_repository.count_by_workspace_id(db, workspace_id, search=search)
            
            # 构造响应
            items = [WorkspaceInterfaceResponse.from_orm(interface) for interface in interfaces]
            
            return {
                "items": items,
                "total": total,
                "page": page,
                "page_size": page_size
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取工作区接口失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取工作区接口失败: {str(e)}"
            )
    
    async def get_interface(
        self,
        db: AsyncSession,
        interface_id: int,
        user: User
    ) -> WorkspaceInterfaceDetail:
        """
        获取工作区接口详情
        
        :param db: 数据库会话
        :param interface_id: 接口ID
        :param user: 当前用户
        :return: 接口详情
        """
        try:
            # 获取接口
            interface = await workspace_interface_repository.get_by_id(db, interface_id)
            
            if not interface:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="接口不存在"
                )
            
            # 验证工作区访问权限
            await self.validate_workspace_access(db, interface.workspace_id, user)
            
            # 转换为详细响应
            response = WorkspaceInterfaceResponse.from_orm(interface)
            
            # 转换参数信息
            detail = WorkspaceInterfaceDetail(
                **response.dict(),
                request_params=interface.request_params_json or [],
                response_params=interface.response_params_json or []
            )
            
            return detail
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取工作区接口详情失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取工作区接口详情失败: {str(e)}"
            )
    
    async def create_interface(
        self,
        db: AsyncSession,
        workspace_id: int,
        interface_data: WorkspaceInterfaceCreate,
        user: User
    ) -> WorkspaceInterfaceResponse:
        """
        创建工作区接口
        
        :param db: 数据库会话
        :param workspace_id: 工作区ID
        :param interface_data: 接口数据
        :param user: 当前用户
        :return: 创建的接口
        """
        try:
            # 验证工作区访问权限
            await self.validate_workspace_access(db, workspace_id, user, require_write=True)
            
            # 检查是否已存在相同路径和方法的接口
            interface_exists = await workspace_interface_repository.check_interface_exists(
                db, workspace_id, interface_data.path, interface_data.method
            )
            
            if interface_exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"工作区中已存在路径为 '{interface_data.path}' 且方法为 '{interface_data.method}' 的接口"
                )
            
            # 创建接口
            interface_dict = interface_data.dict(exclude={"workspace_id"})
            interface = await workspace_interface_repository.create_interface(
                db, workspace_id, user.id, interface_dict
            )
            
            return WorkspaceInterfaceResponse.from_orm(interface)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"创建工作区接口失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建工作区接口失败: {str(e)}"
            )
    
    async def update_interface(
        self,
        db: AsyncSession,
        interface_id: int,
        interface_data: WorkspaceInterfaceUpdate,
        user: User
    ) -> WorkspaceInterfaceResponse:
        """
        更新工作区接口
        
        :param db: 数据库会话
        :param interface_id: 接口ID
        :param interface_data: 接口更新数据
        :param user: 当前用户
        :return: 更新后的接口
        """
        try:
            # 获取接口
            interface = await workspace_interface_repository.get_by_id(db, interface_id)
            
            if not interface:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="接口不存在"
                )
            
            # 验证工作区访问权限
            await self.validate_workspace_access(db, interface.workspace_id, user, require_write=True)
            
            # 检查是否与其他接口冲突
            if interface_data.path != interface.path or interface_data.method != interface.method:
                interface_exists = await workspace_interface_repository.check_interface_exists(
                    db, interface.workspace_id, interface_data.path, interface_data.method, exclude_id=interface_id
                )
                
                if interface_exists:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"工作区中已存在路径为 '{interface_data.path}' 且方法为 '{interface_data.method}' 的接口"
                    )
            
            # 更新接口
            interface_dict = interface_data.dict()
            updated_interface = await workspace_interface_repository.update_interface(
                db, interface_id, user.id, interface_dict
            )
            
            if not updated_interface:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="接口不存在"
                )
            
            return WorkspaceInterfaceResponse.from_orm(updated_interface)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"更新工作区接口失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新工作区接口失败: {str(e)}"
            )
    
    async def delete_interface(
        self,
        db: AsyncSession,
        interface_id: int,
        user: User
    ) -> bool:
        """
        删除工作区接口
        
        :param db: 数据库会话
        :param interface_id: 接口ID
        :param user: 当前用户
        :return: 是否成功删除
        """
        try:
            # 获取接口
            interface = await workspace_interface_repository.get_by_id(db, interface_id)
            
            if not interface:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="接口不存在"
                )
            
            # 验证工作区访问权限
            await self.validate_workspace_access(db, interface.workspace_id, user, require_write=True)
            
            # 删除接口
            success = await workspace_interface_repository.delete_interface(db, interface_id)
            
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="接口不存在"
                )
            
            return True
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"删除工作区接口失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除工作区接口失败: {str(e)}"
            )

    async def check_interface_exists(
        self,
        db: AsyncSession,
        workspace_id: int,
        path: str,
        method: str,
        exclude_id: Optional[int] = None
    ) -> bool:
        """
        检查工作区中是否已存在相同路径和方法的接口
        
        :param db: 数据库会话
        :param workspace_id: 工作区ID
        :param path: 接口路径
        :param method: 请求方法
        :param exclude_id: 排除的接口ID（编辑模式下使用）
        :return: 是否存在重复接口
        """
        try:
            # 调用仓库方法检查接口是否存在
            exists = await workspace_interface_repository.check_interface_exists(
                db, workspace_id, path, method, exclude_id
            )
            return exists
        except Exception as e:
            logger.error(f"检查工作区接口是否存在失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"检查工作区接口是否存在失败: {str(e)}"
            )


# 创建工作区接口服务实例
workspace_interface_service = WorkspaceInterfaceService() 