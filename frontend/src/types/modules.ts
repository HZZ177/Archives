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
  workspace_id?: number | null; // 工作区ID
  permission_id?: number | null; // 权限ID
}

// 数据库表字段类型
export interface DatabaseTableColumn {
  field_name: string;
  field_type: string;
  length?: number; // 字段长度/精度
  nullable: boolean; // 是否可为空
  default_value?: string; // 默认值
  description?: string; // 字段描述
  remark?: string; // 备注
  is_primary_key: boolean; // 是否为主键
  is_unique: boolean; // 是否唯一
  is_index: boolean; // 是否索引
  foreign_key?: { // 外键信息
    reference_table: string; // 引用表
    reference_column: string; // 引用列
  };
  previewMode?: boolean; // 是否处于预览模式
}

// 数据库表类型
export interface DatabaseTable {
  name: string;
  schema_name?: string; // 模式名称
  description?: string; // 表描述
  columns: DatabaseTableColumn[];
  relationships?: { // 表关系
    to_table: string; // 关联表
    type: 'one-to-one' | 'one-to-many' | 'many-to-many'; // 关系类型
    description?: string; // 关系描述
  }[];
  workspace_table_id?: number; // 工作区表ID，用于引用工作区级别的表
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

// 新增卡片式API接口类型定义
export interface ApiInterfaceCard {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  contentType: string;
  requestParams: ApiParam[];
  responseParams: ApiParam[];
  workspace_interface_id?: number; // 工作区接口ID，用于引用工作区级别的接口
  requestExample?: string; // 新增整体请求示例
  responseExample?: string; // 新增整体响应示例
}

// API参数类型
export interface ApiParam {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  children?: ApiParam[];
}

// 常量定义
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
export const CONTENT_TYPES = [
  'application/json', 
  'application/x-www-form-urlencoded', 
  'multipart/form-data', 
  'text/plain'
] as const;
export const PARAM_TYPES = ['string', 'number', 'boolean', 'object', 'array', 'null'] as const;

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
  node_id: number;
  overview_text?: string;
  content: {
    overview?: string;
    diagram?: DiagramData;
    key_tech?: KeyTechnology[];
    database_tables?: DatabaseTable[];
    related_modules?: number[];
    interface_definitions?: ApiInterfaceCard[];
    glossary?: GlossaryItem[];
  };
  sections?: any[]; // 为动态模块添加sections
  last_updated_at: string;
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
  details_text?: string;
  database_tables_json?: DatabaseTable[];
  database_table_refs?: number[]; // 工作区表ID列表
  related_module_ids_json?: number[];
  api_interfaces_json?: ApiInterface[];
  api_interface_refs?: number[]; // 工作区接口ID列表
  examples_json?: ExampleItem[];
  node_id: number;
  content: {
    overview?: string;
    diagram?: any;
    key_tech?: KeyTechItem[];
    database_tables?: DatabaseTable[];
    related_modules?: number[];
    interface_definitions?: ApiInterfaceCard[];
    glossary?: GlossaryItem[];
  };
}

// 模块结构树响应
export interface ModuleTreeResponse {
  items: ModuleStructureNode[];
}

export interface GlossaryItem {
  id: string;
  term: string;
  explanation: string;
}

// 图表数据类型
export interface DiagramData {
  elements: any[];
  state: any;
}

// 关键技术类型
export interface KeyTechnology {
  id: string;
  name: string;
  description: string;
}

// 相关模块类型
export interface RelatedModule {
  id: number;
  name: string;
  description?: string;
} 