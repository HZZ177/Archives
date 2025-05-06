import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { UserProvider } from './contexts/UserContext';
import LoginPage from './pages/login/LoginPage';
import MainLayout from './layouts/MainLayout';
import UserList from './pages/user/UserList';
import UserDetail from './pages/user/components/UserDetail';
import DocumentList from './pages/documents/DocumentList';
import DocumentEdit from './pages/documents/DocumentEdit';
import RoleList from './pages/role/RoleList';
import PermissionList from './pages/permission/PermissionList';
import { ROUTES } from './config/constants';
import PrivateRoute from './components/common/PrivateRoute';
import './styles/global.css';
import StructureManagementPage from './pages/structure-management/StructureManagementPage';
import ModuleContentPage from './pages/module-content/ModuleContentPage';

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <UserProvider>
        <Router>
          <Routes>
            <Route path={ROUTES.LOGIN} element={<LoginPage />} />
            
            <Route path="/" element={
              <PrivateRoute>
                <MainLayout />
              </PrivateRoute>
            }>
              <Route index element={<div>首页内容</div>} />
              
              <Route path={ROUTES.USER_LIST} element={<UserList />} />
              <Route path={`${ROUTES.USER_LIST}/:id`} element={<UserDetail />} />
              <Route path={`${ROUTES.USER_LIST}/new`} element={<UserDetail />} />
              
              <Route path={ROUTES.ROLE_LIST} element={<RoleList />} />
              <Route path={ROUTES.PERMISSION_LIST} element={<PermissionList />} />
              
              <Route path={ROUTES.TEMPLATE_LIST} element={<div>模板列表页面</div>} />
              <Route path={`${ROUTES.TEMPLATE_LIST}/:id`} element={<div>模板详情页面</div>} />
              
              <Route path={ROUTES.DOCUMENT_LIST} element={<DocumentList />} />
              <Route path={`${ROUTES.DOCUMENT_LIST}/new`} element={<DocumentEdit />} />
              <Route path={`${ROUTES.DOCUMENT_LIST}/:id`} element={<DocumentEdit />} />

              <Route path={ROUTES.STRUCTURE_MANAGEMENT} element={<StructureManagementPage />} />
              <Route path={`${ROUTES.MODULE_CONTENT}/:moduleId`} element={<ModuleContentPage />} />
            </Route>
            
            {/* 默认路由重定向到首页 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </UserProvider>
    </ConfigProvider>
  );
};

export default App; 