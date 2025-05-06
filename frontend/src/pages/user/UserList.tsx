import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Space, Card, Popconfirm, message, Tag, Modal, Form, Switch } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { User } from '../../types/user';
import { ROUTES } from '../../config/constants';
import axios from 'axios';
import { API_BASE_URL } from '../../config/constants';

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
  
  const navigate = useNavigate();

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
      if (Array.isArray(response.data)) {
        // API直接返回了用户数组，没有包装在items字段中
        // 处理后端返回的用户数据，确保兼容性
        const processedUsers = response.data.map((user: any) => ({
          ...user,
          // 如果有is_active但没有status，根据is_active添加status
          status: user.status !== undefined ? user.status : (user.is_active ? 1 : 0)
        }));
        setUsers(processedUsers);
        setTotal(response.data.length); // 将总数设置为数组长度
      } else {
        // 使用标准的分页响应格式
        // 处理用户数据确保兼容性
        const processedUsers = response.data.items.map((user: any) => ({
          ...user,
          // 如果有is_active但没有status，根据is_active添加status
          status: user.status !== undefined ? user.status : (user.is_active ? 1 : 0)
        }));
        setUsers(processedUsers);
        setTotal(response.data.total);
      }
      
      setCurrent(page);
      setPageSize(size);
      setLoading(false);
    } catch (error) {
      message.error('获取用户列表失败');
      console.error('获取用户列表错误:', error);
      setLoading(false);
    }
  };

  // 显示添加用户模态框
  const showAddUserModal = () => {
    addUserForm.resetFields(); // 重置表单
    setAddUserModalVisible(true);
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
      
      // 调用创建用户API
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

  // 初始加载
  useEffect(() => {
    fetchUsers();
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
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: User) => (
        <Space size="middle">
          <Button 
            type="link" 
            icon={<EditOutlined />} 
            onClick={() => navigate(`/users/${record.id}`)}
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
            name="email"
            label="邮箱"
            rules={[
              { type: 'email', message: '邮箱格式不正确' }
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          
          <Form.Item
            name="full_name"
            label="姓名"
          >
            <Input placeholder="请输入姓名" />
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
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserList; 