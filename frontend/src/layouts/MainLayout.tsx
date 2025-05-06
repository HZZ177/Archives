import React, { useState, useEffect } from 'react';
import { Layout, Menu, theme, Button, Dropdown, Avatar, Breadcrumb } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  FileOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  HomeOutlined,
  AppstoreOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { ROUTES } from '../config/constants';
import type { MenuProps } from 'antd';
import { fetchModuleTree } from '../apis/moduleService';
import { ModuleStructureNode } from '../types/modules';

const { Header, Sider, Content } = Layout;

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { userState, logout } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [userModules, setUserModules] = useState<ModuleStructureNode[]>([]);
  const [loading, setLoading] = useState(false);
  
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  // 获取用户自定义的模块结构树
  useEffect(() => {
    const loadModuleTree = async () => {
      try {
        setLoading(true);
        const response = await fetchModuleTree();
        setUserModules(response.items);
        setLoading(false);
      } catch (error) {
        console.error('加载模块结构树失败:', error);
        setLoading(false);
      }
    };

    loadModuleTree();
  }, []);

  // 将模块结构树转换为菜单项
  const convertModuleToMenuItem = (module: ModuleStructureNode): any => {
    const menuItem: any = {
      key: `/module-content/${module.id}`,
      icon: <FolderOutlined />,
      label: module.name,
    };

    if (module.children && module.children.length > 0) {
      menuItem.children = module.children.map(child => convertModuleToMenuItem(child));
    }

    return menuItem;
  };

  // 导航菜单项
  const staticMenuItems: MenuProps['items'] = [
    {
      key: ROUTES.HOME,
      icon: <HomeOutlined />,
      label: '首页',
    },
    {
      key: 'user',
      icon: <UserOutlined />,
      label: '用户管理',
      children: [
        {
          key: ROUTES.USER_LIST,
          label: '用户列表',
        },
        {
          key: ROUTES.ROLE_LIST,
          label: '角色管理',
        },
        {
          key: ROUTES.PERMISSION_LIST,
          label: '权限管理',
        },
      ],
    },
    {
      key: ROUTES.STRUCTURE_MANAGEMENT,
      icon: <AppstoreOutlined />,
      label: '结构管理',
    },
  ];

  // 合并静态菜单项和用户自定义模块菜单项
  const userModuleMenuItems = userModules.map(module => convertModuleToMenuItem(module));
  const menuItems: MenuProps['items'] = [...staticMenuItems, ...userModuleMenuItems];

  // 用户菜单
  const userMenuItems: MenuProps['items'] = [
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
  ];

  // 处理菜单点击
  const handleMenuClick = (key: string) => {
    if (key === 'logout') {
      handleLogout();
    }
  };

  // 处理登出
  const handleLogout = async () => {
    try {
      await logout();
      navigate(ROUTES.LOGIN);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // 根据路径生成面包屑
  const generateBreadcrumb = () => {
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
          if (module.children && module.children.length > 0) {
            const childResult = findModuleName(module.children);
            if (childResult) return childResult;
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
  };

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
        }}
      >
        <div className="logo" style={{ 
          height: '64px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          borderBottom: '1px solid #f0f0f0',
          padding: '16px'
        }}>
          {collapsed ? (
            <FileOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
          ) : (
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1890ff' }}>
              资料管理系统
            </div>
          )}
        </div>
        <Menu
          theme="light"
          mode="inline"
          defaultSelectedKeys={['/']}
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'all 0.2s' }}>
        <Header style={{ 
          padding: 0, 
          background: colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0, 21, 41, 0.08)'
        }}>
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
          <div style={{ marginRight: '24px' }}>
            <Dropdown menu={{ 
              items: userMenuItems, 
              onClick: ({ key }) => handleMenuClick(key as string) 
            }} placement="bottomRight">
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Avatar icon={<UserOutlined />} style={{ marginRight: '8px' }} />
                <span>{userState.currentUser?.username || '用户'}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ 
          margin: '16px', 
          padding: 24, 
          minHeight: 280, 
          background: colorBgContainer, 
        }}>
          <Breadcrumb style={{ marginBottom: '16px' }} items={generateBreadcrumb()} />
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout; 