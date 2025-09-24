import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Layout, Menu, theme, Button, Dropdown, Avatar, Breadcrumb, Tooltip, Space, Spin } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import {
  UserOutlined,
  TeamOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  HomeOutlined,
  AppstoreOutlined,
  FolderOutlined,
  FileTextOutlined,

  BranchesOutlined,
  BookOutlined,
  DatabaseOutlined,
  ApiOutlined,
  BugOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useModules } from '../contexts/ModuleContext';
import { ROUTES } from '../config/constants';

import { ModuleStructureNode } from '../types/modules';
import { fetchUserPagePermissions } from '../apis/permissionService';
// 使用新的PageTransition组件
import PageTransition from '../components/common/PageTransition';
import WorkspaceSelector from '../components/common/WorkspaceSelector';
import PasswordChangeWrapper from '../components/layouts/PasswordChangeWrapper';

const { Header, Sider, Content } = Layout;

// 防抖函数实现
const debounce = <F extends (...args: any[]) => any>(
  func: F, 
  wait: number
): ((...args: Parameters<F>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<F>) {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
};

// 侧边栏宽度常量
const DEFAULT_SIDER_WIDTH = 250;
const MIN_SIDER_WIDTH = 150;
const MAX_SIDER_WIDTH = 500;

// 定义菜单项类型，增加了page_path属性
interface ExtendedMenuItem {
  key: string;
  icon?: React.ReactNode;
  label: React.ReactNode;
  page_path?: string;
  children?: ExtendedMenuItem[];
}

// 自定义分隔线类型
interface MenuDivider {
  type: 'divider';
  key: string;
}

// 组合类型，可以是扩展菜单项或分隔线
type MenuItemOrDivider = ExtendedMenuItem | MenuDivider;

// 静态菜单项不应该每次渲染都创建新的对象，将其移到组件外部
const staticMenuItems: ExtendedMenuItem[] = [
  {
    key: '/',
    icon: <HomeOutlined />,
    label: '首页',
    page_path: '/',
  },
  {
    key: '/system',
    icon: <AppstoreOutlined />,
    label: '系统管理',
    page_path: '/system',
    children: [
      {
        key: '/system/users',
        icon: <UserOutlined />,
        label: '用户管理',
        page_path: '/system/users',
      },
      {
        key: '/system/roles',
        icon: <TeamOutlined />,
        label: '角色管理',
        page_path: '/system/roles',
      },
      {
        key: '/system/ai-models',
        icon: <RobotOutlined />,
        label: 'AI模型管理',
        page_path: '/system/ai-models',
      },
    ],
  },
  {
    key: '/structure-management',
    icon: <AppstoreOutlined />,
    label: '结构管理',
    page_path: '/structure-management',
    children: [
        {
            key: '/structure-management/tree',
            icon: <AppstoreOutlined />,
            label: '结构树配置',
            page_path: '/structure-management/tree',
        },
        {
            key: '/structure-management/module-config',
            icon: <AppstoreOutlined />,
            label: '页面模块配置',
            page_path: '/structure-management/module-config',
        }
    ]
  },
  {
    key: '/workspaces/resources',
    icon: <BookOutlined />,
    label: '数据资源',
    page_path: '/workspaces/resources',
    children: [
      {
        key: '/workspaces/tables',
        icon: <DatabaseOutlined />,
        label: '数据库表池',
        page_path: '/workspaces/tables',
      },
      {
        key: '/workspaces/interfaces',
        icon: <ApiOutlined />,
        label: '接口池',
        page_path: '/workspaces/interfaces',
      },
      {
        key: '/workspaces/bug-management',
        icon: <BugOutlined />,
        label: '缺陷管理',
        page_path: '/workspaces/bug-management',
      },
    ],
  },
];

// 创建一个全局事件总线，用于在不同组件间通信
export const refreshModuleTreeEvent = new CustomEvent('refreshModuleTree');

// 当前路由路径记录，用于跟踪路由变化
let previousPath = '';

// 递归查找当前路径对应菜单项的所有父级key
const findMenuPathKeys = (
  items: any[],
  targetKey: string,
  path: string[] = []
): string[] => {
  for (const item of items) {
    if (item.key === targetKey) {
      return [...path];
    }
    if (item.children) {
      const found = findMenuPathKeys(item.children, targetKey, [...path, item.key]);
      if (found.length > 0) return found;
    }
  }
  return [];
};

// 注释：已删除未使用的 MenuItem 接口和 menuItems 配置
// 实际使用的是 staticMenuItems 配置（第78行开始）

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  // 使用ModuleContext代替本地状态
  const { modules: userModules, loading: modulesLoading, fetchModules } = useModules();
  const [siderWidth, setSiderWidth] = useState(() => {
    const savedWidth = localStorage.getItem('siderWidth');
    return savedWidth ? parseInt(savedWidth) : DEFAULT_SIDER_WIDTH;
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const { userState, logout, refreshUserInfo } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [filteredMenuItems, setFilteredMenuItems] = useState<ItemType[]>([]);
  const { currentWorkspace, initializing } = useWorkspace();
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  // 注释：selectedKeys 现在由路由自动管理，不需要手动状态
  
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  // 在组件挂载时记录日志，包括组件挂载原因
  useEffect(() => {
    const currentPath = location.pathname;
    
    // 记录组件挂载时的路由路径
    previousPath = currentPath;
    
    // 组件卸载时执行清理，记录卸载日志
    return () => {
      const unmountPath = location.pathname;
    };
  }, []); // 仅在组件挂载和卸载时执行

  // 刷新用户模块树 - 使用ModuleContext的fetchModules方法
  const refreshModuleTree = useCallback(async () => {
    await fetchModules();
  }, [fetchModules]);

  // 监听全局刷新事件 - 不再需要，ModuleContext已经处理刷新事件
  // 不过我们仍然保留这个注释，以便理解，但相关代码已移除

  // 获取用户模块 - 确保模块已加载
  useEffect(() => {
    if (userModules.length === 0 && !modulesLoading) {
      refreshModuleTree();
    }
  }, [refreshModuleTree, userModules.length, modulesLoading]);

  // 添加鼠标样式效果
  useEffect(() => {
    if (isDragging) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  // 获取用户权限
  useEffect(() => {
    const fetchUserPermissions = async () => {
      try {
        const workspaceId = currentWorkspace?.id;
        const pagePaths = await fetchUserPagePermissions(workspaceId);
        const permissions = Array.isArray(pagePaths) ? pagePaths : [];
        setUserPermissions(permissions);
      } catch (error) {
        console.error('获取用户权限失败:', error);
        setUserPermissions([]);
      }
    };

    if (userState.isLoggedIn) {
      fetchUserPermissions();
    }
  }, [userState.isLoggedIn, currentWorkspace?.id]);

  // 从模块结构生成菜单项，根据has_content属性区分处理方式
  const convertModuleToMenuItem = (module: ModuleStructureNode): ExtendedMenuItem => {
    // 优先使用is_content_page字段判断节点类型，区分内容页面和普通目录节点
    const moduleIcon = module.is_content_page ? <FileTextOutlined /> : <FolderOutlined />;
    
    // 如果模块被标记为内容页面类型，无论是否有子节点，都显示为内容页面
    if (module.is_content_page) {
      return {
        key: `/module-content/${module.id}`,
        icon: moduleIcon,
        label: module.name,
        page_path: `/module-content/${module.id}`,
        // 内容页面类型不显示子节点，直接导航到内容页面
      };
    }
    
    // 对于普通目录节点，继续递归处理子节点
    return {
      key: `/module-content/${module.id}`,
      icon: moduleIcon,
      label: module.name,
      page_path: `/module-content/${module.id}`,
      children: module.children?.map(child => convertModuleToMenuItem(child)),
    };
  };

  /**
   * 递归过滤菜单项函数
   * @param items 要过滤的菜单项
   * @param permissions 用户拥有的权限列表
   * @param isSystemMenu 是否为系统菜单（系统菜单和模块菜单有不同的过滤规则）
   * @returns 过滤后的菜单项
   */
  const filterMenuItems = (items: MenuItemOrDivider[], permissions: string[], isSystemMenu: boolean = false): MenuItemOrDivider[] => {
    return items
      .map(item => {
        // 如果是分隔线，直接保留
        if ('type' in item && item.type === 'divider') {
          return item;
        }

        // 检查当前项是否有直接权限 - 严格匹配模式
        let hasDirectPermission = false;
        if ('page_path' in item && item.page_path) {
          // 严格匹配：只有当权限列表中包含完全相同的路径时才认为有权限
          hasDirectPermission = permissions.includes(item.page_path);



          // 移除特殊处理模块内容页面的宽松匹配逻辑
          // 每个模块内容页面都需要有明确的权限
        }
        
        // 如果有子菜单，递归过滤子菜单
        if ('children' in item && item.children && item.children.length > 0) {
          const filteredChildren = filterMenuItems(item.children, permissions, isSystemMenu);
          
          // 是否有权访问的子项
          const hasAccessibleChildren = filteredChildren.length > 0;
          
          if (isSystemMenu) {
            // 系统菜单处理逻辑：仍然保持相对宽松的策略，但子菜单必须严格匹配
            if (filteredChildren.length === 0 && !hasDirectPermission) {
              return null;
            }
            return { ...item, children: filteredChildren };
          } else {
            // 模块菜单处理逻辑：严格权限策略
            if (hasDirectPermission) {
              // 如果用户有当前节点的直接权限，则显示当前节点和所有有权限的子节点
              return { ...item, children: filteredChildren };
            } else if (hasAccessibleChildren) {
              // 如果用户没有当前节点的直接权限，但有子节点的权限，则显示当前节点作为导航路径，但只显示有权限的子节点
              return { ...item, children: filteredChildren };
            }
            return null;
          }
        }
        
        // 叶子节点权限判断 - 严格匹配
        return hasDirectPermission ? item : null;
      })
      .filter(Boolean) as MenuItemOrDivider[];
  };

  // 侧边栏拖动相关函数
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    const startX = e.clientX;
    const startWidth = siderWidth;
    
    const handleDragMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      // 限制宽度在合理范围内
      if (newWidth >= MIN_SIDER_WIDTH && newWidth <= MAX_SIDER_WIDTH) {
        setSiderWidth(newWidth);
      }
    };
    
    const handleDragEnd = () => {
      setIsDragging(false);
      // 保存宽度到localStorage
      localStorage.setItem('siderWidth', String(siderWidth));
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
    
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  }, [siderWidth]);

  // 过滤菜单项，只显示有权限的
  useEffect(() => {
    // 避免在依赖项变化前执行逻辑
    if (!userPermissions.length && !userState.currentUser) {
      return;
    }
    
    // 获取用户模块菜单项
    const userModuleMenuItems = userModules.map(module => convertModuleToMenuItem(module));
    
    // 只有当存在用户模块菜单项时，才添加分割线
    const dividerItem: MenuDivider[] = userModuleMenuItems.length > 0 ? [
      {
        type: 'divider',
        key: 'system-modules-divider',
      }
    ] : [];
    
    // 超级管理员可以看到所有菜单
    if (userState.currentUser?.is_superuser) {
      // 合并静态菜单项、分割线和用户自定义模块菜单项
      const allMenuItems = [...staticMenuItems, ...dividerItem, ...userModuleMenuItems];
      setFilteredMenuItems(allMenuItems);
      return;
    }

    // 应用过滤
    // 对静态菜单项和模块菜单项分别过滤，传入不同的isSystemMenu参数
    const filteredStaticItems = filterMenuItems(staticMenuItems, userPermissions, true);

    // 自定义模块权限检查
    // 如果有任何模块的page_path存在于用户权限中，则显示该模块
    const filteredModuleItems = userModuleMenuItems.length > 0
      ? filterMenuItems(userModuleMenuItems, userPermissions, false)
      : [];

    // 只有当筛选后的模块菜单项不为空时，才包含分隔线
    const finalDividerItem = filteredModuleItems.length > 0 ? dividerItem : [];

    // 合并过滤后的菜单项
    const finalMenuItems = [...filteredStaticItems, ...finalDividerItem, ...filteredModuleItems];
    
    // 如果用户只有模块权限而没有系统权限，至少确保首页菜单可见
    if (filteredStaticItems.length === 0 && filteredModuleItems.length > 0) {
      // 添加首页菜单项
      finalMenuItems.unshift({
        key: '/',
        icon: <HomeOutlined />,
        label: '首页',
        page_path: '/',
      });
    }
    
    setFilteredMenuItems(finalMenuItems);
  }, [userModules, userPermissions, userState.currentUser]);

  // 用户菜单
  const userMenuItems = useMemo(() => [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
    },
  ], []);

  // 处理菜单点击
  const handleMenuClick = useCallback((key: string) => {
    if (key === 'logout') {
      handleLogout();
    } else if (key === 'profile') {
      navigate('/user/profile');
    }
  }, [navigate, logout]);

  // 处理登出
  const handleLogout = async () => {
    try {
      await logout();
      // 使用window.location.href进行硬重定向，确保页面完全刷新
      window.location.href = ROUTES.LOGIN;
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // 查找从根节点到目标节点的完整路径
  const findModulePath = (modules: ModuleStructureNode[], targetId: number): ModuleStructureNode[] => {
    const findPath = (nodes: ModuleStructureNode[], id: number, path: ModuleStructureNode[] = []): ModuleStructureNode[] | null => {
      for (const node of nodes) {
        // 尝试当前节点路径
        const currentPath = [...path, node];
        
        // 如果找到目标节点，返回路径
        if (node.id === id) {
          return currentPath;
        }
        
        // 如果有子节点，递归搜索
        if (node.children && node.children.length > 0) {
          const foundPath = findPath(node.children, id, currentPath);
          if (foundPath) {
            return foundPath;
          }
        }
      }
      
      // 没找到返回null
      return null;
    };
    
    const result = findPath(modules, targetId);
    return result || [];
  };

  // 根据路径生成面包屑
  const generateBreadcrumb = useCallback(() => {
    const pathSnippets = location.pathname.split('/').filter(i => i);
    const breadcrumbItems: any[] = [];

    // 系统管理页面的面包屑 - 添加首页作为起点
    if (pathSnippets.includes('users') || pathSnippets.includes('roles') || pathSnippets.includes('structure-management')) {
      // 系统页面添加首页作为起点
      breadcrumbItems.push({
        title: <Link to="/">首页</Link>,
      });
      
      if (pathSnippets.includes('users')) {
        breadcrumbItems.push({
          title: <span>系统管理</span>,
        });
        breadcrumbItems.push({
          title: <span>用户管理</span>,
        });
      } else if (pathSnippets.includes('roles')) {
        breadcrumbItems.push({
          title: <span>系统管理</span>,
        });
        breadcrumbItems.push({
          title: <span>角色管理</span>,
        });
      } else if (pathSnippets.includes('structure-management')) {
        breadcrumbItems.push({
          title: <span>结构管理</span>,
        });
        
        // 处理结构管理的子页面
        if (pathSnippets.includes('tree')) {
          breadcrumbItems.push({
            title: <span>结构树配置</span>,
          });
        } else if (pathSnippets.includes('module-config')) {
          breadcrumbItems.push({
            title: <span>页面模块配置</span>,
          });
        }
      }
    } else if (pathSnippets.includes('module-content')) {
      // 为模块内容页面查找对应的模块路径
      const moduleId = parseInt(pathSnippets[pathSnippets.length - 1]);
      
      // 使用新函数查找完整路径
      const modulePath = findModulePath(userModules, moduleId);
      
      // 如果找到路径，构建面包屑
      if (modulePath.length > 0) {
        // 遍历路径中所有节点
        for (let i = 0; i < modulePath.length; i++) {
          const node = modulePath[i];
          const isLastNode = i === modulePath.length - 1;
          
          // 根据节点类型和是否为最后一个节点决定显示方式：
          // 1. 最后一个节点总是纯文本
          // 2. 中间节点只有在是内容页面(is_content_page=true)时才有链接
          if (isLastNode) {
            breadcrumbItems.push({
              title: <span>{node.name}</span>,
            });
          } else if (node.is_content_page) {
            // 内容页面节点可以链接
            breadcrumbItems.push({
              title: <Link to={`/module-content/${node.id}`}>{node.name}</Link>,
            });
          } else {
            // 普通节点不可链接，仅显示文本
            breadcrumbItems.push({
              title: <span>{node.name}</span>,
            });
          }
        }
      } else {
        // 如果没找到路径，回退到只显示当前节点名称
        const findModuleName = (modules: ModuleStructureNode[]): string | null => {
          for (const module of modules) {
            if (module.id === moduleId) {
              return module.name;
            }
            if (module.children) {
              const name = findModuleName(module.children);
              if (name) return name;
            }
          }
          return null;
        };
        
        const moduleName = findModuleName(userModules);
        if (moduleName) {
          breadcrumbItems.push({
            title: <span>{moduleName}</span>,
          });
        } else {
          breadcrumbItems.push({
            title: <span>模块内容</span>,
          });
        }
      }
    }

    return breadcrumbItems;
  }, [location.pathname, userModules]);

  // 添加菜单预加载功能，在鼠标悬停时预加载组件
  const handleMenuHover = (key: string) => {
    // 通过路径判断应该预加载哪个组件
    switch(key) {
      case '/roles':
        import('../utils/preloadRegistry').then(module => {
          module.preloadComponentByName('RoleList');
        });
        break;
      case '/users':
        import('../utils/preloadRegistry').then(module => {
          module.preloadComponentByName('UserList');
        });
        break;
      case '/structure-management':
        import('../utils/preloadRegistry').then(module => {
          module.preloadComponentByName('StructureManagementPage');
        });
        break;
      default:
        // 对于模块内容页面
        if (key.startsWith('/module-content/')) {
          import('../utils/preloadRegistry').then(module => {
            module.preloadComponentByName('ModuleContentPage');
          });
        }
        break;
    }
  };

  // 路由变化时自动展开到目标节点
  useEffect(() => {
    if (filteredMenuItems && filteredMenuItems.length > 0) {
      const pathKeys = findMenuPathKeys(filteredMenuItems, location.pathname);
      setOpenKeys(pathKeys);
    }
  }, [location.pathname, filteredMenuItems]);

  // 菜单手动展开/折叠
  const handleOpenChange = (keys: string[]) => {
    setOpenKeys(keys);
  };

  // 注释：菜单选中状态现在由 findMenuPathKeys 函数和路由变化自动处理

  // 如果工作区正在初始化，显示加载指示器
  if (initializing) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          width: '100%',
          background: colorBgContainer
        }}>
          <Spin tip="正在加载工作区..." size="large">
            <div style={{ minHeight: '100px', minWidth: '100px' }} />
          </Spin>
        </div>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 主菜单侧边栏 */}
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        theme="light"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          borderRight: '1px solid #f0f0f0',
          zIndex: 2,
          transition: isDragging ? 'none' : 'width 0.2s'
        }}
        width={collapsed ? 80 : siderWidth}
      >
        <div style={{ height: 32, margin: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 'bold' }}>
          <img 
            src="/logo.svg" 
            alt="Logo" 
            style={{ 
              height: '24px', 
              width: '24px', 
              marginRight: collapsed ? 0 : '8px',
              flexShrink: 0
            }} 
          />
          {!collapsed && <span>智源资料系统</span>}
        </div>
        <Menu
          theme="light"
          mode="inline"
          defaultSelectedKeys={['/']}
          defaultOpenKeys={['system']}
          selectedKeys={[location.pathname]}
          openKeys={openKeys}
          onOpenChange={handleOpenChange}
          items={filteredMenuItems}
          onClick={async (info) => {
            // 防止重复导航到当前路径，避免不必要的组件重新加载
            if (info.key === location.pathname) {
              return;
            }
            
            // 在导航前预加载目标组件
            try {
              const preloadRegistry = await import('../utils/preloadRegistry');
              // 根据路径预加载对应组件
              switch(info.key) {
                case '/roles':
                  preloadRegistry.preloadComponentByName('RoleList');
                  break;
                case '/users':
                  preloadRegistry.preloadComponentByName('UserList');
                  break;
                case '/structure-management':
                  preloadRegistry.preloadComponentByName('StructureManagementPage');
                  break;
                default:
                  // 对于模块内容页面
                  if (info.key.startsWith('/module-content/')) {
                    preloadRegistry.preloadComponentByName('ModuleContentPage');
                  }
                  break;
              }
            } catch (error) {
              console.error('预加载组件失败:', error);
            }
            
            // 执行导航
            navigate(info.key);
          }}
          onMouseEnter={(event) => {
            // 获取鼠标所在菜单项的key（路径）
            const targetMenuItem = event.target as HTMLElement;
            const menuItemKey = targetMenuItem.closest('li[data-menu-id]')?.getAttribute('data-menu-id');
            
            if (menuItemKey) {
              // 提取实际路径（去掉前缀）
              const pathKey = menuItemKey.replace(/^.+:/, '');
              handleMenuHover(pathKey);
            }
          }}
          style={{
            // 禁用可能的内部过渡效果
            transition: isDragging ? 'none' : undefined
          }}
        />
      </Sider>
      
      {/* 添加拖动手柄 */}
      {!collapsed && (
        <div
          ref={dragHandleRef}
          style={{
            position: 'fixed',
            top: 0,
            left: siderWidth,
            width: '5px',
            height: '100%',
            backgroundColor: 'transparent',
            cursor: 'col-resize',
            zIndex: 100,
            transition: isDragging ? 'none' : 'left 0.2s'
          }}
          onMouseDown={handleDragStart}
        >
          {/* 添加可视提示，在鼠标悬停时显示 */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: '#e6e6e6',
              opacity: isDragging ? 0.5 : 0,
              transition: 'opacity 0.2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.opacity = '0.5'; }}
            onMouseOut={(e) => { if (!isDragging) e.currentTarget.style.opacity = '0'; }}
          />
        </div>
      )}

      {/* 主内容区域 */}
      <Layout style={{ 
        marginLeft: collapsed ? 80 : siderWidth, 
        transition: isDragging ? 'none' : 'margin-left 0.2s'
      }}>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{
                  fontSize: '16px',
                  width: 64,
                  height: 64,
                }}
              />
              <WorkspaceSelector style={{ marginLeft: 16 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Dropdown 
                menu={{ 
                  items: userMenuItems,
                  onClick: ({ key }) => handleMenuClick(key),
                }} 
                placement="bottomRight"
              >
                <Button type="text" style={{ height: 64 }}>
                  <Avatar icon={<UserOutlined />} />
                  <span style={{ marginLeft: 8 }}>
                    {userState.currentUser?.username || '用户'}
                  </span>
                </Button>
              </Dropdown>
            </div>
          </div>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, overflow: 'auto', borderRadius: 8, background: colorBgContainer }}>
          <Breadcrumb 
            style={{ marginBottom: 16 }}
            items={generateBreadcrumb()}
          />
          <div className="main-content">
            <PageTransition />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

// 使用React.memo包装MainLayout组件，减少不必要的重渲染
export default React.memo(MainLayout); 