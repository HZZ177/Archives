from typing import Generic, TypeVar, Type, List, Optional, Any, Dict, Union
from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from backend.app.db.base import Base
from backend.app.core.logger import logger

# 定义泛型类型变量
ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class BaseRepository(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    提供基本的CRUD操作的基础Repository类
    """
    def __init__(self, model: Type[ModelType]):
        """
        初始化Repository
        :param model: SQLAlchemy模型类
        """
        self.model = model

    async def get(self, db: AsyncSession, id: Any) -> Optional[ModelType]:
        """
        通过ID获取记录
        """
        try:
            return await db.get(self.model, id)
        except Exception as e:
            logger.error(f"获取记录失败: {str(e)}")
            raise

    async def get_by_attribute(self, db: AsyncSession, attr_name: str, attr_value: Any) -> Optional[ModelType]:
        """
        通过属性获取记录
        """
        try:
            stmt = select(self.model).where(getattr(self.model, attr_name) == attr_value)
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"通过属性获取记录失败: {str(e)}")
            raise

    async def get_multi(
        self, db: AsyncSession, *, skip: int = 0, limit: int = 100
    ) -> List[ModelType]:
        """
        获取多条记录
        """
        try:
            stmt = select(self.model).offset(skip).limit(limit)
            result = await db.execute(stmt)
            return result.scalars().all()
        except Exception as e:
            logger.error(f"获取多条记录失败: {str(e)}")
            raise

    async def create(self, db: AsyncSession, *, obj_in: Union[CreateSchemaType, Dict[str, Any]]) -> ModelType:
        """
        创建记录
        """
        try:
            obj_in_data = obj_in.dict() if isinstance(obj_in, BaseModel) else obj_in
            db_obj = self.model(**obj_in_data)
            db.add(db_obj)
            await db.commit()
            await db.refresh(db_obj)
            return db_obj
        except Exception as e:
            await db.rollback()
            logger.error(f"创建记录失败: {str(e)}")
            raise

    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: ModelType,
        obj_in: Union[UpdateSchemaType, Dict[str, Any]]
    ) -> ModelType:
        """
        更新记录
        """
        try:
            obj_data = db_obj.__dict__
            if isinstance(obj_in, dict):
                update_data = obj_in
            else:
                update_data = obj_in.dict(exclude_unset=True)
                
            for field in obj_data:
                if field in update_data:
                    setattr(db_obj, field, update_data[field])
                    
            db.add(db_obj)
            await db.commit()
            await db.refresh(db_obj)
            return db_obj
        except Exception as e:
            await db.rollback()
            logger.error(f"更新记录失败: {str(e)}")
            raise

    async def remove(self, db: AsyncSession, *, id: int) -> ModelType:
        """
        删除记录
        """
        try:
            obj = await db.get(self.model, id)
            if obj:
                await db.delete(obj)
                await db.commit()
            return obj
        except Exception as e:
            await db.rollback()
            logger.error(f"删除记录失败: {str(e)}")
            raise

    async def count(self, db: AsyncSession) -> int:
        """
        获取记录总数
        """
        try:
            stmt = select(func.count()).select_from(self.model)
            result = await db.execute(stmt)
            return result.scalar_one()
        except Exception as e:
            logger.error(f"获取记录总数失败: {str(e)}")
            raise 