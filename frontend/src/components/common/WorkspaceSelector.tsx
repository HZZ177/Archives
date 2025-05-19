import React, { useState } from 'react';
import { Spin, Dropdown, Button, Space, message } from 'antd';
import type { MenuProps } from 'antd';
import { DownOutlined, SettingOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useWorkspaceContext } from '../../contexts/WorkspaceContext';
import { useUser } from '../../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../config/constants';
import './WorkspaceSelector.css';

interface WorkspaceSelectorProps {
  showManage?: boolean;
  style?: React.CSSProperties;
}

const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({ showManage = true, style }) => {
  const { 
    currentWorkspace, 
    workspaces, 
    loading, 
    setCurrentWorkspace
  } = useWorkspaceContext();
  const { userState } = useUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (loading) {
    return <Spin size="small" />;
  }

  if (!currentWorkspace) {
    return null;
  }

  // 判断用户是否有管理工作区的权限
  const canManageWorkspaces = userState.currentUser?.is_superuser;

  // 构建菜单项
  const menuItems: MenuProps['items'] = [
    ...workspaces.map(workspace => ({
      key: workspace.id.toString(),
      label: (
        <Space>
          <span style={{ 
            display: 'inline-block', 
            width: '10px', 
            height: '10px', 
            borderRadius: '5px', 
            backgroundColor: workspace.color || '#1890ff' 
          }} />
          <span>{workspace.name}</span>
          {workspace.is_default && <span className="workspace-default-badge">默认</span>}
        </Space>
      ),
    })),
    ...(showManage && canManageWorkspaces ? [
      { type: 'divider' as const },
      {
        key: 'manage',
        label: (
          <Space>
            <SettingOutlined />
            <span>管理工作区</span>
          </Space>
        ),
      }
    ] : []),
  ];

  // 点击菜单项处理
  const onClick: MenuProps['onClick'] = ({ key }) => {
    // 如果点击的是管理按钮
    if (key === 'manage') {
      // 导航到工作区管理页面
      navigate(ROUTES.WORKSPACES_MANAGE);
      setOpen(false);
      return;
    }
    
    // 选择工作区
    const workspace = workspaces.find(w => w.id.toString() === key);
    if (workspace) {
      // 检查是否是不同的工作区
      const isWorkspaceChanged = currentWorkspace.id !== workspace.id;
      
      // 切换工作区
      setCurrentWorkspace(workspace);
      
      // 如果工作区已更改，导航到首页
      if (isWorkspaceChanged) {
        console.log(`工作区已切换，导航到首页`);
        // 使用timeout确保工作区状态更新后再导航
        setTimeout(() => {
          navigate(ROUTES.HOME);
        }, 100);
      }
    }
    setOpen(false);
  };

  // 工作区选择器触发器
  const dropdownTrigger = (
    <Button 
      className="workspace-selector-button" 
      onClick={(e) => {
        setOpen(!open);
        // 点击后自动失去焦点
        if (e.currentTarget) {
          setTimeout(() => {
            e.currentTarget.blur();
          }, 100);
        }
      }}
    >
      <AppstoreOutlined style={{ marginRight: '6px', verticalAlign: 'middle', fontSize: '16px' }} />
      <span className="workspace-title">工作区</span>
      <div className="workspace-content">
        <span style={{ 
          display: 'inline-block', 
          width: '12px', 
          height: '12px', 
          borderRadius: '6px', 
          backgroundColor: currentWorkspace.color || '#1890ff', 
          marginRight: '6px',
          verticalAlign: 'middle'
        }} />
        <span className="workspace-name-text">{currentWorkspace.name}</span>
        <DownOutlined style={{ marginLeft: 'auto', verticalAlign: 'middle' }} />
      </div>
    </Button>
  );

  return (
    <div style={style}>
      <Dropdown 
        menu={{ 
          items: menuItems,
          onClick,
          selectedKeys: [currentWorkspace.id.toString()]
        }}
        trigger={['click']} 
        placement="bottomLeft"
        onOpenChange={setOpen}
        open={open}
        className="workspace-selector-dropdown"
      >
        {dropdownTrigger}
      </Dropdown>
    </div>
  );
};

export default WorkspaceSelector; 