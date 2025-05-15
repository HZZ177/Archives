// 模块结构节点类型
export interface ModuleStructureNode {
  id: number;
  name: string;
  parent_id: number | null;
  order_index: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  children: ModuleStructureNode[];
  has_content: boolean;
  is_content_page: boolean;
}

// 数据库表字段类型
export interface DatabaseTableColumn {
  field_name: string;
  field_type: string;
  description?: string;
  remark?: string;
  previewMode?: boolean; // 是否处于预览模式
}

// 数据库表类型
export interface DatabaseTable {
  table_name: string;
  columns: DatabaseTableColumn[];
}

// API接口参数类型
export interface ApiInterfaceParameter {
  param_name: string;
  param_type: string;
  required?: boolean;
  description?: string;
}

// API接口类型
export interface ApiInterface {
  id: string;
  name: string;
  type: string;
  required: boolean;
  description: string;
  previewMode?: boolean; // 是否处于预览模式
}

// 关键技术项类型
export interface KeyTechItem {
  key: string;
  value: string;
}

// 示例项类型
export interface ExampleItem {
  id: string;
  title: string;
  description: string;
  code: string;
}

// 模块内容类型
export interface ModuleContent {
  id: number;
  module_node_id: number;
  overview_text?: string;
  diagram_image_path?: string;
  key_tech_items_json?: KeyTechItem[];
  principle_text?: string;
  database_tables_json?: DatabaseTable[];
  related_module_ids_json?: number[];
  api_interfaces_json?: ApiInterface[];
  examples_json?: ExampleItem[];
  user_id: number;
  created_at: string;
  updated_at: string;
}

// 创建/更新模块结构节点的请求参数
export interface ModuleStructureNodeRequest {
  name: string;
  parent_id?: number | null;
  order_index?: number;
  is_content_page?: boolean;  // 是否作为内容页面
}

// 创建/更新模块内容的请求参数
export interface ModuleContentRequest {
  overview_text?: string;
  key_tech_items_json?: KeyTechItem[];
  principle_text?: string;
  database_tables_json?: DatabaseTable[];
  related_module_ids_json?: number[];
  api_interfaces_json?: ApiInterface[];
  examples_json?: ExampleItem[];
}

// 模块结构树响应
export interface ModuleTreeResponse {
  items: ModuleStructureNode[];
} 