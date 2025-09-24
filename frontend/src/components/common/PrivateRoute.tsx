import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { usePermission } from '../../contexts/PermissionContext';
import { ROUTES } from '../../config/constants';
import { Spin } from 'antd';

interface PrivateRouteProps {
  children: React.ReactNode;
}

/**
 * 私有路由组件
 * 用于保护需要登录才能访问的路由
 * 并检查用户是否有权限访问当前页面
 */
const PrivateRoute: React.FC<PrivateRouteProps> = React.memo(({ children }) => {
  const { userState } = useUser();
  const { hasPermission, loading: permissionLoading, userPermissions } = usePermission();
  const location = useLocation();
  const [lastCheckedPath, setLastCheckedPath] = useState('');
  
  const currentPath = location.pathname;
  const isSamePath = lastCheckedPath === currentPath;
  
  if (!isSamePath) {
    setLastCheckedPath(currentPath);
  }
  
  // 判断用户是否已登录
  if (!userState.isLoggedIn) {
    // 未登录时重定向到登录页
    return <Navigate to={ROUTES.LOGIN} replace />;
  }
  
  // 特殊路径始终允许访问，避免无限重定向
  if (currentPath === '/no-permission') {
    return <>{children}</>;
  }

  // 等待权限加载完成
  if (permissionLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin tip="验证权限中..." size="large">
          <div style={{ minHeight: '100px', minWidth: '100px' }} />
        </Spin>
      </div>
    );
  }
  
  // 检查用户是否有权限访问当前页面
  const authorized = hasPermission(currentPath);
  
  // 无权限访问
  if (!authorized) {
    return <Navigate to="/no-permission" replace />;
  }
  
  // 已登录且有权限时显示子组件
  return <>{children}</>;
}, (prevProps, nextProps) => {
  // 自定义比较函数，减少不必要的重渲染
  // 只有当子组件引用发生变化时才重新渲染
  return prevProps.children === nextProps.children;
});

export default PrivateRoute; 