import os
import uuid
import shutil
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from pathlib import Path
from fastapi import UploadFile, HTTPException, status

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.repositories.image_repository import image_repository
from backend.app.schemas.image import ImageResponse


class ImageService:
    """
    图片服务层
    负责图片上传、获取等业务逻辑
    """
    
    async def upload_image(
        self,
        db: AsyncSession,
        file: UploadFile,
        server_host: str,
        current_user: Optional[User] = None,
        module_id: Optional[int] = None
    ) -> Tuple[ImageResponse, str]:
        """
        上传图片
        
        Args:
            db: 数据库会话
            file: 上传的文件对象
            server_host: 服务器主机地址 (例如: http://localhost:8000)
            current_user: 当前用户
            module_id: 关联的模块ID
            
        Returns:
            图片对象和消息
        """
        # 创建保存目录
        today = datetime.now().strftime("%Y%m%d")
        save_dir = f"uploads/images/{today}"
        os.makedirs(save_dir, exist_ok=True)
        
        # 生成唯一文件名以避免覆盖
        file_ext = self._get_file_extension(file.filename)
        if not file_ext:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不支持的文件类型"
            )
            
        unique_filename = f"{uuid.uuid4().hex}{file_ext}"
        file_path = os.path.join(save_dir, unique_filename)
        
        # 保存文件
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            logger.error(f"保存文件失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"保存文件失败: {str(e)}"
            )
        finally:
            await file.close()
        
        # 获取文件大小
        file_size = os.path.getsize(file_path)
        
        # 图片访问URL
        image_url = f"{server_host}/uploads/images/{today}/{unique_filename}"
        
        # 保存图片信息到数据库
        image_data = {
            "filename": file.filename,
            "file_path": file_path,
            "url": image_url,
            "file_size": file_size,
            "mime_type": file.content_type,
            "created_by": current_user.id if current_user else None,
            "module_id": module_id,
        }
        
        try:
            image = await image_repository.create_image(db, image_data)
            return ImageResponse.from_orm(image), "图片上传成功"
        except Exception as e:
            # 如果数据库操作失败，删除已上传的文件
            if os.path.exists(file_path):
                os.remove(file_path)
            logger.error(f"保存图片信息失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"保存图片信息失败: {str(e)}"
            )
    
    async def get_image_by_id(
        self,
        db: AsyncSession,
        image_id: int,
        include_relations: bool = False
    ) -> Optional[ImageResponse]:
        """
        通过ID获取图片
        
        Args:
            db: 数据库会话
            image_id: 图片ID
            include_relations: 是否包含关联信息
            
        Returns:
            图片对象，未找到则返回None
        """
        image = await image_repository.get_image_by_id(db, image_id, include_relations)
        if not image:
            return None
        return ImageResponse.from_orm(image)
    
    async def get_images_by_module_id(
        self,
        db: AsyncSession,
        module_id: int
    ) -> List[ImageResponse]:
        """
        获取指定模块关联的所有图片
        
        Args:
            db: 数据库会话
            module_id: 模块ID
            
        Returns:
            图片对象列表
        """
        images = await image_repository.get_images_by_module_id(db, module_id)
        return [ImageResponse.from_orm(image) for image in images]
    
    async def delete_image(
        self,
        db: AsyncSession,
        image_id: int
    ) -> bool:
        """
        删除图片
        
        Args:
            db: 数据库会话
            image_id: 图片ID
            
        Returns:
            删除成功返回True，否则返回False
        """
        # 先获取图片信息
        image = await image_repository.get_image_by_id(db, image_id)
        if not image:
            return False
        
        # 删除文件
        if os.path.exists(image.file_path):
            try:
                os.remove(image.file_path)
            except Exception as e:
                logger.error(f"删除文件失败: {str(e)}")
                # 继续执行删除数据库记录，即使文件删除失败
        
        # 删除数据库记录
        return await image_repository.delete_image(db, image_id)
    
    def _get_file_extension(self, filename: Optional[str]) -> Optional[str]:
        """
        获取文件扩展名
        
        Args:
            filename: 文件名
            
        Returns:
            文件扩展名，以.开头，例如.jpg
        """
        if not filename:
            return None
            
        # 确保文件名是字符串
        if not isinstance(filename, str):
            return None
            
        # 获取文件扩展名
        ext = os.path.splitext(filename)[1].lower()
        
        # 检查是否是支持的图片扩展名
        allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']
        if ext in allowed_extensions:
            return ext
            
        return None


image_service = ImageService() 