import request, { unwrapResponse } from '../utils/request';
import { 
  Workspace, 
  WorkspaceListResponse,
  WorkspaceUser,
  WorkspaceUserListResponse,
  AddUserToWorkspaceRequest,
  BatchAddUsersToWorkspaceRequest,
  BatchRemoveUsersFromWorkspaceRequest,
  SetDefaultWorkspaceRequest,
  CreateWorkspaceParams,
  UpdateWorkspaceParams,
  WorkspaceUserParams,
  WorkspaceTable,
  WorkspaceTableRead,
  WorkspaceTableCreate,
  WorkspaceTableUpdate,
  WorkspaceInterface,
  WorkspaceInterfaceCreate,
  WorkspaceInterfaceUpdate
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
 * 批量添加用户到工作区
 * @param workspaceId 工作区ID
 * @param params 包含用户ID列表和访问级别
 * @returns API响应，可能包含成功/失败信息和操作详情
 */
export const addUsersToWorkspaceBatch = async (
  workspaceId: number, 
  params: BatchAddUsersToWorkspaceRequest
): Promise<APIResponse<any>> => {
  try {
    const response = await request.post<APIResponse<any>>(
      `/workspaces/${workspaceId}/users/batch`, 
      params
    );
    // 后端直接返回 APIResponse 结构，如果需要解包则调整
    if (!response.data.success) {
      throw new Error(response.data.message || '批量添加用户到工作区失败');
    }
    return response.data; // 返回整个 APIResponse 以便前端获取 details
  } catch (error) {
    console.error(`批量添加用户到工作区(ID:${workspaceId})失败:`, error);
    throw error;
  }
};

/**
 * 批量从工作区移除用户
 * @param workspaceId 工作区ID
 * @param userIds 要移除的用户ID列表
 * @returns API响应
 */
export const removeUsersFromWorkspaceBatch = async (
  workspaceId: number, 
  userIds: number[]
): Promise<APIResponse<any>> => {
  try {
    const response = await request.post<APIResponse<any>>(
      `/workspaces/${workspaceId}/users/batch-remove`, 
      { user_ids: userIds } // Ensure payload matches backend schema
    );
    if (!response.data.success) {
      throw new Error(response.data.message || '批量移除用户失败');
    }
    return response.data;
  } catch (error) {
    console.error(`批量从工作区(ID:${workspaceId})移除用户失败:`, error);
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
      `/workspaces/${workspaceId}/users/${userId}/role`,
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
    await request.delete<APIResponse<void>>(`/workspaces/${workspaceId}/users/${userId}`);
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
    await request.post<APIResponse<void>>(`/users/${userId}/default-workspace`, { workspace_id: workspaceId });
    invalidateWorkspaceCache();
  } catch (error) {
    console.error(`设置默认工作区(ID:${workspaceId})失败:`, error);
    throw error;
  }
};

// 工作区表相关API

/**
 * 获取工作区下的所有数据库表，支持分页和搜索
 * @param workspaceId 工作区ID
 * @param page 页码，从1开始
 * @param pageSize 每页数量
 * @param search 搜索关键词
 * @param returnAllItems 是否只返回表数组而不是分页对象，用于兼容旧版调用
 * @returns 分页的数据库表列表和总数，或仅数据库表数组（当returnAllItems为true时）
 */
export const getWorkspaceTables = async <T extends boolean = false>(
  workspaceId: number, 
  page: number = 1, 
  pageSize: number = 10,
  search: string = '',
  returnAllItems: T = false as T
): Promise<T extends true ? WorkspaceTableRead[] : {
  items: WorkspaceTableRead[],
  total: number,
  page: number,
  page_size: number
}> => {
  try {
    const params: Record<string, any> = { page, page_size: pageSize };
    if (search) {
      params.search = search;
    }
    
    console.log(`获取工作区数据库表，参数:`, { workspaceId, page, pageSize, search, returnAllItems });
    
    const response = await request.get<APIResponse<{
      items: WorkspaceTableRead[],
      total: number,
      page: number,
      page_size: number
    }>>(`/workspaces/${workspaceId}/tables`, { params });
    
    const data = unwrapResponse(response.data);
    console.log('获取工作区数据库表响应:', data);
    
    // 确保items是数组
    const result = {
      items: Array.isArray(data.items) ? data.items : [],
      total: data.total || 0,
      page: data.page || 1,
      page_size: data.page_size || pageSize
    };
    
    // 根据returnAllItems参数决定返回类型
    if (returnAllItems) {
      console.log('仅返回数据库表数组:', result.items);
      return result.items as any;
    }
    
    return result as any;
  } catch (error) {
    console.error(`获取工作区(ID:${workspaceId})数据库表列表失败:`, error);
    // 出错时返回安全的默认值
    const defaultResult = {
      items: [],
      total: 0,
      page: page,
      page_size: pageSize
    };
    
    if (returnAllItems) {
      return [] as any;
    }
    
    return defaultResult as any;
  }
};

/**
 * 获取工作区下的特定数据库表
 * @param workspaceId 工作区ID
 * @param tableId 表ID
 * @returns 数据库表详情
 */
export const getWorkspaceTable = async (workspaceId: number, tableId: number): Promise<WorkspaceTableRead> => {
  try {
    const response = await request.get<APIResponse<WorkspaceTableRead>>(`/workspaces/${workspaceId}/tables/${tableId}`);
    return unwrapResponse(response.data);
  } catch (error) {
    console.error(`获取工作区(ID:${workspaceId})数据库表(ID:${tableId})详情失败:`, error);
    throw error;
  }
};

/**
 * 创建工作区数据库表
 * @param workspaceId 工作区ID
 * @param data 表数据
 * @returns 创建的数据库表
 */
export const createWorkspaceTable = async (workspaceId: number, data: WorkspaceTableCreate): Promise<WorkspaceTableRead> => {
  try {
    const response = await request.post<APIResponse<WorkspaceTableRead>>(`/workspaces/${workspaceId}/tables`, data);
    return unwrapResponse(response.data);
  } catch (error) {
    console.error(`创建工作区(ID:${workspaceId})数据库表失败:`, error);
    throw error;
  }
};

/**
 * 更新工作区数据库表
 * @param workspaceId 工作区ID
 * @param tableId 表ID
 * @param data 更新数据
 * @returns 更新后的数据库表
 */
export const updateWorkspaceTable = async (workspaceId: number, tableId: number, data: WorkspaceTableUpdate): Promise<WorkspaceTableRead> => {
  try {
    const response = await request.put<APIResponse<WorkspaceTableRead>>(`/workspaces/${workspaceId}/tables/${tableId}`, data);
    return unwrapResponse(response.data);
  } catch (error) {
    console.error(`更新工作区(ID:${workspaceId})数据库表(ID:${tableId})失败:`, error);
    throw error;
  }
};

/**
 * 删除工作区数据库表
 * @param workspaceId 工作区ID
 * @param tableId 表ID
 */
export const deleteWorkspaceTable = async (workspaceId: number, tableId: number): Promise<void> => {
  try {
    await request.delete<APIResponse<void>>(`/workspaces/${workspaceId}/tables/${tableId}`);
  } catch (error) {
    console.error(`删除工作区(ID:${workspaceId})数据库表(ID:${tableId})失败:`, error);
    throw error;
  }
};

// 工作区接口相关API

/**
 * 获取工作区下的所有接口，支持分页和搜索
 * @param workspaceId 工作区ID
 * @param page 页码，从1开始
 * @param pageSize 每页数量
 * @param search 搜索关键词
 * @param returnAllItems 是否只返回接口数组而不是分页对象，用于兼容旧版调用
 * @returns 分页的接口列表和总数，或仅接口数组（当returnAllItems为true时）
 */
export const getWorkspaceInterfaces = async <T extends boolean = false>(
  workspaceId: number, 
  page: number = 1, 
  pageSize: number = 10,
  search: string = '',
  returnAllItems: T = false as T
): Promise<T extends true ? WorkspaceInterface[] : {
  items: WorkspaceInterface[],
  total: number,
  page: number,
  page_size: number
}> => {
  try {
    const params: Record<string, any> = { page, page_size: pageSize };
    if (search) {
      params.search = search;
    }
    
    console.log(`获取工作区接口，参数:`, { workspaceId, page, pageSize, search, returnAllItems });
    
    const response = await request.get<APIResponse<{
      items: WorkspaceInterface[],
      total: number,
      page: number,
      page_size: number
    }>>(`/workspaces/${workspaceId}/interfaces`, { params });
    
    const data = unwrapResponse(response.data);
    console.log('获取工作区接口响应:', data);
    
    // 确保items是数组
    const result = {
      items: Array.isArray(data.items) ? data.items : [],
      total: data.total || 0,
      page: data.page || 1,
      page_size: data.page_size || pageSize
    };
    
    // 根据returnAllItems参数决定返回类型
    if (returnAllItems) {
      console.log('仅返回接口数组:', result.items);
      return result.items as any;
    }
    
    return result as any;
  } catch (error) {
    console.error(`获取工作区(ID:${workspaceId})接口列表失败:`, error);
    // 出错时返回安全的默认值
    const defaultResult = {
      items: [],
      total: 0,
      page: page,
      page_size: pageSize
    };
    
    if (returnAllItems) {
      return [] as any;
    }
    
    return defaultResult as any;
  }
};

/**
 * 获取工作区下的特定接口
 * @param workspaceId 工作区ID
 * @param interfaceId 接口ID
 * @returns 接口详情
 */
export const getWorkspaceInterface = async (workspaceId: number, interfaceId: number): Promise<WorkspaceInterface> => {
  try {
    const response = await request.get<APIResponse<WorkspaceInterface>>(`/workspaces/${workspaceId}/interfaces/${interfaceId}`);
    return unwrapResponse(response.data);
  } catch (error) {
    console.error(`获取工作区(ID:${workspaceId})接口(ID:${interfaceId})详情失败:`, error);
    throw error;
  }
};

/**
 * 创建工作区接口
 * @param workspaceId 工作区ID
 * @param data 接口数据
 * @returns 创建的接口
 */
export const createWorkspaceInterface = async (workspaceId: number, data: WorkspaceInterfaceCreate): Promise<WorkspaceInterface> => {
  try {
    const response = await request.post<APIResponse<WorkspaceInterface>>(`/workspaces/${workspaceId}/interfaces`, data);
    return unwrapResponse(response.data);
  } catch (error) {
    console.error(`创建工作区(ID:${workspaceId})接口失败:`, error);
    throw error;
  }
};

/**
 * 更新工作区接口
 * @param workspaceId 工作区ID
 * @param interfaceId 接口ID
 * @param data 更新数据
 * @returns 更新后的接口
 */
export const updateWorkspaceInterface = async (workspaceId: number, interfaceId: number, data: WorkspaceInterfaceUpdate): Promise<WorkspaceInterface> => {
  try {
    const response = await request.put<APIResponse<WorkspaceInterface>>(`/workspaces/${workspaceId}/interfaces/${interfaceId}`, data);
    return unwrapResponse(response.data);
  } catch (error) {
    console.error(`更新工作区(ID:${workspaceId})接口(ID:${interfaceId})失败:`, error);
    throw error;
  }
};

/**
 * 删除工作区接口
 * @param workspaceId 工作区ID
 * @param interfaceId 接口ID
 */
export const deleteWorkspaceInterface = async (workspaceId: number, interfaceId: number): Promise<void> => {
  try {
    await request.delete<APIResponse<void>>(`/workspaces/${workspaceId}/interfaces/${interfaceId}`);
  } catch (error) {
    console.error(`删除工作区(ID:${workspaceId})接口(ID:${interfaceId})失败:`, error);
    throw error;
  }
};

/**
 * 检查工作区中是否存在相同路径和方法的接口
 * @param workspaceId 工作区ID
 * @param path 接口路径
 * @param method 请求方法
 * @param excludeId 排除的接口ID（编辑模式下使用）
 * @returns 是否存在重复接口
 */
export const checkInterfaceExists = async (
  workspaceId: number, 
  path: string, 
  method: string, 
  excludeId?: number | string
): Promise<boolean> => {
  try {
    const params: Record<string, any> = { path, method };
    if (excludeId !== undefined) {
      params.exclude_id = excludeId;
    }
    
    const response = await request.get<APIResponse<boolean>>(
      `/workspace-interfaces/workspace/${workspaceId}/check-exists`, 
      { params }
    );
    
    return unwrapResponse(response.data);
  } catch (error) {
    console.error(`检查接口唯一性失败:`, error);
    // 出错时返回false，让后端验证来处理
    return false;
  }
}; 