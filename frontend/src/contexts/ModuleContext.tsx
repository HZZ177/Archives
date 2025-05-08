import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ModuleStructureNode, ModuleTreeResponse } from '../types/modules';
import { fetchModuleTree } from '../apis/moduleService';

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
  // 加载状态
  const [loading, setLoading] = useState<boolean>(false);
  // 模块树数据
  const [modules, setModules] = useState<ModuleStructureNode[]>(() => {
    try {
      // 尝试从sessionStorage获取缓存数据
      const cachedModules = sessionStorage.getItem('userModules');
      if (cachedModules) {
        console.log('ModuleContext: 从sessionStorage初始化模块树数据');
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
    // 如果已经在加载中，直接返回现有模块
    if (loading) {
      console.log('ModuleContext: 正在加载中，返回现有模块');
      return modules;
    }
    
    try {
      setLoading(true);
      console.log(`ModuleContext: 开始获取模块树 (强制刷新: ${forceRefresh})`);
      
      const data = await fetchModuleTree(undefined, forceRefresh);
      const newModules = Array.isArray(data) ? data : data.items || [];
      
      // 只有当数据确实变化时才更新状态
      if (JSON.stringify(newModules) !== JSON.stringify(modules)) {
        console.log('ModuleContext: 模块树数据已更新');
        setModules(newModules);
        
        // 保存到sessionStorage中
        try {
          sessionStorage.setItem('userModules', JSON.stringify(newModules));
          console.log('ModuleContext: 模块树数据已保存到sessionStorage');
        } catch (error) {
          console.error('ModuleContext: 保存模块树到sessionStorage失败:', error);
        }
        
        // 更新最后更新时间
        const now = Date.now();
        setLastUpdated(now);
        return newModules;
      } else {
        console.log('ModuleContext: 模块树数据未变化，跳过更新');
        return modules;
      }
    } catch (error) {
      console.error('ModuleContext: 获取模块树失败:', error);
      return modules;
    } finally {
      setLoading(false);
    }
  }, [loading, modules]);

  // 初始加载模块树
  useEffect(() => {
    if (modules.length === 0) {
      console.log('ModuleContext: 初始模块树为空，自动获取');
      fetchModules();
    }
  }, [fetchModules, modules.length]);

  // 监听刷新事件
  useEffect(() => {
    const handleRefreshEvent = () => {
      console.log('ModuleContext: 收到全局刷新事件');
      fetchModules(true);
    };
    
    // 添加刷新事件监听器
    window.addEventListener('refreshModuleTree', handleRefreshEvent);
    
    // 清理监听器
    return () => {
      window.removeEventListener('refreshModuleTree', handleRefreshEvent);
    };
  }, [fetchModules]);

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