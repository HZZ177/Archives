import { message } from 'antd';
import { Role, RoleFormData, RoleQueryParams, RoleWithPermissions } from '../types/role';
import request from '../utils/request';

// 获取角色列表
export const fetchRoles = async (): Promise<Role[]> => {
  const response = await request.get('/roles/');
  return response.data;
};

// 获取单个角色详情
export const fetchRoleById = async (id: number): Promise<RoleWithPermissions> => {
  try {
    const response = await request.get(`/roles/${id}`);
    return response.data;
  } catch (error) {
    console.error(`获取角色ID=${id}的详情失败:`, error);
    throw error;
  }
};

// 创建角色
export const createRole = async (roleData: {
  name: string;
  description?: string;
  status?: boolean;
  permission_ids?: number[];
}): Promise<Role> => {
  const response = await request.post('/roles/', roleData);
  return response.data;
};

// 更新角色
export const updateRole = async (
  roleId: number,
  roleData: {
    name?: string;
    description?: string;
    status?: boolean;
    permission_ids?: number[];
  }
): Promise<Role> => {
  const response = await request.put(`/roles/${roleId}/`, roleData);
  return response.data;
};

// 删除角色
export const deleteRole = async (roleId: number): Promise<{success: boolean; message: string}> => {
  const response = await request.delete(`/roles/${roleId}/`);
  return response.data;
};

// 获取角色权限
export const fetchRolePermissions = async (roleId: number): Promise<number[]> => {
  const response = await request.get(`/roles/${roleId}/permissions/`);
  return response.data;
};

// 分配权限给角色
export const assignPermissionsToRole = async (
  roleId: number,
  permissionIds: number[]
): Promise<void> => {
  await request.post(`/roles/${roleId}/permissions/`, {
    permission_ids: permissionIds,
  });
};

// 获取用户角色
export const fetchUserRoles = async (userId: number): Promise<Role[]> => {
  const response = await request.get(`/users/${userId}/roles/`);
  return response.data;
};

// 更新用户角色
export const updateUserRoles = async (userId: number, roleIds: number[]) => {
  const response = await request.put(
    `/users/${userId}/roles/`, 
    { role_ids: roleIds }
  );
  
  // 处理新的响应格式
  const result = response.data;
  
  // 如果请求成功但业务逻辑失败（如权限不足）
  if (result && typeof result === 'object' && result.success === false) {
    throw new Error(result.message || '更新角色失败');
  }
  
  // 返回角色列表或原始结果
  return result.roles || result;
}; 