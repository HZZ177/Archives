import React, { useState, useEffect } from 'react';
import { Button, message, Tabs, Modal, Spin, Select, Tag, Empty, Space } from 'antd';
import { PlusOutlined, ExclamationCircleFilled } from '@ant-design/icons';
import WorkspaceTable from './components/WorkspaceTable';
import WorkspaceForm from './components/WorkspaceForm';
import { 
  fetchWorkspaces, 
  createWorkspace, 
  updateWorkspace, 
  deleteWorkspace, 
  fetchWorkspaceUsers,
  addUserToWorkspace,
  addUsersToWorkspaceBatch,
  removeUsersFromWorkspaceBatch
} from '../../apis/workspaceService';
import { 
  Workspace, 
  CreateWorkspaceParams, 
  UpdateWorkspaceParams,
  WorkspaceUser,
  WorkspaceUserParams,
  BatchAddUsersToWorkspaceRequest
} from '../../types/workspace';
import WorkspaceUserTable from './components/WorkspaceUserTable';
import AddUserToWorkspaceModal from './components/AddUserToWorkspaceModal';
import { useAuthContext } from '../../contexts/AuthContext';
import { useWorkspaceContext } from '../../contexts/WorkspaceContext';
import './WorkspaceManagePage.css';

// 用于处理API返回的原始工作区用户数据
interface ApiWorkspaceUser {
  id?: number; // This is user_id from backend's user_data, or workspace_user table id.
  user_id: number;
  workspace_id: number;
  username?: string;
  email?: string;
  is_superuser?: boolean; // Added based on backend service layer
  access_level?: string;
  role?: string;
  user?: { // Nested user object from some backend responses
    id: number;
    username: string;
    email?: string;
  };
}

