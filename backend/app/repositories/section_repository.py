from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.repositories.base_repository import BaseRepository
from backend.app.models.document import Section
from backend.app.core.logger import logger
from backend.app.schemas.document import SectionCreate, SectionUpdate


class SectionRepository(BaseRepository[Section, SectionCreate, SectionUpdate]):
    """
    Section模型的数据库操作仓库
    """
    def __init__(self):
        super().__init__(Section)
    
    async def get_by_document_id(self, db: AsyncSession, document_id: int) -> List[Section]:
        """
        获取文档的所有章节
        """
        try:
            result = await db.execute(
                select(Section)
                .where(Section.document_id == document_id)
                .order_by(Section.order)
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"获取文档章节失败: {str(e)}")
            raise
    
    async def get_section(
        self, 
        db: AsyncSession, 
        document_id: int, 
        section_id: int
    ) -> Optional[Section]:
        """
        获取特定文档的特定章节
        """
        try:
            result = await db.execute(
                select(Section)
                .where(
                    Section.id == section_id,
                    Section.document_id == document_id
                )
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"获取章节失败: {str(e)}")
            raise
            
    async def create_section(
        self, 
        db: AsyncSession, 
        document_id: int, 
        section_data: SectionCreate
    ) -> Section:
        """
        创建新章节
        """
        try:
            # 创建章节对象
            db_section = Section(
                title=section_data.title,
                content=section_data.content,
                document_id=document_id,
                order=section_data.order
            )
            
            # 保存到数据库
            db.add(db_section)
            await db.commit()
            await db.refresh(db_section)
            
            return db_section
        except Exception as e:
            await db.rollback()
            logger.error(f"创建章节失败: {str(e)}")
            raise


# 创建章节仓库实例
section_repository = SectionRepository() 