import React, { useState } from 'react';
import { Table, Button, Space, Tag, Modal, message, Tooltip } from 'antd';
import { EditOutlined, DeleteOutlined, QuestionCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { WorkspaceUser } from '../../../types/workspace';
import { updateWorkspaceUserRole, removeUserFromWorkspace } from '../../../apis/workspaceService';
import { roleConfig, getEffectiveRole, getRoleColor, getRoleLabel, getRoleDescription } from '../../../utils/roleMapping';
import { useWorkspaceContext } from '../../../contexts/WorkspaceContext';

interface WorkspaceUserTableProps {
  workspaceId: number;
  workspaceUsers: WorkspaceUser[];
  loading: boolean;
  onRefresh: () => void;
  onAddUser: () => void;
}

const WorkspaceUserTable: React.FC<WorkspaceUserTableProps> = ({
  workspaceId,
  workspaceUsers,
  loading,
  onRefresh,
  onAddUser,
}) => {
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<WorkspaceUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const { refreshWorkspaces } = useWorkspaceContext();

  // 从工作区中移除用户
  const handleRemoveUser = (user: WorkspaceUser) => {
    Modal.confirm({
      title: '确认移除用户',
      content: `确定要将用户 "${user.user?.username || '未知用户'}" 从该工作区移除吗？此操作不可撤销。`,
      okText: '确认移除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setActionLoading(true);
          await removeUserFromWorkspace(workspaceId, user.user_id);
          message.success('已成功移除用户');
          onRefresh();
          // 刷新WorkspaceContext中的数据
          await refreshWorkspaces();
        } catch (error) {
          console.error('移除用户失败:', error);
          message.error('移除用户失败');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // 打开编辑角色模态框
  const handleEditRole = (user: WorkspaceUser) => {
    setSelectedUser(user);
    // 获取有效角色，确保前端显示一致
    setSelectedRole(getEffectiveRole(user));
    setEditModalVisible(true);
  };

  // 更新用户角色
  const handleUpdateRole = async () => {
    if (!selectedUser) return;
    
    try {
      setActionLoading(true);
      await updateWorkspaceUserRole(workspaceId, selectedUser.user_id, selectedRole);
      message.success('已成功更新用户角色');
      setEditModalVisible(false);
      onRefresh();
      // 刷新WorkspaceContext中的数据
      await refreshWorkspaces();
    } catch (error) {
      console.error('更新用户角色失败:', error);
      message.error('更新用户角色失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 表格列配置
  const columns = [
    {
      title: '用户名',
      dataIndex: ['user', 'username'],
      key: 'username',
      render: (text: string, record: WorkspaceUser) => text || `用户 ${record.user_id}`,
    },
    {
      title: '邮箱',
      dataIndex: ['user', 'email'],
      key: 'email',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (_: string, record: WorkspaceUser) => {
        // 获取有效角色，确保前端显示一致
        const effectiveRole = getEffectiveRole(record);
        return (
          <Tooltip title={getRoleDescription(effectiveRole)}>
            <Tag color={getRoleColor(effectiveRole)}>
              {getRoleLabel(effectiveRole)} <QuestionCircleOutlined style={{ fontSize: '12px' }} />
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: WorkspaceUser) => (
        <Space size="small">
          <Button
            icon={<EditOutlined />}
            type="link"
            onClick={() => handleEditRole(record)}
          >
            修改角色
          </Button>
          <Button
            icon={<DeleteOutlined />}
            type="link"
            danger
            onClick={() => handleRemoveUser(record)}
          >
            移除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3>工作区用户</h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={onAddUser}>
          添加用户
        </Button>
      </div>
      
      <Table
        dataSource={workspaceUsers}
        columns={columns}
        rowKey={(record) => `${record.workspace_id}_${record.user_id}`}
        loading={loading}
        pagination={false}
        size="middle"
        locale={{ emptyText: '该工作区暂无用户' }}
      />

      {/* 编辑角色模态框 */}
      <Modal
        title="编辑用户角色"
        open={editModalVisible}
        onOk={handleUpdateRole}
        onCancel={() => setEditModalVisible(false)}
        confirmLoading={actionLoading}
        okText="保存"
        cancelText="取消"
      >
        <div>
          <h4>用户: {selectedUser?.user?.username || `用户 ${selectedUser?.user_id}`}</h4>
          <p>选择角色:</p>
          <Space direction="vertical" style={{ width: '100%' }}>
            {roleConfig.map(role => (
              <div 
                key={role.value}
                onClick={() => setSelectedRole(role.value)}
                style={{ 
                  padding: '8px 12px',
                  border: `1px solid ${role.value === selectedRole ? role.color : '#d9d9d9'}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: role.value === selectedRole ? `${role.color}10` : 'transparent'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Tag color={role.color}>{role.label}</Tag>
                  <span style={{ marginLeft: 8 }}>{role.description}</span>
                </div>
              </div>
            ))}
          </Space>
        </div>
      </Modal>
    </div>
  );
};

export default WorkspaceUserTable; 