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
    console.log(`PrivateRoute: 路径变更 - 从 ${lastCheckedPath} 到 ${currentPath}`);
    setLastCheckedPath(currentPath);
  }
  
  // 添加组件生命周期日志
  useEffect(() => {
    console.log(`PrivateRoute: 组件挂载 - 路径: ${location.pathname}`);
    
    return () => {
      console.log(`PrivateRoute: 组件卸载 - 路径: ${location.pathname}`);
    };
  }, []); // 仅在组件挂载和卸载时执行
  
  // 判断用户是否已登录
  if (!userState.isLoggedIn) {
    // 未登录时重定向到登录页
    return <Navigate to={ROUTES.LOGIN} replace />;
  }
  
  // 特殊路径始终允许访问，避免无限重定向
  if (currentPath === '/no-permission') {
    console.log('PrivateRoute: 访问无权限页面，直接通过');
    return <>{children}</>;
        }

  // 等待权限加载完成
  if (permissionLoading) {
    console.log('PrivateRoute: 权限加载中，显示加载指示器');
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin tip="验证权限中..." />
      </div>
    );
  }
  
  // 检查用户是否有权限访问当前页面
  const authorized = hasPermission(currentPath);
  
  // 权限检查结束后打印调试信息
  console.log(`PrivateRoute: 权限检查完成 - 路径: ${currentPath}, 权限: ${authorized ? '有权限' : '无权限'}, 权限列表:`, userPermissions);
  
  // 无权限访问
  if (!authorized) {
    console.log(`PrivateRoute: 无访问权限 - 路径: ${currentPath}`);
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