from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.logger import logger
from backend.app.models.document import Image
from backend.app.repositories.base_repository import BaseRepository
from backend.app.schemas.image import ImageCreate, ImageBase


class ImageRepository(BaseRepository[Image, ImageCreate, ImageBase]):
    """
    Image模型的数据库操作仓库
    """
    def __init__(self):
        super().__init__(Image)
    
    async def get_by_document_id(self, db: AsyncSession, document_id: int) -> List[Image]:
        """
        获取指定文档的所有图片
        """
        try:
            result = await db.execute(
                select(Image).where(Image.document_id == document_id)
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"获取文档图片失败: {str(e)}")
            raise
    
    async def get_by_section_id(self, db: AsyncSession, section_id: int) -> List[Image]:
        """
        获取指定章节的所有图片
        """
        try:
            result = await db.execute(
                select(Image).where(Image.section_id == section_id)
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"获取章节图片失败: {str(e)}")
            raise
    
    async def create_image(
        self, 
        db: AsyncSession, 
        filename: str, 
        file_path: str, 
        url: str, 
        document_id: int, 
        section_id: Optional[int] = None
    ) -> Image:
        """
        创建图片记录
        """
        try:
            # 创建图片记录
            db_image = Image(
                filename=filename,
                file_path=file_path,
                url=url,
                document_id=document_id,
                section_id=section_id
            )
            
            db.add(db_image)
            await db.commit()
            await db.refresh(db_image)
            
            return db_image
        except Exception as e:
            await db.rollback()
            logger.error(f"创建图片记录失败: {str(e)}")
            raise


# 创建图片仓库实例
image_repository = ImageRepository() 