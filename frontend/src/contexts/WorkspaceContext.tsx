import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Workspace } from '../types/workspace';
import { 
  fetchDefaultWorkspace, 
  fetchWorkspaces,
  setDefaultWorkspace
} from '../apis/workspaceService';
import { useUser } from './UserContext';
import { message } from 'antd';
import axios from 'axios';
import { API_BASE_URL } from '../config/constants';

// 工作区上下文接口
interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  loading: boolean;
  error: string | null;
  setCurrentWorkspace: (workspace: Workspace) => void;
  setAsDefaultWorkspace: (workspace: Workspace) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
}

// 创建上下文
const WorkspaceContext = createContext<WorkspaceContextType>({
  currentWorkspace: null,
  workspaces: [],
  loading: false,
  error: null,
  setCurrentWorkspace: () => {},
  setAsDefaultWorkspace: async () => {},
  refreshWorkspaces: async () => {},
});

// 上下文提供者组件
export const WorkspaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { userState } = useUser();

  // 初始加载默认工作区
  useEffect(() => {
    if (userState.currentUser) {
      loadDefaultWorkspace();
    }
  }, [userState.currentUser]);

  // 加载默认工作区
  const loadDefaultWorkspace = async () => {
    try {
      setLoading(true);
      setError(null);

      // 加载用户可访问的所有工作区
      const allWorkspaces = await fetchWorkspaces();
      setWorkspaces(allWorkspaces);

      if (allWorkspaces.length === 0) {
        // 如果用户没有可访问工作区，自动尝试分配默认工作区
        const currentUserId = userState.currentUser?.id;
        if (currentUserId) {
          try {
            console.log('用户没有工作区访问权限，尝试自动分配默认工作区...');
            const response = await axios.post(
              `${API_BASE_URL}/workspaces/add_to_default/${currentUserId}`,
              {},
              {
                headers: {
                  Authorization: `Bearer ${userState.token}`
                }
              }
            );
            
            if (response.data.success) {
              console.log('成功分配默认工作区，正在重新加载工作区...');
              message.success(response.data.message || '已为您分配默认工作区访问权限');
              
              // 重新加载工作区列表
              const updatedWorkspaces = await fetchWorkspaces(true);
              setWorkspaces(updatedWorkspaces);
              
              if (updatedWorkspaces.length > 0) {
                // 成功获取到工作区，继续处理
                const defaultWorkspace = await fetchDefaultWorkspace(true);
                setCurrentWorkspace(defaultWorkspace);
                
                // 将工作区信息同时保存到localStorage和sessionStorage
                try {
                  localStorage.setItem('currentWorkspace', JSON.stringify(defaultWorkspace));
                  sessionStorage.setItem('currentWorkspace', JSON.stringify(defaultWorkspace));
                } catch (error) {
                  console.error('存储当前工作区失败:', error);
                }
                
                setLoading(false);
                return;
              }
            } else {
              console.log('自动分配默认工作区失败:', response.data.message);
            }
          } catch (error) {
            console.error('自动分配默认工作区失败:', error);
          }
        }
        
        // 如果自动分配失败或出错，显示错误消息
        setError('您没有权限访问任何工作区');
        setLoading(false);
        return;
      }

      // 尝试从sessionStorage获取上次使用的工作区ID
      let workspaceToUse = null;
      try {
        const sessionWorkspace = sessionStorage.getItem('currentWorkspace');
        if (sessionWorkspace) {
          const savedWorkspace = JSON.parse(sessionWorkspace);
          // 检查保存的工作区是否在当前用户的工作区列表中
          workspaceToUse = allWorkspaces.find(w => w.id === savedWorkspace.id);
          if (workspaceToUse) {
            console.log(`从会话中恢复工作区: ${workspaceToUse.name}(ID:${workspaceToUse.id})`);
          }
        }
      } catch (e) {
        console.error('从sessionStorage读取工作区失败:', e);
      }

      // 如果无法从sessionStorage恢复，则加载默认工作区
      if (!workspaceToUse) {
        workspaceToUse = await fetchDefaultWorkspace();
        console.log(`加载默认工作区: ${workspaceToUse.name}(ID:${workspaceToUse.id})`);
      }
      
      setCurrentWorkspace(workspaceToUse);
      
      // 将工作区信息同时保存到localStorage和sessionStorage
      try {
        localStorage.setItem('currentWorkspace', JSON.stringify(workspaceToUse));
        sessionStorage.setItem('currentWorkspace', JSON.stringify(workspaceToUse));
      } catch (error) {
        console.error('存储当前工作区失败:', error);
      }
    } catch (err) {
      console.error('加载默认工作区失败:', err);
      setError('加载工作区失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 刷新工作区列表
  const refreshWorkspaces = async () => {
    try {
      setLoading(true);
      setError(null);
      const allWorkspaces = await fetchWorkspaces(true);
      setWorkspaces(allWorkspaces);
      
      // 如果当前工作区不在列表中，重新设置为默认
      if (currentWorkspace && !allWorkspaces.find(w => w.id === currentWorkspace.id)) {
        const defaultWorkspace = await fetchDefaultWorkspace(true);
        setCurrentWorkspace(defaultWorkspace);
      }
    } catch (err) {
      console.error('刷新工作区列表失败:', err);
      setError('刷新工作区列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 切换当前工作区
  const handleSetCurrentWorkspace = async (workspace: Workspace) => {
    // 仅更新UI状态，不设置为默认工作区
    setCurrentWorkspace(workspace);
    
    // 将当前工作区同时存储到localStorage和sessionStorage中
    try {
      localStorage.setItem('currentWorkspace', JSON.stringify(workspace));
      sessionStorage.setItem('currentWorkspace', JSON.stringify(workspace));
      
      // 触发模块树刷新事件，使ModuleContext更新数据
      window.dispatchEvent(new Event('refreshModuleTree'));
      
      // 触发全局工作区变更事件，以便其他组件可以响应工作区切换
      const workspaceChangeEvent = new CustomEvent('workspaceChanged', {
        detail: { workspace }
      });
      window.dispatchEvent(workspaceChangeEvent);
      
      console.log(`已切换到工作区: ${workspace.name}(ID:${workspace.id})，已触发数据刷新事件`);
    } catch (error) {
      console.error('存储当前工作区失败:', error);
    }
  };

  // 设置默认工作区
  const setAsDefaultWorkspace = async (workspace: Workspace) => {
    if (!userState.currentUser) return;
    
    try {
      // 设置为用户默认工作区
      await setDefaultWorkspace(userState.currentUser.id, workspace.id);
      message.success('默认工作区设置成功');
    } catch (err) {
      console.error('设置默认工作区失败:', err);
      message.error('设置默认工作区失败，请稍后重试');
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        workspaces,
        loading,
        error,
        setCurrentWorkspace: handleSetCurrentWorkspace,
        setAsDefaultWorkspace,
        refreshWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

// 使用工作区上下文的Hook
export const useWorkspaceContext = () => useContext(WorkspaceContext); 