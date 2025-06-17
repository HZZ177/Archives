"""
数据访问层 - Repository层
负责数据库交互，不包含业务逻辑
"""

from backend.app.repositories.base_repository import BaseRepository
from backend.app.repositories.auth_repository import auth_repository
from backend.app.repositories.module_content_repository import module_content_repository
from backend.app.repositories.module_structure_repository import module_structure_repository
from backend.app.repositories.permission_repository import permission_repository
from backend.app.repositories.role_repository import role_repository
from backend.app.repositories.workspace_repository import workspace_repository
from backend.app.repositories.module_section_config_repository import module_section_config_repository
from backend.app.repositories.image_repository import image_repository

__all__ = [
    'BaseRepository',
    'auth_repository',
    'module_content_repository',
    'module_structure_repository',
    'permission_repository',
    'role_repository',
    'workspace_repository',
    'module_section_config_repository',
    'image_repository'
]