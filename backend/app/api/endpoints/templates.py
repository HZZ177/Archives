from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_current_admin_user, get_db, success_response, error_response
from backend.app.core.logger import logger
from backend.app.models.user import User
from backend.app.schemas.template import TemplateCreate, TemplateResponse, TemplateUpdate
from backend.app.schemas.response import APIResponse
from backend.app.services.template_service import template_service

router = APIRouter()


@router.get("/", response_model=APIResponse[List[TemplateResponse]])
async def read_templates(
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)],
        skip: int = 0,
        limit: int = 100
):
    """
    获取所有模板列表
    """
    try:
        templates = await template_service.get_templates_list(db, skip, limit)
        return success_response(data=templates)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取模板列表失败: {str(e)}")
        return error_response(message=f"获取模板列表失败: {str(e)}")


@router.post("/", response_model=APIResponse[TemplateResponse], status_code=status.HTTP_201_CREATED)
async def create_template(
        template_in: TemplateCreate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_admin_user)]
):
    """
    创建新模板
    """
    try:
        template = await template_service.create_template(db, template_in, current_user)
        return success_response(data=template, message="模板创建成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"创建模板失败: {str(e)}")
        return error_response(message=f"创建模板失败: {str(e)}")


@router.get("/{template_id}", response_model=APIResponse[TemplateResponse])
async def read_template(
        template_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取特定模板
    """
    try:
        template = await template_service.get_template(db, template_id)
        return success_response(data=template)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"获取模板详情失败: {str(e)}")
        return error_response(message=f"获取模板详情失败: {str(e)}")


@router.put("/{template_id}", response_model=APIResponse[TemplateResponse])
async def update_template(
        template_id: int,
        template_in: TemplateUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_admin_user)]
):
    """
    更新模板
    """
    try:
        template = await template_service.update_template(db, template_id, template_in, current_user)
        return success_response(data=template, message="模板更新成功")
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"更新模板失败: {str(e)}")
        return error_response(message=f"更新模板失败: {str(e)}")


@router.delete("/{template_id}", response_model=APIResponse)
async def delete_template(
        template_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_admin_user)]
):
    """
    删除模板
    """
    try:
        message = await template_service.delete_template(db, template_id, current_user)
        return success_response(message=message)
    except HTTPException as e:
        return error_response(message=e.detail)
    except Exception as e:
        logger.error(f"删除模板失败: {str(e)}")
        return error_response(message=f"删除模板失败: {str(e)}")
