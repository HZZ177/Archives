/**
 * 工作区类型定义
 */

// 工作区基础类型
export interface Workspace {
  id: number;
  name: string;
  description?: string;
  color?: string;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
  owner_id?: number;
}

// 创建工作区请求
export interface WorkspaceCreateRequest {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  is_default?: boolean;
}

// 更新工作区请求
export interface WorkspaceUpdateRequest {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  is_default?: boolean;
}

// 工作区用户关系类型
export interface WorkspaceUser {
  id: number;
  user_id: number;
  workspace_id: number;
  role: 'owner' | 'admin' | 'member' | 'guest';
  username: string;
  email?: string;
  is_superuser?: boolean;
  created_at?: string;
  updated_at?: string;
  user?: {
    id: number;
    username: string;
    email?: string;
  };
}

// 添加用户到工作区请求
export interface AddUserToWorkspaceRequest {
  user_id: number;
  access_level: 'read' | 'write' | 'admin';
}

// 设置默认工作区请求
export interface SetDefaultWorkspaceRequest {
  workspace_id: number;
}

// 工作区列表响应
export type WorkspaceListResponse = Workspace[];

// 工作区用户列表响应
export type WorkspaceUserListResponse = WorkspaceUser[];

export interface CreateWorkspaceParams {
  name: string;
  description?: string;
  color?: string;
  is_default?: boolean;
}

export interface UpdateWorkspaceParams {
  name?: string;
  description?: string;
  color?: string;
}

export interface WorkspaceUserParams {
  user_id: number;
  /**
   * 用户在工作区的角色/访问级别
   * 注意：后端API使用access_level字段，但前端使用role字段显示
   * 
   * 角色映射关系：
   * - owner：完全控制权限，可以管理所有内容和设置
   * - admin：可以管理大多数内容和设置，但无法删除工作区
   * - member/write：可以查看和编辑内容，但无法更改关键设置
   * - guest/read：仅可查看权限，无法编辑内容
   */
  access_level: 'owner' | 'admin' | 'write' | 'read';
}

export interface BatchAddUsersToWorkspaceRequest {
  user_ids: number[];
  access_level: string;
}

export interface BatchRemoveUsersFromWorkspaceRequest {
  user_ids: number[];
} 