import os
import shutil
import uuid
from typing import Annotated, List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_db
from backend.app.core.config import settings
from backend.app.models.document import Document, Image
from backend.app.models.user import User
from backend.app.schemas.image import ImageCreate, ImageResponse

router = APIRouter()


@router.post("/upload", response_model=ImageResponse, status_code=status.HTTP_201_CREATED)
async def upload_image(
        file: UploadFile,
        document_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    上传图片
    """
    # 验证文档
    document = await db.get(Document, document_id)

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文档不存在"
        )

    # 验证用户权限
    if document.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有足够的权限"
        )

    # 验证文件类型
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="只能上传图片文件"
        )

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

    # 创建图片记录
    db_image = Image(
        filename=filename,
        file_path=file_location,
        url=file_url,
        document_id=document_id
    )

    db.add(db_image)
    await db.commit()
    await db.refresh(db_image)

    return db_image


@router.get("/document/{document_id}", response_model=List[ImageResponse])
async def get_document_images(
        document_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取文档的所有图片
    """
    # 验证文档
    document = await db.get(Document, document_id)

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文档不存在"
        )

    # 验证用户权限
    if document.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有足够的权限"
        )

    # 查询图片
    result = await db.execute(
        select(Image).where(Image.document_id == document_id)
    )

    images = result.scalars().all()
    return images


@router.get("/{image_id}", response_model=ImageResponse)
async def get_image(
        image_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取特定图片
    """
    # 查询图片
    image = await db.get(Image, image_id)

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="图片不存在"
        )

    # 验证文档和用户权限
    document = await db.get(Document, image.document_id)

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文档不存在"
        )

    if document.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有足够的权限"
        )

    return image


@router.delete("/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_image(
        image_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    删除图片
    """
    # 查询图片
    image = await db.get(Image, image_id)

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="图片不存在"
        )

    # 验证文档和用户权限
    document = await db.get(Document, image.document_id)

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文档不存在"
        )

    if document.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有足够的权限"
        )

    # 删除文件
    try:
        os.remove(image.file_path)
    except OSError:
        # 文件可能已经被删除，忽略错误
        pass

    # 删除记录
    await db.delete(image)
    await db.commit()

    return None
