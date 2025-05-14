import { message } from 'antd';
import { Role, RoleFormData, RoleQueryParams, RoleWithPermissions } from '../types/role';
import request, { unwrapResponse } from '../utils/request';
import { APIResponse } from '../types/api';

// 获取角色列表
export const fetchRoles = async (): Promise<Role[]> => {
  const response = await request.get<APIResponse<Role[]>>('/roles/');
  return unwrapResponse<Role[]>(response.data);
};

// 获取单个角色详情
export const fetchRoleById = async (id: number): Promise<RoleWithPermissions> => {
  try {
    const response = await request.get<APIResponse<RoleWithPermissions>>(`/roles/${id}`);
    return unwrapResponse<RoleWithPermissions>(response.data);
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
  const response = await request.post<APIResponse<Role>>('/roles/', roleData);
  return unwrapResponse<Role>(response.data);
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
  const response = await request.post<APIResponse<Role>>(`/roles/update/${roleId}`, roleData);
  return unwrapResponse<Role>(response.data);
};

// 删除角色
export const deleteRole = async (roleId: number): Promise<APIResponse<void>> => {
  const response = await request.post<APIResponse<void>>(`/roles/delete/${roleId}`);
  return response.data;
};

// 获取角色权限
export const fetchRolePermissions = async (roleId: number): Promise<number[]> => {
  const response = await request.get<APIResponse<number[]>>(`/roles/${roleId}/permissions/`);
  return unwrapResponse<number[]>(response.data);
};

// 分配权限给角色
export const assignPermissionsToRole = async (
  roleId: number,
  permissionIds: number[]
): Promise<void> => {
  await request.post<APIResponse<void>>(`/roles/${roleId}/update_permissions`, {
    permission_ids: permissionIds,
  });
};

// 获取用户角色
export const fetchUserRoles = async (userId: number): Promise<Role[]> => {
  const response = await request.get<APIResponse<Role[]>>(`/users/${userId}/roles/`);
  return unwrapResponse<Role[]>(response.data);
};

// 更新用户角色
export const updateUserRoles = async (userId: number, roleIds: number[]) => {
  const response = await request.post<APIResponse<{roles: Role[]}>>(`/users/${userId}/update_roles`, { role_ids: roleIds });
  
  // 返回角色列表
  return unwrapResponse<{roles: Role[]}>(response.data)?.roles || [];
};

// 添加新函数：更新角色状态
export const updateRoleStatus = async (roleId: number, status: boolean): Promise<APIResponse<Role>> => {
  const response = await request.post<APIResponse<Role>>(`/roles/update/${roleId}`, { status });
  return response.data;
}; 