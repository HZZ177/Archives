from typing import List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


class BugSeverity(str, Enum):
    """Bug严重程度枚举"""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class BugStatus(str, Enum):
    """Bug状态枚举"""
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


# Bug档案相关Schema
class BugProfileBase(BaseModel):
    """Bug档案基础模型"""
    title: str = Field(..., min_length=1, max_length=255, description="Bug标题")
    description: Optional[str] = Field(None, description="Bug详细描述")
    severity: BugSeverity = Field(BugSeverity.MEDIUM, description="严重程度")
    status: BugStatus = Field(BugStatus.OPEN, description="Bug状态")
    tags: Optional[List[str]] = Field(None, description="标签数组")


class BugProfileCreate(BugProfileBase):
    """创建Bug档案请求模型"""
    module_ids: Optional[List[int]] = Field(None, description="关联的模块ID列表")
    manifestation_descriptions: Optional[List[str]] = Field(None, description="在各模块下的表现描述")


class BugProfileUpdate(BaseModel):
    """更新Bug档案请求模型"""
    title: Optional[str] = Field(None, min_length=1, max_length=255, description="Bug标题")
    description: Optional[str] = Field(None, description="Bug详细描述")
    severity: Optional[BugSeverity] = Field(None, description="严重程度")
    status: Optional[BugStatus] = Field(None, description="Bug状态")
    tags: Optional[List[str]] = Field(None, description="标签数组")
    module_ids: Optional[List[int]] = Field(None, description="关联的模块ID列表")
    manifestation_descriptions: Optional[List[str]] = Field(None, description="在各模块下的表现描述")


class BugProfileResponse(BugProfileBase):
    """Bug档案响应模型"""
    id: int
    reporter_id: int
    workspace_id: int
    created_at: datetime
    updated_at: datetime
    occurrence_count: int = Field(0, description="发生次数")
    last_occurrence: Optional[datetime] = Field(None, description="最近发生时间")
    
    class Config:
        from_attributes = True


class BugProfileDetailResponse(BugProfileResponse):
    """Bug档案详情响应模型"""
    logs: List['BugLogResponse'] = Field(default_factory=list, description="发生历史")
    module_links: List['BugModuleLinkResponse'] = Field(default_factory=list, description="关联模块")


# Bug日志相关Schema
class BugLogBase(BaseModel):
    """Bug日志基础模型"""
    notes: Optional[str] = Field(None, description="补充说明")


class BugLogCreate(BugLogBase):
    """创建Bug日志请求模型（可携带模块ID以在记录发生时建立关联）"""
    module_id: Optional[int] = Field(None, description="发生所在模块ID；提供则自动建立关联")


class BugLogResponse(BugLogBase):
    """Bug日志响应模型"""
    id: int
    bug_id: int
    occurred_at: datetime
    reporter_id: int
    created_at: datetime
    module_id: Optional[int] = Field(None, description="发生所在模块ID")
    module_name: Optional[str] = Field(None, description="发生所在模块名称")
    
    class Config:
        from_attributes = True


# Bug模块关联相关Schema
class BugModuleLinkBase(BaseModel):
    """Bug模块关联基础模型"""
    manifestation_description: Optional[str] = Field(None, description="特定表现描述")


class BugModuleLinkCreate(BugModuleLinkBase):
    """创建Bug模块关联请求模型"""
    module_id: int = Field(..., description="模块ID")


class BugModuleLinkResponse(BugModuleLinkBase):
    """Bug模块关联响应模型"""
    id: int
    module_id: int
    bug_id: int
    created_at: datetime
    module_name: Optional[str] = Field(None, description="模块名称")
    
    class Config:
        from_attributes = True


# 请求参数Schema
class BugListParams(BaseModel):
    """Bug列表查询参数"""
    page: int = Field(1, ge=1, description="页码")
    page_size: int = Field(10, ge=1, le=100, description="每页数量")
    keyword: Optional[str] = Field(None, description="搜索关键词")
    severity: Optional[BugSeverity] = Field(None, description="严重程度筛选")
    status: Optional[BugStatus] = Field(None, description="状态筛选")
    workspace_id: Optional[int] = Field(None, description="工作区ID")


class BugLogListParams(BaseModel):
    """Bug日志列表查询参数"""
    page: int = Field(1, ge=1, description="页码")
    page_size: int = Field(10, ge=1, le=100, description="每页数量")


class BugAnalysisParams(BaseModel):
    """Bug分析参数"""
    time_range: str = Field("30d", description="时间范围")
    analysis_type: str = Field("overview", description="分析类型")


# 分析结果Schema
class ModuleHealthScore(BaseModel):
    """模块健康分"""
    module_id: int
    module_name: str
    health_score: float = Field(..., ge=0, le=100, description="健康分")
    critical_count: int = Field(0, description="严重问题数量")
    high_count: int = Field(0, description="高优先级问题数量")
    medium_count: int = Field(0, description="中优先级问题数量")
    low_count: int = Field(0, description="低优先级问题数量")


class BugTrendData(BaseModel):
    """Bug趋势数据"""
    date: str
    count: int


class BugAnalysisResponse(BaseModel):
    """Bug分析响应模型"""
    module_health_scores: List[ModuleHealthScore] = Field(default_factory=list, description="模块健康分")
    bug_trends: List[BugTrendData] = Field(default_factory=list, description="Bug趋势数据")
    severity_distribution: dict = Field(default_factory=dict, description="严重程度分布")
    total_bugs: int = Field(0, description="总Bug数量")
    total_occurrences: int = Field(0, description="总发生次数")


# 更新前向引用
BugProfileDetailResponse.model_rebuild()
