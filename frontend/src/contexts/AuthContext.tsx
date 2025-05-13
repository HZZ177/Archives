import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types/user';

// 定义AuthContext中的数据结构
interface AuthContextType {
  currentUser: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

// 创建默认值
const defaultAuthContext: AuthContextType = {
  currentUser: null,
  isLoggedIn: false,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  checkAuth: async () => false
};

// 创建Context
const AuthContext = createContext<AuthContextType>(defaultAuthContext);

// Provider组件
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // 检查认证状态
  const checkAuth = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      // 这里应该调用API检查用户是否已登录
      // 暂时使用localStorage模拟
      const userJson = localStorage.getItem('currentUser');
      if (userJson) {
        setCurrentUser(JSON.parse(userJson));
        return true;
      }
      return false;
    } catch (error) {
      console.error('认证检查失败:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // 登录函数
  const login = async (username: string, password: string): Promise<void> => {
    try {
      setIsLoading(true);
      // 模拟API调用
      // 真实环境中，这里应该调用登录API
      const userData: User = {
        id: 1,
        username,
        email: `${username}@example.com`,
        is_superuser: username === 'admin',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      localStorage.setItem('currentUser', JSON.stringify(userData));
      setCurrentUser(userData);
    } catch (error) {
      console.error('登录失败:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  // 登出函数
  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      // 模拟API调用
      // 真实环境中，这里应该调用登出API
      localStorage.removeItem('currentUser');
      setCurrentUser(null);
    } catch (error) {
      console.error('登出失败:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  // 初始化时检查用户认证状态
  useEffect(() => {
    checkAuth();
  }, []);
  
  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoggedIn: !!currentUser,
        isLoading,
        login,
        logout,
        checkAuth
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// 自定义Hook，方便在组件中使用
export const useAuthContext = () => useContext(AuthContext);

export default AuthContext; 