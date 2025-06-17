from typing import List, Optional, Any, Dict, Union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from backend.app.core.logger import logger
from backend.app.models.image import Image
from backend.app.repositories.base_repository import BaseRepository


class ImageRepository(BaseRepository):
    """图片存储库"""
    
    async def create_image(
        self, 
        db: AsyncSession, 
        image_data: Dict[str, Any]
    ) -> Image:
        """
        创建图片记录
        
        Args:
            db: 数据库会话
            image_data: 图片数据，包含filename, file_path, url等
            
        Returns:
            创建的图片对象
        """
        image = Image(**image_data)
        db.add(image)
        await db.commit()
        await db.refresh(image)
        return image
    
    async def get_image_by_id(
        self, 
        db: AsyncSession, 
        image_id: int,
        include_relations: bool = False
    ) -> Optional[Image]:
        """
        通过ID获取图片
        
        Args:
            db: 数据库会话
            image_id: 图片ID
            include_relations: 是否包含关联的模块和创建者信息
            
        Returns:
            图片对象，未找到则返回None
        """
        if include_relations:
            query = select(Image).options(
                selectinload(Image.creator),
                selectinload(Image.module)
            ).where(Image.id == image_id)
        else:
            query = select(Image).where(Image.id == image_id)
            
        result = await db.execute(query)
        return result.scalars().first()
    
    async def get_images_by_module_id(
        self, 
        db: AsyncSession, 
        module_id: int
    ) -> List[Image]:
        """
        获取指定模块关联的所有图片
        
        Args:
            db: 数据库会话
            module_id: 模块ID
            
        Returns:
            图片对象列表
        """
        query = select(Image).where(Image.module_id == module_id)
        result = await db.execute(query)
        return list(result.scalars().all())
    
    async def delete_image(
        self, 
        db: AsyncSession, 
        image_id: int
    ) -> bool:
        """
        删除图片记录
        
        Args:
            db: 数据库会话
            image_id: 图片ID
            
        Returns:
            删除成功返回True，否则返回False
        """
        query = delete(Image).where(Image.id == image_id)
        result = await db.execute(query)
        await db.commit()
        
        return result.rowcount > 0
    
    async def get_all_images(
        self, 
        db: AsyncSession, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[Image]:
        """
        获取所有图片，支持分页
        
        Args:
            db: 数据库会话
            skip: 跳过数量
            limit: 限制数量
            
        Returns:
            图片对象列表
        """
        query = select(Image).offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())


image_repository = ImageRepository(Image) 