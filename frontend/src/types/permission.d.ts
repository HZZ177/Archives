export interface Permission {
  id: number;
  code: string;
  name: string;
  page_path: string;
  parent_id?: number;
  icon?: string;
  sort?: number;
  is_visible?: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
  children?: Permission[];
}

export interface PermissionFormData {
  code: string;
  name: string;
  page_path: string;
  parent_id?: number;
  icon?: string;
  sort?: number;
  is_visible?: boolean;
  description?: string;
}

export interface PermissionTree extends Permission {
  children: PermissionTree[];
} 