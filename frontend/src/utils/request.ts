import axios from 'axios';
import { message } from 'antd';
import { API_BASE_URL, STORAGE_TOKEN_KEY, STORAGE_USER_KEY, ROUTES } from '../config/constants';

// 创建 axios 实例
const request = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,  // 添加此配置以支持跨域认证
  maxRedirects: 5,  // 允许最多5次重定向
});

// 请求拦截器
request.interceptors.request.use(
  config => {
    const token = localStorage.getItem(STORAGE_TOKEN_KEY);
    console.log('请求拦截器 - Token状态:', token ? '存在' : '不存在');
    console.log('请求拦截器 - 完整配置:', {
      url: config.url,
      method: config.method,
      headers: config.headers,
      withCredentials: config.withCredentials,
      baseURL: config.baseURL
    });
    
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
      console.log(`请求: ${config.method?.toUpperCase()} ${config.url} - 携带认证Token`);
    } else {
      console.log(`请求: ${config.method?.toUpperCase()} ${config.url} - 无认证Token`);
    }
    return config;
  },
  error => {
    console.error('请求拦截器错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
request.interceptors.response.use(
  response => {
    console.log(`响应: ${response.config.method?.toUpperCase()} ${response.config.url} - 状态码: ${response.status}`);
    console.log('响应头:', response.headers);
    return response;
  },
  error => {
    if (error.response) {
      const { status, config } = error.response;
      console.error(`响应错误: ${config.method?.toUpperCase()} ${config.url} - 状态码: ${status}`);
      console.error('错误响应头:', error.response.headers);
      console.error('错误响应数据:', error.response.data);
      
      switch (status) {
        case 401:
          // 未授权，跳转到登录页面
          console.error('认证失败，需要重新登录');
          message.error('登录已过期，请重新登录');
          localStorage.removeItem(STORAGE_TOKEN_KEY);
          localStorage.removeItem(STORAGE_USER_KEY);
          window.location.href = ROUTES.LOGIN;
          break;
        case 403:
          message.error('没有权限访问');
          break;
        case 500:
          message.error('服务器错误');
          break;
        default:
          message.error(error.response.data?.message || '请求失败');
      }
    } else {
      console.error('网络错误:', error.message);
      message.error('网络错误，请稍后重试');
    }
    return Promise.reject(error);
  }
);

export default request; 