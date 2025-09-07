import asyncio
import time
from typing import Optional
from crewai import LLM
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.services.ai_model_service import AIModelService
from backend.app.schemas.ai_models import PoolStatus
from backend.app.core.exceptions import PoolExhaustedException, LLMConnectionException
from backend.app.core.logger import logger


class LLMPoolService:
    """LLM连接池管理服务"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            logger.info("初始化LLM连接池服务")
            cls._instance = super().__new__(cls)
            cls._instance.pool_size = 3
            cls._instance.llm_pool = []
            cls._instance.available_llms = asyncio.Queue()
            cls._instance._lock = asyncio.Lock()
            cls._instance._initialized = False
            cls._instance._auto_init_attempted = False
        return cls._instance

    def __init__(self):
        if not hasattr(self, '_initialized') or not self._initialized:
            logger.info("初始化LLM连接池实例")
            self.pool_size = 3
            self.llm_pool = []
            self.available_llms = asyncio.Queue()
            self._lock = asyncio.Lock()
            self._initialized = True
            self._auto_init_attempted = False

    async def _auto_initialize_if_needed(self, db: AsyncSession):
        """如果有活跃配置且未初始化，则自动初始化连接池"""
        if self._auto_init_attempted or self.llm_pool:
            return

        self._auto_init_attempted = True
        try:
            # 获取活跃配置
            ai_model_service = AIModelService()
            config = await ai_model_service.get_active_config(db)

            if config:
                logger.info("发现活跃配置，自动初始化连接池")
                await self.initialize_pool(db)
            else:
                logger.info("未找到活跃配置，连接池保持为空")
        except Exception as e:
            logger.error(f"自动初始化连接池失败: {str(e)}")

    async def initialize_pool(self, db: AsyncSession):
        """初始化连接池"""
        async with self._lock:
            try:
                # 清空现有连接池
                self.llm_pool.clear()
                while not self.available_llms.empty():
                    self.available_llms.get_nowait()
                
                # 获取活跃配置
                ai_model_service = AIModelService()
                config = await ai_model_service.get_active_config(db)
                
                if not config:
                    logger.warning("没有找到活跃的AI模型配置，连接池将保持为空")
                    return
                
                # 创建LLM实例
                for i in range(self.pool_size):
                    try:
                        llm = self._create_llm_instance(config)
                        self.llm_pool.append(llm)
                        await self.available_llms.put(llm)
                        logger.debug(f"创建LLM实例 {i+1}/{self.pool_size}")
                    except Exception as e:
                        logger.error(f"创建LLM实例失败: {str(e)}")
                        continue
                
                logger.info(f"LLM连接池初始化完成，配置: {config.name}，池大小: {len(self.llm_pool)}")
                
            except Exception as e:
                logger.error(f"初始化连接池失败: {str(e)}")
                raise LLMConnectionException(f"初始化连接池失败: {str(e)}")
    
    def _create_llm_instance(self, config):
        """创建LLM实例"""
        try:
            # 统一使用 provider/model_name 格式
            model_full_name = f"{config.model_provider}/{config.model_name}"

            base_url = config.base_url

            logger.info(f"创建LLM实例: {model_full_name}, base_url: {base_url}")

            return LLM(
                model=model_full_name,
                api_key=config.api_key,
                base_url=base_url
            )

        except Exception as e:
            logger.error(f"创建LLM实例失败: {str(e)}")
            raise LLMConnectionException(f"创建LLM实例失败: {str(e)}")
    
    async def acquire_llm(self, db: AsyncSession, timeout: int = 30) -> LLM:
        """获取LLM实例"""
        try:
            # 如果连接池为空，尝试自动初始化
            if not self.llm_pool:
                await self._auto_initialize_if_needed(db)

            if not self.llm_pool:
                raise PoolExhaustedException("连接池为空，请先配置AI模型")

            logger.debug("尝试获取LLM实例")
            llm = await asyncio.wait_for(self.available_llms.get(), timeout=timeout)
            logger.debug("成功获取LLM实例")
            return llm
            
        except asyncio.TimeoutError:
            logger.error(f"获取LLM实例超时({timeout}秒)")
            raise PoolExhaustedException(f"获取LLM实例超时({timeout}秒)")
        except Exception as e:
            logger.error(f"获取LLM实例失败: {str(e)}")
            raise PoolExhaustedException(f"获取LLM实例失败: {str(e)}")
    
    async def release_llm(self, llm: LLM):
        """释放LLM实例"""
        try:
            if llm in self.llm_pool:
                await self.available_llms.put(llm)
                logger.debug("成功释放LLM实例")
            else:
                logger.warning("尝试释放不属于连接池的LLM实例")
                
        except Exception as e:
            logger.error(f"释放LLM实例失败: {str(e)}")
    
    async def update_pool_config(self, db: AsyncSession):
        """更新连接池配置"""
        try:
            logger.info("开始更新连接池配置")
            # 重置自动初始化标志，允许重新初始化
            self._auto_init_attempted = False
            await self.initialize_pool(db)
            logger.info("连接池配置更新完成")
            
        except Exception as e:
            logger.error(f"更新连接池配置失败: {str(e)}")
            raise LLMConnectionException(f"更新连接池配置失败: {str(e)}")
    
    async def get_pool_status(self, db: AsyncSession) -> PoolStatus:
        """获取连接池状态"""
        try:
            ai_model_service = AIModelService()
            current_config = await ai_model_service.get_active_config(db)
            
            return PoolStatus(
                total_size=len(self.llm_pool),
                available_count=self.available_llms.qsize(),
                active_count=len(self.llm_pool) - self.available_llms.qsize(),
                pending_count=0,  # 暂时不实现等待队列
                current_config=current_config
            )
            
        except Exception as e:
            logger.error(f"获取连接池状态失败: {str(e)}")
            return PoolStatus(
                total_size=0,
                available_count=0,
                active_count=0,
                pending_count=0,
                current_config=None
            )
