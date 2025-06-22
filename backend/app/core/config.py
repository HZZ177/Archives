import os
import secrets
from typing import List, Optional

from pydantic import Field, validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    应用程序设置
    """
    # API设置
    API_V1_STR: str = "/api/v1"
    VERSION: str = "0.1.0"

    # 项目信息
    PROJECT_NAME: str = "智源资料系统"
    PROJECT_DESCRIPTION: str = "智源资料系统API"

    # CORS设置
    CORS_ORIGINS: List[str] = [
        # "http://localhost:3000",
        # "http://localhost:4173",
        # "http://localhost:5173",
        # "http://localhost:8000"
        "*"
    ]

    # 安全设置
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7天

    # 数据库设置
    DATABASE_URL: str = "sqlite+aiosqlite:///./app.db"

    # 文件上传设置
    MAX_UPLOAD_SIZE: int = 5 * 1024 * 1024  # 5 MB
    STATIC_DIR: str = os.path.join(os.getcwd(), "static")

    # 缓存设置
    CACHE_EXPIRE: int = 60 * 5  # 5分钟

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


# 实例化配置
settings = Settings()
