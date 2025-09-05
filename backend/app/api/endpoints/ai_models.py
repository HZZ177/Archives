from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_user, get_db
from backend.app.models.user import User
from backend.app.services.ai_model_service import AIModelService
from backend.app.services.llm_pool_service import LLMPoolService
from backend.app.schemas.ai_models import (
    AIModelConfigCreate,
    AIModelConfigUpdate,
    AIModelConfigResponse,
    ConnectionTestResult,
    PoolStatus
)
from backend.app.schemas.response import APIResponse, PaginatedResponse
from backend.app.core.exceptions import AIServiceException
from backend.app.core.logger import logger
router = APIRouter()


@router.post("/", response_model=APIResponse[AIModelConfigResponse])
async def create_ai_model_config(
    config: AIModelConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """创建AI模型配置"""
    try:
        ai_model_service = AIModelService()
        db_config = await ai_model_service.create_config(db, config, current_user.id)
        
        return APIResponse(
            success=True,
            message="AI模型配置创建成功",
            data=AIModelConfigResponse.model_validate(db_config)
        )
    except AIServiceException as e:
        logger.error(f"创建AI模型配置失败: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"创建AI模型配置异常: {str(e)}")
        raise HTTPException(status_code=500, detail="内部服务器错误")


@router.get("/", response_model=APIResponse[PaginatedResponse[AIModelConfigResponse]])
async def list_ai_model_configs(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取AI模型配置列表"""
    try:
        ai_model_service = AIModelService()
        configs, total = await ai_model_service.list_configs(db, page, page_size)
        
        config_responses = [AIModelConfigResponse.model_validate(config) for config in configs]
        
        return APIResponse(
            success=True,
            message="获取配置列表成功",
            data=PaginatedResponse(
                items=config_responses,
                total=total,
                page=page,
                page_size=page_size
            )
        )
    except Exception as e:
        logger.error(f"获取配置列表异常: {str(e)}")
        raise HTTPException(status_code=500, detail="内部服务器错误")


@router.get("/{config_id}", response_model=APIResponse[AIModelConfigResponse])
async def get_ai_model_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取单个AI模型配置"""
    try:
        ai_model_service = AIModelService()
        config = await ai_model_service.get_config_by_id(db, config_id)
        
        if not config:
            raise HTTPException(status_code=404, detail="配置不存在")
        
        return APIResponse(
            success=True,
            message="获取配置成功",
            data=AIModelConfigResponse.model_validate(config)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取配置异常: {str(e)}")
        raise HTTPException(status_code=500, detail="内部服务器错误")


@router.put("/{config_id}", response_model=APIResponse[AIModelConfigResponse])
async def update_ai_model_config(
    config_id: int,
    config: AIModelConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """更新AI模型配置"""
    try:
        ai_model_service = AIModelService()
        updated_config = await ai_model_service.update_config(db, config_id, config)
        
        if not updated_config:
            raise HTTPException(status_code=404, detail="配置不存在")
        
        return APIResponse(
            success=True,
            message="配置更新成功",
            data=AIModelConfigResponse.model_validate(updated_config)
        )
    except HTTPException:
        raise
    except AIServiceException as e:
        logger.error(f"更新配置失败: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"更新配置异常: {str(e)}")
        raise HTTPException(status_code=500, detail="内部服务器错误")


@router.delete("/{config_id}", response_model=APIResponse[dict])
async def delete_ai_model_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """删除AI模型配置"""
    try:
        ai_model_service = AIModelService()
        llm_pool_service = LLMPoolService()

        # 删除配置
        result = await ai_model_service.delete_config(db, config_id)

        # 如果删除的是活跃配置，需要更新连接池
        if result["was_active"]:
            logger.info(f"删除了活跃配置: {result['config_name']}，正在更新连接池")
            try:
                # 更新连接池配置（没有活跃配置时会清空连接池）
                await llm_pool_service.update_pool_config(db)
                logger.info("连接池已更新，当前无活跃配置")
            except Exception as e:
                logger.error(f"更新连接池失败: {str(e)}")
                # 不抛出异常，删除操作已经成功

        message = f"配置 '{result['config_name']}' 删除成功"
        if result["was_active"]:
            message += "，连接池已清空"

        return APIResponse(
            success=True,
            message=message,
            data=result
        )
    except AIServiceException as e:
        logger.error(f"删除配置失败: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"删除配置异常: {str(e)}")
        raise HTTPException(status_code=500, detail="内部服务器错误")


@router.post("/{config_id}/test", response_model=APIResponse[ConnectionTestResult])
async def test_ai_model_connection(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """测试AI模型连接"""
    try:
        ai_model_service = AIModelService()
        test_result = await ai_model_service.test_connection(db, config_id)
        
        return APIResponse(
            success=test_result.success,
            message=test_result.message,
            data=test_result
        )
    except Exception as e:
        logger.error(f"测试连接异常: {str(e)}")
        raise HTTPException(status_code=500, detail="内部服务器错误")


@router.post("/clear-active", response_model=APIResponse[bool])
async def clear_active_ai_model_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """清除活跃的AI模型配置"""
    try:
        ai_model_service = AIModelService()
        llm_pool_service = LLMPoolService()

        # 清除活跃配置
        success = await ai_model_service.clear_active_config(db)

        if success:
            logger.info("活跃配置已清除，正在更新连接池")
            try:
                # 更新连接池配置（没有活跃配置时会清空连接池）
                await llm_pool_service.update_pool_config(db)
                logger.info("连接池已清空")
            except Exception as e:
                logger.error(f"更新连接池失败: {str(e)}")
                # 不抛出异常，清除操作已经成功

        return APIResponse(
            success=True,
            message="活跃配置已清除，连接池已清空",
            data=success
        )
    except AIServiceException as e:
        logger.error(f"清除活跃配置失败: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"清除活跃配置异常: {str(e)}")
        raise HTTPException(status_code=500, detail="内部服务器错误")


@router.post("/test-connection", response_model=APIResponse[ConnectionTestResult])
async def test_ai_model_connection_with_config(
    config_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """测试AI模型配置数据的连接（无需保存到数据库）"""
    try:
        ai_model_service = AIModelService()
        test_result = await ai_model_service.test_connection_with_config(config_data)

        return APIResponse(
            success=test_result.success,
            message=test_result.message,
            data=test_result
        )
    except Exception as e:
        logger.error(f"测试配置连接异常: {str(e)}")
        raise HTTPException(status_code=500, detail="内部服务器错误")


@router.post("/{config_id}/activate", response_model=APIResponse[bool])
async def activate_ai_model_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """激活AI模型配置"""
    try:
        ai_model_service = AIModelService()
        llm_pool_service = LLMPoolService()
        
        # 设置为活跃配置
        success = await ai_model_service.set_active_config(db, config_id)
        
        if success:
            # 更新连接池配置
            await llm_pool_service.update_pool_config(db)
        
        return APIResponse(
            success=True,
            message="配置激活成功",
            data=success
        )
    except AIServiceException as e:
        logger.error(f"激活配置失败: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"激活配置异常: {str(e)}")
        raise HTTPException(status_code=500, detail="内部服务器错误")


@router.get("/pool/status", response_model=APIResponse[PoolStatus])
async def get_llm_pool_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取LLM连接池状态"""
    try:
        llm_pool_service = LLMPoolService()
        pool_status = await llm_pool_service.get_pool_status(db)
        
        return APIResponse(
            success=True,
            message="获取连接池状态成功",
            data=pool_status
        )
    except Exception as e:
        logger.error(f"获取连接池状态异常: {str(e)}")
        raise HTTPException(status_code=500, detail="内部服务器错误")
