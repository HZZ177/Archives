from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_current_admin_user, get_db
from backend.app.models.document import Template
from backend.app.models.user import User
from backend.app.schemas.template import TemplateCreate, TemplateResponse, TemplateUpdate

router = APIRouter()


@router.get("/", response_model=List[TemplateResponse])
async def read_templates(
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)],
        skip: int = 0,
        limit: int = 100
):
    """
    获取所有模板列表
    """
    result = await db.execute(select(Template).offset(skip).limit(limit))
    templates = result.scalars().all()
    return templates


@router.post("/", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
        template_in: TemplateCreate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_admin_user)]
):
    """
    创建新模板
    """
    # 创建新模板
    db_template = Template(
        name=template_in.name,
        description=template_in.description,
        structure=template_in.structure
    )

    db.add(db_template)
    await db.commit()
    await db.refresh(db_template)

    return db_template


@router.get("/{template_id}", response_model=TemplateResponse)
async def read_template(
        template_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取特定模板
    """
    template = await db.get(Template, template_id)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="模板不存在"
        )

    return template


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
        template_id: int,
        template_in: TemplateUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_admin_user)]
):
    """
    更新模板
    """
    template = await db.get(Template, template_id)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="模板不存在"
        )

    # 更新模板数据
    update_data = template_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(template, key, value)

    await db.commit()
    await db.refresh(template)

    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
        template_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_admin_user)]
):
    """
    删除模板
    """
    template = await db.get(Template, template_id)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="模板不存在"
        )

    await db.delete(template)
    await db.commit()

    return None
