import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { ROUTES } from '../../config/constants';
import axios from 'axios';
import { API_BASE_URL } from '../../config/constants';
import { Spin } from 'antd';

interface PrivateRouteProps {
  children: React.ReactNode;
}

/**
 * 私有路由组件
 * 用于保护需要登录才能访问的路由
 * 并检查用户是否有权限访问当前页面
 */
const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { userState } = useUser();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  
  // 判断用户是否已登录
  if (!userState.isLoggedIn) {
    // 未登录时重定向到登录页
    return <Navigate to={ROUTES.LOGIN} replace />;
  }
  
  // 检查页面权限
  useEffect(() => {
    const checkPermission = async () => {
      try {
        setLoading(true);
        // 超级管理员拥有所有权限
        if (userState.currentUser?.is_superuser) {
          setHasPermission(true);
          setLoading(false);
          return;
        }

        // 获取用户可访问的页面路径
        const response = await axios.get(`${API_BASE_URL}/permissions/user/pages`, {
          headers: {
            Authorization: `Bearer ${userState.token}`
          }
        });
        
        const pages = response.data;
        // 检查当前路径是否在允许的页面列表中
        // 注意：这里只是简单匹配路径开头，实际可以根据需要优化匹配逻辑
        const currentPath = location.pathname;
        
        // 首页默认所有人可以访问
        if (currentPath === '/') {
          setHasPermission(true);
          setLoading(false);
          return;
        }
        
        // 检查权限
        const hasAccess = pages.some((pagePath: string) => {
          // 完全匹配或前缀匹配（处理动态路由参数）
          return currentPath === pagePath || 
                 currentPath.startsWith(pagePath + '/');
        });
        
        setHasPermission(hasAccess);
        setLoading(false);
      } catch (error) {
        console.error('获取页面权限失败:', error);
        // 权限检查失败时默认允许访问
        setHasPermission(true);
        setLoading(false);
      }
    };

    checkPermission();
  }, [location.pathname, userState.token, userState.currentUser]);

  // 加载中
  if (loading) {
    return <Spin tip="加载中..." size="large" style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }} />;
  }
  
  // 无权限访问
  if (!hasPermission) {
    return <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}>您没有权限访问此页面</div>;
  }
  
  // 已登录且有权限时显示子组件
  return <>{children}</>;
};

export default PrivateRoute; 