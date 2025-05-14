import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { message } from 'antd';
import { API_BASE_URL, STORAGE_TOKEN_KEY, STORAGE_USER_KEY, ROUTES } from '../config/constants';
import { APIResponse } from '../types/api';

// API基础URL
const BASE_URL = API_BASE_URL;

// 获取当前工作区ID的函数
export const getCurrentWorkspaceId = (): number | null => {
  try {
    // 优先从sessionStorage获取(会话级别)，确保刷新页面后使用的仍是当前工作区
    const sessionWorkspace = sessionStorage.getItem('currentWorkspace');
    if (sessionWorkspace) {
      const workspace = JSON.parse(sessionWorkspace);
      return workspace.id || null;
    }
    
    // 其次从localStorage获取(持久存储)
    const localWorkspace = localStorage.getItem('currentWorkspace');
    if (localWorkspace) {
      const workspace = JSON.parse(localWorkspace);
      return workspace.id || null;
    }
  } catch (error) {
    console.error('获取当前工作区ID失败:', error);
  }
  return null;
};

// 创建axios实例
const request = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// URL路径是否已指定工作区ID的检查函数
const isWorkspaceSpecificUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  
  // 检查URL是否匹配 /workspaces/{id}/ 格式，表示针对特定工作区的操作
  const workspaceSpecificPattern = /\/workspaces\/\d+\//;
  return workspaceSpecificPattern.test(url);
};

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // 从localStorage获取token
    const token = localStorage.getItem('token');
    
    // 如果有token则添加到请求头
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // 获取当前工作区ID并添加到请求参数中
    const workspaceId = getCurrentWorkspaceId();
    if (workspaceId) {
      // 检查URL是否已指定特定工作区，如果是则不添加workspace_id查询参数
      const shouldAddWorkspaceId = !isWorkspaceSpecificUrl(config.url);
      
      if (shouldAddWorkspaceId) {
        // 确保params对象存在
        config.params = config.params || {};
        
        // 如果请求中没有显式设置workspace_id，则添加
        if (!config.params.workspace_id) {
          config.params.workspace_id = workspaceId;
          console.log(`自动添加工作区ID(${workspaceId})到请求:`, config.url);
        }
      } else {
        console.log(`URL已指定特定工作区，不自动添加workspace_id参数:`, config.url);
      }
      
      // 同时添加请求头，以防后端从请求头获取
      if (config.headers) {
        config.headers['X-Workspace-ID'] = workspaceId.toString();
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    // 处理成功响应
    return response;
  },
  (error: AxiosError<APIResponse>) => {
    // 处理错误响应
    const { response } = error;
    
    if (response) {
      // 服务器返回了错误响应
      const { status, data } = response;
      
      // 处理401未授权错误，通常是token无效或过期
      if (status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        message.error('会话已过期，请重新登录');
      } 
      // 处理403禁止访问错误
      else if (status === 403) {
        message.error('您没有权限执行此操作');
      } 
      // 处理500服务器错误
      else if (status >= 500) {
        message.error('服务器错误，请稍后再试');
      } 
      // 其他错误，显示服务器返回的错误消息
      else if (data && data.message) {
        message.error(data.message);
      } 
      // 没有错误消息则显示通用错误
      else {
        message.error(`请求失败: ${status}`);
      }
    } else if (error.request) {
      // 发送了请求但没有收到响应
      message.error('无法连接到服务器，请检查网络连接');
    } else {
      // 请求设置过程中出现错误
      message.error(`请求错误: ${error.message}`);
    }
    
    return Promise.reject(error);
  }
);

// 辅助函数：解析API响应中的data字段
export function unwrapResponse<T>(response: APIResponse<T>): T | null {
  // 先检查响应是否成功
  if (!response.success) {
    // 如果响应不成功，使用响应中的message抛出错误
    throw new Error(response.message || '请求失败');
  }
  
  // 不再检查data是否为null，直接返回data
  return response.data;
}

export default request; 