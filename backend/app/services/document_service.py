from typing import Optional, Dict, List, Any, Tuple, Union

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.logger import logger
from backend.app.models.document import Document, Section
from backend.app.models.user import User
from backend.app.repositories.document_repository import document_repository
from backend.app.schemas.document import (
    DocumentCreate,
    DocumentUpdate,
    SectionCreate,
    SectionUpdate,
    PaginatedResponse
)


class DocumentService:
    """
    文档相关的业务逻辑服务
    """
    
    async def check_document_permission(
        self,
        db: AsyncSession,
        document_id: int,
        user: User
    ) -> Tuple[bool, Optional[Document], Optional[str]]:
        """
        检查用户是否有权限访问文档
        
        返回: (有权限标志, 文档对象, 错误消息)
        """
        try:
            # 获取文档
            document = await document_repository.get_with_sections(db, document_id)
            
            # 验证文档是否存在
            if not document:
                return False, None, "文档不存在"
            
            # 验证权限（文档所有者或管理员）
            if document.user_id != user.id and not user.is_superuser:
                return False, document, "没有足够的权限"
                
            return True, document, None
        
        except Exception as e:
            logger.error(f"检查文档权限失败: {str(e)}")
            return False, None, f"检查文档权限失败: {str(e)}"
    
    async def get_user_documents(
        self,
        db: AsyncSession,
        user: User,
        page: int = 1,
        page_size: int = 10,
        keyword: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取用户的所有文档
        """
        try:
            # 计算偏移量
            skip = (page - 1) * page_size
            
            # 获取文档数据
            result = await document_repository.get_user_documents(
                db, user.id, skip, page_size, keyword
            )
            
            # 构造返回数据
            return {
                "total": result["total"],
                "page": page,
                "page_size": page_size,
                "items": result["items"]
            }
        
        except Exception as e:
            logger.error(f"获取用户文档列表失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取文档列表失败: {str(e)}"
            )
    
    async def create_document(
        self,
        db: AsyncSession,
        user: User,
        document_data: DocumentCreate
    ) -> Document:
        """
        创建新文档
        """
        try:
            # 构建文档数据
            document_dict = document_data.model_dump()
            document_dict["user_id"] = user.id
            
            # 创建文档
            document = await document_repository.create(db, obj_in=document_dict)
            return document
            
        except Exception as e:
            logger.error(f"创建文档失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建文档失败: {str(e)}"
            )
    
    async def get_document(
        self,
        db: AsyncSession,
        document_id: int,
        user: User
    ) -> Document:
        """
        获取特定文档
        """
        try:
            # 检查权限
            has_permission, document, error_msg = await self.check_document_permission(db, document_id, user)
            
            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=error_msg
                )
                
            return document
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取文档详情失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取文档详情失败: {str(e)}"
            )
    
    async def update_document(
        self,
        db: AsyncSession,
        document_id: int,
        document_data: DocumentUpdate,
        user: User
    ) -> Document:
        """
        更新文档
        """
        try:
            # 检查权限
            has_permission, document, error_msg = await self.check_document_permission(db, document_id, user)
            
            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=error_msg
                )
            
            # 更新文档
            updated_document = await document_repository.update(
                db, db_obj=document, obj_in=document_data
            )
            
            return updated_document
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"更新文档失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新文档失败: {str(e)}"
            )
    
    async def delete_document(
        self,
        db: AsyncSession,
        document_id: int,
        user: User
    ) -> bool:
        """
        删除文档
        """
        try:
            # 检查权限
            has_permission, document, error_msg = await self.check_document_permission(db, document_id, user)
            
            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=error_msg
                )
            
            # 删除文档
            await document_repository.remove(db, id=document_id)
            return True
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"删除文档失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除文档失败: {str(e)}"
            )
    
    # 章节相关方法
    async def get_sections(
        self,
        db: AsyncSession,
        document_id: int,
        user: User
    ) -> List[Section]:
        """
        获取文档的所有章节
        """
        try:
            # 检查文档权限
            has_permission, document, error_msg = await self.check_document_permission(db, document_id, user)
            
            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=error_msg
                )
            
            # 获取章节
            sections = await document_repository.get_sections_by_document_id(db, document_id)
            return sections
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取章节列表失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取章节列表失败: {str(e)}"
            )
    
    async def create_section(
        self,
        db: AsyncSession,
        document_id: int,
        section_data: SectionCreate,
        user: User
    ) -> Section:
        """
        创建新章节
        """
        try:
            # 检查文档权限
            has_permission, document, error_msg = await self.check_document_permission(db, document_id, user)
            
            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=error_msg
                )
            
            # 创建章节
            section = await document_repository.create_section(db, document_id, section_data)
            return section
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"创建章节失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建章节失败: {str(e)}"
            )
    
    async def get_section(
        self,
        db: AsyncSession,
        document_id: int,
        section_id: int,
        user: User
    ) -> Section:
        """
        获取特定章节
        """
        try:
            # 检查文档权限
            has_permission, document, error_msg = await self.check_document_permission(db, document_id, user)
            
            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=error_msg
                )
            
            # 获取章节
            section = await document_repository.get_section(db, document_id, section_id)
            
            if not section:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="章节不存在"
                )
                
            return section
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取章节详情失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取章节详情失败: {str(e)}"
            )
    
    async def update_section(
        self,
        db: AsyncSession,
        document_id: int,
        section_id: int,
        section_data: SectionUpdate,
        user: User
    ) -> Section:
        """
        更新章节
        """
        try:
            # 检查文档权限
            has_permission, document, error_msg = await self.check_document_permission(db, document_id, user)
            
            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=error_msg
                )
            
            # 获取章节
            section = await document_repository.get_section(db, document_id, section_id)
            
            if not section:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="章节不存在"
                )
            
            # 更新章节
            updated_section = await document_repository.update_section(
                db, section=section, section_data=section_data
            )
            
            return updated_section
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"更新章节失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新章节失败: {str(e)}"
            )
    
    async def delete_section(
        self,
        db: AsyncSession,
        document_id: int,
        section_id: int,
        user: User
    ) -> bool:
        """
        删除章节
        """
        try:
            # 检查文档权限
            has_permission, document, error_msg = await self.check_document_permission(db, document_id, user)
            
            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=error_msg
                )
            
            # 获取章节
            section = await document_repository.get_section(db, document_id, section_id)
            
            if not section:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="章节不存在"
                )
            
            # 删除章节
            await document_repository.delete_section(db, section)
            return True
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"删除章节失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除章节失败: {str(e)}"
            )


# 创建文档服务实例
document_service = DocumentService() 