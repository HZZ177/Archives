import { apiClient } from '../utils/apiClient';
import { APIResponse } from '../types/api';
import {
  CodingBugResponse,
  CodingBugDetailResponse,
  CodingBugListParams,
  CodingBugSyncParams,
  ModuleCodingBugParams,
  UnlinkCodingBugFromModuleRequest,
  PaginatedCodingBugResponse,
  CodingBugAnalysisResponse,
  WorkspaceCodingConfigCreate,
  WorkspaceCodingConfigUpdate,
  WorkspaceCodingConfigResponse
} from '../types/coding-bug';

/**
 * Coding缺陷管理API服务
 */
export const codingBugApi = {
  /**
   * 从Coding平台同步缺陷数据
   */
  async syncFromCoding(data: CodingBugSyncParams): Promise<APIResponse<{
    synced_count: number;
    total_available: number;
    sync_time: string;
    project_name: string;
  }>> {
    return apiClient.post('/coding-bugs/sync-from-coding', data);
  },

  /**
   * 获取Coding缺陷列表
   */
  async getCodingBugs(params: CodingBugListParams): Promise<APIResponse<PaginatedCodingBugResponse>> {
    return apiClient.get('/coding-bugs/', params);
  },

  /**
   * 获取Coding缺陷详情
   */
  async getCodingBugDetail(codingBugId: number): Promise<APIResponse<CodingBugDetailResponse>> {
    return apiClient.post('/coding-bugs/get-detail', { coding_bug_id: codingBugId });
  },



  /**
   * 取消Coding缺陷与模块关联
   */
  async unlinkCodingBugFromModule(data: UnlinkCodingBugFromModuleRequest): Promise<APIResponse<string>> {
    return apiClient.post('/coding-bugs/unlink-from-module', data);
  },

  /**
   * 获取模块关联的Coding缺陷
   */
  async getModuleCodingBugs(params: ModuleCodingBugParams): Promise<APIResponse<PaginatedCodingBugResponse>> {
    return apiClient.post('/coding-bugs/get-module-bugs', params);
  },

  /**
   * 获取Coding缺陷分析数据
   */
  async getCodingBugAnalysis(workspaceId: number): Promise<APIResponse<CodingBugAnalysisResponse>> {
    return apiClient.get(`/coding-bugs/analysis/${workspaceId}`);
  }
};

/**
 * Coding配置管理API服务
 */
export const codingConfigApi = {
  /**
   * 创建工作区Coding配置
   */
  async createCodingConfig(data: WorkspaceCodingConfigCreate): Promise<APIResponse<WorkspaceCodingConfigResponse>> {
    return apiClient.post('/coding-bugs/config', data);
  },

  /**
   * 获取工作区Coding配置
   */
  async getCodingConfig(workspaceId: number): Promise<APIResponse<WorkspaceCodingConfigResponse>> {
    return apiClient.get(`/coding-bugs/config/${workspaceId}`);
  },

  /**
   * 更新工作区Coding配置
   */
  async updateCodingConfig(workspaceId: number, data: WorkspaceCodingConfigUpdate): Promise<APIResponse<WorkspaceCodingConfigResponse>> {
    return apiClient.put(`/coding-bugs/config/${workspaceId}`, data);
  },

  /**
   * 删除工作区Coding配置
   */
  async deleteCodingConfig(workspaceId: number): Promise<APIResponse<string>> {
    return apiClient.delete(`/coding-bugs/config/${workspaceId}`);
  },

  /**
   * 测试工作区Coding配置连接
   */
  async testCodingConfig(workspaceId: number): Promise<APIResponse<{
    success: boolean;
    message: string;
    project_name: string;
    test_time: string;
  }>> {
    return apiClient.post(`/coding-bugs/config/${workspaceId}/test`);
  }
};

// 导出统一的API对象
export const codingApi = {
  ...codingBugApi,
  ...codingConfigApi
};
