from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


class AIModelConfigBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="配置名称")
    model_provider: str = Field(..., min_length=1, max_length=100, description="模型提供商")
    model_name: str = Field(..., min_length=1, max_length=100, description="模型名称")
    api_key: str = Field(..., min_length=1, description="API密钥")
    base_url: str = Field(..., min_length=1, description="API基础URL")
    description: Optional[str] = Field(None, description="配置描述")


class AIModelConfigCreate(AIModelConfigBase):
    pass


class AIModelConfigUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="配置名称")
    model_provider: Optional[str] = Field(None, min_length=1, max_length=100, description="模型提供商")
    model_name: Optional[str] = Field(None, min_length=1, max_length=100, description="模型名称")
    api_key: Optional[str] = Field(None, min_length=1, description="API密钥")
    base_url: Optional[str] = Field(None, min_length=1, description="API基础URL")
    description: Optional[str] = Field(None, description="配置描述")
    is_enabled: Optional[bool] = Field(None, description="是否启用")


class AIModelConfigResponse(AIModelConfigBase):
    id: int
    is_active: bool
    is_enabled: bool
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ConnectionTestResult(BaseModel):
    success: bool = Field(..., description="测试是否成功")
    message: str = Field(..., description="测试结果消息")
    response_time_ms: Optional[int] = Field(None, description="响应时间(毫秒)")
    model_info: Optional[Dict[str, Any]] = Field(None, description="模型信息")


class PoolStatus(BaseModel):
    total_size: int = Field(..., description="连接池总大小")
    available_count: int = Field(..., description="可用连接数")
    active_count: int = Field(..., description="活跃连接数")
    pending_count: int = Field(..., description="等待连接数")
    current_config: Optional[AIModelConfigResponse] = Field(None, description="当前活跃配置")


class AIModelUsageStatsResponse(BaseModel):
    id: int
    config_id: int
    workspace_id: int
    usage_date: datetime
    request_count: int
    token_count: int
    success_count: int
    error_count: int
    avg_response_time: float
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
