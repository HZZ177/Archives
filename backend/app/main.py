import os
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import JSONResponse
from backend.app.api.endpoints import auth, users
from backend.app.api.endpoints import module_structures, module_contents
from backend.app.api.endpoints import roles, permissions
from backend.app.api.endpoints import workspaces
from backend.app.api.endpoints import module_section_config
from backend.app.api.endpoints import images
from backend.app.api.endpoints import workspace_tables
from backend.app.api.endpoints import workspace_interfaces
from backend.app.api.endpoints import bug
from backend.app.core.config import settings
from backend.app.core.logger import logger
from backend.app.db.init_db import init_db


def create_app() -> FastAPI:
    """
    创建应用程序实例
    """
    app = FastAPI(
        title=settings.PROJECT_NAME,
        description=settings.PROJECT_DESCRIPTION,
        version=settings.VERSION,
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url=f"{settings.API_V1_STR}/docs",
        redoc_url=f"{settings.API_V1_STR}/redoc",
    )

    # 设置CORS
    logger.info(f"配置CORS，允许的源: {settings.CORS_ORIGINS}")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["*"],
        expose_headers=["*"],
        max_age=3600,
    )
    logger.info("CORS中间件配置完成")

    # 添加路由
    app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
    app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
    app.include_router(module_structures.router, prefix=f"{settings.API_V1_STR}/module-structures", tags=["module-structures"])
    app.include_router(module_contents.router, prefix=f"{settings.API_V1_STR}/module-contents", tags=["module-contents"])
    app.include_router(roles.router, prefix=f"{settings.API_V1_STR}/roles", tags=["roles"])
    app.include_router(permissions.router, prefix=f"{settings.API_V1_STR}/permissions", tags=["permissions"])
    app.include_router(workspaces.router, prefix=f"{settings.API_V1_STR}/workspaces", tags=["workspaces"])
    app.include_router(module_section_config.router, prefix=f"{settings.API_V1_STR}/module-sections", tags=["module-sections"])
    app.include_router(images.router, prefix=f"{settings.API_V1_STR}/images", tags=["images"])
    app.include_router(workspace_tables.router, prefix=f"{settings.API_V1_STR}/workspace-tables", tags=["workspace-tables"])
    app.include_router(workspace_interfaces.router,
                       prefix=f"{settings.API_V1_STR}/workspace-interfaces", tags=["workspace-interfaces"])
    app.include_router(bug.router, prefix=f"{settings.API_V1_STR}/bugs", tags=["bugs"])

    # 配置静态文件
    static_dir = settings.STATIC_DIR
    os.makedirs(static_dir, exist_ok=True)
    uploads_dir = os.path.join(static_dir, "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    
    # 确保Markdown编辑器图片上传目录存在
    markdown_images_dir = "uploads/images"
    os.makedirs(markdown_images_dir, exist_ok=True)

    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

    return app


app = create_app()


# 自定义异常处理
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    logger.error(f"HTTP异常: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    logger.error(f"请求验证失败: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": "请求参数验证失败", "errors": exc.errors()},
    )


@app.get("/", tags=["健康检查"])
async def health_check():
    """
    健康检查API
    """
    return {"status": "ok", "version": settings.VERSION}


@app.on_event("startup")
async def startup_event():
    """
    应用启动时初始化数据库
    """
    try:
        await init_db()
        logger.info("数据库初始化完成")
    except Exception as e:
        logger.error(f"启动时发生错误: {str(e)}")
        raise


if __name__ == "__main__":
    uvicorn.run(app="main:app", host="0.0.0.0", port=8000, reload=True)
