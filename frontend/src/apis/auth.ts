import { LoginParams, LoginResult, User } from '../types/user';
import { message } from 'antd';
import { STORAGE_TOKEN_KEY, STORAGE_USER_KEY } from '../config/constants';
import request from '../utils/request';

const authAPI = {
  /**
   * 用户登录
   * @param params 登录参数
   * @returns 登录结果包含token和用户信息
   */
  login: async (params: LoginParams): Promise<LoginResult> => {
    try {
      const formData = new URLSearchParams();
      formData.append('username', params.username);
      formData.append('password', params.password);

      // 第一步：登录获取token
      const response = await request.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      console.log('Login response:', response.data);

      // 提取token (后端返回格式为 { access_token, token_type })
      const token = response.data.access_token;
      
      // 存储token
      localStorage.setItem(STORAGE_TOKEN_KEY, token);
      
      // 第二步：获取用户信息
      const userResponse = await request.get('/auth/profile');
      const userInfo = userResponse.data;
      
      console.log('User info response:', userInfo);
      
      // 存储用户信息
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userInfo));
      
      // 返回符合前端期望格式的数据
      return {
        token,
        userinfo: userInfo
      };
    } catch (error) {
      console.error('Login error:', error);
      message.error('登录失败，请检查用户名和密码');
      throw error;
    }
  },

  /**
   * 获取当前用户信息
   * @returns 用户信息
   */
  getCurrentUser: async (): Promise<User> => {
    try {
      const response = await request.get('/auth/profile');
      return response.data;
    } catch (error) {
      console.error('Get current user error:', error);
      message.error('获取用户信息失败');
      throw error;
    }
  },

  /**
   * 用户登出
   */
  logout: async (): Promise<void> => {
    try {
      // 清除本地存储的认证信息
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      localStorage.removeItem(STORAGE_USER_KEY);
    } catch (error) {
      console.error('Logout error:', error);
      message.error('登出失败');
      throw error;
    }
  }
};

export default authAPI; 