import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { ROUTES } from '../../config/constants';

interface PrivateRouteProps {
  children: React.ReactNode;
}

/**
 * 私有路由组件
 * 用于保护需要登录才能访问的路由
 */
const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { userState } = useUser();
  
  // 判断用户是否已登录
  if (!userState.isLoggedIn) {
    // 未登录时重定向到登录页
    return <Navigate to={ROUTES.LOGIN} replace />;
  }
  
  // 已登录时显示子组件
  return <>{children}</>;
};

export default PrivateRoute; 