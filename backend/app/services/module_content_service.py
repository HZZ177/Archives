import os
import shutil
from typing import Optional, List, Tuple

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.core.logger import logger
from backend.app.models.module_content import ModuleContent
from backend.app.models.user import User
from backend.app.repositories.module_content_repository import module_content_repository
from backend.app.schemas.module_content import ModuleContentUpdate


# 确保上传目录存在
UPLOAD_DIR = "uploads/module_diagrams"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class ModuleContentService:
    """
    模块内容相关的业务逻辑服务
    """
    
    async def validate_module_node(
        self,
        db: AsyncSession,
        module_node_id: int
    ) -> bool:
        """
        验证模块节点是否存在
        
        :raises: HTTPException 如果节点不存在
        """
        node_exists = await module_content_repository.check_node_exists(db, module_node_id)
        if not node_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="模块节点不存在"
            )
        return True
    
    async def get_module_content(
        self,
        db: AsyncSession,
        module_node_id: int
    ) -> ModuleContent:
        """
        获取特定模块节点的内容
        
        :param db: 数据库会话
        :param module_node_id: 模块节点ID
        :return: 模块内容对象
        """
        try:
            # 验证模块节点存在
            await self.validate_module_node(db, module_node_id)
            
            # 获取模块内容
            content = await module_content_repository.get_by_node_id(db, module_node_id)
            
            if not content:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="模块内容不存在"
                )
            
            return content
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取模块内容失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取模块内容失败: {str(e)}"
            )
    
    async def upsert_module_content(
        self,
        db: AsyncSession,
        module_node_id: int,
        content_data: ModuleContentUpdate,
        user: User
    ) -> Tuple[ModuleContent, str]:
        """
        创建或更新特定模块节点的内容
        
        :param db: 数据库会话
        :param module_node_id: 模块节点ID
        :param content_data: 内容更新数据
        :param user: 当前用户
        :return: (模块内容对象, 操作消息)
        """
        try:
            # 验证模块节点存在
            await self.validate_module_node(db, module_node_id)
            
            # 检查是否已存在内容
            existing_content = await module_content_repository.get_by_node_id(db, module_node_id)
            
            # 执行更新或创建
            content = await module_content_repository.upsert_content(
                db, module_node_id, user.id, content_data
            )
            
            # 根据操作类型返回相应消息
            message = "模块内容更新成功" if existing_content else "模块内容创建成功"
            
            return content, message
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"更新模块内容失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新模块内容失败: {str(e)}"
            )
    
    async def upload_diagram_image(
        self,
        db: AsyncSession,
        module_node_id: int,
        file: UploadFile,
        user: User
    ) -> Tuple[ModuleContent, str]:
        """
        上传模块的图片
        
        :param db: 数据库会话
        :param module_node_id: 模块节点ID
        :param file: 上传的文件
        :param user: 当前用户
        :return: (模块内容对象, 操作消息)
        """
        try:
            # 验证模块节点存在
            await self.validate_module_node(db, module_node_id)
            
            # 验证文件类型
            await self._validate_image_file(file)
            
            # 保存文件并获取路径
            file_url = await self._save_image_file(module_node_id, file)
            
            # 检查是否已存在内容
            existing_content = await module_content_repository.get_by_node_id(db, module_node_id)
            
            # 更新图片路径
            content = await module_content_repository.update_diagram_image(
                db, module_node_id, user.id, file_url
            )
            
            # 根据操作类型返回相应消息
            message = "模块图片更新成功" if existing_content else "模块图片上传成功"
            
            return content, message
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"上传模块图片失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"上传模块图片失败: {str(e)}"
            )
    
    async def _validate_image_file(self, file: UploadFile) -> bool:
        """
        验证上传的文件是否为支持的图片类型
        
        :param file: 上传的文件
        :raises: HTTPException 如果文件类型不支持
        """
        allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/svg+xml"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"文件类型不支持: {file.content_type}. 允许的类型: {', '.join(allowed_types)}"
            )
        return True
    
    async def _save_image_file(self, module_node_id: int, file: UploadFile) -> str:
        """
        保存上传的图片文件
        
        :param module_node_id: 模块节点ID
        :param file: 上传的文件
        :return: 文件URL路径
        """
        try:
            # 生成文件路径
            filename = f"{module_node_id}_{file.filename}"
            file_path = os.path.join(UPLOAD_DIR, filename)
            
            # 修改URL生成逻辑，移除API_V1_STR前缀
            file_url = f"/uploads/module_diagrams/{filename}"
            
            # 保存文件
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            return file_url
            
        except Exception as e:
            logger.error(f"保存文件失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"上传文件失败: {str(e)}"
            )
        finally:
            file.file.close()
    
    async def delete_diagram_image(
        self,
        db: AsyncSession,
        module_node_id: int,
        user: User
    ) -> Tuple[ModuleContent, str]:
        """
        删除模块的图片
        
        :param db: 数据库会话
        :param module_node_id: 模块节点ID
        :param user: 当前用户
        :return: (模块内容对象, 操作消息)
        """
        try:
            # 验证模块节点存在
            await self.validate_module_node(db, module_node_id)
            
            # 获取模块内容
            content = await module_content_repository.get_by_node_id(db, module_node_id)
            
            if not content:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="模块内容不存在"
                )
            
            # 如果有图片路径，删除文件
            if content.diagram_image_path:
                try:
                    # 从URL路径提取文件名
                    file_path = content.diagram_image_path
                    
                    # 兼容处理：旧格式可能有API_V1_STR前缀
                    if file_path.startswith(settings.API_V1_STR):
                        file_path = file_path[len(settings.API_V1_STR):]
                    
                    # 处理路径中的斜杠
                    if file_path.startswith('/'):
                        file_path = file_path[1:]
                    
                    # 获取实际的文件系统路径
                    fs_path = os.path.join(os.getcwd(), file_path)
                    
                    # 如果文件存在，删除文件
                    if os.path.exists(fs_path):
                        os.remove(fs_path)
                        logger.info(f"已删除文件: {fs_path}")
                    else:
                        logger.warning(f"文件不存在，无法删除: {fs_path}")
                except Exception as e:
                    # 文件删除失败，仅记录错误但继续执行
                    logger.error(f"删除文件失败: {str(e)}")
            
            # 清空数据库中的图片路径
            updated_content = await module_content_repository.clear_diagram_image(db, module_node_id, user.id)
            
            return updated_content, "图片已删除"
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"删除模块图片失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除模块图片失败: {str(e)}"
            )


# 创建模块内容服务实例
module_content_service = ModuleContentService() 