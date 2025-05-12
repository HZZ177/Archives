from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.logger import logger
from backend.app.models.document import Template
from backend.app.models.user import User
from backend.app.repositories.template_repository import template_repository
from backend.app.schemas.template import TemplateCreate, TemplateUpdate


class TemplateService:
    """
    模板相关业务逻辑服务
    """
    
    async def get_templates_list(
        self, 
        db: AsyncSession, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[Template]:
        """
        获取模板列表
        """
        try:
            templates = await template_repository.get_all_templates(db, skip, limit)
            return templates
        except Exception as e:
            logger.error(f"获取模板列表服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取模板列表失败: {str(e)}"
            )
    
    async def get_template(
        self, 
        db: AsyncSession, 
        template_id: int
    ) -> Template:
        """
        获取单个模板（带错误处理）
        """
        try:
            template = await template_repository.get_template_by_id(db, template_id)
            if not template:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="模板不存在"
                )
            return template
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取模板服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取模板详情失败: {str(e)}"
            )
    
    async def create_template(
        self, 
        db: AsyncSession, 
        template_data: TemplateCreate,
        user: User
    ) -> Template:
        """
        创建模板（含验证逻辑）
        """
        try:
            # 构建模板数据
            template_dict = template_data.model_dump()
            template_dict["user_id"] = user.id
            
            # 创建模板
            template = await template_repository.create_template(db, template_dict)
            return template
        except Exception as e:
            logger.error(f"创建模板服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建模板失败: {str(e)}"
            )
    
    async def update_template(
        self, 
        db: AsyncSession, 
        template_id: int, 
        template_data: TemplateUpdate,
        user: User  # 用户对象，通常用于权限检查
    ) -> Template:
        """
        更新模板（含验证逻辑）
        """
        try:
            # 获取模板
            template = await self.get_template(db, template_id)
            
            # 可以在这里添加其他权限验证逻辑
            # 例如检查用户是否有权限更新此模板
            
            # 更新模板
            update_data = template_data.model_dump(exclude_unset=True)
            updated_template = await template_repository.update_template(db, template, update_data)
            
            return updated_template
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"更新模板服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新模板失败: {str(e)}"
            )
    
    async def delete_template(
        self, 
        db: AsyncSession, 
        template_id: int,
        user: User  # 用户对象，通常用于权限检查
    ) -> str:
        """
        删除模板（含验证逻辑）
        """
        try:
            # 获取模板
            template = await self.get_template(db, template_id)
            
            # 可以在这里添加其他权限验证逻辑
            # 例如检查用户是否有权限删除此模板
            
            # 删除模板
            await template_repository.delete_template(db, template)
            
            return "模板删除成功"
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"删除模板服务失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除模板失败: {str(e)}"
            )


# 创建模板服务实例
template_service = TemplateService() 