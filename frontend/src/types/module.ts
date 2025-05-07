/**
 * 模块结构类型定义
 */

// 模块结构类型
export interface ModuleStructure {
  id: number;
  name: string;
  description?: string;
  parent_id: number | null;
  level: number;
  order: number;
  created_at: string;
  updated_at: string;
  children?: ModuleStructure[];
}

// 模块详情类型
export interface ModuleDetail {
  id: number;
  module_id: number;
  overview: string;      // 模块功能概述
  diagrams: DiagramInfo[]; // 逻辑图/数据流向图
  detail_content: string; // 功能详解
  database_tables: DatabaseTable[]; // 数据库表
  related_modules: RelatedModule[]; // 关联模块
  api_interfaces: ApiInterface[]; // 涉及接口
  created_at: string;
  updated_at: string;
}

// 图表信息
export interface DiagramInfo {
  id: number;
  filename: string;
  file_path: string;
  original_name: string;
  created_at: string;
}

// 数据库表
export interface DatabaseTable {
  id: number;
  name: string;
  description?: string;
  fields: DatabaseField[];
}

// 数据库字段
export interface DatabaseField {
  id: number;
  name: string;
  type: string;
  length?: number;
  nullable: boolean;
  default?: string;
  description?: string;
  primary_key: boolean;
  foreign_key?: string;
  unique: boolean;
}

// 关联模块
export interface RelatedModule {
  id: number;
  module_id: number;
  name: string;
  relation_type: string;
  description?: string;
}

// API接口
export interface ApiInterface {
  id: number;
  name: string;
  method: string;
  path: string;
  description?: string;
  request_params?: ApiParam[];
  response_params?: ApiParam[];
}

// API参数
export interface ApiParam {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  example?: string;
} 