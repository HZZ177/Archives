import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { UserProvider } from './contexts/UserContext';
import { ModuleProvider } from './contexts/ModuleContext';
import { PermissionProvider } from './contexts/PermissionContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import PasswordChangeWrapper from './components/layouts/PasswordChangeWrapper';
import router from './router';
import './styles/global.css';
import { preloadCriticalComponents } from './utils/preloadRegistry';

const App: React.FC = () => {
  console.log('App组件渲染');
  
  // 在App组件挂载时预加载关键组件
  useEffect(() => {
    console.log('App组件挂载，启动预加载关键组件');
    // 预加载关键组件
    preloadCriticalComponents();
    
    return () => {
      console.log('App组件卸载');
    };
  }, []);
  
  return (
    <ConfigProvider locale={zhCN}>
      <UserProvider>
        <WorkspaceProvider>
          <ModuleProvider>
            <PermissionProvider>
              <PasswordChangeWrapper>
                <RouterProvider router={router} />
              </PasswordChangeWrapper>
            </PermissionProvider>
          </ModuleProvider>
        </WorkspaceProvider>
      </UserProvider>
    </ConfigProvider>
  );
};

export default App; 