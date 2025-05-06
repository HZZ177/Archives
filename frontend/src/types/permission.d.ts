export interface Permission {
  id: number;
  code: string;
  name: string;
  type: string;
  parent_id?: number;
  path?: string;
  component?: string;
  permission?: string;
  icon?: string;
  sort?: number;
  visible?: boolean;
  created_at: string;
  updated_at: string;
  children?: Permission[];
}

export interface PermissionFormData {
  code: string;
  name: string;
  type: string;
  parent_id?: number;
  path?: string;
  component?: string;
  permission?: string;
  icon?: string;
  sort?: number;
  visible?: boolean;
}

export interface PermissionTree extends Permission {
  children: PermissionTree[];
} 