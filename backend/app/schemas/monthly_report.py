from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field


class PromptTemplateBase(BaseModel):
    """提示词模板基础模式"""
    template_name: str = Field(..., description="模板名称")
    template_content: str = Field(..., description="模板内容")
    is_active: bool = Field(True, description="是否激活")
    is_default: bool = Field(False, description="是否为默认模板")


class PromptTemplateCreate(PromptTemplateBase):
    """创建提示词模板"""
    workspace_id: int = Field(..., description="工作区ID")


class PromptTemplateUpdate(BaseModel):
    """更新提示词模板"""
    template_name: Optional[str] = None
    template_content: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None


class PromptTemplateResponse(PromptTemplateBase):
    """提示词模板响应"""
    id: int
    workspace_id: int
    created_by: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GenerationProgress(BaseModel):
    """生成进度"""
    current_step: int = Field(..., description="当前步骤")
    total_steps: int = Field(..., description="总步骤数")
    step_name: str = Field(..., description="当前步骤名称")
    step_description: str = Field(..., description="步骤描述")
    progress_percentage: float = Field(..., description="进度百分比")
    data_count: Optional[int] = Field(None, description="处理的数据数量")
    estimated_remaining: Optional[int] = Field(None, description="预计剩余时间(秒)")


class ReportData(BaseModel):
    """报告数据结构"""
    executive_summary: str = Field(..., description="执行摘要")
    key_metrics: Dict[str, Any] = Field(..., description="关键指标")
    trend_analysis: Dict[str, Any] = Field(..., description="趋势分析")
    hotspot_analysis: List[Dict[str, Any]] = Field(..., description="热点分析")
    ai_insights: str = Field(..., description="AI洞察")
    improvement_suggestions: List[str] = Field(..., description="改进建议")
    detailed_data: Dict[str, Any] = Field(..., description="详细数据")
    generation_metadata: Dict[str, Any] = Field(..., description="生成元数据")


class MonthlyReportBase(BaseModel):
    """月度报告基础模式"""
    year: int = Field(..., description="年份")
    month: int = Field(..., ge=1, le=12, description="月份")
    prompt_template: Optional[str] = Field(None, description="使用的提示词模板")


class MonthlyReportCreate(MonthlyReportBase):
    """创建月度报告"""
    workspace_id: int = Field(..., description="工作区ID")


class MonthlyReportUpdate(BaseModel):
    """更新月度报告"""
    prompt_template: Optional[str] = None
    report_data: Optional[ReportData] = None
    status: Optional[str] = None


class MonthlyReportResponse(MonthlyReportBase):
    """月度报告响应"""
    id: int
    workspace_id: int
    report_data: Optional[ReportData] = None
    status: str
    generation_progress: Optional[GenerationProgress] = None
    error_message: Optional[str] = None
    created_by: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GenerateReportRequest(BaseModel):
    """生成报告请求"""
    workspace_id: int = Field(..., description="工作区ID")
    year: int = Field(..., description="年份")
    month: int = Field(..., ge=1, le=12, description="月份")
    prompt_template: Optional[str] = Field(None, description="自定义提示词模板")
    regenerate: bool = Field(False, description="是否重新生成已存在的报告")


class ReportHistoryResponse(BaseModel):
    """报告历史响应"""
    reports: List[MonthlyReportResponse]
    total: int
    has_more: bool
