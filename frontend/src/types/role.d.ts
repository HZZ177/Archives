import { Permission } from './permission';

export interface Role {
  id: number;
  name: string;
  description?: string;
  is_default?: boolean;
  status?: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export interface RoleFormData {
  name: string;
  description?: string;
  is_default?: boolean;
  status?: boolean;
}

export interface RoleQueryParams {
  page?: number;
  page_size?: number;
  keyword?: string;
} 