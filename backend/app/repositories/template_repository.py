from typing import List, Optional, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.logger import logger
from backend.app.models.document import Template
from backend.app.repositories.base_repository import BaseRepository
from backend.app.schemas.template import TemplateCreate, TemplateUpdate


class TemplateRepository(BaseRepository[Template, TemplateCreate, TemplateUpdate]):
    """
    Template模型的数据库操作仓库
    """
    def __init__(self):
        super().__init__(Template)
    
    async def get_all_templates(
        self, 
        db: AsyncSession, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[Template]:
        """
        获取所有模板列表
        """
        try:
            result = await db.execute(
                select(Template).offset(skip).limit(limit)
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"获取模板列表失败: {str(e)}")
            raise
    
    async def get_template_by_id(self, db: AsyncSession, template_id: int) -> Optional[Template]:
        """
        根据ID获取模板
        """
        try:
            return await db.get(Template, template_id)
        except Exception as e:
            logger.error(f"获取模板详情失败: {str(e)}")
            raise
    
    async def create_template(
        self, 
        db: AsyncSession, 
        template_data: Dict[str, Any]
    ) -> Template:
        """
        创建模板
        """
        try:
            db_template = Template(**template_data)
            db.add(db_template)
            await db.commit()
            await db.refresh(db_template)
            return db_template
        except Exception as e:
            await db.rollback()
            logger.error(f"创建模板失败: {str(e)}")
            raise
    
    async def update_template(
        self, 
        db: AsyncSession, 
        template: Template, 
        update_data: Dict[str, Any]
    ) -> Template:
        """
        更新模板
        """
        try:
            for key, value in update_data.items():
                setattr(template, key, value)
            
            await db.commit()
            await db.refresh(template)
            return template
        except Exception as e:
            await db.rollback()
            logger.error(f"更新模板失败: {str(e)}")
            raise
    
    async def delete_template(self, db: AsyncSession, template: Template) -> None:
        """
        删除模板
        """
        try:
            await db.delete(template)
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"删除模板失败: {str(e)}")
            raise


# 创建模板仓库实例
template_repository = TemplateRepository() 