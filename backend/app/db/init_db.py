import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select

from backend.app.core.security import get_password_hash
from backend.app.db.base import Base
from backend.app.db.session import engine
from backend.app.models.user import User, Role
from backend.app.models.document import Document, Template, Section, Image, Relation

logger = logging.getLogger(__name__)


async def init_db() -> None:
    """
    初始化数据库
    创建所有表并添加初始数据
    """
    try:
        # 创建所有表
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            logger.info("数据库表创建成功")

        # 创建初始角色
        async with AsyncSession(engine) as session:
            # 检查是否已存在管理员角色
            result = await session.execute(text("SELECT COUNT(*) FROM roles WHERE name = 'admin'"))
            admin_count = result.scalar()

            if admin_count == 0:
                # 创建管理员角色
                admin_role = Role(
                    name="admin",
                    description="系统管理员"
                )
                session.add(admin_role)
                await session.commit()
                logger.info("管理员角色创建成功")

            # 检查是否已存在管理员用户
            result = await session.execute(text("SELECT COUNT(*) FROM users WHERE username = 'admin'"))
            admin_user_count = result.scalar()

            if admin_user_count == 0:
                # 创建管理员用户
                admin_user = User(
                    username="admin",
                    email="admin@example.com",
                    full_name="Administrator",
                    hashed_password=get_password_hash("admin123"),
                    is_active=True,
                    is_superuser=True
                )
                session.add(admin_user)
                await session.commit()
                logger.info("管理员用户创建成功")
            else:
                # 查询并显示现有用户信息
                result = await session.execute(select(User).where(User.username == "admin"))
                existing_user = result.scalar_one_or_none()
                if existing_user:
                    logger.info(f"管理员用户已存在: {existing_user.username}")

    except Exception as e:
        logger.error(f"数据库初始化失败: {str(e)}")
        raise
