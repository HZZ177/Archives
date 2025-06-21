/**
 * 工作区类型定义
 */
import { ApiParam, DatabaseTable, DatabaseTableColumn, ApiInterfaceCard } from './modules';
import { UserSimple } from './user';

// 工作区基础类型
export interface Workspace {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  is_default: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
}

// 工作区用户关系
export interface WorkspaceUser {
  user_id: number;
  workspace_id: number;
  access_level: string; // 'read', 'write', 'admin'
  username: string;
  email: string;
}

// 工作区数据库表
export interface WorkspaceTable {
  id: number;
  workspace_id: number;
  table_name: string;
  schema_name?: string;
  description?: string;
  columns_json: any[];
  relationships_json?: any[];
  user_id: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

// 工作区数据库表详情
export interface WorkspaceTableDetail extends WorkspaceTable {
  columns: any[]; // 转换后的字段信息
}

// 工作区接口
export interface WorkspaceInterface {
  id: number;
  workspace_id: number;
  path: string;
  method: string;
  description?: string;
  content_type?: string;
  request_params_json?: any[];
  response_params_json?: any[];
  user_id: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

// 工作区接口详情
export interface WorkspaceInterfaceDetail extends WorkspaceInterface {
  request_params: any[]; // 转换后的请求参数
  response_params: any[]; // 转换后的响应参数
}

// 创建工作区请求
export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

// 更新工作区请求
export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
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

// 工作区表类型
export interface WorkspaceTable {
  id: number;
  workspace_id: number;
  name: string;
  schema_name?: string;
  description?: string;
  columns_json: DatabaseTableColumn[];
  relationships_json?: any[];
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceTableRead extends WorkspaceTable {
  creator?: UserSimple;
}

// 创建工作区表请求
export interface WorkspaceTableCreate {
  workspace_id: number;
  name: string;
  schema_name?: string;
  description?: string;
  columns_json: DatabaseTableColumn[];
  relationships_json?: any[];
}

// 更新工作区表请求
export interface WorkspaceTableUpdate {
  name?: string;
  schema_name?: string;
  description?: string;
  columns_json?: DatabaseTableColumn[];
  relationships_json?: any[];
}

// 工作区接口类型
export interface WorkspaceInterface {
  id: number;
  workspace_id: number;
  path: string;
  method: string;
  description?: string;
  content_type?: string;
  request_params_json?: ApiParam[];
  response_params_json?: ApiParam[];
  created_by: number;
  created_at: string;
  updated_at: string;
}

// 创建工作区接口请求
export interface WorkspaceInterfaceCreate {
  workspace_id: number;
  path: string;
  method: string;
  description?: string;
  content_type?: string;
  request_params_json?: ApiParam[];
  response_params_json?: ApiParam[];
}

// 更新工作区接口请求
export interface WorkspaceInterfaceUpdate {
  path?: string;
  method?: string;
  description?: string;
  content_type?: string;
  request_params_json?: ApiParam[];
  response_params_json?: ApiParam[];
}

// 模块内容引用工作区表和接口的类型
export interface ModuleContentReferences {
  database_table_refs?: number[];
  api_interface_refs?: number[];
} 