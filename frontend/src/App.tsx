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
  // 在App组件挂载时预加载关键组件
  useEffect(() => {
    // 预加载关键组件
    preloadCriticalComponents();
  }, []);
  
  return (
    <ConfigProvider locale={zhCN}>
      <UserProvider>
        <WorkspaceProvider>
          <ModuleProvider>
            <PermissionProvider>
              <PasswordChangeWrapper>
                <RouterProvider
                  router={router}
                  future={{
                    v7_startTransition: true,
                  }}
                />
              </PasswordChangeWrapper>
            </PermissionProvider>
          </ModuleProvider>
        </WorkspaceProvider>
      </UserProvider>
    </ConfigProvider>
  );
};

export default App; 