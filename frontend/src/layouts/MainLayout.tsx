import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Layout, Menu, theme, Button, Dropdown, Avatar, Breadcrumb } from 'antd';
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
  FileTextOutlined
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { ROUTES } from '../config/constants';
import { fetchModuleTree } from '../apis/moduleService';
import { ModuleStructureNode } from '../types/modules';
import { fetchUserPagePermissions } from '../apis/permissionService';

const { Header, Sider, Content } = Layout;

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
    key: 'system',
    icon: <AppstoreOutlined />,
    label: '系统管理',
    children: [
      {
        key: '/users',
        icon: <UserOutlined />,
        label: '用户管理',
        page_path: '/users',
      },
      {
        key: '/roles',
        icon: <TeamOutlined />,
        label: '角色管理',
        page_path: '/roles',
      },
    ],
  },
  {
    key: '/structure-management',
    icon: <AppstoreOutlined />,
    label: '结构管理',
    page_path: '/structure-management',
  },
];

// 创建一个全局事件总线，用于在不同组件间通信
export const refreshModuleTreeEvent = new CustomEvent('refreshModuleTree');

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [userModules, setUserModules] = useState<ModuleStructureNode[]>([]);
  const { userState, logout } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [filteredMenuItems, setFilteredMenuItems] = useState<ItemType[]>([]);
  
  const {
    token: { colorBgContainer },
  } = theme.useToken();

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

  // 刷新用户模块树
  const refreshModuleTree = useCallback(async () => {
    try {
      const data = await fetchModuleTree();
      const modules = Array.isArray(data) ? data : data.items || [];
      setUserModules(modules);
      console.log('模块树已刷新');
    } catch (error) {
      console.error('刷新模块树失败:', error);
    }
  }, []);

  // 监听全局刷新事件
  useEffect(() => {
    const handleRefreshEvent = () => {
      refreshModuleTree();
    };
    
    // 添加刷新事件监听器
    window.addEventListener('refreshModuleTree', handleRefreshEvent);
    
    // 清理监听器
    return () => {
      window.removeEventListener('refreshModuleTree', handleRefreshEvent);
    };
  }, [refreshModuleTree]);

  // 获取用户模块
  useEffect(() => {
    refreshModuleTree();
  }, [refreshModuleTree]);

  // 获取用户权限
  useEffect(() => {
    const fetchUserPermissions = async () => {
      try {
        // 获取用户可访问的页面路径
        const pagePaths = await fetchUserPagePermissions();
        setUserPermissions(pagePaths);
      } catch (error) {
        console.error('获取用户权限失败:', error);
      }
    };

    if (userState.isLoggedIn) {
      fetchUserPermissions();
    }
  }, [userState.isLoggedIn]);

  // 递归过滤菜单项函数 - 移到useEffect外部以避免每次渲染都创建新函数
  const filterMenuItems = (items: MenuItemOrDivider[], permissions: string[]): MenuItemOrDivider[] => {
    return items
      .map(item => {
        // 如果是分隔线，直接保留
        if ('type' in item && item.type === 'divider') {
          return item;
        }
        
        // 如果有子菜单，递归过滤子菜单
        if ('children' in item && item.children && item.children.length > 0) {
          const filteredChildren = filterMenuItems(item.children, permissions);
          // 如果过滤后的子菜单为空，且当前项没有page_path（即仅作为目录），则不显示此项
          if (filteredChildren.length === 0 && !item.page_path) {
            return null;
          }
          return { ...item, children: filteredChildren };
        }
        
        // 叶子节点，检查是否有权限访问
        if ('page_path' in item && item.page_path) {
          return permissions.some(path => 
            path === item.page_path || 
            (item.page_path && item.page_path.startsWith(path + '/'))
          ) ? item : null;
        }
        
        return item;
      })
      .filter(Boolean) as MenuItemOrDivider[];
  };

  // 过滤菜单项，只显示有权限的
  useEffect(() => {
    // 避免在依赖项变化前执行逻辑
    if (!userModules.length && !userPermissions.length && !userState.currentUser) {
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
      setFilteredMenuItems([...staticMenuItems, ...dividerItem, ...userModuleMenuItems]);
      return;
    }

    // 应用过滤
    const allMenuItems = [...staticMenuItems, ...dividerItem, ...userModuleMenuItems];
    const filtered = filterMenuItems(allMenuItems, userPermissions);
    setFilteredMenuItems(filtered);
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
    }
  }, []);

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

  // 根据路径生成面包屑
  const generateBreadcrumb = useCallback(() => {
    const pathSnippets = location.pathname.split('/').filter(i => i);
    const breadcrumbItems = [
      {
        title: <Link to="/">首页</Link>,
      },
    ];

    // 根据路径生成面包屑项
    let breadcrumbName = '';
    
    if (pathSnippets.includes('users')) {
      breadcrumbName = '用户管理';
    } else if (pathSnippets.includes('roles')) {
      breadcrumbName = '角色管理';
    } else if (pathSnippets.includes('structure-management')) {
      breadcrumbName = '结构管理';
    } else if (pathSnippets.includes('module-content')) {
      // 为模块内容页面查找对应的模块名称
      const moduleId = parseInt(pathSnippets[pathSnippets.length - 1]);
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
      
      breadcrumbName = findModuleName(userModules) || '模块内容';
    }

    if (breadcrumbName) {
      breadcrumbItems.push({
        title: <span>{breadcrumbName}</span>,
      });
    }

    return breadcrumbItems;
  }, [location.pathname, userModules]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
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
        }}
      >
        <div style={{ height: 32, margin: 16, textAlign: 'center', fontSize: 18, fontWeight: 'bold' }}>
          {collapsed ? '档案' : '档案管理系统'}
        </div>
        <Menu
          theme="light"
          mode="inline"
          defaultSelectedKeys={['/']}
          defaultOpenKeys={['system']}
          selectedKeys={[location.pathname]}
          items={filteredMenuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
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
            <div>
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
        <Content style={{ margin: '24px 16px', padding: 24, minHeight: 280, borderRadius: 8, background: colorBgContainer }}>
          <Breadcrumb 
            style={{ marginBottom: 16 }}
            items={generateBreadcrumb()}
          />
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout; 