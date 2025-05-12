from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_db, success_response, error_response
from backend.app.core.logger import logger
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
from backend.app.schemas.response import APIResponse
from backend.app.services.document_service import document_service

router = APIRouter()


# 文档操作
@router.get("/", response_model=APIResponse[PaginatedResponse])
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
    try:
        # 调用服务层获取文档列表
        document_data = await document_service.get_user_documents(
            db, current_user, page, page_size, keyword
        )
        
        return success_response(data=document_data)
    except Exception as e:
        logger.error(f"获取文档列表失败: {str(e)}")
        return error_response(message=f"获取文档列表失败: {str(e)}")


@router.post("/", response_model=APIResponse[DocumentResponse], status_code=status.HTTP_201_CREATED)
async def create_document(
        document_in: DocumentCreate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    创建新文档
    """
    try:
        # 调用服务层创建文档
        document = await document_service.create_document(
            db, current_user, document_in
        )
        
        return success_response(data=document, message="文档创建成功")
    except Exception as e:
        logger.error(f"创建文档失败: {str(e)}")
        return error_response(message=f"创建文档失败: {str(e)}")


@router.get("/{document_id}", response_model=APIResponse[DocumentResponse])
async def read_document(
        document_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取特定文档
    """
    try:
        # 调用服务层获取文档
        document = await document_service.get_document(
            db, document_id, current_user
        )
        
        return success_response(data=document)
    except Exception as e:
        logger.error(f"获取文档详情失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"获取文档详情失败: {str(e)}")


@router.put("/{document_id}", response_model=APIResponse[DocumentResponse])
async def update_document(
        document_id: int,
        document_in: DocumentUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新文档
    """
    try:
        # 调用服务层更新文档
        document = await document_service.update_document(
            db, document_id, document_in, current_user
        )
        
        return success_response(data=document, message="文档更新成功")
    except Exception as e:
        logger.error(f"更新文档失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"更新文档失败: {str(e)}")


@router.delete("/{document_id}", response_model=APIResponse)
async def delete_document(
        document_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    删除文档
    """
    try:
        # 调用服务层删除文档
        await document_service.delete_document(
            db, document_id, current_user
        )
        
        return success_response(message="文档删除成功")
    except Exception as e:
        logger.error(f"删除文档失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"删除文档失败: {str(e)}")


# 章节操作
@router.post("/{document_id}/sections", response_model=APIResponse[SectionResponse], status_code=status.HTTP_201_CREATED)
async def create_section(
        document_id: int,
        section_in: SectionCreate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    创建新章节
    """
    try:
        # 调用服务层创建章节
        section = await document_service.create_section(
            db, document_id, section_in, current_user
        )
        
        return success_response(data=section, message="章节创建成功")
    except Exception as e:
        logger.error(f"创建章节失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"创建章节失败: {str(e)}")


@router.get("/{document_id}/sections", response_model=APIResponse[List[SectionResponse]])
async def read_sections(
        document_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取文档的所有章节
    """
    try:
        # 调用服务层获取章节
        sections = await document_service.get_sections(
            db, document_id, current_user
        )
        
        return success_response(data=sections)
    except Exception as e:
        logger.error(f"获取章节列表失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"获取章节列表失败: {str(e)}")


@router.get("/{document_id}/sections/{section_id}", response_model=APIResponse[SectionResponse])
async def read_section(
        document_id: int,
        section_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取特定章节
    """
    try:
        # 调用服务层获取特定章节
        section = await document_service.get_section(
            db, document_id, section_id, current_user
        )
        
        return success_response(data=section)
    except Exception as e:
        logger.error(f"获取章节详情失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"获取章节详情失败: {str(e)}")


@router.put("/{document_id}/sections/{section_id}", response_model=APIResponse[SectionResponse])
async def update_section(
        document_id: int,
        section_id: int,
        section_in: SectionUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新章节
    """
    try:
        # 调用服务层更新章节
        section = await document_service.update_section(
            db, document_id, section_id, section_in, current_user
        )
        
        return success_response(data=section, message="章节更新成功")
    except Exception as e:
        logger.error(f"更新章节失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"更新章节失败: {str(e)}")


@router.delete("/{document_id}/sections/{section_id}", response_model=APIResponse)
async def delete_section(
        document_id: int,
        section_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    删除章节
    """
    try:
        # 调用服务层删除章节
        await document_service.delete_section(
            db, document_id, section_id, current_user
        )
        
        return success_response(message="章节删除成功")
    except Exception as e:
        logger.error(f"删除章节失败: {str(e)}")
        return error_response(message=str(e) if hasattr(e, "detail") else f"删除章节失败: {str(e)}")
