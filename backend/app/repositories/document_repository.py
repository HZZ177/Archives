from typing import List, Optional, Dict, Any
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.repositories.base_repository import BaseRepository
from backend.app.models.document import Document, Section
from backend.app.core.logger import logger
from backend.app.schemas.document import DocumentCreate, DocumentUpdate, SectionCreate, SectionUpdate


class DocumentRepository(BaseRepository[Document, DocumentCreate, DocumentUpdate]):
    """
    Document模型的数据库操作仓库
    """
    def __init__(self):
        super().__init__(Document)
    
    async def get_with_sections(self, db: AsyncSession, document_id: int) -> Optional[Document]:
        """
        获取文档及其所有章节
        """
        try:
            result = await db.execute(
                select(Document)
                .where(Document.id == document_id)
                .options(selectinload(Document.sections))
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"获取文档及章节失败: {str(e)}")
            raise
    
    async def get_user_documents(
        self, 
        db: AsyncSession, 
        user_id: int, 
        skip: int = 0, 
        limit: int = 10,
        keyword: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取用户的所有文档，支持分页和关键字搜索
        """
        try:
            # 构建基础查询
            query = select(Document).where(Document.user_id == user_id)

            # 添加关键字搜索
            if keyword:
                query = query.where(
                    or_(
                        Document.title.ilike(f"%{keyword}%"),
                        Document.description.ilike(f"%{keyword}%")
                    )
                )

            # 查询总数
            total_query = select(func.count()).select_from(query.subquery())
            total = await db.scalar(total_query)

            # 查询文档列表
            result = await db.execute(
                query
                .options(selectinload(Document.sections))
                .offset(skip)
                .limit(limit)
            )
            documents = result.scalars().all()

            return {
                "total": total,
                "items": documents
            }
        except Exception as e:
            logger.error(f"获取用户文档列表失败: {str(e)}")
            raise
    
    # Section 相关方法
    async def get_sections_by_document_id(self, db: AsyncSession, document_id: int) -> List[Section]:
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
    
    async def update_section(
        self, 
        db: AsyncSession, 
        section: Section, 
        section_data: SectionUpdate
    ) -> Section:
        """
        更新章节
        """
        try:
            # 更新章节属性
            update_data = section_data.model_dump(exclude_unset=True)
            for key, value in update_data.items():
                setattr(section, key, value)
            
            # 保存到数据库
            await db.commit()
            await db.refresh(section)
            
            return section
        except Exception as e:
            await db.rollback()
            logger.error(f"更新章节失败: {str(e)}")
            raise
    
    async def delete_section(self, db: AsyncSession, section: Section) -> None:
        """
        删除章节
        """
        try:
            await db.delete(section)
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"删除章节失败: {str(e)}")
            raise


# 创建文档仓库实例
document_repository = DocumentRepository() 