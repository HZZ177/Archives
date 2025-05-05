import axios from 'axios';
import { LoginParams, LoginResult } from '../types/user';
import { message } from 'antd';
import { API_BASE_URL } from '../config/constants';

const authAPI = {
  /**
   * 用户登录
   * @param params 登录参数
   * @returns 登录结果
   */
  login: async (params: LoginParams): Promise<LoginResult> => {
    try {
      const formData = new URLSearchParams();
      formData.append('username', params.username);
      formData.append('password', params.password);

      const response = await axios.post<LoginResult>(`${API_BASE_URL}/auth/login`, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      return response.data;
    } catch (error) {
      message.error('登录失败，请检查用户名和密码');
      throw error;
    }
  },

  /**
   * 用户登出
   */
  logout: async (): Promise<void> => {
    try {
      // 获取本地存储的token
      const token = localStorage.getItem('token');
      if (token) {
        // 设置请求头
        const headers = {
          Authorization: `Bearer ${token}`
        };
        
        await axios.post(`${API_BASE_URL}/auth/logout`, {}, { headers });
      }
      // 清除本地存储的认证信息
      localStorage.removeItem('token');
      localStorage.removeItem('userInfo');
    } catch (error) {
      message.error('登出失败');
      throw error;
    }
  }
};

export default authAPI; 