import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/constants';
import { useUser } from './UserContext';
import { useWorkspace } from './WorkspaceContext';

// 权限上下文类型
interface PermissionContextType {
  userPermissions: string[];
  hasPermission: (path: string) => boolean;
  loading: boolean;
  refreshPermissions: (workspaceId?: number) => Promise<string[]>;
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
  const { currentWorkspace } = useWorkspace();
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // 刷新权限方法
  const refreshPermissions = useCallback(async (workspaceId?: number): Promise<string[]> => {
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
      console.log('PermissionContext: 加载用户权限，工作区ID:', workspaceId);
      const params = workspaceId ? { workspace_id: workspaceId } : {};
      const response = await axios.get(`${API_BASE_URL}/permissions/user/pages`, {
        headers: {
          Authorization: `Bearer ${userState.token}`
        },
        params
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
      // 精确匹配
      if (path === permission) {
        console.log(`PermissionContext: 精确匹配成功 - 路径: ${path}, 权限: ${permission}`);
        return true;
      }
      
      // 前缀匹配（权限是路径的父级路径）- 只有当路径后面紧跟/时才匹配
      // 例如：权限为/structure-management，路径为/structure-management/module-config
      // 这种情况下，不应该自动授予子路径的访问权限
      // 修改为：只有当permission明确包含了path，或者path就是permission本身时才允许访问
      
      // 移除前缀匹配逻辑，避免父路径权限自动授予子路径访问权限
      // if (path.startsWith(`${permission}/`)) {
      //   console.log(`PermissionContext: 前缀匹配成功 - 路径: ${path}, 父路径权限: ${permission}`);
      //   return true;
      // }
      
      // 模块页面特殊处理 - 保留这部分逻辑，因为模块内容页面有特殊需求
      if (permission.includes('/module-content/') && path.includes('/module-content/')) {
        console.log(`PermissionContext: 模块内容页面匹配 - 路径: ${path}, 权限: ${permission}`);
        return true;
      }
      
      return false;
    });
    
    if (!hasAccess) {
      console.log(`PermissionContext: 权限匹配失败 - 路径: ${path}, 当前权限列表:`, userPermissions);
    }
    
    return hasAccess;
  }, [userPermissions]);
  
  // 用户登录状态或工作区变化时重新加载权限
  useEffect(() => {
    if (userState.isLoggedIn) {
      const workspaceId = currentWorkspace?.id;
      console.log('PermissionContext: 用户登录状态或工作区变化，重新加载权限，工作区ID:', workspaceId);
      refreshPermissions(workspaceId);
    } else {
      setUserPermissions([]);
      setLoading(false);
    }
  }, [userState.isLoggedIn, currentWorkspace?.id, refreshPermissions]);
  
  // 监听工作区变更事件
  useEffect(() => {
    const handleWorkspaceChange = () => {
      if (userState.isLoggedIn) {
        const workspaceId = currentWorkspace?.id;
        console.log('PermissionContext: 监听到工作区变更事件，重新加载权限，工作区ID:', workspaceId);
        refreshPermissions(workspaceId);
      }
    };
    
    window.addEventListener('workspaceChanged', handleWorkspaceChange);
    
    return () => {
      window.removeEventListener('workspaceChanged', handleWorkspaceChange);
    };
  }, [userState.isLoggedIn, currentWorkspace?.id, refreshPermissions]);
  
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