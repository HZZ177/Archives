import axios from 'axios';
import { API_BASE_URL } from '../config/constants';
import { Permission, PermissionTree } from '../types/permission';
import request, { unwrapResponse } from '../utils/request';
import { APIResponse } from '../types/api';

// 获取请求头
const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    Authorization: `Bearer ${token}`
  };
};

// 获取权限列表（扁平结构）
export const fetchPermissions = async (params = {}): Promise<Permission[]> => {
  try {
    const response = await request.get<APIResponse<Permission[]>>('/permissions', { params });
    return unwrapResponse<Permission[]>(response.data)!;
  } catch (error) {
    console.error('获取权限列表失败', error);
    throw error;
  }
};

// 构建完整的权限树
const buildPermissionTree = (permissions: Permission[]): PermissionTree[] => {
  // 创建权限ID映射表，便于快速查找
  const permissionMap = new Map<number, Permission>();
  permissions.forEach(permission => {
    permissionMap.set(permission.id, { ...permission, children: [] });
  });
  
  // 构建树形结构
  const rootNodes: PermissionTree[] = [];
  
  permissions.forEach(permission => {
    const permissionWithChildren = permissionMap.get(permission.id) as PermissionTree;
    
    if (permission.parent_id === null || permission.parent_id === undefined) {
      // 顶级节点
      rootNodes.push(permissionWithChildren);
    } else {
      // 子节点，添加到父节点的children中
      const parentId = permission.parent_id as number; // 确保parent_id是number类型
      const parentNode = permissionMap.get(parentId);
      if (parentNode) {
        if (!parentNode.children) {
          parentNode.children = [];
        }
        parentNode.children.push(permissionWithChildren);
      }
    }
  });
  
  return rootNodes;
};

// 获取权限树（树形结构）
export const fetchPermissionTree = async () => {
  try {
    // 先获取扁平的权限列表
    const permissions = await fetchPermissions();
    
    // 构建树形结构
    return buildPermissionTree(permissions);
  } catch (error) {
    console.error('获取权限树失败', error);
    throw error;
  }
};

// 获取权限详情
export const fetchPermissionById = async (id: number): Promise<Permission> => {
  try {
    const response = await request.get<APIResponse<Permission>>(`/permissions/${id}`);
    return unwrapResponse<Permission>(response.data)!;
  } catch (error) {
    console.error(`获取权限ID:${id}详情失败`, error);
    throw error;
  }
};

// 创建权限
export const createPermission = async (permissionData: any): Promise<Permission> => {
  try {
    const response = await request.post<APIResponse<Permission>>('/permissions', permissionData);
    return unwrapResponse<Permission>(response.data)!;
  } catch (error) {
    console.error('创建权限失败', error);
    throw error;
  }
};

// 更新权限
export const updatePermission = async (id: number, permissionData: any): Promise<Permission> => {
  try {
    const response = await request.post<APIResponse<Permission>>(`/permissions/update/${id}`, permissionData);
    return unwrapResponse<Permission>(response.data)!;
  } catch (error) {
    console.error(`更新权限ID:${id}失败`, error);
    throw error;
  }
};

// 删除权限
export const deletePermission = async (id: number) => {
  try {
    await request.post<APIResponse<void>>(`/permissions/delete/${id}`);
    return;
  } catch (error) {
    console.error(`删除权限ID:${id}失败`, error);
    throw error;
  }
};

// 获取当前用户的权限
export const fetchCurrentUserPermissions = async (): Promise<string[]> => {
  try {
    const response = await request.get<APIResponse<string[]>>('/permissions/user/current');
    return unwrapResponse<string[]>(response.data)!;
  } catch (error) {
    console.error('获取当前用户权限失败', error);
    throw error;
  }
};

// 获取当前用户可访问的页面路径
export const fetchUserPagePermissions = async (workspaceId?: number): Promise<string[]> => {
  try {
    const url = '/permissions/user/pages';
    const params = workspaceId ? { workspace_id: workspaceId } : {};
    
    const response = await request.get<APIResponse<string[]>>(url, { params });
    return unwrapResponse<string[]>(response.data)!;
  } catch (error) {
    console.error('获取用户页面权限失败', error);
    throw error;
  }
}; 