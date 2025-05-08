import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Space, Card, Popconfirm, message, Tag, Modal, Form, Switch, Select } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { User } from '../../types/user';
import { ROUTES } from '../../config/constants';
import axios from 'axios';
import { API_BASE_URL } from '../../config/constants';
import { fetchUserRoles, fetchRoles, updateUserRoles } from '../../apis/roleService';
import { Role } from '../../types/role';
import { formatDate } from '../../utils/dateUtils';

const { Search } = Input;

const UserList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState<number>(0);
  const [current, setCurrent] = useState(1);
  const [page_size, setPageSize] = useState(10);
  const [searchKeyword, setSearchKeyword] = useState('');
  // 添加用户模态框控制状态
  const [addUserModalVisible, setAddUserModalVisible] = useState(false);
  const [addUserForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  // 编辑用户模态框控制状态
  const [editUserModalVisible, setEditUserModalVisible] = useState(false);
  const [editUserForm] = Form.useForm();
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  // 用户角色缓存
  const [userRolesMap, setUserRolesMap] = useState<Record<number, Role[]>>({});
  // 角色列表状态
  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  // 是否为超级管理员的状态
  const [isSuperUser, setIsSuperUser] = useState(false);
  
  const navigate = useNavigate();

  // 获取所有角色列表
  const fetchAllRoles = async () => {
    try {
      setLoadingRoles(true);
      const data = await fetchRoles();
      setRoles(data);
      setLoadingRoles(false);
    } catch (error) {
      console.error('获取角色列表失败:', error);
      message.error('获取角色列表失败');
      setLoadingRoles(false);
    }
  };

  // 获取用户列表
  const fetchUsers = async (page = current, size = page_size, keyword = searchKeyword) => {
    try {
      setLoading(true);
      // 构建查询参数
      const params = {
        page,
        page_size: size,
        ...(keyword ? { keyword } : {}),
      };
      
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };
      
      const response = await axios.get(`${API_BASE_URL}/users`, { 
        params,
        headers
      });
      
      // 检查响应格式，适配直接返回数组的情况
      let processedUsers: User[] = [];
      
      if (Array.isArray(response.data)) {
        // API直接返回了用户数组，没有包装在items字段中
        // 处理后端返回的用户数据，确保兼容性
        processedUsers = response.data.map((user: any) => ({
          ...user,
          // 如果有is_active但没有status，根据is_active添加status
          status: user.status !== undefined ? user.status : (user.is_active ? 1 : 0)
        }));
        setUsers(processedUsers);
        setTotal(response.data.length); // 将总数设置为数组长度
      } else {
        // 使用标准的分页响应格式
        // 处理用户数据确保兼容性
        processedUsers = response.data.items.map((user: any) => ({
          ...user,
          // 如果有is_active但没有status，根据is_active添加status
          status: user.status !== undefined ? user.status : (user.is_active ? 1 : 0)
        }));
        setUsers(processedUsers);
        setTotal(response.data.total);
      }
      
      // 获取用户角色信息
      fetchUserRolesInfo(processedUsers);
      
      setCurrent(page);
      setPageSize(size);
      setLoading(false);
    } catch (error) {
      message.error('获取用户列表失败');
      console.error('获取用户列表错误:', error);
      setLoading(false);
    }
  };
  
  // 获取用户角色信息
  const fetchUserRolesInfo = async (userList: User[]) => {
    const newUserRolesMap: Record<number, Role[]> = {};
    
    for (const user of userList) {
      try {
        const roles = await fetchUserRoles(user.id);
        newUserRolesMap[user.id] = roles;
      } catch (error) {
        console.error(`获取用户ID=${user.id}的角色失败:`, error);
        newUserRolesMap[user.id] = [];
      }
    }
    
    setUserRolesMap(newUserRolesMap);
  };

  // 显示添加用户模态框
  const showAddUserModal = () => {
    addUserForm.resetFields(); // 重置表单
    setIsSuperUser(false); // 重置超级管理员状态
    setAddUserModalVisible(true);
  };

  // 处理超级管理员切换
  const handleSuperUserChange = (checked: boolean) => {
    setIsSuperUser(checked);
    
    // 如果切换为管理员，清空角色选择
    if (checked) {
      addUserForm.setFieldValue('role_ids', []);
    }
  };

  // 处理编辑模式下的超级管理员切换
  const handleEditSuperUserChange = (checked: boolean) => {
    // 更新本地状态，用于控制角色选择是否禁用
    setIsSuperUser(checked);
    
    // 如果切换为超级管理员，清空角色选择
    if (checked) {
      editUserForm.setFieldValue('role_ids', []);
    }
  };

  // 关闭添加用户模态框
  const handleAddUserCancel = () => {
    setAddUserModalVisible(false);
  };

  // 提交添加用户表单
  const handleAddUserSubmit = async () => {
    try {
      // 表单验证
      const values = await addUserForm.validateFields();
      setSubmitting(true);
      
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };
      
      // 直接提交所有数据，包括角色ID
      await axios.post(`${API_BASE_URL}/users`, values, { headers });
      
      message.success('用户创建成功');
      setAddUserModalVisible(false);
      fetchUsers(); // 刷新用户列表
      setSubmitting(false);
    } catch (error) {
      console.error('创建用户失败:', error);
      message.error('创建用户失败');
      setSubmitting(false);
    }
  };

  // 显示编辑用户模态框
  const showEditUserModal = async (userId: number) => {
    try {
      setEditingUserId(userId);
      
      // 获取用户数据
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };
      
      // 获取用户数据
      const response = await axios.get(`${API_BASE_URL}/users/${userId}`, { headers });
      const userData = response.data;
      
      // 更新超级管理员状态
      setIsSuperUser(userData.is_superuser);
      
      // 设置表单初始值
      editUserForm.setFieldsValue({
        username: userData.username,
        mobile: userData.mobile,
        email: userData.email,
        is_active: userData.is_active,
        is_superuser: userData.is_superuser
      });
      
      // 获取用户角色
      if (!userRolesMap[userId] || userRolesMap[userId].length === 0) {
        try {
          const roles = await fetchUserRoles(userId);
          const roleIds = roles.map((role: Role) => role.id);
          
          // 更新表单角色字段
          editUserForm.setFieldValue('role_ids', roleIds);
          
          // 更新本地缓存
          setUserRolesMap(prev => ({
            ...prev,
            [userId]: roles
          }));
        } catch (error: any) {
          console.error('获取用户角色失败:', error);
          // 提取详细错误信息
          let errorMessage = '获取用户角色失败';
          if (error.response && error.response.data) {
            if (typeof error.response.data === 'string') {
              errorMessage = error.response.data;
            } else if (error.response.data.detail) {
              errorMessage = error.response.data.detail;
            } else if (error.response.data.message) {
              errorMessage = error.response.data.message;
            }
          }
          message.error(errorMessage);
        }
      } else {
        // 使用缓存的角色数据
        const roleIds = userRolesMap[userId].map(role => role.id);
        editUserForm.setFieldValue('role_ids', roleIds);
      }
      
      setEditUserModalVisible(true);
    } catch (error: any) {
      console.error('加载用户数据失败:', error);
      // 提取详细错误信息
      let errorMessage = '加载用户数据失败';
      if (error.response && error.response.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      }
      message.error(errorMessage);
    }
  };
  
  // 处理编辑用户提交
  const handleEditUserSubmit = async () => {
    try {
      // 表单验证
      const values = await editUserForm.validateFields();
      setSubmitting(true);
      
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };
      
      // 提取角色ID
      const roleIds = values.role_ids || [];
      
      // 移除角色ID，只更新基本用户信息
      const userUpdateData = { ...values };
      delete userUpdateData.role_ids;
      
      try {
        // 1. 更新用户基本信息
        await axios.put(`${API_BASE_URL}/users/${editingUserId}`, userUpdateData, { headers });
        
        // 2. 更新用户角色
        if (!isSuperUser) {  // 如果是超级管理员，不需要更新角色
          try {
            await updateUserRoles(editingUserId!, roleIds);
          } catch (error: any) {
            // 处理角色更新失败的情况，但不中断流程
            console.error('更新用户角色失败:', error);
            // 如果有错误消息，显示给用户
            if (error.message) {
              message.warning(`用户信息已更新，但角色更新失败: ${error.message}`);
            } else {
              message.warning('用户信息已更新，但角色更新失败');
            }
            setEditUserModalVisible(false);
            setEditingUserId(null);
            fetchUsers(); // 刷新用户列表
            setSubmitting(false);
            return;
          }
        }
        
        message.success('用户信息更新成功');
        setEditUserModalVisible(false);
        setEditingUserId(null);
        fetchUsers(); // 刷新用户列表
      } catch (error: any) {
        console.error('更新用户失败:', error);
        if (error.response && error.response.data && error.response.data.detail) {
          message.error(`更新用户失败: ${error.response.data.detail}`);
        } else {
          message.error('更新用户失败');
        }
      }
      
      setSubmitting(false);
    } catch (error) {
      console.error('表单验证失败:', error);
      message.error('表单验证失败，请检查输入');
      setSubmitting(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchUsers();
    fetchAllRoles(); // 加载角色数据
  }, []);

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    fetchUsers(1, page_size, value);
  };

  // 处理分页变化
  const handleTableChange = (pagination: any) => {
    fetchUsers(pagination.current, pagination.pageSize, searchKeyword);
  };

  // 处理删除用户
  const handleDelete = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };
      
      await axios.delete(`${API_BASE_URL}/users/${id}`, { headers });
      message.success('删除用户成功');
      fetchUsers();
    } catch (error) {
      message.error('删除用户失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '手机号',
      dataIndex: 'mobile',
      key: 'mobile',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (_: any, record: User) => {
        // 优先使用is_active字段，如果不存在则使用status字段
        const isActive = record.is_active !== undefined ? record.is_active : record.status === 1;
        return isActive ? 
          <Tag color="green">启用</Tag> : 
          <Tag color="red">禁用</Tag>;
      },
    },
    {
      title: '角色',
      key: 'roles',
      render: (_: any, record: User) => {
        const roles = userRolesMap[record.id] || [];
        if (roles.length === 0) {
          return <span style={{ color: '#999' }}>无角色</span>;
        }
        return (
          <Space size={[0, 4]} wrap>
            {roles.map(role => (
              <Tag color="blue" key={role.id}>
                {role.name}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => formatDate(text)
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: User) => (
        <Space size="middle">
          <Button 
            type="link" 
            icon={<EditOutlined />} 
            onClick={() => {
              showEditUserModal(record.id);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除该用户吗?"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card bordered={false}>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Search
              placeholder="搜索用户名/邮箱/手机号"
              allowClear
              enterButton={<Button type="primary" icon={<SearchOutlined />}>搜索</Button>}
              size="middle"
              onSearch={handleSearch}
              style={{ width: 300 }}
            />
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={showAddUserModal}
            >
              添加用户
            </Button>
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          pagination={{
            current,
            pageSize: page_size,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total: number) => `共 ${total} 条记录`,
          }}
          onChange={handleTableChange}
          loading={loading}
        />
      </Card>

      {/* 添加用户模态框 */}
      <Modal
        title="添加用户"
        open={addUserModalVisible}
        onCancel={handleAddUserCancel}
        footer={[
          <Button key="back" onClick={handleAddUserCancel}>
            取消
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            loading={submitting} 
            onClick={handleAddUserSubmit}
          >
            提交
          </Button>,
        ]}
        maskClosable={false}
      >
        <Form
          form={addUserForm}
          layout="vertical"
          initialValues={{
            is_active: true,
            is_superuser: false
          }}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          
          <Form.Item
            name="mobile"
            label="手机号"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' }
            ]}
          >
            <Input placeholder="请输入手机号" />
          </Form.Item>
          
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { type: 'email', message: '邮箱格式不正确' }
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          
          <Form.Item
            name="is_active"
            label="是否启用"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          
          <Form.Item
            name="is_superuser"
            label="是否管理员"
            valuePropName="checked"
          >
            <Switch onChange={handleSuperUserChange} />
          </Form.Item>
          
          <Form.Item
            name="role_ids"
            label="角色"
            help={isSuperUser ? "当前用户已设置为管理员，无须选择角色" : "请选择用户角色"}
            rules={[
              {
                required: !isSuperUser,
                message: '请至少选择一个角色'
              }
            ]}
          >
            <Select
              mode="multiple"
              placeholder={isSuperUser ? "当前用户已设置为管理员，无须选择角色" : "请选择角色"}
              loading={loadingRoles}
              style={{ width: '100%' }}
              optionFilterProp="label"
              disabled={isSuperUser}
            >
              {roles.map(role => (
                <Select.Option key={role.id} value={role.id} label={role.name}>
                  {role.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑用户模态框 */}
      <Modal
        title="编辑用户"
        open={editUserModalVisible}
        onCancel={() => {
          setEditUserModalVisible(false);
          setEditingUserId(null);
        }}
        footer={[
          <Button key="back" onClick={() => {
            setEditUserModalVisible(false);
            setEditingUserId(null);
          }}>
            取消
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            loading={submitting}
            onClick={handleEditUserSubmit}
          >
            提交
          </Button>,
        ]}
        maskClosable={false}
      >
        <Form
          form={editUserForm}
          layout="vertical"
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          
          <Form.Item
            name="mobile"
            label="手机号"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' }
            ]}
          >
            <Input placeholder="请输入手机号" />
          </Form.Item>
          
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { type: 'email', message: '邮箱格式不正确' }
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          
          <Form.Item
            name="is_active"
            label="是否启用"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          
          <Form.Item
            name="is_superuser"
            label="是否管理员"
            valuePropName="checked"
          >
            <Switch onChange={handleEditSuperUserChange} />
          </Form.Item>
          
          <Form.Item
            name="role_ids"
            label="角色"
            help={isSuperUser ? "当前用户已设置为管理员，无须选择角色" : "请选择用户角色"}
            rules={[
              {
                required: !isSuperUser,
                message: '请至少选择一个角色'
              }
            ]}
          >
            <Select
              mode="multiple"
              placeholder={isSuperUser ? "当前用户已设置为管理员，无须选择角色" : "请选择角色"}
              loading={loadingRoles}
              style={{ width: '100%' }}
              optionFilterProp="label"
              disabled={isSuperUser}
            >
              {roles.map(role => (
                <Select.Option key={role.id} value={role.id} label={role.name}>
                  {role.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserList; 