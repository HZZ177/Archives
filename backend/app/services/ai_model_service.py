import time
from typing import List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload

from backend.app.models.ai_model_config import AIModelConfig, AIModelUsageStats
from backend.app.schemas.ai_models import (
    AIModelConfigCreate, 
    AIModelConfigUpdate, 
    ConnectionTestResult,
    PoolStatus
)
from backend.app.core.exceptions import AIServiceException, LLMConnectionException
from backend.app.core.logger import logger


class AIModelService:
    """AI模型配置管理服务"""

    def __init__(self):
        pass

    async def create_config(
        self, 
        db: AsyncSession, 
        config_data: AIModelConfigCreate, 
        user_id: int
    ) -> AIModelConfig:
        """创建AI模型配置"""
        try:
            # 创建新配置
            db_config = AIModelConfig(
                **config_data.model_dump(),
                created_by=user_id
            )
            
            db.add(db_config)
            await db.commit()
            await db.refresh(db_config)
            
            logger.info(f"创建AI模型配置成功: {db_config.name} (ID: {db_config.id})")
            return db_config
            
        except Exception as e:
            await db.rollback()
            logger.error(f"创建AI模型配置失败: {str(e)}")
            raise AIServiceException(f"创建配置失败: {str(e)}")

    async def update_config(
        self, 
        db: AsyncSession, 
        config_id: int, 
        config_data: AIModelConfigUpdate
    ) -> Optional[AIModelConfig]:
        """更新AI模型配置"""
        try:
            # 查找配置
            result = await db.execute(
                select(AIModelConfig).where(AIModelConfig.id == config_id)
            )
            db_config = result.scalar_one_or_none()
            
            if not db_config:
                return None
            
            # 更新字段
            update_data = config_data.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                setattr(db_config, field, value)
            
            await db.commit()
            await db.refresh(db_config)
            
            logger.info(f"更新AI模型配置成功: {db_config.name} (ID: {config_id})")
            return db_config
            
        except Exception as e:
            await db.rollback()
            logger.error(f"更新AI模型配置失败: {str(e)}")
            raise AIServiceException(f"更新配置失败: {str(e)}")

    async def delete_config(self, db: AsyncSession, config_id: int) -> dict:
        """删除AI模型配置"""
        try:
            # 检查配置是否存在
            result = await db.execute(
                select(AIModelConfig).where(AIModelConfig.id == config_id)
            )
            config = result.scalar_one_or_none()

            if not config:
                raise AIServiceException("配置不存在")

            # 记录是否为活跃配置
            was_active = config.is_active
            config_name = config.name

            # 删除配置
            await db.execute(
                delete(AIModelConfig).where(AIModelConfig.id == config_id)
            )
            await db.commit()

            logger.info(f"删除AI模型配置成功: {config_name} (ID: {config_id})")

            return {
                "success": True,
                "was_active": was_active,
                "config_name": config_name
            }

        except Exception as e:
            await db.rollback()
            logger.error(f"删除AI模型配置失败: {str(e)}")
            raise AIServiceException(f"删除配置失败: {str(e)}")

    async def get_active_config(self, db: AsyncSession) -> Optional[AIModelConfig]:
        """获取当前活跃的AI模型配置"""
        try:
            result = await db.execute(
                select(AIModelConfig).where(
                    AIModelConfig.is_active == True,
                    AIModelConfig.is_enabled == True
                )
            )
            return result.scalar_one_or_none()
            
        except Exception as e:
            logger.error(f"获取活跃配置失败: {str(e)}")
            return None

    async def set_active_config(self, db: AsyncSession, config_id: int) -> bool:
        """设置活跃配置"""
        try:
            # 先将所有配置设为非活跃
            await db.execute(
                update(AIModelConfig).values(is_active=False)
            )
            
            # 设置指定配置为活跃
            result = await db.execute(
                update(AIModelConfig)
                .where(AIModelConfig.id == config_id)
                .values(is_active=True)
            )
            
            if result.rowcount == 0:
                raise AIServiceException("配置不存在")
            
            await db.commit()
            logger.info(f"设置活跃配置成功: ID {config_id}")
            return True
            
        except Exception as e:
            await db.rollback()
            logger.error(f"设置活跃配置失败: {str(e)}")
            raise AIServiceException(f"设置活跃配置失败: {str(e)}")

    async def clear_active_config(self, db: AsyncSession) -> bool:
        """清除活跃的AI模型配置"""
        try:
            # 将所有配置设置为非活跃
            await db.execute(
                update(AIModelConfig).values(is_active=False)
            )
            await db.commit()

            logger.info("所有AI模型配置已设置为非活跃状态")
            return True

        except Exception as e:
            await db.rollback()
            logger.error(f"清除活跃AI模型配置失败: {str(e)}")
            raise AIServiceException(f"清除活跃配置失败: {str(e)}")

    async def test_connection(self, db: AsyncSession, config_id: int) -> ConnectionTestResult:
        """测试AI模型连接"""
        start_time = time.time()

        try:
            # 获取配置
            result = await db.execute(
                select(AIModelConfig).where(AIModelConfig.id == config_id)
            )
            config = result.scalar_one_or_none()

            if not config:
                return ConnectionTestResult(
                    success=False,
                    message="配置不存在",
                    response_time_ms=int((time.time() - start_time) * 1000)
                )

            # 实际测试LLM连接
            return await self._test_connection_with_config(
                model_provider=config.model_provider,
                model_name=config.model_name,
                base_url=config.base_url,
                api_key=config.api_key,
                max_tokens=config.max_tokens,
                temperature=config.temperature,
                start_time=start_time
            )
            
        except Exception as e:
            return ConnectionTestResult(
                success=False,
                message=f"连接测试失败: {str(e)}",
                response_time_ms=int((time.time() - start_time) * 1000)
            )

    async def test_connection_with_config(self, config_data: dict) -> ConnectionTestResult:
        """测试未保存的配置数据的连接"""
        start_time = time.time()

        try:
            # 验证必要字段
            required_fields = ['model_provider', 'model_name', 'api_key']
            for field in required_fields:
                if not config_data.get(field):
                    return ConnectionTestResult(
                        success=False,
                        message=f"缺少必要字段: {field}",
                        response_time_ms=int((time.time() - start_time) * 1000)
                    )

            # 实际测试LLM连接
            return await self._test_connection_with_config(
                model_provider=config_data.get('model_provider'),
                model_name=config_data.get('model_name'),
                base_url=config_data.get('base_url'),
                api_key=config_data.get('api_key'),
                max_tokens=config_data.get('max_tokens', 4000),
                temperature=config_data.get('temperature', 0.7),
                start_time=start_time
            )

        except Exception as e:
            logger.error(f"测试配置数据连接异常: {str(e)}")
            return ConnectionTestResult(
                success=False,
                message=f"测试连接失败: {str(e)}",
                response_time_ms=int((time.time() - start_time) * 1000)
            )

    async def list_configs(
        self, 
        db: AsyncSession, 
        page: int = 1, 
        page_size: int = 10
    ) -> Tuple[List[AIModelConfig], int]:
        """获取配置列表"""
        try:
            # 计算偏移量
            offset = (page - 1) * page_size
            
            # 查询配置列表
            result = await db.execute(
                select(AIModelConfig)
                .order_by(AIModelConfig.created_at.desc())
                .offset(offset)
                .limit(page_size)
            )
            configs = result.scalars().all()
            
            # 查询总数
            from sqlalchemy import func
            count_result = await db.execute(
                select(func.count(AIModelConfig.id))
            )
            total = count_result.scalar()
            
            return list(configs), total
            
        except Exception as e:
            logger.error(f"获取配置列表失败: {str(e)}")
            raise AIServiceException(f"获取配置列表失败: {str(e)}")

    async def get_config_by_id(self, db: AsyncSession, config_id: int) -> Optional[AIModelConfig]:
        """根据ID获取配置"""
        try:
            result = await db.execute(
                select(AIModelConfig).where(AIModelConfig.id == config_id)
            )
            return result.scalar_one_or_none()
            
        except Exception as e:
            logger.error(f"获取配置失败: {str(e)}")
            return None

    async def _test_connection_with_config(
        self,
        model_provider: str,
        model_name: str,
        base_url: str,
        api_key: str,
        max_tokens: int = 4000,
        temperature: float = 0.7,
        start_time: float = None
    ) -> ConnectionTestResult:
        """测试模型连接的内部实现"""
        if start_time is None:
            start_time = time.time()

        try:
            from crewai import LLM

            # 构建完整的模型名称
            model_full_name = f"{model_provider}/{model_name}"
            logger.info(f"测试模型连接: {model_full_name}")

            # 创建LLM实例
            llm = LLM(
                model=model_full_name,
                base_url=base_url,
                api_key=api_key
            )

            # 发送一个简单的测试请求
            response = llm.call("你好，这是一个连接测试。请回复'连接正常'")

            response_time = int((time.time() - start_time) * 1000)

            logger.info(f"模型连接测试成功: {model_full_name}, 响应时间: {response_time}ms")

            return ConnectionTestResult(
                success=True,
                message="连接测试成功",
                response_time_ms=response_time,
                model_info={
                    "provider": model_provider,
                    "model": model_name,
                    "max_tokens": max_tokens,
                    "response_preview": response[:100] if response else "无响应内容"
                }
            )

        except Exception as e:
            response_time = int((time.time() - start_time) * 1000)
            error_msg = str(e)

            # 根据错误类型提供更友好的错误信息
            if "401" in error_msg or "Unauthorized" in error_msg:
                friendly_msg = "API密钥无效或已过期"
            elif "403" in error_msg or "Forbidden" in error_msg:
                friendly_msg = "API密钥权限不足"
            elif "404" in error_msg or "Not Found" in error_msg:
                friendly_msg = "模型不存在或API端点错误"
            elif "timeout" in error_msg.lower():
                friendly_msg = "连接超时，请检查网络或API端点"
            elif "connection" in error_msg.lower():
                friendly_msg = "网络连接失败，请检查API端点地址"
            else:
                friendly_msg = f"连接测试失败: {error_msg}"

            logger.error(f"测试模型连接失败: {model_full_name}, 错误: {error_msg}")

            return ConnectionTestResult(
                success=False,
                message=friendly_msg,
                response_time_ms=response_time,
                model_info={
                    "provider": model_provider,
                    "model": model_name,
                    "error_details": error_msg
                }
            )
