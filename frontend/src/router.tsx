import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate, ScrollRestoration, useNavigate } from 'react-router-dom';
import { Spin, Button, Space, Typography } from 'antd';
import LoginPage from './pages/login/LoginPage';
import MainLayout from './layouts/MainLayout';
import { ROUTES } from './config/constants';
import PrivateRoute from './components/common/PrivateRoute';
import { useUser } from './contexts/UserContext';

// 使用React.lazy进行代码分割，减少初始加载时间
const UserList = lazy(() => import('./pages/user/UserList'));
const UserDetail = lazy(() => import('./pages/user/components/UserDetail'));
const DocumentList = lazy(() => import('./pages/documents/DocumentList'));
const DocumentEdit = lazy(() => import('./pages/documents/DocumentEdit'));
const RoleList = lazy(() => import('./pages/role/RoleList'));
const PermissionList = lazy(() => import('./pages/permission/PermissionList'));
const StructureManagementPage = lazy(() => import('./pages/structure-management/StructureManagementPage'));
const ModuleContentPage = lazy(() => import('./pages/module-content/ModuleContentPage'));
const WorkspaceManagePage = lazy(() => import('./pages/workspace/WorkspaceManagePage'));
const HomePage = lazy(() => import('./pages/home/HomePage'));

// 加载指示器组件
const LoadingComponent = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '200px' }}>
    <Spin tip="页面加载中..." />
  </div>
);

// 包装Suspense组件，简化路由配置
const SuspenseWrapper = ({ component: Component }: { component: React.ComponentType<any> }) => (
  <Suspense fallback={<LoadingComponent />}>
    <Component />
  </Suspense>
);

// 包装PrivateRoute组件，减少重复代码
const PrivateComponent = ({ component: Component }: { component: React.ComponentType<any> }) => (
  <PrivateRoute>
    <SuspenseWrapper component={Component} />
  </PrivateRoute>
);

// 无权限页面
const NoPermissionPage = () => {
  const navigate = useNavigate();
  const { logout } = useUser();
  
  const handleBackToLogin = async () => {
    try {
      await logout();
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (error) {
      console.error('登出失败:', error);
      // 即使登出失败，也强制跳转到登录页
      navigate(ROUTES.LOGIN, { replace: true });
    }
  };
  
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      marginTop: '100px',
      gap: '20px'
    }}>
      <Typography.Title level={3}>
        您没有权限访问此页面
      </Typography.Title>
      <Space>
        <Button type="primary" onClick={handleBackToLogin}>
          返回登录页
        </Button>
      </Space>
    </div>
  );
};

// 创建路由配置
const router = createBrowserRouter([
  {
    path: ROUTES.LOGIN,
    element: <LoginPage />
  },
  // 无权限页面单独定义，避免循环重定向
  {
    path: '/no-permission',
    element: <NoPermissionPage />
  },
  {
    path: '/',
    element: (
      <PrivateRoute>
        <MainLayout />
      </PrivateRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <>
            <ScrollRestoration />
            <SuspenseWrapper component={HomePage} />
          </>
        )
      },
      {
        path: ROUTES.USER_LIST,
        element: <SuspenseWrapper component={UserList} />
      },
      {
        path: `${ROUTES.USER_LIST}/:id`,
        element: <SuspenseWrapper component={UserDetail} />
      },
      {
        path: `${ROUTES.USER_LIST}/new`,
        element: <SuspenseWrapper component={UserDetail} />
      },
      {
        path: ROUTES.ROLE_LIST,
        element: <SuspenseWrapper component={RoleList} />
      },
      {
        path: ROUTES.PERMISSION_LIST,
        element: <SuspenseWrapper component={PermissionList} />
      },
      {
        path: ROUTES.TEMPLATE_LIST,
        element: <div>模板列表页面</div>
      },
      {
        path: `${ROUTES.TEMPLATE_LIST}/:id`,
        element: <div>模板详情页面</div>
      },
      {
        path: ROUTES.DOCUMENT_LIST,
        element: <SuspenseWrapper component={DocumentList} />
      },
      {
        path: `${ROUTES.DOCUMENT_LIST}/new`,
        element: <SuspenseWrapper component={DocumentEdit} />
      },
      {
        path: `${ROUTES.DOCUMENT_LIST}/:id`,
        element: <SuspenseWrapper component={DocumentEdit} />
      },
      {
        path: ROUTES.STRUCTURE_MANAGEMENT,
        element: <SuspenseWrapper component={StructureManagementPage} />
      },
      {
        path: `${ROUTES.MODULE_CONTENT}/:moduleId`,
        element: <SuspenseWrapper component={ModuleContentPage} />
      },
      {
        path: ROUTES.WORKSPACES_MANAGE,
        element: <SuspenseWrapper component={WorkspaceManagePage} />
      }
    ]
  },
  {
    path: '*',
    element: <Navigate to="/" replace />
  }
], {
  // 启用滚动恢复，改善用户体验
  future: {
    v7_normalizeFormMethod: true,
  },
});

export default router; 