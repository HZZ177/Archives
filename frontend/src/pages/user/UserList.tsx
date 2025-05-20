import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Space, Card, Popconfirm, message, Tag, Modal, Form, Switch, Select, Tooltip } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { User } from '../../types/user';
import { ROUTES } from '../../config/constants';
import axios from 'axios';
import { API_BASE_URL } from '../../config/constants';
import { fetchUserRoles, fetchRoles, updateUserRoles } from '../../apis/roleService';
import { Role } from '../../types/role';
import { formatDate } from '../../utils/dateUtils';
import request, { unwrapResponse } from '../../utils/request';
import { APIResponse } from '../../types/api';
import { useUser } from '../../contexts/UserContext';

const { Search } = Input;

// 添加EllipsisTooltip组件
const EllipsisTooltip: React.FC<{ 
  children: React.ReactNode; 
  title: string;
  widthLimit?: number; 
}> = ({ children, title, widthLimit }) => {
  const [isEllipsis, setIsEllipsis] = useState(false);
  const textRef = React.useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const checkEllipsis = () => {
      const element = textRef.current;
      if (element) {
        // 如果元素实际宽度大于可见宽度，说明有截断
        setIsEllipsis(element.scrollWidth > element.clientWidth);
      }
    };

    checkEllipsis();
    window.addEventListener('resize', checkEllipsis);
    return () => window.removeEventListener('resize', checkEllipsis);
  }, [title]);

  // 应用样式使文本在必要时截断
  const style: React.CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'inline-block',
    width: widthLimit ? `${widthLimit}px` : '100%'
  };

  // 只在有截断时使用Tooltip
  if (isEllipsis) {
    return (
      <Tooltip placement="topLeft" title={title}>
        <span ref={textRef} style={style}>
          {children}
        </span>
      </Tooltip>
    );
  }

  // 没有截断时直接显示文本
  return (
    <span ref={textRef} style={style}>
      {children}
    </span>
  );
};

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
  // 获取当前用户信息
  const { userState } = useUser();
  const isAdmin = userState.currentUser?.username === 'admin';
  // 添加重置密码的loading状态
  const [resetPasswordLoading, setResetPasswordLoading] = useState<number | null>(null);

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
      
      // 使用统一 request 工具发起请求
      const response = await request.get<APIResponse<any>>(`/users`, { params });
      
      if (!response.data.success) {
        message.error(response.data.message || '获取用户列表失败');
        setLoading(false);
        return;
      }
      
      // 使用 unwrapResponse 处理统一响应格式
      const responseData = unwrapResponse<any>(response.data);
      
      if (!responseData || !responseData.items) {
        setUsers([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      
      // 处理用户数据
      const processedUsers = responseData.items.map((user: any) => ({
        ...user,
        status: user.status !== undefined ? user.status : (user.is_active ? 1 : 0)
      }));
      
      setUsers(processedUsers);
      setTotal(responseData.total);
      
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
      
      // 使用request工具发送请求
      const response = await request.post<APIResponse<any>>('/users', values);
      
      if (!response.data.success) {
        message.error(response.data.message || '创建用户失败');
        setSubmitting(false);
        return;
      }
      
      message.success(response.data.message || '用户创建成功');
      setAddUserModalVisible(false);
      fetchUsers(); // 刷新用户列表
      setSubmitting(false);
    } catch (error: any) {
      console.error('创建用户失败:', error);
      
      // 提取详细错误信息
      let errorMessage = '创建用户失败';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      message.error(errorMessage);
      setSubmitting(false);
    }
  };

  // 显示编辑用户模态框
  const showEditUserModal = async (userId: number) => {
    try {
      setEditingUserId(userId);
      
      // 获取用户数据
      const response = await request.get<APIResponse<any>>(`/users/${userId}`);
      
      if (!response.data.success) {
        message.error(response.data.message || '加载用户数据失败');
        return;
      }
      
      // 使用unwrapResponse处理统一响应格式
      const userData = unwrapResponse<any>(response.data);
      
      if (!userData) {
        message.error('用户数据获取失败');
        return;
      }
      
      // 更新超级管理员状态
      setIsSuperUser(userData.is_superuser);
      
      // 设置表单初始值
      editUserForm.setFieldsValue({
        username: userData.username,
        mobile: userData.mobile,
        email: userData.email,
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
          if (error.response?.data?.message) {
            errorMessage = error.response.data.message;
          } else if (error.response?.data?.detail) {
            errorMessage = error.response.data.detail;
          } else if (error.message) {
            errorMessage = error.message;
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
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
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
      
      // 提取角色ID
      const roleIds = values.role_ids || [];
      
      // 移除角色ID，只更新基本用户信息
      const userUpdateData = { ...values };
      delete userUpdateData.role_ids;
      
      try {
        // 1. 更新用户基本信息
        const response = await request.post<APIResponse<any>>(`/users/update/${editingUserId}`, userUpdateData);
        
        if (!response.data.success) {
          message.error(response.data.message || '更新用户信息失败');
          setSubmitting(false);
          return;
        }
        
        // 2. 更新用户角色
        if (!isSuperUser) {  // 如果是超级管理员，不需要更新角色
          try {
            await updateUserRoles(editingUserId!, roleIds);
          } catch (error: any) {
            // 处理角色更新失败的情况，但不中断流程
            console.error('更新用户角色失败:', error);
            // 如果有错误消息，显示给用户
            let errorMessage = '用户信息已更新，但角色更新失败';
            if (error.response?.data?.message) {
              errorMessage = `用户信息已更新，但角色更新失败: ${error.response.data.message}`;
            } else if (error.message) {
              errorMessage = `用户信息已更新，但角色更新失败: ${error.message}`;
            }
            message.warning(errorMessage);
            setEditUserModalVisible(false);
            setEditingUserId(null);
            fetchUsers(); // 刷新用户列表
            setSubmitting(false);
            return;
          }
        }
        
        message.success(response.data.message || '用户信息更新成功');
        setEditUserModalVisible(false);
        setEditingUserId(null);
        fetchUsers(); // 刷新用户列表
      } catch (error: any) {
        console.error('更新用户失败:', error);
        let errorMessage = '更新用户失败';
        if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.response?.data?.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.message) {
          errorMessage = error.message;
        }
        message.error(errorMessage);
      }
      
      setSubmitting(false);
    } catch (error) {
      console.error('表单验证失败:', error);
      setSubmitting(false);
    }
  };

  // 更新用户状态
  const handleUserStatusChange = async (userId: number, checked: boolean) => {
    try {
      // 使用is_active字段替代status字段，匹配后端API期望的格式
      const response = await request.post<APIResponse<any>>(`/users/update_status/${userId}`, { 
        is_active: checked  // 将status改为is_active
      });
      
      if (!response.data.success) {
        message.error(response.data.message || '更新用户状态失败');
        // 状态切换失败，回滚UI
        fetchUsers();
        return;
      }
      
      message.success('用户状态更新成功');
      
      // 更新本地状态，避免重新获取整个列表
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId ? { ...user, is_active: checked, status: checked ? 1 : 0 } : user
        )
      );
    } catch (error: any) {
      console.error('更新用户状态失败:', error);
      // 提取详细错误信息
      let errorMessage = '更新用户状态失败';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      message.error(errorMessage);
      
      // 状态切换失败，回滚UI
      fetchUsers();
    }
  };

  // 添加处理重置密码的函数
  const handleResetPassword = async (userId: number) => {
    try {
      setResetPasswordLoading(userId);
      
      // 发送重置密码请求
      const response = await request.post<APIResponse<any>>(`/users/${userId}/reset_password`);
      
      if (!response.data.success) {
        message.error(response.data.message || '重置密码失败');
        setResetPasswordLoading(null);
        return;
      }
      
      message.success(response.data.message || '密码已重置');
      setResetPasswordLoading(null);
    } catch (error: any) {
      console.error('重置密码失败:', error);
      
      // 提取详细错误信息
      let errorMessage = '重置密码失败';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      message.error(errorMessage);
      setResetPasswordLoading(null);
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
    setCurrent(1); // 重置为第一页
    fetchUsers(1, page_size, value);
  };

  // 处理表格分页、排序、筛选变化
  const handleTableChange = (pagination: any) => {
    setCurrent(pagination.current);
    setPageSize(pagination.pageSize);
    fetchUsers(pagination.current, pagination.pageSize, searchKeyword);
  };

  // 删除用户
  const handleDelete = async (id: number) => {
    try {
      const response = await request.post<APIResponse<any>>(`/users/delete/${id}`);
      
      if (!response.data.success) {
        message.error(response.data.message || '删除用户失败');
        return;
      }
      
      message.success(response.data.message || '用户已删除');
      fetchUsers();
    } catch (error: any) {
      console.error('删除用户失败:', error);
      let errorMessage = '删除用户失败';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      message.error(errorMessage);
    }
  };

  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 70,
      align: 'center' as 'center',
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (username: string) => (
        <EllipsisTooltip title={username} widthLimit={110}>
          {username}
        </EllipsisTooltip>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 160,
      render: (email: string) => (
        <EllipsisTooltip title={email || '-'} widthLimit={150}>
          {email || '-'}
        </EllipsisTooltip>
      ),
    },
    {
      title: '手机号',
      dataIndex: 'mobile',
      key: 'mobile',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      align: 'center' as 'center',
      render: (_: any, record: User) => {
        // 优先使用is_active字段
        const isActive = record.is_active !== undefined ? record.is_active : record.status === 1;
        
        return (
          <Switch
            checked={isActive}
            onChange={(checked) => handleUserStatusChange(record.id, checked)}
            checkedChildren="启用"
            unCheckedChildren="禁用"
          />
        );
      },
    },
    {
      title: '角色',
      key: 'roles',
      width: 160,
      render: (_: any, record: User) => {
        const roles = userRolesMap[record.id] || [];
        if (roles.length === 0) {
          return <span style={{ color: '#999' }}>无角色</span>;
        }
        
        // 生成角色名称字符串用于Tooltip
        const roleNames = roles.map(role => role.name).join(', ');
        
        return (
          <EllipsisTooltip title={roleNames} widthLimit={160}>
            <Space size={[4, 0]} direction="horizontal" style={{ display: 'inline-flex' }}>
              {roles.map(role => (
                <Tag color="blue" key={role.id}>
                  {role.name}
                </Tag>
              ))}
            </Space>
          </EllipsisTooltip>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (text: string) => formatDate(text)
    },
    {
      title: '操作',
      key: 'action',
      width: 300,
      fixed: 'right' as 'right',
      align: 'center' as 'center',
      render: (_: any, record: User) => (
        <Space size="small" style={{ display: 'flex', justifyContent: 'center' }}>
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
          
          {/* 初始化密码按钮 - 仅当当前用户是超级管理员且目标用户不是admin时显示 */}
          {userState.currentUser?.is_superuser && record.username !== 'admin' && (
            <Popconfirm
              title="确定要将该用户密码重置为手机号吗?"
              description={`用户 ${record.username} 的密码将被重置为手机号`}
              onConfirm={() => handleResetPassword(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button 
                type="link" 
                icon={<KeyOutlined />} 
                loading={resetPasswordLoading === record.id}
              >
                初始化密码
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // 添加表头居中的样式
  const centerHeaderStyle = `
    .center-header .ant-table-thead th {
      text-align: center !important;
    }
  `;

  return (
    <div>
      {/* 添加内联样式 */}
      <style>{centerHeaderStyle}</style>
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
          className="center-header"
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
          bordered={true}
          size="middle"
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
            name="mobile"
            label="手机号"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' }
            ]}
            help="手机号将被设置为初始密码，用户首次登录时将被要求修改密码"
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
          
          {isAdmin && (
            <Form.Item
              name="is_superuser"
              label="是否超级管理员"
              valuePropName="checked"
            >
              <Switch onChange={handleSuperUserChange} />
            </Form.Item>
          )}
          
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
          
          {isAdmin && (
            <Form.Item
              name="is_superuser"
              label="是否超级管理员"
              valuePropName="checked"
            >
              <Switch onChange={handleEditSuperUserChange} />
            </Form.Item>
          )}
          
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