import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { Workspace, WorkspaceTableRead } from '../types/workspace';
import { 
  fetchDefaultWorkspace, 
  fetchWorkspaces,
  setDefaultWorkspace,
  getWorkspaceTables
} from '../apis/workspaceService';
import { useUser } from './UserContext';
import { message } from 'antd';
import axios from 'axios';
import { API_BASE_URL } from '../config/constants';

// 工作区上下文接口
interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  defaultWorkspace: Workspace | null;
  loading: boolean;
  initializing: boolean; // 添加初始化状态标志
  error: string | null;
  workspaceTables: WorkspaceTableRead[]; // 当前工作区的表数据
  loadingTables: boolean; // 表数据加载状态
  refreshWorkspaceTables: () => Promise<void>; // 刷新表数据
  setCurrentWorkspace: (workspace: Workspace | null) => Promise<void>; // 修改为返回Promise
  setAsDefaultWorkspace: (workspace: Workspace) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  isChangingWorkspace: boolean; // 添加工作区切换状态标志
}

// 创建上下文
const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

// 上下文提供者组件
export const WorkspaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 登录后始终使用默认工作区，不再恢复之前选择的工作区
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [defaultWorkspace, setDefaultWorkspaceState] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [initializing, setInitializing] = useState<boolean>(true); // 添加初始化状态标志
  const [error, setError] = useState<string | null>(null);
  const [workspaceTables, setWorkspaceTables] = useState<WorkspaceTableRead[]>([]);
  const [loadingTables, setLoadingTables] = useState<boolean>(false);
  const [isChangingWorkspace, setIsChangingWorkspace] = useState<boolean>(false); // 添加工作区切换状态标志
  const { userState } = useUser();

  // 切换当前工作区
  const handleSetCurrentWorkspace = useCallback(async (workspace: Workspace | null): Promise<void> => {
    // 如果已经在切换工作区，则忽略此次请求
    if (isChangingWorkspace) {
      return;
    }
    
    // 如果要切换的工作区与当前工作区相同，则不执行切换
    if (workspace?.id === currentWorkspace?.id) {
      return;
    }
    
    try {
      setIsChangingWorkspace(true);
      
    // 仅更新UI状态，不设置为默认工作区
    setCurrentWorkspace(workspace);
      
      // 清空当前工作区的表数据缓存
      setWorkspaceTables([]);
    
    // 将当前工作区存储到sessionStorage中（仅会话级别，不持久化）
      sessionStorage.setItem('currentWorkspace', JSON.stringify(workspace));
      
      // 触发模块树刷新事件，使ModuleContext更新数据
      window.dispatchEvent(new Event('refreshModuleTree'));
      
      // 触发全局工作区变更事件，以便其他组件可以响应工作区切换
      const workspaceChangeEvent = new CustomEvent('workspaceChanged', {
        detail: { workspace }
      });
      window.dispatchEvent(workspaceChangeEvent);
      
      // 确保状态更新完成
      return new Promise<void>(resolve => {
        // 使用setTimeout确保状态更新已经应用
        setTimeout(() => {
          setIsChangingWorkspace(false);
          resolve();
        }, 300); // 增加延迟，确保状态更新完成
      });
    } catch (error) {
      console.error('存储当前工作区失败:', error);
      setIsChangingWorkspace(false);
      throw error;
    }
  }, [currentWorkspace?.id, isChangingWorkspace]);

  // 加载工作区列表和默认工作区
  const loadWorkspaces = useCallback(async (forceSetDefault = false) => {
    // 如果用户未登录，不执行请求
    if (!userState.isLoggedIn || !userState.token) {
      setInitializing(false); // 确保初始化完成
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 并行加载工作区列表和默认工作区
      const [workspacesData, defaultWorkspaceData] = await Promise.all([
        fetchWorkspaces(),
        fetchDefaultWorkspace()
      ]);

      setWorkspaces(workspacesData);
      setDefaultWorkspaceState(defaultWorkspaceData);

      // 只有在强制设置默认工作区或当前没有工作区时才设置为默认工作区
      if (defaultWorkspaceData && (forceSetDefault || !currentWorkspace)) {
        await handleSetCurrentWorkspace(defaultWorkspaceData);
      }
    } catch (err) {
      console.error('WorkspaceContext: 加载工作区数据失败:', err);
      setError('加载工作区数据失败');
      message.error('加载工作区数据失败');
    } finally {
      setLoading(false);
      setInitializing(false); // 确保初始化完成
    }
  }, [userState.isLoggedIn, userState.token, currentWorkspace, handleSetCurrentWorkspace]);

  // 初始加载默认工作区
  useEffect(() => {
    if (userState.isLoggedIn && userState.currentUser) {
      loadWorkspaces(true); // 初始加载时强制设置为默认工作区
    } else {
      setInitializing(false); // 如果用户未登录，也标记初始化完成
    }
  }, [userState.isLoggedIn, userState.currentUser]); // 移除loadWorkspaces依赖，避免循环触发

  // 刷新工作区列表
  const refreshWorkspaces = useCallback(async () => {
    await loadWorkspaces(false); // 刷新时不强制设置默认工作区
  }, [loadWorkspaces]);

  // 加载工作区表数据
  const loadWorkspaceTables = useCallback(async (workspaceId: number) => {
    if (!workspaceId) return;
    
    // 增强安全检查，确保用户已登录
    if (!userState.isLoggedIn || !userState.token) {
      return;
    }
    
    setLoadingTables(true);
    try {
      const tables = await getWorkspaceTables(workspaceId, 1, 10, '', true);
      setWorkspaceTables(tables);
    } catch (error) {
      console.error(`加载工作区(ID:${workspaceId})表数据失败:`, error);
    } finally {
      setLoadingTables(false);
    }
  }, [userState.isLoggedIn, userState.token]);

  // 刷新工作区表数据
  const refreshWorkspaceTables = useCallback(async () => {
    // 确保用户已登录
    if (!userState.isLoggedIn || !userState.token) {
      return;
    }
    
    if (currentWorkspace?.id) {
      await loadWorkspaceTables(currentWorkspace.id);
    }
  }, [currentWorkspace?.id, loadWorkspaceTables, userState.isLoggedIn, userState.token]);

  // 当工作区变更时，加载表数据
  useEffect(() => {
    // 只在用户已登录并且有当前工作区时加载表数据
    if (userState.isLoggedIn && userState.token && currentWorkspace?.id) {
      loadWorkspaceTables(currentWorkspace.id);
    } else {
      // 清空表数据
      setWorkspaceTables([]);
    }
  }, [userState.isLoggedIn, userState.token, currentWorkspace?.id, loadWorkspaceTables]);

  // 设置默认工作区
  const setAsDefaultWorkspace = async (workspace: Workspace) => {
    if (!userState.currentUser) return Promise.reject(new Error('用户未登录'));
    
    try {
      await setDefaultWorkspace(userState.currentUser.id, workspace.id);
      setDefaultWorkspaceState(workspace);
      message.success(`已将 ${workspace.name} 设为默认工作区`);
      return Promise.resolve();
    } catch (error) {
      console.error('设置默认工作区失败:', error);
      message.error('设置默认工作区失败');
      return Promise.reject(error);
    }
  };

  // 上下文值
  const contextValue: WorkspaceContextType = {
    currentWorkspace,
    workspaces,
    defaultWorkspace,
    loading,
    initializing,
    error,
    workspaceTables,
    loadingTables,
    refreshWorkspaceTables,
    setCurrentWorkspace: handleSetCurrentWorkspace,
    setAsDefaultWorkspace,
    refreshWorkspaces,
    isChangingWorkspace,
  };

  // 渲染提供者组件
  return (
    <WorkspaceContext.Provider value={contextValue}>
      {children}
    </WorkspaceContext.Provider>
  );
};

// 自定义Hook，用于访问工作区上下文
export const useWorkspace = (): WorkspaceContextType => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};

export default WorkspaceContext; 