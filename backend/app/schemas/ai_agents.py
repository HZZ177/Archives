from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


class AIAgentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Agent名称")
    role: str = Field(..., min_length=1, max_length=100, description="Agent角色")
    goal: str = Field(..., min_length=1, description="Agent目标")
    backstory: str = Field(..., min_length=1, description="Agent背景故事")
    system_prompt: Optional[str] = Field(None, description="系统提示词")
    agent_type: str = Field(..., min_length=1, max_length=50, description="Agent类型")
    config_json: Optional[str] = Field(None, description="额外配置JSON")


class AIAgentCreate(AIAgentBase):
    pass


class AIAgentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Agent名称")
    role: Optional[str] = Field(None, min_length=1, max_length=100, description="Agent角色")
    goal: Optional[str] = Field(None, min_length=1, description="Agent目标")
    backstory: Optional[str] = Field(None, min_length=1, description="Agent背景故事")
    system_prompt: Optional[str] = Field(None, description="系统提示词")
    agent_type: Optional[str] = Field(None, min_length=1, max_length=50, description="Agent类型")
    is_enabled: Optional[bool] = Field(None, description="是否启用")
    config_json: Optional[str] = Field(None, description="额外配置JSON")


class AIAgentResponse(AIAgentBase):
    id: int
    is_enabled: bool
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class AIAgentExecutionCreate(BaseModel):
    agent_id: int = Field(..., description="Agent ID")
    task_type: str = Field(..., min_length=1, max_length=50, description="任务类型")
    input_data: Optional[str] = Field(None, description="输入数据")
    workspace_id: Optional[int] = Field(None, description="工作空间ID")


class AIAgentExecutionResponse(BaseModel):
    id: int
    agent_id: int
    task_type: str
    input_data: Optional[str]
    output_data: Optional[str]
    execution_status: str
    start_time: datetime
    end_time: Optional[datetime]
    duration_ms: Optional[int]
    error_message: Optional[str]
    workspace_id: Optional[int]
    created_by: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True


class DefectAnalysisRequest(BaseModel):
    year: int = Field(..., ge=2020, le=2030, description="分析年份")
    month: int = Field(..., ge=1, le=12, description="分析月份")
    workspace_id: int = Field(..., description="工作空间ID")


class DefectAnalysisResult(BaseModel):
    execution_id: int = Field(..., description="执行记录ID")
    analysis_summary: str = Field(..., description="分析摘要")
    time_distribution: Dict[str, Any] = Field(..., description="时间维度分析")
    module_distribution: Dict[str, Any] = Field(..., description="模块分布分析")
    defect_type_analysis: Dict[str, Any] = Field(..., description="缺陷类型分析")
    root_cause_analysis: Dict[str, Any] = Field(..., description="根因分析")
    recurring_issues: List[Dict[str, Any]] = Field(..., description="重复问题分析")
    improvement_suggestions: List[str] = Field(..., description="改进建议")
    generated_at: datetime = Field(..., description="生成时间")
