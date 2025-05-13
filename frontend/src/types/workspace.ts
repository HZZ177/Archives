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
  role: 'owner' | 'admin' | 'member' | 'guest';
} 