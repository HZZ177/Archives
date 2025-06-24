import { LoginParams, LoginResult, User, ChangePasswordParams } from '../types/user';
import { message } from 'antd';
import { STORAGE_TOKEN_KEY, STORAGE_USER_KEY } from '../config/constants';
import request, { unwrapResponse } from '../utils/request';
import { APIResponse } from '../types/api';

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
      const response = await request.post<APIResponse<{ access_token: string; token_type: string; need_change_password?: boolean }>>('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });



      // 登录响应需要特殊处理，不使用unwrapResponse
      // 验证响应是否成功
      if (!response.data.success) {
        // 如果后端返回失败信息，将其作为错误抛出
        throw new Error(response.data.message || '登录失败');
      }

      // 提取token (后端返回格式为 { data: { access_token, token_type } })
      if (!response.data.data) {
        throw new Error('登录响应数据格式错误');
      }
      
      const token = response.data.data.access_token;
      const needChangePassword = response.data.data.need_change_password || false;
      
      // 存储token
      localStorage.setItem(STORAGE_TOKEN_KEY, token);
      
      // 第二步：获取用户信息
      const userResponse = await request.get<APIResponse<User>>('/auth/profile');
      const userInfo = unwrapResponse<User>(userResponse.data);
      

      
      // 存储用户信息
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userInfo));
      
      // 存储登录结果，包含need_change_password标志
      const loginResult = {
        token,
        userinfo: userInfo,
        need_change_password: needChangePassword
      };
      localStorage.setItem('login_result', JSON.stringify(loginResult));
      
      // 返回符合前端期望格式的数据
      return loginResult;
    } catch (error: any) {
      console.error('Login error:', error);
      
      // 增强错误对象，添加详细错误信息
      if (!error.response) {
        error.response = {
          data: {
            detail: error.message || '网络错误，请检查您的网络连接'
          }
        };
      } else if (error.response.status === 401) {
        // 401 Unauthorized，通常是用户名或密码错误
        error.response.data = {
          detail: '用户名或密码错误，请重试'
        };
      } else if (!error.response.data || (!error.response.data.detail && !error.response.data.message)) {
        // 确保response.data.detail或message字段存在
        error.response.data = {
          ...(error.response.data || {}),
          detail: error.message || '登录失败，请检查用户名和密码'
        };
      }
      
      // 不在此处显示错误消息，而是让调用者处理
      throw error;
    }
  },

  /**
   * 获取当前用户信息
   * @returns 用户信息
   */
  getCurrentUser: async (): Promise<User | null> => {
    try {
      const response = await request.get<APIResponse<User>>('/auth/profile');
      return unwrapResponse<User>(response.data);
    } catch (error) {
      console.error('Get current user error:', error);
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
  },

  /**
   * 修改用户密码
   * @param params 包含旧密码和新密码的参数对象
   * @returns 修改结果
   */
  changePassword: async (params: ChangePasswordParams): Promise<boolean> => {
    try {
      const response = await request.post<APIResponse<any>>('/auth/change-password', params);
      unwrapResponse(response.data);
      return true;
    } catch (error: any) {
      console.error('修改密码失败:', error);
      throw error;
    }
  }
};

export default authAPI; 