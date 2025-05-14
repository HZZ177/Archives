import request, { unwrapResponse } from '../utils/request';
import { 
  Workspace, 
  WorkspaceCreateRequest, 
  WorkspaceUpdateRequest,
  WorkspaceListResponse,
  WorkspaceUser,
  WorkspaceUserListResponse,
  AddUserToWorkspaceRequest,
  SetDefaultWorkspaceRequest,
  CreateWorkspaceParams,
  UpdateWorkspaceParams,
  WorkspaceUserParams
} from '../types/workspace';
import { APIResponse } from '../types/api';

const API_WORKSPACES = '/workspaces';

// 工作区缓存
let workspaceCache: {
  list: Workspace[] | null;
  default: Workspace | null;
  timestamp: number;
  loading: boolean;
} = {
  list: null,
  default: null,
  timestamp: 0,
  loading: false
};

// 缓存过期时间: 5分钟
const CACHE_TTL = 300000;

/**
 * 清除工作区缓存
 */
export const invalidateWorkspaceCache = () => {
  workspaceCache.list = null;
  workspaceCache.default = null;
  workspaceCache.timestamp = 0;
  workspaceCache.loading = false;
  console.log('工作区缓存已清空');
};

/**
 * 获取工作区列表
 * @param forceRefresh 是否强制刷新缓存
 * @returns 工作区列表
 */
export const fetchWorkspaces = async (forceRefresh = false): Promise<Workspace[]> => {
  try {
    const params = forceRefresh ? { refresh: true } : {};
    const response = await request.get<APIResponse<Workspace[]>>('/workspaces', { params });
    return unwrapResponse(response.data);
  } catch (error) {
    console.error('获取工作区列表失败:', error);
    throw error;
  }
};

/**
 * 获取默认工作区
 * @param forceRefresh 是否强制刷新缓存
 * @returns 默认工作区
 */
export const fetchDefaultWorkspace = async (forceRefresh = false): Promise<Workspace> => {
  try {
    const params = forceRefresh ? { refresh: true } : {};
    const response = await request.get<APIResponse<Workspace>>('/workspaces/default', { params });
    return unwrapResponse(response.data);
  } catch (error) {
    console.error('获取默认工作区失败:', error);
    throw error;
  }
};

/**
 * 获取工作区详情
 * @param id 工作区ID
 * @returns 工作区详情
 */
export const fetchWorkspaceById = async (id: number): Promise<Workspace> => {
  try {
    const response = await request.get<APIResponse<Workspace>>(`/workspaces/${id}`);
    return unwrapResponse(response.data);
  } catch (error) {
    console.error(`获取工作区(ID:${id})详情失败:`, error);
    throw error;
  }
};

/**
 * 创建工作区
 * @param params 工作区数据
 * @returns 创建的工作区
 */
export const createWorkspace = async (params: CreateWorkspaceParams): Promise<Workspace> => {
  try {
    const response = await request.post<APIResponse<Workspace>>('/workspaces', params);
    return unwrapResponse(response.data);
  } catch (error) {
    console.error('创建工作区失败:', error);
    throw error;
  }
};

/**
 * 更新工作区
 * @param id 工作区ID
 * @param params 更新数据
 * @returns 更新后的工作区
 */
export const updateWorkspace = async (id: number, params: UpdateWorkspaceParams): Promise<Workspace> => {
  try {
    const response = await request.post<APIResponse<Workspace>>(`/workspaces/update/${id}`, params);
    invalidateWorkspaceCache();
    return unwrapResponse(response.data);
  } catch (error) {
    console.error(`更新工作区(ID:${id})失败:`, error);
    throw error;
  }
};

/**
 * 删除工作区
 * @param id 工作区ID
 */
export const deleteWorkspace = async (id: number): Promise<void> => {
  try {
    await request.post<APIResponse<void>>(`/workspaces/delete/${id}`);
    invalidateWorkspaceCache();
  } catch (error) {
    console.error(`删除工作区(ID:${id})失败:`, error);
    throw error;
  }
};

/**
 * 获取工作区用户列表
 * @param workspaceId 工作区ID
 * @returns 用户列表
 */
export const fetchWorkspaceUsers = async (workspaceId: number): Promise<WorkspaceUser[]> => {
  try {
    const response = await request.get<APIResponse<WorkspaceUser[]>>(`/workspaces/${workspaceId}/users`);
    return unwrapResponse(response.data);
  } catch (error) {
    console.error(`获取工作区(ID:${workspaceId})用户列表失败:`, error);
    throw error;
  }
};

/**
 * 添加用户到工作区
 * @param workspaceId 工作区ID
 * @param params 用户数据
 */
export const addUserToWorkspace = async (workspaceId: number, params: WorkspaceUserParams): Promise<void> => {
  try {
    const response = await request.post<APIResponse<any>>(`/workspaces/${workspaceId}/users`, params);
    // 仅检查success字段，不再使用unwrapResponse
    if (!response.data.success) {
      throw new Error(response.data.message || '添加用户到工作区失败');
    }
    // 成功添加用户，不需要返回数据
  } catch (error) {
    console.error(`添加用户到工作区(ID:${workspaceId})失败:`, error);
    throw error;
  }
};

/**
 * 更新工作区用户角色
 * @param workspaceId 工作区ID
 * @param userId 用户ID
 * @param role 前端显示的角色
 * @returns 更新后的用户
 */
export const updateWorkspaceUserRole = async (workspaceId: number, userId: number, role: string): Promise<WorkspaceUser> => {
  try {
    // 角色映射：从前端显示角色映射到后端access_level
    const roleToAccessLevel: Record<string, string> = {
      'owner': 'owner',
      'admin': 'admin',
      'member': 'write', // 成员对应write权限
      'guest': 'read'    // 访客对应read权限
    };
    
    // 使用access_level作为参数名，与后端API匹配
    const response = await request.post<APIResponse<WorkspaceUser>>(
      `/workspaces/${workspaceId}/users/${userId}`, 
      { access_level: roleToAccessLevel[role] || 'read' }
    );
    return unwrapResponse(response.data);
  } catch (error) {
    console.error(`更新工作区(ID:${workspaceId})用户(ID:${userId})角色失败:`, error);
    throw error;
  }
};

/**
 * 从工作区移除用户
 * @param workspaceId 工作区ID
 * @param userId 用户ID
 */
export const removeUserFromWorkspace = async (workspaceId: number, userId: number): Promise<void> => {
  try {
    await request.post<APIResponse<void>>(`/workspaces/${workspaceId}/users/${userId}/remove`);
  } catch (error) {
    console.error(`从工作区(ID:${workspaceId})移除用户(ID:${userId})失败:`, error);
    throw error;
  }
};

/**
 * 设置默认工作区
 * @param userId 用户ID
 * @param workspaceId 工作区ID
 */
export const setDefaultWorkspace = async (userId: number, workspaceId: number): Promise<void> => {
  try {
    await request.post<APIResponse<void>>(`/workspaces/default`, { 
      user_id: userId, 
      workspace_id: workspaceId 
    });
    invalidateWorkspaceCache();
  } catch (error) {
    console.error(`设置默认工作区失败:`, error);
    throw error;
  }
}; 