import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, UserState, UserContextType, LoginParams, ChangePasswordParams } from '../types/user';
import authAPI from '../apis/auth';
import { STORAGE_TOKEN_KEY, STORAGE_USER_KEY } from '../config/constants';
import { message } from 'antd';

// 从localStorage获取初始用户信息
const getUserFromLocalStorage = (): User | null => {
  try {
    const userJson = localStorage.getItem(STORAGE_USER_KEY);
    if (userJson) {
      return JSON.parse(userJson);
    }
  } catch (error) {
    console.error('解析本地存储的用户信息失败:', error);
    // 如果解析失败，清除可能损坏的数据
    localStorage.removeItem(STORAGE_USER_KEY);
  }
  return null;
};

// 默认状态
const initialUserState: UserState = {
  currentUser: getUserFromLocalStorage(),
  token: localStorage.getItem(STORAGE_TOKEN_KEY),
  roles: [],
  isLoggedIn: !!localStorage.getItem(STORAGE_TOKEN_KEY),
};

// 创建Context
const UserContext = createContext<UserContextType | undefined>(undefined);

// Context Provider组件
export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userState, setUserState] = useState<UserState>(initialUserState);

  // 在组件挂载时从服务器刷新用户信息
  useEffect(() => {
    const refreshUserInfo = async () => {
      // 只有当有token但没有用户信息时，才需要刷新
      if (userState.token && (!userState.currentUser || Object.keys(userState.currentUser).length === 0)) {
        try {
          const userInfo = await authAPI.getCurrentUser();
          updateUserInfo(userInfo);
        } catch (error: any) {
          console.error('刷新用户信息失败:', error);
          // 如果获取用户信息失败，可能是token已失效
          if (error.response && error.response.status === 401) {
            // 清理无效的认证状态
            logout();
          }
        }
      }
    };

    refreshUserInfo();
  }, []);

  // 登录
  const login = async (params: LoginParams): Promise<void> => {
    try {
      const result = await authAPI.login(params);
      
      // 更新状态
      setUserState({
        currentUser: result.userinfo,
        token: result.token,
        roles: [], // 角色信息可能需要另外获取
        isLoggedIn: true,
      });
      
      // token 和用户信息已经在 authAPI.login 中存储到 localStorage
      
      // 如果需要修改密码，显示提示
      if (result.need_change_password) {
        message.warning('您的密码与手机号相同，出于安全考虑，请尽快修改密码。', 10);
      }
    } catch (error: any) {
      console.error('UserContext: 登录失败', error);
      throw error;
    }
  };

  // 登出
  const logout = async (): Promise<void> => {
    try {
      await authAPI.logout();

      // 清理工作区会话存储
      sessionStorage.removeItem('currentWorkspace');

      // 清空状态
      setUserState({
        currentUser: null,
        token: null,
        roles: [],
        isLoggedIn: false,
      });

      message.success('已安全登出');
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  };

  // 更新用户信息
  const updateUserInfo = (user: User | null): void => {
    setUserState(prev => ({
      ...prev,
      currentUser: user,
    }));
    if (user) {
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_USER_KEY);
    }
  };

  // 刷新用户信息
  const refreshUserInfo = async (): Promise<void> => {
    try {
      if (!userState.token) return;
      
      const userInfo = await authAPI.getCurrentUser();
      updateUserInfo(userInfo);
    } catch (error: any) {
      console.error('刷新用户信息失败:', error);
      if (error.response && error.response.status === 401) {
        logout();
      }
    }
  };

  // 修改密码
  const changePassword = async (params: ChangePasswordParams): Promise<void> => {
    try {
      await authAPI.changePassword(params);
      message.success('密码修改成功');
    } catch (error) {
      console.error('修改密码失败:', error);
      throw error;
    }
  };

  // 提供Context值
  const contextValue: UserContextType = {
    userState,
    login,
    logout,
    updateUserInfo,
    refreshUserInfo,
    changePassword
  };

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
};

// 自定义Hook，用于访问Context
export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export default UserContext; 