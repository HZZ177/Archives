from typing import Annotated

from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_db, success_response, error_response
from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.schemas.module_content import (
    ModuleContentResponse,
    ModuleContentUpdate
)
from backend.app.schemas.response import APIResponse
from backend.app.services.module_content_service import module_content_service

router = APIRouter()


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
        # 调用服务层获取模块内容
        content = await module_content_service.get_module_content(
            db, module_node_id
        )
        
        return success_response(data=content)
    except Exception as e:
        logger.error(f"获取模块内容失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"获取模块内容失败: {str(e)}")


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
        # 调用服务层创建或更新模块内容
        content, message = await module_content_service.upsert_module_content(
            db, module_node_id, content_in, current_user
        )
        
        return success_response(data=content, message=message)
    except Exception as e:
        logger.error(f"更新模块内容失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"更新模块内容失败: {str(e)}")


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
        # 调用服务层上传模块图片
        content, message = await module_content_service.upload_diagram_image(
            db, module_node_id, file, current_user
        )
        
        return success_response(data=content, message=message)
    except Exception as e:
        logger.error(f"上传模块图片失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"上传模块图片失败: {str(e)}")


@router.delete("/delete-diagram/{module_node_id}", response_model=APIResponse[ModuleContentResponse])
async def delete_diagram_image(
        module_node_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    删除模块的逻辑图/数据流向图
    """
    try:
        # 调用服务层删除模块图片
        content, message = await module_content_service.delete_diagram_image(
            db, module_node_id, current_user
        )
        
        return success_response(data=content, message=message)
    except Exception as e:
        logger.error(f"删除模块图片失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"删除模块图片失败: {str(e)}") 