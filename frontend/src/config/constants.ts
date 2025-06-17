// API 基础URL
const getApiBaseUrl = () => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol; // 获取当前协议 (http: 或 https:)

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // 开发环境或本地访问，保持 http
    return 'http://localhost:8000/api/v1';
  } else {
    // 局域网或生产环境访问，使用当前协议和主机名
    // protocol 自身包含冒号, 例如 "https:"
    return `${protocol}//${hostname}:8000/api/v1`;
  }
};

export const API_BASE_URL = getApiBaseUrl();

// 本地存储键名
export const STORAGE_TOKEN_KEY = 'token';
export const STORAGE_USER_KEY = 'userInfo';

// 分页默认参数
export const DEFAULT_PAGE_SIZE = 10;
export const DEFAULT_PAGE = 1;

// 图片上传配置
export const UPLOAD_MAX_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];

// 路由路径
export const ROUTES = {
  LOGIN: '/login',
  HOME: '/',
  USER_LIST: '/system/users',
  USER_EDIT: '/system/users/:id',
  ROLE_LIST: '/system/roles',
  ROLE_EDIT: '/system/roles/:id',
  PERMISSION_LIST: '/permissions',
  STRUCTURE_MANAGEMENT: '/structure-management/tree',
  MODULE_CONTENT: '/module-content',
  WORKSPACES_MANAGE: '/workspaces/manage',
  WORKSPACES_EDIT: '/workspaces/:id',
};

// 状态码
export const STATUS_CODES = {
  SUCCESS: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
}; 