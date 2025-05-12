import os
import shutil
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy import select, exists
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_db, success_response, error_response
from backend.app.core.logger import logger
from backend.app.models.module_structure import ModuleStructureNode
from backend.app.models.module_content import ModuleContent
from backend.app.models.user import User
from backend.app.schemas.module_content import (
    ModuleContentCreate,
    ModuleContentResponse,
    ModuleContentUpdate
)
from backend.app.schemas.response import APIResponse

router = APIRouter()

# 确保上传目录存在
UPLOAD_DIR = "uploads/module_diagrams"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.get("/by-node/{module_node_id}", response_model=APIResponse[ModuleContentResponse])
async def read_module_content(
        module_node_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取特定模块节点的内容
    """
    try:
        # 验证模块节点存在
        node_exists = await db.execute(
            select(exists().where(ModuleStructureNode.id == module_node_id))
        )
        if not node_exists.scalar():
            return error_response(message="模块节点不存在")

        # 查询模块内容
        result = await db.execute(
            select(ModuleContent).where(ModuleContent.module_node_id == module_node_id)
        )
        content = result.scalar_one_or_none()

        # 如果内容不存在，返回404
        if not content:
            return error_response(message="模块内容不存在")

        return success_response(data=content)
    except Exception as e:
        logger.error(f"获取模块内容失败: {str(e)}")
        return error_response(message=f"获取模块内容失败: {str(e)}")


@router.post("/update/by-node/{module_node_id}", response_model=APIResponse[ModuleContentResponse])
async def upsert_module_content(
        module_node_id: int,
        content_in: ModuleContentUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    创建或更新特定模块节点的内容
    """
    try:
        # 验证模块节点存在
        node_exists = await db.execute(
            select(exists().where(ModuleStructureNode.id == module_node_id))
        )
        if not node_exists.scalar():
            return error_response(message="模块节点不存在")

        # 查询是否已存在内容
        result = await db.execute(
            select(ModuleContent).where(ModuleContent.module_node_id == module_node_id)
        )
        content = result.scalar_one_or_none()

        if content:
            # 更新已有内容
            update_data = content_in.dict(exclude_unset=True)
            for key, value in update_data.items():
                setattr(content, key, value)
            
            # 更新最后修改者
            content.user_id = current_user.id
            message = "模块内容更新成功"
        else:
            # 创建新内容
            content = ModuleContent(
                module_node_id=module_node_id,
                user_id=current_user.id,
                **content_in.dict(exclude_unset=True)
            )
            db.add(content)
            message = "模块内容创建成功"

        await db.commit()
        await db.refresh(content)

        return success_response(data=content, message=message)
    except Exception as e:
        logger.error(f"更新模块内容失败: {str(e)}")
        return error_response(message=f"更新模块内容失败: {str(e)}")


@router.post("/upload-diagram/{module_node_id}", response_model=APIResponse[ModuleContentResponse])
async def upload_diagram_image(
        module_node_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)],
        file: UploadFile = File(...)
):
    """
    上传模块的逻辑图/数据流向图
    """
    try:
        # 验证模块节点存在
        node_exists = await db.execute(
            select(exists().where(ModuleStructureNode.id == module_node_id))
        )
        if not node_exists.scalar():
            return error_response(message="模块节点不存在")

        # 验证文件类型
        allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/svg+xml"]
        if file.content_type not in allowed_types:
            return error_response(
                message=f"文件类型不支持: {file.content_type}. 允许的类型: {', '.join(allowed_types)}"
            )

        # 生成文件路径
        filename = f"{module_node_id}_{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        file_url = f"/uploads/module_diagrams/{filename}"

        # 保存文件
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            logger.error(f"保存文件失败: {str(e)}")
            return error_response(message=f"上传文件失败: {str(e)}")
        finally:
            file.file.close()

        # 查询或创建模块内容
        result = await db.execute(
            select(ModuleContent).where(ModuleContent.module_node_id == module_node_id)
        )
        content = result.scalar_one_or_none()

        if content:
            # 更新图片路径
            content.diagram_image_path = file_url
            content.user_id = current_user.id
            message = "模块图片更新成功"
        else:
            # 创建新内容
            content = ModuleContent(
                module_node_id=module_node_id,
                diagram_image_path=file_url,
                user_id=current_user.id
            )
            db.add(content)
            message = "模块图片上传成功"

        await db.commit()
        await db.refresh(content)

        return success_response(data=content, message=message)
    except Exception as e:
        logger.error(f"上传模块图片失败: {str(e)}")
        return error_response(message=f"上传模块图片失败: {str(e)}") 