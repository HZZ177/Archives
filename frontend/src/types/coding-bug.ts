// Coding缺陷相关类型定义

// Coding缺陷基础接口
export interface CodingBugBase {
  title: string;
  description?: string;
  priority: string; // 最高、高、中、低
  status_name: string;
  project_name?: string;
}

// Coding缺陷响应接口
export interface CodingBugResponse extends CodingBugBase {
  id: number;
  coding_bug_id: number;
  coding_bug_code: number;
  creator_id?: number;
  coding_created_at?: number;
  coding_updated_at?: number;
  workspace_id: number;
  assignees?: string[];
  labels?: string[];
  iteration_name?: string;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

// Coding缺陷详情响应接口
export interface CodingBugDetailResponse extends CodingBugResponse {
  module_links: CodingBugModuleLinkResponse[];
}

// Coding缺陷模块关联接口
export interface CodingBugModuleLinkBase {
  manifestation_description?: string;
}

// 创建Coding缺陷模块关联请求
export interface CodingBugModuleLinkCreate extends CodingBugModuleLinkBase {
  module_id: number;
  coding_bug_id: number;
}

// Coding缺陷模块关联响应
export interface CodingBugModuleLinkResponse extends CodingBugModuleLinkBase {
  id: number;
  module_id: number;
  coding_bug_id: number;
  created_at: string;
  module_name?: string;
}

// 工作区Coding配置基础接口
export interface WorkspaceCodingConfigBase {
  api_token: string;
  project_name: string;
  api_base_url?: string;
  is_enabled?: boolean;
  sync_conditions?: Array<{key: string; value: string}>;
  selected_iteration?: string;
}

// 创建工作区Coding配置请求
export interface WorkspaceCodingConfigCreate extends WorkspaceCodingConfigBase {
  workspace_id: number;
}

// 更新工作区Coding配置请求
export interface WorkspaceCodingConfigUpdate {
  api_token?: string;
  project_name?: string;
  api_base_url?: string;
  is_enabled?: boolean;
  sync_conditions?: Array<{key: string; value: string}>;
  selected_iteration?: string;
}

// 工作区Coding配置响应
export interface WorkspaceCodingConfigResponse extends WorkspaceCodingConfigBase {
  id: number;
  workspace_id: number;
  last_sync_at?: string;
  created_at: string;
  updated_at: string;
  created_by: number;
}

// 查询参数接口
export interface CodingBugListParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  priority?: string;
  status_name?: string;
  workspace_id?: number;
}

// 同步参数接口
export interface CodingBugSyncParams {
  workspace_id: number;
  force_sync?: boolean;
  conditions?: Array<{key: string; value: string}>;
}

// 模块缺陷查询参数
export interface ModuleCodingBugParams {
  module_id: number;
  page?: number;
  page_size?: number;
}

// 关联操作请求接口
// 取消关联操作请求接口
export interface UnlinkCodingBugFromModuleRequest {
  coding_bug_id: number;
  module_id: number;
}

// 分页响应接口
export interface PaginatedCodingBugResponse {
  items: CodingBugResponse[];
  total: number;
  page: number;
  page_size: number;
}

// 数据分析响应接口
export interface CodingBugAnalysisResponse {
  total_bugs: number;
  priority_distribution: Record<string, number>;
  status_distribution: Record<string, number>;
  module_bug_counts: Array<{
    module_id: number;
    module_name: string;
    bug_count: number;
  }>;
  recent_bugs: CodingBugResponse[];
}

// 模块健康分数接口
export interface ModuleHealthScore {
  module_id: number;
  module_name: string;
  bug_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  health_score: number;
}

// 优先级选项
export const PRIORITY_OPTIONS = [
  { label: '紧急', value: '紧急', color: '#ff4d4f' },
  { label: '高', value: '高', color: '#ff7a45' },
  { label: '中', value: '中', color: '#faad14' },
  { label: '低', value: '低', color: '#52c41a' }
];

// 状态选项
export const STATUS_OPTIONS = [
  { label: '待处理', value: '待处理', color: 'magenta' },
  { label: '处理中', value: '处理中', color: 'blue' },
  { label: '已解决', value: '已解决', color: 'green' },
  { label: '已关闭', value: '已关闭', color: 'default' }
];
