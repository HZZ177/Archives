/**
 * 统一API响应类型定义
 */

/**
 * 统一API响应格式
 * @template T 响应数据类型
 */
export interface APIResponse<T = any> {
  /** 请求是否成功 */
  success: boolean;
  /** 响应消息 */
  message: string;
  /** 响应数据 */
  data: T | null;
  /** 错误代码 */
  error_code?: string;
}

/**
 * 分页响应数据
 * @template T 列表项类型
 */
export interface PaginatedData<T = any> {
  /** 当前页数据列表 */
  items: T[];
  /** 总条数 */
  total: number;
  /** 页码 */
  page: number;
  /** 每页条数 */
  size: number;
}

// 分页请求参数
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// 分页响应结构
export interface PaginatedResponse<T> extends APIResponse {
  data: PaginatedData<T>;
}

// 搜索类型参数
export interface SearchParams extends PaginationParams {
  query?: string;
  filters?: Record<string, any>;
}

// 通用ID参数
export interface IdParam {
  id: number;
} 