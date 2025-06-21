import React, { useRef, useState, useEffect } from 'react';
import { Outlet, useLocation, ScrollRestoration } from 'react-router-dom';
import { CSSTransition, SwitchTransition } from 'react-transition-group';

// 定义系统页面路径列表，这些页面使用较小的初始高度
const systemPages = [
  '/', // 首页
  '/system', // 系统管理页面
  '/system/users', // 用户管理
  '/system/roles', // 角色管理
  '/permissions', // 权限管理
  '/structure-management', // 结构管理
  '/structure-management/tree', // 结构树配置
  '/structure-management/module-config', // 页面模块配置
  '/templates', // 模板列表
  '/documents', // 文档列表
  '/workspaces/manage', // 工作区管理
  '/workspaces/tables', // 数据库表池
  '/workspaces/interfaces', // 接口池
];

// 检查当前路径是否为系统页面
const isSystemPage = (path: string): boolean => {
  return systemPages.some(page => path === page || path.startsWith(`${page}/`));
};

/**
 * 带过渡效果的页面组件
 * 在路由切换时，提供流畅的过渡动画
 */
const PageTransition: React.FC = () => {
  const location = useLocation();
  const nodeRef = useRef<HTMLDivElement>(null);
  const [minHeight, setMinHeight] = useState<number>(200);
  const [prevPathname, setPrevPathname] = useState<string>('');
  
  // 记录上一个路径和内容高度，确保过渡时不会塌陷
  useEffect(() => {
    if (location.pathname !== prevPathname) {
      // 仅在路径变化时记录
      if (nodeRef.current) {
        const height = nodeRef.current.offsetHeight;
        if (height > 0) {
          // 留出一点额外空间，避免滚动条闪烁
          setMinHeight(height);
        }
        setPrevPathname(location.pathname);
      }
    }
  }, [location.pathname, prevPathname]);
  
  return (
    <>
      {/* 自动恢复滚动位置 */}
      <ScrollRestoration />
      
      <SwitchTransition mode="out-in">
        <CSSTransition
          key={location.pathname}
          nodeRef={nodeRef}
          classNames="page-transition"
          timeout={{
            enter: 200,
            exit: 150
          }}
          mountOnEnter
          unmountOnExit
          onEnter={() => {
            // 页面进入时，使用之前记录的高度，避免布局抖动
            if (nodeRef.current) {
              nodeRef.current.style.minHeight = `${minHeight}px`;
            }
          }}
          onExited={() => {
            // 页面退出后，清除固定高度，允许自动调整
            if (nodeRef.current) {
              nodeRef.current.style.minHeight = '';
            }
            
            // 重置 minHeight 状态变量，确保新页面可以自动调整高度
            // 使用延迟处理，确保在新页面内容渲染后再重置高度
            setTimeout(() => {
              // 检查当前路径是否为系统页面，如果是则使用较小的初始高度
              if (isSystemPage(location.pathname)) {
                setMinHeight(200); // 系统页面使用较小的初始高度
              } else {
                // 对于内容页面，根据当前内容高度设置新的 minHeight
                if (nodeRef.current) {
                  const newHeight = nodeRef.current.offsetHeight;
                  if (newHeight > 0) {
                    setMinHeight(newHeight);
                  }
                }
              }
            }, 300); // 延迟300ms，确保新页面已渲染
          }}
        >
          <div 
            ref={nodeRef} 
            className="main-content"
            style={{ 
              minHeight: `${minHeight}px`, 
              transition: 'min-height 0.2s ease-out' 
            }}
          >
            <Outlet />
          </div>
        </CSSTransition>
      </SwitchTransition>
    </>
  );
};

export default PageTransition; 