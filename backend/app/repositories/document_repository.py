from typing import List, Optional, Dict, Any
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.repositories.base_repository import BaseRepository
from backend.app.models.document import Document
from backend.app.core.logger import logger
from backend.app.schemas.document import DocumentCreate, DocumentUpdate


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


# 创建文档仓库实例
document_repository = DocumentRepository() 