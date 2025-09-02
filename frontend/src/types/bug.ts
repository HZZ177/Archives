// Bug严重程度枚举
export enum BugSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

// Bug状态枚举
export enum BugStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED'
}

// Bug档案基础接口
export interface BugProfileBase {
  title: string;
  description?: string;
  severity: BugSeverity;
  status: BugStatus;
  tags?: string[];
}

// 创建Bug档案请求
export interface BugProfileCreate extends BugProfileBase {
  module_ids?: number[];
  manifestation_descriptions?: string[];
}

// 更新Bug档案请求
export interface BugProfileUpdate {
  title?: string;
  description?: string;
  severity?: BugSeverity;
  status?: BugStatus;
  tags?: string[];
  module_ids?: number[];
  manifestation_descriptions?: string[];
}

// Bug档案响应
export interface BugProfileResponse extends BugProfileBase {
  id: number;
  reporter_id: number;
  workspace_id: number;
  created_at: string;
  updated_at: string;
  occurrence_count: number;
  last_occurrence?: string;
}

// Bug档案详情响应
export interface BugProfileDetailResponse extends BugProfileResponse {
  logs: BugLogResponse[];
  module_links: BugModuleLinkResponse[];
}

// Bug日志基础接口
export interface BugLogBase {
  notes?: string;
}

// 创建Bug日志请求
export interface BugLogCreate extends BugLogBase {}

// Bug日志响应
export interface BugLogResponse extends BugLogBase {
  id: number;
  bug_id: number;
  occurred_at: string;
  reporter_id: number;
  created_at: string;
  module_id?: number;
  module_name?: string;
}

// Bug模块关联基础接口
export interface BugModuleLinkBase {
  manifestation_description?: string;
}

// 创建Bug模块关联请求
export interface BugModuleLinkCreate extends BugModuleLinkBase {
  module_id: number;
}

// Bug模块关联响应
export interface BugModuleLinkResponse extends BugModuleLinkBase {
  id: number;
  module_id: number;
  bug_id: number;
  created_at: string;
  module_name?: string;
}

// Bug列表查询参数
export interface BugListParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  severity?: BugSeverity;
  status?: BugStatus;
  workspace_id?: number;
}

// Bug日志列表查询参数
export interface BugLogListParams {
  page?: number;
  page_size?: number;
}

// Bug分析参数
export interface BugAnalysisParams {
  time_range?: string;
  analysis_type?: string;
}

// 模块健康分
export interface ModuleHealthScore {
  module_id: number;
  module_name: string;
  health_score: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
}

// Bug趋势数据
export interface BugTrendData {
  date: string;
  count: number;
}

// Bug分析响应
export interface BugAnalysisResponse {
  module_health_scores: ModuleHealthScore[];
  bug_trends: BugTrendData[];
  severity_distribution: Record<string, number>;
  total_bugs: number;
  total_occurrences: number;
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// Bug列表响应
export interface BugListResponse extends PaginatedResponse<BugProfileResponse> {}

// Bug日志列表响应
export interface BugLogListResponse extends PaginatedResponse<BugLogResponse> {}

// 模块Bug列表响应
export interface ModuleBugListResponse extends PaginatedResponse<BugProfileResponse> {}

// API请求参数类型
export interface CreateBugRequest {
  title: string;
  description?: string;
  severity: BugSeverity;
  status: BugStatus;
  tags?: string[];
  module_ids?: number[];
  manifestation_descriptions?: string[];
}

export interface UpdateBugRequest {
  bug_id: number;
  data: BugProfileUpdate;
}

export interface DeleteBugRequest {
  bug_id: number;
}

export interface GetBugDetailRequest {
  bug_id: number;
}

export interface LogBugOccurrenceRequest {
  bug_id: number;
  notes?: string;
  module_id?: number;
}

export interface GetBugLogsRequest {
  bug_id: number;
  page?: number;
  page_size?: number;
}

export interface LinkBugToModuleRequest {
  bug_id: number;
  module_id: number;
  manifestation_description?: string;
}

export interface GetModuleBugsRequest {
  module_id: number;
  page?: number;
  page_size?: number;
}

export interface UnlinkBugFromModuleRequest {
  bug_id: number;
  module_id: number;
}

export interface GetBugAnalysisRequest {
  workspace_id: number;
  time_range?: string;
  analysis_type?: string;
}

// 状态选项
export const STATUS_OPTIONS = [
  { value: BugStatus.OPEN, label: '待处理', color: 'magenta' },
  { value: BugStatus.IN_PROGRESS, label: '处理中', color: 'blue' },
  { value: BugStatus.RESOLVED, label: '已解决', color: 'green' },
  { value: BugStatus.CLOSED, label: '已关闭', color: 'default' }
];

// 严重程度选项
export const SEVERITY_OPTIONS = [
  { value: BugSeverity.CRITICAL, label: '严重', color: '#ff4d4f' },
  { value: BugSeverity.HIGH, label: '高', color: '#ff7a45' },
  { value: BugSeverity.MEDIUM, label: '中', color: '#faad14' },
  { value: BugSeverity.LOW, label: '低', color: '#52c41a' }
];

// 时间范围选项
export const TIME_RANGE_OPTIONS = [
  { value: '7d', label: '最近7天' },
  { value: '30d', label: '最近30天' },
  { value: '90d', label: '最近90天' }
];

// 分析类型选项
export const ANALYSIS_TYPE_OPTIONS = [
  { value: 'overview', label: '概览' },
  { value: 'trend', label: '趋势' },
  { value: 'module', label: '模块分析' }
];
