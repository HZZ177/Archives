from fastapi import APIRouter
from backend.app.api.endpoints import (
    auth,
    users,
    roles,
    permissions,
    documents,
    module_structures,
    module_contents,
    module_section_config  # 新增
)

api_router = APIRouter()

# ... 其他路由注册 ...

# 注册模块配置路由
api_router.include_router(
    module_section_config.router,
    prefix="/module-sections",
    tags=["module-sections"]
) 