import React, { useState } from 'react';
import { Table, Button, Space, Tag, Modal, message, Tooltip, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, QuestionCircleOutlined, ExclamationCircleFilled } from '@ant-design/icons';
import { WorkspaceUser } from '../../../types/workspace';
import { updateWorkspaceUserRole, removeUserFromWorkspace, removeUsersFromWorkspaceBatch } from '../../../apis/workspaceService';
import { roleConfig, getEffectiveRole, getRoleColor, getRoleLabel, getRoleDescription } from '../../../utils/roleMapping';
import { useWorkspaceContext } from '../../../contexts/WorkspaceContext';

const { Text } = Typography;

interface WorkspaceUserTableProps {
  workspaceId: number;
  workspaceUsers: WorkspaceUser[];
  loading: boolean;
  onRefresh: () => void;
  selectedRowKeys: React.Key[];
  onSelectionChange: (selectedKeys: React.Key[]) => void;
}

const WorkspaceUserTable: React.FC<WorkspaceUserTableProps> = ({
  workspaceId,
  workspaceUsers,
  loading,
  onRefresh,
  selectedRowKeys,
  onSelectionChange,
}) => {
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<WorkspaceUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const { refreshWorkspaces } = useWorkspaceContext();

  const handleRemoveUser = (user: WorkspaceUser) => {
    Modal.confirm({
      title: '确认移除用户',
      icon: <ExclamationCircleFilled />,
      content: `确定要将用户 "${user.username || '未知用户'}" 从该工作区移除吗？此操作不可撤销。`,
      okText: '确认移除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setActionLoading(true);
          await removeUserFromWorkspace(workspaceId, user.user_id);
          message.success('已成功移除用户');
          onRefresh();
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

  const handleEditRole = (user: WorkspaceUser) => {
    setSelectedUser(user);
    setSelectedRole(getEffectiveRole(user));
    setEditModalVisible(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedUser) return;
    try {
      setActionLoading(true);
      await updateWorkspaceUserRole(workspaceId, selectedUser.user_id, selectedRole);
      message.success('已成功更新用户角色');
      setEditModalVisible(false);
      onRefresh();
      await refreshWorkspaces();
    } catch (error) {
      console.error('更新用户角色失败:', error);
      message.error('更新用户角色失败');
    } finally {
      setActionLoading(false);
    }
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectionChange,
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text: string, record: WorkspaceUser) => text || `用户 ${record.user_id}`,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (_: string, record: WorkspaceUser) => {
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
            disabled={actionLoading}
          >
            修改角色
          </Button>
          <Button
            icon={<DeleteOutlined />}
            type="link"
            danger
            onClick={() => handleRemoveUser(record)}
            disabled={actionLoading || record.is_superuser}
            title={record.is_superuser ? "超级管理员不能被移除" : ""}
          >
            移除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Table
        rowSelection={rowSelection}
        dataSource={workspaceUsers}
        columns={columns}
        rowKey={(record) => record.user_id}
        loading={loading || actionLoading}
        pagination={false}
        size="middle"
        locale={{ emptyText: '该工作区暂无用户' }}
      />

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
          <h4>用户: {selectedUser?.username || `用户 ${selectedUser?.user_id}`}</h4>
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