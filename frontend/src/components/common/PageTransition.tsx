import React, { useRef, useState, useEffect } from 'react';
import { Outlet, useLocation, ScrollRestoration } from 'react-router-dom';
import { CSSTransition, SwitchTransition } from 'react-transition-group';

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