import { lazy } from 'react';
import { preloadComponentsWithLowPriority } from './preloadUtils';

// 导入lazy组件
const lazyComponents = {
  UserList: lazy(() => import('../pages/user/UserList')),
  UserDetail: lazy(() => import('../pages/user/components/UserDetail')),
  RoleList: lazy(() => import('../pages/role/RoleList')),
  StructureManagementPage: lazy(() => import('../pages/structure-management/StructureManagementPage')),
  ModuleContentPage: lazy(() => import('../pages/module-content/ModuleContentPage'))
};

/**
 * 预加载关键组件
 * 在应用启动后立即执行，使用低优先级预加载
 */
export const preloadCriticalComponents = (): void => {
  // 首批优先加载的组件 - 这些是最常用的页面
  const criticalComponents = [
    lazyComponents.UserList,
    lazyComponents.RoleList,
    lazyComponents.StructureManagementPage
  ];
  
  // 第二批低优先级加载的组件
  const secondaryComponents = [
    lazyComponents.UserDetail,
    lazyComponents.ModuleContentPage
  ];
  
  // 预加载首批关键组件
  preloadComponentsWithLowPriority(criticalComponents);
  
  // 延迟加载第二批组件
  setTimeout(() => {
    preloadComponentsWithLowPriority(secondaryComponents);
  }, 5000); // 5秒后加载次要组件
};

/**
 * 按需预加载特定组件
 * 可在导航前调用预加载目标路由的组件
 */
export const preloadComponentByName = (name: keyof typeof lazyComponents): void => {
  const component = lazyComponents[name];
  if (component) {
    import('./preloadUtils').then(({ preloadComponent }) => {
      preloadComponent(component);
    });
  }
};

// 导出预加载的组件，以便在路由中使用
export default lazyComponents; 