import React, { useState } from 'react';
import { Spin, Dropdown, Button, Space, message } from 'antd';
import type { MenuProps } from 'antd';
import { DownOutlined, SettingOutlined } from '@ant-design/icons';
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
    setCurrentWorkspace,
    setAsDefaultWorkspace
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

  // 为当前选中的工作区添加"设为默认"选项（如果不是默认工作区）
  const currentId = currentWorkspace.id.toString();
  if (workspaces.find(w => w.id.toString() === currentId && !w.is_default)) {
    menuItems.push(
      { type: 'divider' as const },
      {
        key: `set_default:${currentId}`,
        label: (
          <Space>
            <span>设为默认工作区</span>
          </Space>
        ),
      }
    );
  }

  // 点击菜单项处理
  const onClick: MenuProps['onClick'] = ({ key }) => {
    // 如果点击的是管理按钮
    if (key === 'manage') {
      // 导航到工作区管理页面
      navigate(ROUTES.WORKSPACES_MANAGE);
      setOpen(false);
      return;
    }
    
    // 如果是设为默认工作区
    if (key.startsWith('set_default:')) {
      const workspaceId = key.split(':')[1];
      const workspace = workspaces.find(w => w.id.toString() === workspaceId);
      if (workspace) {
        setAsDefaultWorkspace(workspace);
      }
      setOpen(false);
      return;
    }
    
    // 选择工作区
    const workspace = workspaces.find(w => w.id.toString() === key);
    if (workspace) {
      setCurrentWorkspace(workspace);
    }
    setOpen(false);
  };

  // 工作区选择器触发器
  const dropdownTrigger = (
    <Button className="workspace-selector-button" onClick={() => setOpen(!open)}>
      <Space>
        <span style={{ 
          display: 'inline-block', 
          width: '12px', 
          height: '12px', 
          borderRadius: '6px', 
          backgroundColor: currentWorkspace.color || '#1890ff', 
          marginRight: '6px' 
        }} />
        <span className="workspace-name-text">{currentWorkspace.name}</span>
        <DownOutlined />
      </Space>
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