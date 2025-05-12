from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_db, success_response, error_response
from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.schemas.image import ImageResponse
from backend.app.schemas.response import APIResponse
from backend.app.services.image_service import image_service

router = APIRouter()


@router.post("/upload", response_model=APIResponse[ImageResponse], status_code=status.HTTP_201_CREATED)
async def upload_image(
        file: UploadFile,
        document_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)],
        section_id: Optional[int] = None
):
    """
    上传图片
    """
    try:
        # 调用服务层处理图片上传
        image = await image_service.upload_image(
            db, file, document_id, current_user, section_id
        )
        
        return success_response(data=image, message="图片上传成功")
    except Exception as e:
        logger.error(f"上传图片失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"上传图片失败: {str(e)}")


@router.get("/document/{document_id}", response_model=APIResponse[List[ImageResponse]])
async def get_document_images(
        document_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取文档的所有图片
    """
    try:
        # 调用服务层获取文档图片
        images = await image_service.get_document_images(
            db, document_id, current_user
        )
        
        return success_response(data=images)
    except Exception as e:
        logger.error(f"获取文档图片失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"获取文档图片失败: {str(e)}")


@router.get("/{image_id}", response_model=APIResponse[ImageResponse])
async def get_image(
        image_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取特定图片
    """
    try:
        # 调用服务层获取图片
        image = await image_service.get_image(
            db, image_id, current_user
        )
        
        return success_response(data=image)
    except Exception as e:
        logger.error(f"获取图片详情失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"获取图片详情失败: {str(e)}")


@router.delete("/{image_id}", response_model=APIResponse)
async def delete_image(
        image_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    删除图片
    """
    try:
        # 调用服务层删除图片
        await image_service.delete_image(
            db, image_id, current_user
        )
        
        return success_response(message="图片删除成功")
    except Exception as e:
        logger.error(f"删除图片失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"删除图片失败: {str(e)}")
