import React, { useState, useEffect } from 'react';
import { Button, message, Tabs, Modal, Spin, Select, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import WorkspaceTable from './components/WorkspaceTable';
import WorkspaceForm from './components/WorkspaceForm';
import { 
  fetchWorkspaces, 
  createWorkspace, 
  updateWorkspace, 
  deleteWorkspace, 
  fetchWorkspaceUsers,
  addUserToWorkspace
} from '../../apis/workspaceService';
import { 
  Workspace, 
  CreateWorkspaceParams, 
  UpdateWorkspaceParams,
  WorkspaceUser,
  WorkspaceUserParams
} from '../../types/workspace';
import WorkspaceUserTable from './components/WorkspaceUserTable';
import AddUserToWorkspaceModal from './components/AddUserToWorkspaceModal';
import { useAuthContext } from '../../contexts/AuthContext';
import { useWorkspaceContext } from '../../contexts/WorkspaceContext';
import './WorkspaceManagePage.css';

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
      const data = await fetchWorkspaceUsers(workspaceId);
      
      // 处理API返回的数据格式，转换为组件期望的格式
      const formattedData = data.map((item: ApiWorkspaceUser) => {
        // 检查返回数据的格式，根据实际情况调整
        const user = {
          id: item.user_id,
          username: item.username || `用户 ${item.user_id}`,
          email: item.email
        };
        
        // 角色映射：access_level到role的转换
        let role = item.role;
        if (!role && item.access_level) {
          // 如果没有role字段但有access_level字段，进行映射
          const accessToRoleMapping: Record<string, string> = {
            'owner': 'owner',  // 添加owner角色映射
            'read': 'guest',
            'write': 'member',
            'admin': 'admin'
          };
          role = accessToRoleMapping[item.access_level] || 'member';
        }
        
        // 记录日志用于调试
        console.log(`用户${item.user_id} 原始角色:`, {
          role: item.role,
          access_level: item.access_level,
          mapped_role: role
        });
        
        return {
          ...item,
          role: role || 'member',
          user: item.user || user
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
    }
  }, [selectedWorkspace, activeTab]);

  // 当工作区列表加载完成或标签页切换到users时，自动选择默认工作区
  useEffect(() => {
    if (activeTab === 'users' && workspaces.length > 0 && !selectedWorkspace) {
      // 优先选择默认工作区，如果没有默认工作区，则选择第一个
      const defaultWorkspace = workspaces.find(w => w.is_default);
      setSelectedWorkspace(defaultWorkspace || workspaces[0]);
    }
  }, [activeTab, workspaces, selectedWorkspace]);

  // 处理标签页切换
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    
    // 如果切换到用户管理标签页，且已选择了工作区，则加载用户列表
    if (key === 'users') {
      if (selectedWorkspace) {
      fetchWorkspaceUsersList(selectedWorkspace.id);
      } else if (workspaces.length > 0) {
        // 优先选择默认工作区，如果没有默认工作区，则选择第一个
        const defaultWorkspace = workspaces.find(w => w.is_default);
        const workspaceToSelect = defaultWorkspace || workspaces[0];
        setSelectedWorkspace(workspaceToSelect);
        fetchWorkspaceUsersList(workspaceToSelect.id);
      }
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

  // 添加用户到工作区
  const handleAddUserToWorkspace = async (params: WorkspaceUserParams) => {
    if (!selectedWorkspace) return;
    
    try {
      await addUserToWorkspace(selectedWorkspace.id, params);
      message.success('已成功添加用户到工作区');
      setAddUserModalVisible(false);
      
      // 刷新工作区用户列表
      fetchWorkspaceUsersList(selectedWorkspace.id);
      // 刷新WorkspaceContext中的数据
      await refreshWorkspacesContext();
    } catch (error) {
      console.error('添加用户到工作区失败:', error);
      message.error('添加用户到工作区失败');
      throw error; // 将错误向上传递，让调用方处理
    }
  };

  // 渲染工作区管理标签页内容
  const renderWorkspacesTab = () => (
    <div>
      <div className="workspace-header">
        <h1>工作区管理</h1>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => setCreateModalVisible(true)}
        >
          创建工作区
        </Button>
      </div>
      
      <WorkspaceTable 
        workspaces={workspaces}
        onEdit={(workspace) => {
          setSelectedWorkspace(workspace);
          setEditModalVisible(true);
        }}
        onDelete={handleDelete}
      />
    </div>
  );

  // 渲染用户管理标签页内容
  const renderUsersTab = () => {
    // 获取已在当前选择工作区中的用户ID列表
    const existingUserIds = workspaceUsers.map(user => user.user_id);
    
    return (
      <div>
        <div className="workspace-user-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2>用户权限管理</h2>
            <div style={{ width: 300 }}>
              <Select
                placeholder="请选择工作区"
                value={selectedWorkspace?.id}
                onChange={(value) => {
                  const workspace = workspaces.find(w => w.id === value);
                  if (workspace) {
                    setSelectedWorkspace(workspace);
                    fetchWorkspaceUsersList(workspace.id);
                  }
                }}
                style={{ width: '100%' }}
                options={workspaces.map(workspace => ({
                  value: workspace.id,
                  label: (
                    <span>
                      {workspace.color && (
                        <span 
                          style={{
                            display: 'inline-block',
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: workspace.color,
                            marginRight: 8,
                          }}
                        />
                      )}
                      {workspace.name}
                      {workspace.is_default && <Tag color="blue" style={{ marginLeft: 8 }}>默认</Tag>}
                    </span>
                  ),
                }))}
              />
            </div>
          </div>
        </div>
        
        {!selectedWorkspace ? (
          <div className="select-workspace-message">
            <h3>请选择一个工作区</h3>
            <p>请从上方下拉菜单中选择要管理的工作区</p>
          </div>
        ) : (
          <div>
            <WorkspaceUserTable 
              workspaceId={selectedWorkspace.id}
              workspaceUsers={workspaceUsers}
              loading={workspaceUsersLoading}
              onRefresh={() => fetchWorkspaceUsersList(selectedWorkspace.id)}
              onAddUser={() => setAddUserModalVisible(true)}
            />
            
            <AddUserToWorkspaceModal 
              visible={addUserModalVisible}
              workspaceId={selectedWorkspace.id}
              workspaceName={selectedWorkspace.name}
              existingUserIds={existingUserIds}
              onAdd={handleAddUserToWorkspace}
              onCancel={() => setAddUserModalVisible(false)}
            />
          </div>
        )}
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
        onCancel={() => setCreateModalVisible(false)}
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
          onCancel={() => setCreateModalVisible(false)}
        />
      </Modal>
      
      {/* 编辑工作区模态框 */}
      <Modal
        title="编辑工作区"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        maskClosable={false}
      >
        <WorkspaceForm
          initialValues={selectedWorkspace}
          loading={formSubmitting}
          onFinish={handleEdit}
          onCancel={() => setEditModalVisible(false)}
        />
      </Modal>
    </div>
  );
};

export default WorkspaceManagePage; 