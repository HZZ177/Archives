import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ModuleStructureNode, ModuleTreeResponse } from '../types/modules';
import { fetchModuleTree } from '../apis/moduleService';
import { useUser } from './UserContext';

// 模块上下文类型
interface ModuleContextType {
  modules: ModuleStructureNode[];
  loading: boolean;
  fetchModules: (forceRefresh?: boolean) => Promise<ModuleStructureNode[]>;
  lastUpdated: number;
}

// 创建模块上下文
const ModuleContext = createContext<ModuleContextType>({
  modules: [],
  loading: false,
  fetchModules: async () => [],
  lastUpdated: 0
});

// 模块上下文提供者属性
interface ModuleProviderProps {
  children: React.ReactNode;
}

// 模块上下文提供者组件
export const ModuleProvider: React.FC<ModuleProviderProps> = ({ children }) => {
  // 从UserContext获取用户登录状态
  const { userState } = useUser();
  // 加载状态
  const [loading, setLoading] = useState<boolean>(false);
  // 模块树数据
  const [modules, setModules] = useState<ModuleStructureNode[]>(() => {
    try {
      // 尝试从sessionStorage获取缓存数据
      const cachedModules = sessionStorage.getItem('userModules');
      if (cachedModules) {
        return JSON.parse(cachedModules);
      }
    } catch (error) {
      console.error('ModuleContext: 从sessionStorage读取模块树失败:', error);
    }
    return [];
  });
  // 最后更新时间
  const [lastUpdated, setLastUpdated] = useState<number>(0);

  // 获取模块树数据
  const fetchModules = useCallback(async (forceRefresh = false): Promise<ModuleStructureNode[]> => {
    // 如果用户未登录，不执行请求
    if (!userState.isLoggedIn) {
      return [];
    }
    
    // 如果已经在加载中，直接返回现有模块
    if (loading) {
      return modules;
    }
    
    try {
      setLoading(true);
      
      const data = await fetchModuleTree(undefined, forceRefresh);
      const newModules = Array.isArray(data) ? data : data.items || [];
      
      // 只有当数据确实变化时才更新状态
      if (JSON.stringify(newModules) !== JSON.stringify(modules)) {
        setModules(newModules);
        
        // 保存到sessionStorage中
        try {
          sessionStorage.setItem('userModules', JSON.stringify(newModules));
        } catch (error) {
          console.error('ModuleContext: 保存模块树到sessionStorage失败:', error);
        }
        
        // 更新最后更新时间
        const now = Date.now();
        setLastUpdated(now);
        return newModules;
      } else {
        return modules;
      }
    } catch (error) {
      console.error('ModuleContext: 获取模块树失败:', error);
      return modules;
    } finally {
      setLoading(false);
    }
  }, [loading, modules, userState.isLoggedIn]);

  // 初始加载模块树
  useEffect(() => {
    // 只有用户已登录且模块树为空时才获取
    if (userState.isLoggedIn && modules.length === 0) {
      fetchModules();
    }
  }, [fetchModules, modules.length, userState.isLoggedIn]);

  // 监听刷新事件
  useEffect(() => {
    const handleRefreshEvent = () => {
      fetchModules(true);
    };
    
    // 添加刷新事件监听器
    window.addEventListener('refreshModuleTree', handleRefreshEvent);
    
    // 清理监听器
    return () => {
      window.removeEventListener('refreshModuleTree', handleRefreshEvent);
    };
  }, [fetchModules]);

  // 监听用户登录状态变化
  useEffect(() => {
    // 当用户退出登录时，清空模块缓存
    if (!userState.isLoggedIn) {
      setModules([]);
      sessionStorage.removeItem('userModules');
    }
  }, [userState.isLoggedIn]);

  return (
    <ModuleContext.Provider
      value={{
        modules,
        loading,
        fetchModules,
        lastUpdated
      }}
    >
      {children}
    </ModuleContext.Provider>
  );
};

// 自定义钩子，方便使用模块上下文
export const useModules = () => useContext(ModuleContext);

export default ModuleContext; 