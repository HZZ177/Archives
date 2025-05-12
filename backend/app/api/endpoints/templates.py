from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_current_admin_user, get_db, success_response, error_response
from backend.app.core.logger import logger
from backend.app.models.document import Template
from backend.app.models.user import User
from backend.app.schemas.template import TemplateCreate, TemplateResponse, TemplateUpdate
from backend.app.schemas.response import APIResponse

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
        result = await db.execute(select(Template).offset(skip).limit(limit))
        templates = result.scalars().all()
        return success_response(data=templates)
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
        # 创建新模板
        db_template = Template(
            name=template_in.name,
            description=template_in.description,
            structure=template_in.structure
        )

        db.add(db_template)
        await db.commit()
        await db.refresh(db_template)

        return success_response(data=db_template, message="模板创建成功")
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
        template = await db.get(Template, template_id)

        if not template:
            return error_response(message="模板不存在")

        return success_response(data=template)
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
        template = await db.get(Template, template_id)

        if not template:
            return error_response(message="模板不存在")

        # 更新模板数据
        update_data = template_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(template, key, value)

        await db.commit()
        await db.refresh(template)

        return success_response(data=template, message="模板更新成功")
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
        template = await db.get(Template, template_id)

        if not template:
            return error_response(message="模板不存在")

        await db.delete(template)
        await db.commit()

        return success_response(message="模板删除成功")
    except Exception as e:
        logger.error(f"删除模板失败: {str(e)}")
        return error_response(message=f"删除模板失败: {str(e)}")
