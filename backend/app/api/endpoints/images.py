from typing import Annotated, List, Optional, Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_db, success_response, error_response
from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.schemas.image import ImageResponse
from backend.app.schemas.response import APIResponse
from backend.app.services.image_service import image_service

router = APIRouter()


@router.post("/upload", response_model=APIResponse[ImageResponse])
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    module_id: Optional[int] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    上传图片接口
    
    支持以下图片格式: jpg, jpeg, png, gif, bmp, webp, svg
    
    Args:
        request: FastAPI Request object
        file: 要上传的图片文件
        module_id: 可选，关联的模块ID
        db: 数据库会话
        current_user: 当前用户
    
    Returns:
        包含图片信息的响应对象
    """
    try:
        if not file.content_type or not file.content_type.startswith('image/'):
            return error_response(message="仅支持上传图片类型的文件", status_code=status.HTTP_400_BAD_REQUEST)
        
        # 从请求动态构建服务主机地址
        server_host = f"{request.url.scheme}://{request.url.netloc}"
        
        # 上传图片
        image, message = await image_service.upload_image(db, file, server_host, current_user, module_id)
        return success_response(data=image, message=message)
    except HTTPException as e:
        logger.error(f"上传图片失败: {str(e.detail)}")
        return error_response(message=str(e.detail), status_code=e.status_code)
    except Exception as e:
        logger.error(f"上传图片失败: {str(e)}")
        return error_response(message=f"上传图片失败: {str(e)}")


@router.get("/{image_id}", response_model=APIResponse[ImageResponse])
async def get_image(
    image_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    获取图片信息
    
    Args:
        image_id: 图片ID
        db: 数据库会话
    
    Returns:
        包含图片信息的响应对象
    """
    try:
        image = await image_service.get_image_by_id(db, image_id)
        if not image:
            return error_response(message=f"图片不存在(ID: {image_id})", status_code=status.HTTP_404_NOT_FOUND)
            
        return success_response(data=image)
    except Exception as e:
        logger.error(f"获取图片信息失败: {str(e)}")
        return error_response(message=f"获取图片信息失败: {str(e)}")


@router.get("/module/{module_id}", response_model=APIResponse[List[ImageResponse]])
async def get_module_images(
    module_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    获取模块关联的所有图片
    
    Args:
        module_id: 模块ID
        db: 数据库会话
    
    Returns:
        包含图片列表的响应对象
    """
    try:
        images = await image_service.get_images_by_module_id(db, module_id)
        return success_response(data=images)
    except Exception as e:
        logger.error(f"获取模块图片失败: {str(e)}")
        return error_response(message=f"获取模块图片失败: {str(e)}")


@router.delete("/{image_id}", response_model=APIResponse[bool])
async def delete_image(
    image_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    删除图片
    
    Args:
        image_id: 图片ID
        db: 数据库会话
        current_user: 当前用户
    
    Returns:
        包含删除结果的响应对象
    """
    try:
        # 检查图片是否存在
        image = await image_service.get_image_by_id(db, image_id)
        if not image:
            return error_response(message=f"图片不存在(ID: {image_id})", status_code=status.HTTP_404_NOT_FOUND)
        
        # 删除图片
        result = await image_service.delete_image(db, image_id)
        if result:
            return success_response(data=True, message="图片删除成功")
        else:
            return error_response(message="图片删除失败", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        logger.error(f"删除图片失败: {str(e)}")
        return error_response(message=f"删除图片失败: {str(e)}") 