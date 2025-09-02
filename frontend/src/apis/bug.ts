import { apiClient } from '../utils/apiClient';
import { APIResponse } from '../types/api';
import {
  BugProfileCreate,
  BugProfileUpdate,
  BugLogCreate,
  BugModuleLinkCreate,
  BugListParams,
  BugLogListParams,
  BugAnalysisParams,
  BugProfileResponse,
  BugProfileDetailResponse,
  BugLogResponse,
  BugModuleLinkResponse,
  BugAnalysisResponse,
  BugListResponse,
  BugLogListResponse,
  ModuleBugListResponse,
  CreateBugRequest,
  UpdateBugRequest,
  DeleteBugRequest,
  GetBugDetailRequest,
  LogBugOccurrenceRequest,
  GetBugLogsRequest,
  LinkBugToModuleRequest,
  GetModuleBugsRequest,
  UnlinkBugFromModuleRequest,
  GetBugAnalysisRequest
} from '../types/bug';

/**
 * Bug管理API服务
 */
export const bugApi = {
  /**
   * 创建Bug档案
   */
  async createBugProfile(data: CreateBugRequest): Promise<APIResponse<BugProfileResponse>> {
    return apiClient.post('/bugs/', data);
  },

  /**
   * 获取Bug档案列表
   */
  async getBugProfiles(params: BugListParams): Promise<APIResponse<BugListResponse>> {
    return apiClient.get('/bugs/', params);
  },

  /**
   * 获取Bug档案详情
   */
  async getBugDetail(bugId: number): Promise<APIResponse<BugProfileDetailResponse>> {
    return apiClient.post('/bugs/get-detail', { bug_id: bugId });
  },

  /**
   * 更新Bug档案
   */
  async updateBugProfile(bugId: number, data: BugProfileUpdate): Promise<APIResponse<BugProfileResponse>> {
    return apiClient.post('/bugs/update', { bug_id: bugId, data });
  },

  /**
   * 删除Bug档案
   */
  async deleteBugProfile(bugId: number): Promise<APIResponse<void>> {
    return apiClient.post('/bugs/delete', { bug_id: bugId });
  },

  /**
   * 记录Bug发生
   */
  async logBugOccurrence(bugId: number, notes?: string): Promise<APIResponse<BugLogResponse>> {
    return apiClient.post('/bugs/log-occurrence', { bug_id: bugId, notes });
  },

  /**
   * 获取Bug发生历史
   */
  async getBugLogs(bugId: number, params: BugLogListParams): Promise<APIResponse<BugLogListResponse>> {
    return apiClient.post('/bugs/get-logs', { bug_id: bugId, ...params });
  },

  /**
   * 关联Bug到模块
   */
  async linkBugToModule(bugId: number, moduleId: number, description?: string): Promise<APIResponse<BugModuleLinkResponse>> {
    return apiClient.post('/bugs/link-module', { 
      bug_id: bugId, 
      module_id: moduleId, 
      manifestation_description: description 
    });
  },

  /**
   * 获取模块关联的所有Bug
   */
  async getModuleBugs(moduleId: number, params: BugLogListParams): Promise<APIResponse<ModuleBugListResponse>> {
    return apiClient.post('/bugs/get-module-bugs', { module_id: moduleId, ...params });
  },

  /**
   * 取消Bug与模块的关联
   */
  async unlinkBugFromModule(bugId: number, moduleId: number): Promise<APIResponse<void>> {
    return apiClient.post('/bugs/unlink-module', { bug_id: bugId, module_id: moduleId });
  },

  /**
   * 获取Bug分析结果
   */
  async getBugAnalysis(workspaceId: number, params: BugAnalysisParams): Promise<APIResponse<BugAnalysisResponse>> {
    return apiClient.post('/bugs/analysis', { workspace_id: workspaceId, ...params });
  }
};

/**
 * Bug管理API服务类
 */
export class BugApiService {
  /**
   * 创建Bug档案
   */
  static async createBugProfile(data: CreateBugRequest): Promise<APIResponse<BugProfileResponse>> {
    return bugApi.createBugProfile(data);
  }

  /**
   * 获取Bug档案列表
   */
  static async getBugProfiles(params: BugListParams): Promise<APIResponse<BugListResponse>> {
    return bugApi.getBugProfiles(params);
  }

  /**
   * 获取Bug档案详情
   */
  static async getBugDetail(bugId: number): Promise<APIResponse<BugProfileDetailResponse>> {
    return bugApi.getBugDetail(bugId);
  }

  /**
   * 更新Bug档案
   */
  static async updateBugProfile(bugId: number, data: BugProfileUpdate): Promise<APIResponse<BugProfileResponse>> {
    return bugApi.updateBugProfile(bugId, data);
  }

  /**
   * 删除Bug档案
   */
  static async deleteBugProfile(bugId: number): Promise<APIResponse<void>> {
    return bugApi.deleteBugProfile(bugId);
  }

  /**
   * 记录Bug发生
   */
  static async logBugOccurrence(bugId: number, notes?: string): Promise<APIResponse<BugLogResponse>> {
    return bugApi.logBugOccurrence(bugId, notes);
  }

  /**
   * 获取Bug发生历史
   */
  static async getBugLogs(bugId: number, params: BugLogListParams): Promise<APIResponse<BugLogListResponse>> {
    return bugApi.getBugLogs(bugId, params);
  }

  /**
   * 关联Bug到模块
   */
  static async linkBugToModule(bugId: number, moduleId: number, description?: string): Promise<APIResponse<BugModuleLinkResponse>> {
    return bugApi.linkBugToModule(bugId, moduleId, description);
  }

  /**
   * 获取模块关联的所有Bug
   */
  static async getModuleBugs(moduleId: number, params: BugLogListParams): Promise<APIResponse<ModuleBugListResponse>> {
    return bugApi.getModuleBugs(moduleId, params);
  }

  /**
   * 取消Bug与模块的关联
   */
  static async unlinkBugFromModule(bugId: number, moduleId: number): Promise<APIResponse<void>> {
    return bugApi.unlinkBugFromModule(bugId, moduleId);
  }

  /**
   * 获取Bug分析结果
   */
  static async getBugAnalysis(workspaceId: number, params: BugAnalysisParams): Promise<APIResponse<BugAnalysisResponse>> {
    return bugApi.getBugAnalysis(workspaceId, params);
  }
}

export default bugApi;
