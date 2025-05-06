import axios from 'axios';
import { API_BASE_URL } from '../config/constants';

// 获取请求头
const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    Authorization: `Bearer ${token}`
  };
};

// 获取权限列表（扁平结构）
export const fetchPermissions = async (params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/permissions`, {
      params,
      headers: getHeaders()
    });
    return response.data;
  } catch (error) {
    console.error('获取权限列表失败', error);
    throw error;
  }
};

// 获取权限树（树形结构）
export const fetchPermissionTree = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/permissions/tree`, {
      headers: getHeaders()
    });
    return response.data;
  } catch (error) {
    console.error('获取权限树失败', error);
    throw error;
  }
};

// 获取权限详情
export const fetchPermissionById = async (id: number) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/permissions/${id}`, {
      headers: getHeaders()
    });
    return response.data;
  } catch (error) {
    console.error(`获取权限ID:${id}详情失败`, error);
    throw error;
  }
};

// 创建权限
export const createPermission = async (permissionData: any) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/permissions`, permissionData, {
      headers: getHeaders()
    });
    return response.data;
  } catch (error) {
    console.error('创建权限失败', error);
    throw error;
  }
};

// 更新权限
export const updatePermission = async (id: number, permissionData: any) => {
  try {
    const response = await axios.put(`${API_BASE_URL}/permissions/${id}`, permissionData, {
      headers: getHeaders()
    });
    return response.data;
  } catch (error) {
    console.error(`更新权限ID:${id}失败`, error);
    throw error;
  }
};

// 删除权限
export const deletePermission = async (id: number) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/permissions/${id}`, {
      headers: getHeaders()
    });
    return response.data;
  } catch (error) {
    console.error(`删除权限ID:${id}失败`, error);
    throw error;
  }
};

// 获取当前用户的权限
export const fetchCurrentUserPermissions = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/permissions/user/current`, {
      headers: getHeaders()
    });
    return response.data;
  } catch (error) {
    console.error('获取当前用户权限失败', error);
    throw error;
  }
}; 