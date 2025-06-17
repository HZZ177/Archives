"""
业务逻辑层 - Service层
负责处理业务逻辑，连接API层和Repository层
"""

from backend.app.services.auth_service import auth_service
from backend.app.services.module_content_service import module_content_service
from backend.app.services.module_structure_service import module_structure_service
from backend.app.services.permission_service import permission_service
from backend.app.services.role_service import role_service
from backend.app.services.workspace_service import workspace_service
from backend.app.services.module_section_config_service import module_section_config_service
from backend.app.services.image_service import image_service

__all__ = [
    'auth_service',
    'module_content_service',
    'module_structure_service',
    'permission_service',
    'role_service',
    'workspace_service',
    'module_section_config_service',
    'image_service'
]