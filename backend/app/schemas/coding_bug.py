from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


# Coding缺陷相关Schema
class CodingBugBase(BaseModel):
    """Coding缺陷基础模型"""
    title: str = Field(..., description="缺陷标题")
    description: Optional[str] = Field(None, description="缺陷描述")
    priority: str = Field(..., description="优先级")
    status_name: str = Field(..., description="状态名称")
    project_name: Optional[str] = Field(None, description="项目名称")


class CodingBugResponse(CodingBugBase):
    """Coding缺陷响应模型"""
    id: int
    coding_bug_id: int
    coding_bug_code: int
    creator_id: Optional[int] = None
    coding_created_at: Optional[int] = None
    coding_updated_at: Optional[int] = None
    workspace_id: int
    assignees: Optional[List[str]] = []
    labels: Optional[List[str]] = []
    iteration_name: Optional[str] = None
    synced_at: datetime
    created_at: datetime
    updated_at: datetime
    module_links: Optional[List[Dict[str, Any]]] = []

    class Config:
        from_attributes = True


# Coding缺陷模块关联相关Schema
class CodingBugModuleLinkBase(BaseModel):
    """Coding缺陷模块关联基础模型"""
    manifestation_description: Optional[str] = Field(None, description="在该模块下的特定表现描述")


class CodingBugModuleLinkCreate(CodingBugModuleLinkBase):
    """创建Coding缺陷模块关联请求模型"""
    module_id: int = Field(..., description="模块ID")
    coding_bug_id: int = Field(..., description="Coding缺陷ID")


class CodingBugModuleLinkResponse(CodingBugModuleLinkBase):
    """Coding缺陷模块关联响应模型"""
    id: int
    module_id: int
    coding_bug_id: int
    created_at: datetime
    module_name: Optional[str] = None

    class Config:
        from_attributes = True


class CodingBugDetailResponse(CodingBugResponse):
    """Coding缺陷详情响应模型"""
    module_links: List[CodingBugModuleLinkResponse] = Field(default_factory=list, description="关联模块")


# Coding配置相关Schema
class WorkspaceCodingConfigBase(BaseModel):
    """工作区Coding配置基础模型"""
    api_token: str = Field(..., description="Coding API Token")
    project_name: str = Field(..., description="Coding项目名称")
    is_enabled: Optional[bool] = Field(True, description="是否启用")
    sync_conditions: Optional[List[Dict[str, str]]] = Field(None, description="同步条件配置")
    selected_iteration: Optional[str] = Field(None, description="选中的迭代ID")


class WorkspaceCodingConfigCreate(WorkspaceCodingConfigBase):
    """创建工作区Coding配置请求模型"""
    workspace_id: int = Field(..., description="工作区ID")


class WorkspaceCodingConfigUpdate(BaseModel):
    """更新工作区Coding配置请求模型"""
    api_token: Optional[str] = Field(None, description="Coding API Token")
    project_name: Optional[str] = Field(None, description="Coding项目名称")
    is_enabled: Optional[bool] = Field(None, description="是否启用")
    sync_conditions: Optional[List[Dict[str, str]]] = Field(None, description="同步条件配置")
    selected_iteration: Optional[str] = Field(None, description="选中的迭代ID")


class WorkspaceCodingConfigResponse(WorkspaceCodingConfigBase):
    """工作区Coding配置响应模型"""
    id: int
    workspace_id: int
    last_sync_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    created_by: int
    
    class Config:
        from_attributes = True


# 查询参数Schema
class CodingBugListParams(BaseModel):
    """Coding缺陷列表查询参数"""
    page: Optional[int] = Field(1, ge=1, description="页码")
    page_size: Optional[int] = Field(20, ge=1, le=100, description="每页数量")
    keyword: Optional[str] = Field(None, description="搜索关键词")
    priority: Optional[str] = Field(None, description="优先级筛选")
    status_name: Optional[str] = Field(None, description="状态筛选")
    workspace_id: Optional[int] = Field(None, description="工作区ID")
    start_date: Optional[str] = Field(None, description="开始日期 YYYY-MM-DD")
    end_date: Optional[str] = Field(None, description="结束日期 YYYY-MM-DD")


class CodingBugSyncParams(BaseModel):
    """Coding缺陷同步参数"""
    workspace_id: int = Field(..., description="工作区ID")
    force_sync: Optional[bool] = Field(False, description="是否强制同步")
    conditions: Optional[List[Dict[str, str]]] = Field(None, description="同步条件")


# 模块缺陷查询参数
class ModuleCodingBugParams(BaseModel):
    """模块关联的Coding缺陷查询参数"""
    module_id: int = Field(..., description="模块ID")
    page: Optional[int] = Field(1, ge=1, description="页码")
    page_size: Optional[int] = Field(10, ge=1, le=50, description="每页数量")


# 关联操作请求Schema
class UnlinkCodingBugFromModuleRequest(BaseModel):
    """取消Coding缺陷与模块关联请求"""
    coding_bug_id: int = Field(..., description="Coding缺陷ID")
    module_id: int = Field(..., description="模块ID")


# 分页响应Schema
class PaginatedCodingBugResponse(BaseModel):
    """分页Coding缺陷响应"""
    items: List[CodingBugResponse]
    total: int
    page: int
    page_size: int


# 数据分析相关Schema
class CodingBugAnalysisResponse(BaseModel):
    """Coding缺陷分析响应"""
    total_bugs: int = Field(..., description="总缺陷数")
    priority_distribution: Dict[str, int] = Field(..., description="优先级分布")
    status_distribution: Dict[str, int] = Field(..., description="状态分布")
    module_bug_counts: List[Dict[str, Any]] = Field(..., description="模块缺陷统计")
    recent_bugs: List[CodingBugResponse] = Field(..., description="最近缺陷")


class ModuleHealthScore(BaseModel):
    """模块健康分数"""
    module_id: int
    module_name: str
    bug_count: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    health_score: float
