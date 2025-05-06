import axios from 'axios';
import { message } from 'antd';
import { API_BASE_URL } from '../config/constants';
import { Role, RoleFormData, RoleQueryParams, RoleWithPermissions } from '../types/role';

// 获取角色列表
export const fetchRoles = async (params?: RoleQueryParams): Promise<{ items: Role[], total: number }> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/roles`, { params });
    return response.data;
  } catch (error) {
    console.error('获取角色列表失败:', error);
    throw error;
  }
};

// 获取单个角色详情
export const fetchRoleById = async (id: number): Promise<RoleWithPermissions> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/roles/${id}`);
    return response.data;
  } catch (error) {
    console.error(`获取角色ID=${id}的详情失败:`, error);
    throw error;
  }
};

// 创建角色
export const createRole = async (roleData: RoleFormData): Promise<Role> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/roles`, roleData);
    return response.data;
  } catch (error) {
    console.error('创建角色失败:', error);
    throw error;
  }
};

// 更新角色
export const updateRole = async (id: number, roleData: RoleFormData): Promise<Role> => {
  try {
    const response = await axios.put(`${API_BASE_URL}/roles/${id}`, roleData);
    return response.data;
  } catch (error) {
    console.error(`更新角色ID=${id}失败:`, error);
    throw error;
  }
};

// 删除角色
export const deleteRole = async (id: number): Promise<void> => {
  try {
    await axios.delete(`${API_BASE_URL}/roles/${id}`);
  } catch (error) {
    console.error(`删除角色ID=${id}失败:`, error);
    throw error;
  }
};

// 为角色分配权限
export const assignPermissionsToRole = async (roleId: number, permissionIds: number[]): Promise<void> => {
  try {
    await axios.post(`${API_BASE_URL}/roles/${roleId}/permissions`, { permission_ids: permissionIds });
  } catch (error) {
    console.error(`为角色ID=${roleId}分配权限失败:`, error);
    throw error;
  }
};

// 获取角色的权限列表
export const fetchRolePermissions = async (roleId: number): Promise<number[]> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/roles/${roleId}/permissions`);
    return response.data;
  } catch (error) {
    console.error(`获取角色ID=${roleId}的权限列表失败:`, error);
    throw error;
  }
};

// 获取用户的角色
export const fetchUserRoles = async (userId: number) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/users/${userId}/roles`);
    return response.data;
  } catch (error) {
    console.error(`获取用户ID:${userId}的角色失败`, error);
    throw error;
  }
};

// 更新用户角色
export const updateUserRoles = async (userId: number, roleIds: number[]) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/users/${userId}/roles`, 
      { role_ids: roleIds }
    );
    return response.data;
  } catch (error) {
    console.error(`更新用户ID:${userId}的角色失败`, error);
    throw error;
  }
}; 