const WorkspaceManagePage: React.FC = () => {
  const { currentUser } = useAuthContext();
  const { refreshWorkspaces: refreshWorkspacesContext } = useWorkspaceContext();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [createModalVisible, setCreateModalVisible] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [addUserModalVisible, setAddUserModalVisible] = useState<boolean>(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('workspaces');
  
  // 工作区用户相关状态
  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceUser[]>([]);
  const [workspaceUsersLoading, setWorkspaceUsersLoading] = useState<boolean>(false);
  const [selectedUserKeysForBatchRemove, setSelectedUserKeysForBatchRemove] = useState<React.Key[]>([]);
  const [batchActionLoading, setBatchActionLoading] = useState<boolean>(false);

  // 获取工作区列表
  const fetchWorkspacesList = async () => {
    try {
      setLoading(true);
      const data = await fetchWorkspaces(true); // 强制刷新缓存
      setWorkspaces(data);
      setLoading(false);
    } catch (error) {
      console.error('获取工作区列表失败:', error);
      message.error('获取工作区列表失败');
      setLoading(false);
    }
  };

  // 获取工作区用户列表
  const fetchWorkspaceUsersList = async (workspaceId: number) => {
    if (!workspaceId) return;
    
    try {
      setWorkspaceUsersLoading(true);
      setSelectedUserKeysForBatchRemove([]);
      const data = await fetchWorkspaceUsers(workspaceId);
      
      // 处理API返回的数据格式，转换为组件期望的格式
      const formattedData = data.map((item: ApiWorkspaceUser) => {
        // item from API (contains top-level username, email, is_superuser from get_workspace_users)
        
        // 角色映射：access_level到role的转换
        let role = item.role;
        if (!role && item.access_level) {
          const accessToRoleMapping: Record<string, string> = {
            'owner': 'owner',
            'admin': 'admin',
            'read': 'guest',
            'write': 'member',
          };
          role = accessToRoleMapping[item.access_level] || 'member';
        }
        
        return {
          id: item.user_id, // Use user_id for the main id in WorkspaceUserTable
          user_id: item.user_id,
          workspace_id: item.workspace_id,
          username: item.username || item.user?.username || `用户 ${item.user_id}`,
          email: item.email || item.user?.email,
          is_superuser: item.is_superuser || false, // Ensure it's always boolean
          role: role || 'member',
          // The nested 'user' object is no longer strictly necessary for WorkspaceUserTable if info is top-level
          // user: item.user || { id: item.user_id, username: item.username || `用户 ${item.user_id}`, email: item.email }
        } as WorkspaceUser;
      });
      
      setWorkspaceUsers(formattedData);
      setWorkspaceUsersLoading(false);
    } catch (error) {
      console.error(`获取工作区(ID:${workspaceId})用户列表失败:`, error);
      message.error('获取工作区用户列表失败');
      setWorkspaceUsersLoading(false);
    }
  };

  // 初始化时获取数据
  useEffect(() => {
    fetchWorkspacesList();
  }, []);

  // 当选择的工作区变化时，加载该工作区的用户
  useEffect(() => {
    if (selectedWorkspace && activeTab === 'users') {
      fetchWorkspaceUsersList(selectedWorkspace.id);
    } else if (!selectedWorkspace && activeTab === 'users') {
      setSelectedUserKeysForBatchRemove([]);
    }
  }, [selectedWorkspace, activeTab]);

  // 当工作区列表加载完成或标签页切换到users时，自动选择默认工作区
  useEffect(() => {
    if (activeTab === 'users' && workspaces.length > 0 && !selectedWorkspace) {
      // 优先选择默认工作区，如果没有默认工作区，则选择第一个
      const defaultWorkspace = workspaces.find(w => w.is_default);
      const workspaceToSelect = defaultWorkspace || workspaces[0];
      setSelectedWorkspace(workspaceToSelect);
      fetchWorkspaceUsersList(workspaceToSelect.id);
    } else if (activeTab !== 'users') {
      setSelectedUserKeysForBatchRemove([]);
    }
  }, [activeTab, workspaces, selectedWorkspace]);

  // 处理标签页切换
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    
    // 如果切换到用户管理标签页，且已选择了工作区，则加载用户列表
    if (key === 'users') {
      if (selectedWorkspace) {
      } else if (workspaces.length > 0) {
        // 优先选择默认工作区，如果没有默认工作区，则选择第一个
        const defaultWorkspace = workspaces.find(w => w.is_default);
        const workspaceToSelect = defaultWorkspace || workspaces[0];
        setSelectedWorkspace(workspaceToSelect);
        fetchWorkspaceUsersList(workspaceToSelect.id);
      }
    } else {
      setSelectedUserKeysForBatchRemove([]);
    }
  };

  // 创建工作区
  const handleCreate = async (values: CreateWorkspaceParams) => {
    try {
      setFormSubmitting(true);
      await createWorkspace(values);
      message.success('工作区创建成功');
      setCreateModalVisible(false);
      await fetchWorkspacesList();
      // 刷新WorkspaceContext中的数据
      await refreshWorkspacesContext();
    } catch (error) {
      console.error('创建工作区失败:', error);
      message.error('创建工作区失败');
    } finally {
      setFormSubmitting(false);
    }
  };

  // 编辑工作区
  const handleEdit = async (values: UpdateWorkspaceParams) => {
    if (!selectedWorkspace) return;
    
    try {
      setFormSubmitting(true);
      await updateWorkspace(selectedWorkspace.id, values);
      message.success('工作区更新成功');
      setEditModalVisible(false);
      await fetchWorkspacesList();
      // 刷新WorkspaceContext中的数据
      await refreshWorkspacesContext();
    } catch (error) {
      console.error('更新工作区失败:', error);
      message.error('更新工作区失败');
    } finally {
      setFormSubmitting(false);
    }
  };

  // 处理创建弹窗打开
  const handleOpenCreateModal = () => {
    setCreateModalVisible(true);
  };

  // 处理创建弹窗关闭
  const handleCloseCreateModal = () => {
    setCreateModalVisible(false);
  };

  // 处理编辑弹窗打开
  const handleOpenEditModal = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setEditModalVisible(true);
  };

  // 处理编辑弹窗关闭
  const handleCloseEditModal = () => {
    setEditModalVisible(false);
    // 延迟重置selectedWorkspace以避免UI闪烁
    setTimeout(() => {
      setSelectedWorkspace(null);
    }, 300);
  };

  // 处理用户弹窗关闭
  const handleCloseAddUserModal = () => {
    setAddUserModalVisible(false);
  };

  // 删除工作区
  const handleDelete = (workspace: Workspace) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此工作区吗？此操作不可撤销。',
      okText: '确认',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setLoading(true);
          await deleteWorkspace(workspace.id);
          message.success('工作区删除成功');
          await fetchWorkspacesList();
          // 刷新WorkspaceContext中的数据
          await refreshWorkspacesContext();
        } catch (error) {
          console.error('删除工作区失败:', error);
          message.error('删除工作区失败');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // 添加用户到工作区 - 现在改为批量处理
  const handleAddUsersToWorkspace = async (params: BatchAddUsersToWorkspaceRequest) => {
    if (!selectedWorkspace) {
      message.error('请先选择一个工作区');
      return;
    }
    
    try {
      setFormSubmitting(true);
      const response = await addUsersToWorkspaceBatch(selectedWorkspace.id, params);
      if (response.success) {
        message.success(response.message || '用户已成功批量添加到工作区');
      } else {
        message.error(response.message || '批量添加用户失败');
      }
      
      // 刷新用户列表
      await fetchWorkspaceUsersList(selectedWorkspace.id);
      
      // 关闭添加用户模态框
      setAddUserModalVisible(false);
    } catch (error: any) {
      console.error('批量添加用户到工作区失败:', error);
      message.error(error.message || '批量添加用户到工作区时发生错误');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleBatchRemoveUsers = async () => {
    if (!selectedWorkspace) {
      message.error('未选择工作区');
      return;
    }
    if (selectedUserKeysForBatchRemove.length === 0) {
      message.warning('请至少选择一个用户进行移除');
      return;
    }

    Modal.confirm({
      title: `确认批量移除 ${selectedUserKeysForBatchRemove.length} 名用户吗？`,
      icon: <ExclamationCircleFilled />,
      content: '此操作将从当前工作区移除所有选定的用户，且操作不可撤销。',
      okText: '确认移除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setBatchActionLoading(true);
          const response = await removeUsersFromWorkspaceBatch(
            selectedWorkspace.id, 
            selectedUserKeysForBatchRemove as number[]
          );
          message.success(response.message || '成功移除指定用户。');
          setSelectedUserKeysForBatchRemove([]);
          await fetchWorkspaceUsersList(selectedWorkspace.id); 
          await refreshWorkspacesContext();
        } catch (error: any) {
          console.error('批量移除用户失败:', error);
          const errorMessage = error.response?.data?.detail || error.message || '批量移除用户失败';
          message.error(errorMessage);
        } finally {
          setBatchActionLoading(false);
        }
      },
    });
  };

  // 渲染工作区管理标签页内容
  const renderWorkspacesTab = () => (
    <div>
      <div className="workspace-header">
        <h1>工作区管理</h1>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleOpenCreateModal}
        >
          创建工作区
        </Button>
      </div>
      
      <WorkspaceTable 
        workspaces={workspaces}
        onEdit={handleOpenEditModal}
        onDelete={handleDelete}
      />
    </div>
  );

  // 渲染用户管理标签页内容
  const renderUsersTab = () => {
    if (!selectedWorkspace) {
      return (
        <div className="workspace-user-header">
          <Empty description="请先选择一个工作区" />
        </div>
      );
    }

    return (
      <div className="workspace-user-container">
        <div className="workspace-user-header">
          <div className="workspace-user-title">
            <h3>{selectedWorkspace.name} - 用户管理</h3>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setAddUserModalVisible(true)}
              >
                批量添加用户
              </Button>
              <Button
                type="primary"
                danger
                onClick={handleBatchRemoveUsers}
                disabled={selectedUserKeysForBatchRemove.length === 0 || workspaceUsersLoading || batchActionLoading}
                loading={batchActionLoading}
              >
                批量移除选中用户 ({selectedUserKeysForBatchRemove.length})
              </Button>
            </Space>
          </div>
          <div className="workspace-user-filter">
            <Select
              value={selectedWorkspace.id}
              onChange={(value) => {
                const workspace = workspaces.find(w => w.id === value);
                if (workspace) {
                  setSelectedWorkspace(workspace);
                  fetchWorkspaceUsersList(workspace.id);
                }
              }}
              style={{ width: 200 }}
            >
              {workspaces.map(workspace => (
                <Select.Option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </Select.Option>
              ))}
            </Select>
          </div>
        </div>

        <WorkspaceUserTable
          workspaceId={selectedWorkspace.id}
          workspaceUsers={workspaceUsers}
          loading={workspaceUsersLoading || batchActionLoading}
          onRefresh={() => fetchWorkspaceUsersList(selectedWorkspace.id)}
          selectedRowKeys={selectedUserKeysForBatchRemove}
          onSelectionChange={(keys) => setSelectedUserKeysForBatchRemove(keys)}
        />

        <AddUserToWorkspaceModal
          visible={addUserModalVisible}
          workspaceId={selectedWorkspace.id}
          workspaceName={selectedWorkspace.name}
          existingUserIds={workspaceUsers.map(user => user.user_id)}
          onAdd={handleAddUsersToWorkspace}
          onCancel={() => setAddUserModalVisible(false)}
        />
      </div>
    );
  };

  return (
    <div className="workspace-manage-page">
      <Spin spinning={loading}>
        <Tabs 
          activeKey={activeTab} 
          onChange={handleTabChange}
          items={[
            {
              key: 'workspaces',
              label: '工作区管理',
              children: renderWorkspacesTab()
            },
            {
              key: 'users',
              label: '用户权限管理',
              children: renderUsersTab()
            }
          ]}
        />
      </Spin>
      
      {/* 创建工作区模态框 */}
      <Modal
        title="创建工作区"
        open={createModalVisible}
        onCancel={handleCloseCreateModal}
        footer={null}
        maskClosable={false}
      >
        <WorkspaceForm
          loading={formSubmitting}
          onFinish={(values) => {
            // 确保值符合CreateWorkspaceParams类型
            const createParams: CreateWorkspaceParams = {
              name: values.name || '',  // 确保name不是undefined
              description: values.description,
              color: values.color,
            };
            handleCreate(createParams);
          }}
          onCancel={handleCloseCreateModal}
        />
      </Modal>
      
      {/* 编辑工作区模态框 */}
      <Modal
        title="编辑工作区"
        open={editModalVisible}
        onCancel={handleCloseEditModal}
        footer={null}
        maskClosable={false}
      >
        <WorkspaceForm
          initialValues={selectedWorkspace}
          loading={formSubmitting}
          onFinish={handleEdit}
          onCancel={handleCloseEditModal}
        />
      </Modal>
    </div>
  );
};

export default WorkspaceManagePage; 