from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.api.deps import get_current_active_user, get_db
from backend.app.models.document import Document, Section
from backend.app.models.user import User
from backend.app.schemas.document import (
    DocumentCreate,
    DocumentResponse,
    DocumentUpdate,
    SectionCreate,
    SectionResponse,
    SectionUpdate,
    PaginatedResponse
)

router = APIRouter()


# 文档操作
@router.get("/", response_model=PaginatedResponse)
async def read_documents(
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)],
        page: int = 1,
        page_size: int = 10,
        keyword: Optional[str] = None
):
    """
    获取所有文档列表
    """
    # 计算偏移量
    skip = (page - 1) * page_size

    # 构建基础查询
    query = select(Document).where(Document.user_id == current_user.id)

    # 如果有关键字，添加搜索条件
    if keyword:
        query = query.where(
            or_(
                Document.title.ilike(f"%{keyword}%"),
                Document.description.ilike(f"%{keyword}%")
            )
        )

    # 查询总数
    total_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(total_query)

    # 查询指定用户的所有文档
    result = await db.execute(
        query
        .options(selectinload(Document.sections))
        .offset(skip)
        .limit(page_size)
    )

    documents = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": documents
    }


@router.post("/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_document(
        document_in: DocumentCreate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    创建新文档
    """
    # 创建新文档
    db_document = Document(
        title=document_in.title,
        description=document_in.description,
        user_id=current_user.id,
        template_id=document_in.template_id
    )

    db.add(db_document)
    await db.commit()
    await db.refresh(db_document)

    return db_document


@router.get("/{document_id}", response_model=DocumentResponse)
async def read_document(
        document_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取特定文档
    """
    # 查询文档，包括部分
    result = await db.execute(
        select(Document)
        .where(Document.id == document_id)
        .options(selectinload(Document.sections))
    )

    document = result.scalar_one_or_none()

    # 验证文档是否存在
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文档不存在"
        )

    # 验证权限
    if document.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有足够的权限"
        )

    return document


@router.put("/{document_id}", response_model=DocumentResponse)
async def update_document(
        document_id: int,
        document_in: DocumentUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新文档
    """
    # 查询文档
    document = await db.get(Document, document_id)

    # 验证文档是否存在
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文档不存在"
        )

    # 验证权限
    if document.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有足够的权限"
        )

    # 更新文档
    update_data = document_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(document, key, value)

    await db.commit()
    await db.refresh(document)

    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
        document_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    删除文档
    """
    # 查询文档
    document = await db.get(Document, document_id)

    # 验证文档是否存在
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文档不存在"
        )

    # 验证权限
    if document.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有足够的权限"
        )

    # 删除文档
    await db.delete(document)
    await db.commit()

    return None


# 文档部分操作
@router.post("/{document_id}/sections", response_model=SectionResponse, status_code=status.HTTP_201_CREATED)
async def create_section(
        document_id: int,
        section_in: SectionCreate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    为文档添加部分
    """
    # 查询文档
    document = await db.get(Document, document_id)

    # 验证文档是否存在
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文档不存在"
        )

    # 验证权限
    if document.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有足够的权限"
        )

    # 创建部分
    db_section = Section(
        title=section_in.title,
        content=section_in.content,
        document_id=document_id,
        order=section_in.order
    )

    db.add(db_section)
    await db.commit()
    await db.refresh(db_section)

    return db_section


@router.get("/{document_id}/sections", response_model=List[SectionResponse])
async def read_sections(
        document_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取文档的所有部分
    """
    # 查询文档
    document = await db.get(Document, document_id)

    # 验证文档是否存在
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文档不存在"
        )

    # 验证权限
    if document.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有足够的权限"
        )

    # 查询部分
    result = await db.execute(
        select(Section)
        .where(Section.document_id == document_id)
        .order_by(Section.order)
    )

    sections = result.scalars().all()
    return sections


@router.get("/{document_id}/sections/{section_id}", response_model=SectionResponse)
async def read_section(
        document_id: int,
        section_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取特定部分
    """
    # 查询部分
    section = await db.get(Section, section_id)

    # 验证部分是否存在
    if not section or section.document_id != document_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="部分不存在"
        )

    # 验证文档权限
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()

    if not document or (document.user_id != current_user.id and not current_user.is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有足够的权限"
        )

    return section


@router.put("/{document_id}/sections/{section_id}", response_model=SectionResponse)
async def update_section(
        document_id: int,
        section_id: int,
        section_in: SectionUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新部分
    """
    # 查询部分
    section = await db.get(Section, section_id)

    # 验证部分是否存在
    if not section or section.document_id != document_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="部分不存在"
        )

    # 验证文档权限
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()

    if not document or (document.user_id != current_user.id and not current_user.is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有足够的权限"
        )

    # 更新部分
    update_data = section_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(section, key, value)

    await db.commit()
    await db.refresh(section)

    return section


@router.delete("/{document_id}/sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_section(
        document_id: int,
        section_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    删除部分
    """
    # 查询部分
    section = await db.get(Section, section_id)

    # 验证部分是否存在
    if not section or section.document_id != document_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="部分不存在"
        )

    # 验证文档权限
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()

    if not document or (document.user_id != current_user.id and not current_user.is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有足够的权限"
        )

    # 删除部分
    await db.delete(section)
    await db.commit()

    return None
