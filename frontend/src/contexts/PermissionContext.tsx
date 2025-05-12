import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/constants';
import { useUser } from './UserContext';

// 权限上下文类型
interface PermissionContextType {
  userPermissions: string[];
  hasPermission: (path: string) => boolean;
  loading: boolean;
  refreshPermissions: () => Promise<string[]>;
}

// 创建权限上下文
const PermissionContext = createContext<PermissionContextType>({
  userPermissions: [],
  hasPermission: () => false,
  loading: true,
  refreshPermissions: async () => [],
});

// 权限上下文提供者属性
interface PermissionProviderProps {
  children: React.ReactNode;
}

/**
 * 全局权限管理上下文提供者
 * 负责一次性加载和缓存用户权限，避免重复请求
 */
export const PermissionProvider: React.FC<PermissionProviderProps> = ({ children }) => {
  const { userState } = useUser();
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // 刷新权限方法
  const refreshPermissions = useCallback(async (): Promise<string[]> => {
    if (!userState.isLoggedIn || !userState.token) {
      setUserPermissions([]);
      setLoading(false);
      return [];
    }
    
    try {
      setLoading(true);
      
      // 超级管理员拥有所有权限，可以设置一个通配符或返回所有路径
      if (userState.currentUser?.is_superuser) {
        console.log('PermissionContext: 超级管理员权限加载');
        // 使用通配符表示拥有所有权限
        const allPermissions = ['/*'];
        setUserPermissions(allPermissions);
        setLoading(false);
        return allPermissions;
      }
      
      // 普通用户加载权限
      console.log('PermissionContext: 加载用户权限');
      const response = await axios.get(`${API_BASE_URL}/permissions/user/pages`, {
        headers: {
          Authorization: `Bearer ${userState.token}`
        }
      });
      
      // 确保权限是数组类型
      let permissions = [];
      if (response.data && response.data.data) {
        // 处理统一响应格式
        permissions = Array.isArray(response.data.data) ? response.data.data : [];
      } else if (Array.isArray(response.data)) {
        // 处理直接返回数组的情况
        permissions = response.data;
      }
      
      console.log('PermissionContext: 获取到权限列表', permissions);
      
      setUserPermissions(permissions);
      setLoading(false);
      return permissions;
    } catch (error) {
      console.error('PermissionContext: 加载权限失败', error);
      setLoading(false);
      return [];
    }
  }, [userState.isLoggedIn, userState.token, userState.currentUser?.is_superuser]);
  
  // 检查权限方法
  const hasPermission = useCallback((path: string): boolean => {
    // 路径为空或不是以/开头，视为无效路径
    if (!path || !path.startsWith('/')) {
      console.log(`PermissionContext: 无效路径 "${path}"`);
      return false;
    }
    
    // 确保userPermissions是数组
    if (!Array.isArray(userPermissions)) {
      console.warn('PermissionContext: userPermissions不是数组', userPermissions);
      return false;
    }
    
    // 如果权限中包含通配符，表示拥有所有权限
    if (userPermissions.includes('/*')) {
      console.log(`PermissionContext: 通配符权限匹配 - 路径: ${path}`);
      return true;
    }
    
    // 检查直接匹配或前缀匹配
    const hasAccess = userPermissions.some(permission => {
      const isMatch = path === permission || path.startsWith(`${permission}/`);
      if (isMatch) {
        console.log(`PermissionContext: 权限匹配成功 - 路径: ${path}, 匹配权限: ${permission}`);
      }
      return isMatch;
    });
    
    if (!hasAccess) {
      console.log(`PermissionContext: 权限匹配失败 - 路径: ${path}, 当前权限列表:`, userPermissions);
    }
    
    return hasAccess;
  }, [userPermissions]);
  
  // 用户登录状态变化时重新加载权限
  useEffect(() => {
    if (userState.isLoggedIn) {
      refreshPermissions();
    } else {
      setUserPermissions([]);
      setLoading(false);
    }
  }, [userState.isLoggedIn, refreshPermissions]);
  
  return (
    <PermissionContext.Provider
      value={{
        userPermissions,
        hasPermission,
        loading,
        refreshPermissions,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
};

// 使用权限的钩子函数
export const usePermission = () => useContext(PermissionContext);

export default PermissionContext; 