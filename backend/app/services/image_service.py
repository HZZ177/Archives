import os
import shutil
import uuid
from typing import List, Optional, Tuple

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.core.logger import logger
from backend.app.models.document import Document, Image
from backend.app.models.user import User
from backend.app.repositories.image_repository import image_repository
from backend.app.services.document_service import document_service


class ImageService:
    """
    图片相关的业务逻辑服务
    """
    
    async def _validate_document_permission(
        self,
        db: AsyncSession,
        document_id: int,
        user: User
    ) -> Document:
        """
        验证用户是否有权限访问文档
        
        :raises: HTTPException 如果文档不存在或用户无权限
        """
        # 调用document_service的权限检查方法
        has_permission, document, error_msg = await document_service.check_document_permission(
            db, document_id, user
        )
        
        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_msg
            )
            
        return document
    
    async def upload_image(
        self,
        db: AsyncSession,
        file: UploadFile,
        document_id: int,
        user: User,
        section_id: Optional[int] = None
    ) -> Image:
        """
        上传图片
        
        :param db: 数据库会话
        :param file: 上传的文件
        :param document_id: 文档ID
        :param user: 当前用户
        :param section_id: 章节ID (可选)
        :return: 创建的图片记录
        """
        try:
            # 验证文档权限
            await self._validate_document_permission(db, document_id, user)
            
            # 验证文件类型
            if not file.content_type.startswith("image/"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="只能上传图片文件"
                )
            
            # 处理文件保存
            filename, file_path, file_url = await self._save_file(file)
            
            # 创建图片记录
            image = await image_repository.create_image(
                db, filename, file_path, file_url, document_id, section_id
            )
            
            return image
            
        except HTTPException:
            # 重新抛出HTTP异常
            raise
        except Exception as e:
            logger.error(f"上传图片失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"上传图片失败: {str(e)}"
            )
    
    async def _save_file(self, file: UploadFile) -> Tuple[str, str, str]:
        """
        保存上传的文件到磁盘
        
        :param file: 上传的文件
        :return: (文件名, 文件路径, URL路径)
        """
        try:
            # 创建上传目录
            uploads_dir = os.path.join(settings.STATIC_DIR, "uploads")
            os.makedirs(uploads_dir, exist_ok=True)
            
            # 生成文件名
            file_extension = os.path.splitext(file.filename)[1]
            filename = f"{uuid.uuid4()}{file_extension}"
            file_location = os.path.join(uploads_dir, filename)
            
            # 保存文件
            with open(file_location, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # 生成URL路径
            file_url = f"{settings.API_V1_STR}/static/uploads/{filename}"
            
            return filename, file_location, file_url
            
        except Exception as e:
            logger.error(f"保存文件失败: {str(e)}")
            raise
    
    async def get_document_images(
        self,
        db: AsyncSession,
        document_id: int,
        user: User
    ) -> List[Image]:
        """
        获取文档的所有图片
        
        :param db: 数据库会话
        :param document_id: 文档ID
        :param user: 当前用户
        :return: 图片列表
        """
        try:
            # 验证文档权限
            await self._validate_document_permission(db, document_id, user)
            
            # 获取图片列表
            images = await image_repository.get_by_document_id(db, document_id)
            return images
            
        except HTTPException:
            # 重新抛出HTTP异常
            raise
        except Exception as e:
            logger.error(f"获取文档图片失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取文档图片失败: {str(e)}"
            )
    
    async def get_image(
        self,
        db: AsyncSession,
        image_id: int,
        user: User
    ) -> Image:
        """
        获取特定图片
        
        :param db: 数据库会话
        :param image_id: 图片ID
        :param user: 当前用户
        :return: 图片对象
        """
        try:
            # 查询图片
            image = await image_repository.get(db, image_id)
            
            if not image:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="图片不存在"
                )
            
            # 验证文档权限
            await self._validate_document_permission(db, image.document_id, user)
            
            return image
            
        except HTTPException:
            # 重新抛出HTTP异常
            raise
        except Exception as e:
            logger.error(f"获取图片详情失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取图片详情失败: {str(e)}"
            )
    
    async def delete_image(
        self,
        db: AsyncSession,
        image_id: int,
        user: User
    ) -> bool:
        """
        删除图片
        
        :param db: 数据库会话
        :param image_id: 图片ID
        :param user: 当前用户
        :return: 是否成功删除
        """
        try:
            # 查询图片
            image = await image_repository.get(db, image_id)
            
            if not image:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="图片不存在"
                )
            
            # 验证文档权限
            await self._validate_document_permission(db, image.document_id, user)
            
            # 删除文件
            try:
                os.remove(image.file_path)
            except OSError:
                # 文件可能已经被删除，忽略错误
                logger.warning(f"删除图片文件失败: {image.file_path}")
            
            # 删除数据库记录
            await image_repository.remove(db, id=image_id)
            
            return True
            
        except HTTPException:
            # 重新抛出HTTP异常
            raise
        except Exception as e:
            logger.error(f"删除图片失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除图片失败: {str(e)}"
            )


# 创建图片服务实例
image_service = ImageService() 