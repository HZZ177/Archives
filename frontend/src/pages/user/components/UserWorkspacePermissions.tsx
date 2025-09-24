import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Space, message, Tooltip, Modal, Select, Spin } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { fetchWorkspaces, fetchWorkspaceUsers, addUserToWorkspace, updateWorkspaceUserRole, removeUserFromWorkspace } from '../../../apis/workspaceService';
import { Workspace, WorkspaceUser } from '../../../types/workspace';
import { roleOptions, roleToAccessLevel, accessLevelToRole, getRoleColor, getRoleLabel, getEffectiveRole } from '../../../utils/roleMapping';
import './UserWorkspacePermissions.css';

// 用于处理API返回的原始工作区用户数据
interface ApiWorkspaceUser {
  id?: number;
  user_id: number;
  workspace_id: number;
  username?: string;
  email?: string;
  access_level?: string;
  role?: string;
  user?: {
    id: number;
    username: string;
    email?: string;
  };
}

interface UserWorkspacePermissionsProps {
  userId: number;
  username: string;
}

const UserWorkspacePermissions: React.FC<UserWorkspacePermissionsProps> = ({ userId, username }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [userWorkspaces, setUserWorkspaces] = useState<WorkspaceUser[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('member');
  const [selectedUserWorkspace, setSelectedUserWorkspace] = useState<WorkspaceUser | null>(null);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<Workspace[]>([]);

  // 获取工作区列表和用户的工作区权限
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 获取所有工作区
      const allWorkspaces = await fetchWorkspaces();
      setWorkspaces(allWorkspaces);
      
      // 获取用户所在的工作区
      const userWorkspaceList: WorkspaceUser[] = [];
      
      // 并行获取每个工作区的用户
      const workspaceUsersPromises = allWorkspaces.map(async workspace => {
        try {
          const apiUsers = await fetchWorkspaceUsers(workspace.id);
          
          // 处理API返回的数据
          const users = apiUsers.map((item: ApiWorkspaceUser) => {
            // 创建用户对象
            const userObj = {
              id: item.user_id,
              username: item.username || `用户 ${item.user_id}`,
              email: item.email
            };
            
            return {
              ...item,
              // 如果后端返回access_level而非role，需要进行映射
              role: item.role || item.access_level || 'member',
              // 将用户信息放入user对象中
              user: item.user || userObj
            } as WorkspaceUser;
          });
          
          const userInWorkspace = users.find(u => u.user_id === userId);
          if (userInWorkspace) {
            userWorkspaceList.push({
              ...userInWorkspace,
              workspace_id: workspace.id
            });
          }
        } catch (error) {
          console.error(`获取工作区 ${workspace.id} 用户列表失败:`, error);
        }
      });
      
      await Promise.all(workspaceUsersPromises);
      setUserWorkspaces(userWorkspaceList);
      
      // 计算可添加的工作区（用户尚未加入的工作区）
      const userWorkspaceIds = userWorkspaceList.map(uw => uw.workspace_id);
      setAvailableWorkspaces(allWorkspaces.filter(w => !userWorkspaceIds.includes(w.id)));
      
      setLoading(false);
    } catch (error) {
      console.error('获取数据失败:', error);
      message.error('获取工作区权限数据失败');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId]);

  // 添加用户到工作区
  const handleAddUserToWorkspace = async () => {
    if (!selectedWorkspace) {
      message.warning('请选择工作区');
      return;
    }

    try {
      setLoading(true);
      await addUserToWorkspace(selectedWorkspace.id, {
        user_id: userId,
        access_level: roleToAccessLevel[selectedRole] || 'read'
      });
      message.success('已成功添加用户到工作区');
      closeAddModal();
      fetchData(); // 刷新数据
    } catch (error) {
      console.error('添加用户到工作区失败:', error);
      message.error('添加用户到工作区失败');
    } finally {
      setLoading(false);
    }
  };

  // 更新用户在工作区中的角色
  const handleUpdateUserRole = async () => {
    if (!selectedUserWorkspace) {
      message.warning('请选择要编辑的工作区权限');
      return;
    }

    try {
      setLoading(true);
      await updateWorkspaceUserRole(
        selectedUserWorkspace.workspace_id,
        userId,
        selectedRole
      );
      message.success('已成功更新用户在工作区中的角色');
      closeEditModal();
      fetchData(); // 刷新数据
    } catch (error) {
      console.error('更新用户角色失败:', error);
      message.error('更新用户角色失败');
    } finally {
      setLoading(false);
    }
  };

  // 从工作区移除用户
  const handleRemoveFromWorkspace = async (workspaceId: number) => {
    Modal.confirm({
      title: '确认移除',
      content: '确定要将用户从该工作区移除吗？此操作不可撤销。',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          setLoading(true);
          await removeUserFromWorkspace(workspaceId, userId);
          message.success('已成功将用户从工作区移除');
          fetchData(); // 刷新数据
        } catch (error) {
          console.error('从工作区移除用户失败:', error);
          message.error('从工作区移除用户失败');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // 获取角色标签
  const getRoleTag = (role: string) => {
    const effectiveRole = typeof role === 'string' ? 
      (['write', 'read'].includes(role) ? accessLevelToRole[role] : role) : 'guest';
    
    return (
      <Tag color={getRoleColor(effectiveRole)} className="workspace-role-tag">
        {getRoleLabel(effectiveRole)}
      </Tag>
    );
  };

  // 打开添加工作区权限弹窗
  const openAddModal = () => {
    setSelectedWorkspace(availableWorkspaces[0] || null);
    setSelectedRole('member');
    setAddModalVisible(true);
  };

  // 关闭添加工作区权限弹窗
  const closeAddModal = () => {
    setAddModalVisible(false);
    // 延迟重置状态以避免UI闪烁
    setTimeout(() => {
      setSelectedWorkspace(null);
      setSelectedRole('member');
    }, 300);
  };

  // 打开编辑角色模态框
  const openEditModal = (userWorkspace: WorkspaceUser) => {
    setSelectedUserWorkspace(userWorkspace);
    // 使用统一的角色转换函数获取有效角色
    setSelectedRole(getEffectiveRole(userWorkspace));
    setEditModalVisible(true);
  };
  
  // 关闭编辑工作区角色模态框
  const closeEditModal = () => {
    setEditModalVisible(false);
    // 延迟重置状态以避免UI闪烁
    setTimeout(() => {
      setSelectedUserWorkspace(null);
      setSelectedRole('member');
    }, 300);
  };

  // 表格列配置
  const columns = [
    {
      title: '工作区名称',
      dataIndex: 'workspace_id',
      key: 'workspace_id',
      render: (workspaceId: number) => {
        const workspace = workspaces.find(w => w.id === workspaceId);
        return (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {workspace?.color && (
              <div
                className="workspace-color-indicator"
                style={{
                  backgroundColor: workspace.color
                }}
              />
            )}
            <span>{workspace?.name || `工作区 ${workspaceId}`}</span>
            {workspace?.is_default && <Tag color="cyan" style={{ marginLeft: 8 }}>默认</Tag>}
          </div>
        );
      }
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        return getRoleTag(role);
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: WorkspaceUser) => (
        <Space size="small">
          <Tooltip title="编辑角色">
            <Button 
              icon={<EditOutlined />} 
              size="small" 
              onClick={() => openEditModal(record)}
            />
          </Tooltip>
          <Tooltip title="移除">
            <Button 
              icon={<DeleteOutlined />} 
              size="small" 
              danger
              onClick={() => handleRemoveFromWorkspace(record.workspace_id)}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  // 获取工作区名称
  const getWorkspaceName = (workspaceId: number) => {
    const workspace = workspaces.find(w => w.id === workspaceId);
    return workspace?.name || `工作区 ${workspaceId}`;
  };

  return (
    <Spin spinning={loading}>
      <Card
        title="工作区权限"
        variant="borderless"
        extra={
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={openAddModal}
            disabled={availableWorkspaces.length === 0}
          >
            添加工作区权限
          </Button>
        }
      >
        <Table 
          dataSource={userWorkspaces} 
          columns={columns} 
          rowKey={(record) => `${record.workspace_id}_${record.user_id}`}
          pagination={false}
          locale={{ emptyText: '该用户未分配任何工作区权限' }}
          size="middle"
        />
      </Card>

      {/* 添加工作区权限模态框 */}
      <Modal
        title="添加工作区权限"
        open={addModalVisible}
        onOk={handleAddUserToWorkspace}
        onCancel={closeAddModal}
        confirmLoading={loading}
        okText="确认"
        cancelText="取消"
        destroyOnClose={true}
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>工作区:</label>
          <Select
            style={{ width: '100%' }}
            value={selectedWorkspace?.id}
            onChange={(value) => {
              const workspace = workspaces.find(w => w.id === value);
              setSelectedWorkspace(workspace || null);
            }}
            placeholder="请选择工作区"
            options={availableWorkspaces.map(w => ({ value: w.id, label: w.name }))}
          />
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: 8 }}>角色:</label>
          <Select
            style={{ width: '100%' }}
            value={selectedRole}
            onChange={setSelectedRole}
            placeholder="请选择角色"
            options={roleOptions}
          />
        </div>
      </Modal>

      {/* 编辑工作区角色模态框 */}
      <Modal
        title={`编辑 ${username} 在 ${selectedUserWorkspace ? getWorkspaceName(selectedUserWorkspace.workspace_id) : ''} 中的角色`}
        open={editModalVisible}
        onOk={handleUpdateUserRole}
        onCancel={closeEditModal}
        confirmLoading={loading}
        okText="确认"
        cancelText="取消"
        destroyOnClose={true}
      >
        <div>
          <label style={{ display: 'block', marginBottom: 8 }}>角色:</label>
          <Select
            style={{ width: '100%' }}
            value={selectedRole}
            onChange={setSelectedRole}
            placeholder="请选择角色"
            options={roleOptions}
          />
        </div>
      </Modal>
    </Spin>
  );
};

export default UserWorkspacePermissions; 