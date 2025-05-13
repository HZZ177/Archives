import request, { unwrapResponse } from '../utils/request';
import { User } from '../types/user';
import { APIResponse } from '../types/api';

/**
 * 获取用户列表
 * @param params 查询参数
 * @returns 用户列表
 */
export const fetchUsers = async (params?: { 
  page?: number; 
  page_size?: number; 
  keyword?: string;
}): Promise<User[]> => {
  try {
    const queryParams = {
      page: params?.page || 1,
      page_size: params?.page_size || 100,
      keyword: params?.keyword || ''
    };
    
    const response = await request.get<APIResponse<any>>('/users', { params: queryParams });
    const data = unwrapResponse(response.data);
    
    // 处理不同格式的返回数据
    if (Array.isArray(data)) {
      return data;
    } else if (data && data.items) {
      return data.items;
    }
    
    return [];
  } catch (error) {
    console.error('获取用户列表失败:', error);
    throw error;
  }
};

/**
 * 获取用户详情
 * @param userId 用户ID
 * @returns 用户详情
 */
export const fetchUserById = async (userId: number): Promise<User> => {
  try {
    const response = await request.get<APIResponse<User>>(`/users/${userId}`);
    return unwrapResponse(response.data);
  } catch (error) {
    console.error(`获取用户(ID:${userId})详情失败:`, error);
    throw error;
  }
};

/**
 * 创建用户
 * @param data 用户数据
 * @returns 创建的用户
 */
export const createUser = async (data: {
  username: string;
  password: string;
  email?: string;
  mobile?: string;
  is_superuser?: boolean;
  role_ids?: number[];
}): Promise<User> => {
  try {
    const response = await request.post<APIResponse<User>>('/users', data);
    return unwrapResponse(response.data);
  } catch (error) {
    console.error('创建用户失败:', error);
    throw error;
  }
};

/**
 * 更新用户
 * @param userId 用户ID
 * @param data 更新数据
 * @returns 更新后的用户
 */
export const updateUser = async (userId: number, data: {
  username?: string;
  password?: string;
  email?: string;
  mobile?: string;
  is_superuser?: boolean;
}): Promise<User> => {
  try {
    const response = await request.post<APIResponse<User>>(`/users/update/${userId}`, data);
    return unwrapResponse(response.data);
  } catch (error) {
    console.error(`更新用户(ID:${userId})失败:`, error);
    throw error;
  }
};

/**
 * 删除用户
 * @param userId 用户ID
 */
export const deleteUser = async (userId: number): Promise<void> => {
  try {
    await request.post<APIResponse<void>>(`/users/delete/${userId}`);
  } catch (error) {
    console.error(`删除用户(ID:${userId})失败:`, error);
    throw error;
  }
}; 