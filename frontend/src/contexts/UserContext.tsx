import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, UserState, UserContextType, LoginParams } from '../types/user';
import authAPI from '../apis/auth';
import { STORAGE_TOKEN_KEY, STORAGE_USER_KEY } from '../config/constants';
import { message } from 'antd';

// 默认状态
const initialUserState: UserState = {
  currentUser: null,
  token: localStorage.getItem(STORAGE_TOKEN_KEY),
  roles: [],
  isLoggedIn: !!localStorage.getItem(STORAGE_TOKEN_KEY),
};

// 创建Context
const UserContext = createContext<UserContextType | undefined>(undefined);

// Context Provider组件
export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userState, setUserState] = useState<UserState>(initialUserState);

  // 登录
  const login = async (params: LoginParams): Promise<void> => {
    try {
      console.log('UserContext: 开始登录流程');
      const result = await authAPI.login(params);
      console.log('UserContext: 登录成功，获取到结果', result);
      
      // 更新状态
      setUserState({
        currentUser: result.userinfo,
        token: result.token,
        roles: [], // 角色信息可能需要另外获取
        isLoggedIn: true,
      });
      
      // token 和用户信息已经在 authAPI.login 中存储到 localStorage
      
      console.log('UserContext: 状态更新完成');
      message.success('登录成功');
    } catch (error) {
      console.error('UserContext: 登录失败', error);
      throw error;
    }
  };

  // 登出
  const logout = async (): Promise<void> => {
    try {
      await authAPI.logout();
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
  const updateUserInfo = (user: User): void => {
    setUserState(prev => ({
      ...prev,
      currentUser: user,
    }));
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
  };

  // 提供Context值
  const contextValue: UserContextType = {
    userState,
    login,
    logout,
    updateUserInfo,
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