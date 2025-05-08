import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Space, Card, Popconfirm, message, Tag, Modal, Form, Switch, Tooltip } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons';
import { Role } from '../../types/role';
import { fetchRoles, createRole, updateRole, deleteRole } from '../../apis/roleService';
import RolePermissionForm from './components/RolePermissionForm';
import { DEFAULT_PAGE_SIZE } from '../../config/constants';
import { formatDate } from '../../utils/dateUtils';

const { Search } = Input;

const RoleList: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [searchKeyword, setSearchKeyword] = useState('');
  
  // 角色表单状态
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [roleModalTitle, setRoleModalTitle] = useState('添加角色');
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  
  // 权限分配模态框状态
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [currentRoleId, setCurrentRoleId] = useState<number | null>(null);

  // 获取角色列表
  const fetchRoleList = async (page = current, size = pageSize, keyword = searchKeyword) => {
    try {
      setLoading(true);
      const params = {
        page,
        page_size: size,
        ...(keyword ? { keyword } : {}),
      };
      
      const data = await fetchRoles(params);
      
      // 处理不同格式的响应
      if (Array.isArray(data)) {
        setRoles(data);
        setTotal(data.length);
      } else if (data.items) {
        setRoles(data.items);
        setTotal(data.total);
      } else {
        setRoles([]);
        setTotal(0);
      }
      
      setCurrent(page);
      setPageSize(size);
      setLoading(false);
    } catch (error) {
      message.error('获取角色列表失败');
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchRoleList();
  }, []);

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    fetchRoleList(1, pageSize, value);
  };

  // 处理分页变化
  const handleTableChange = (pagination: any) => {
    fetchRoleList(pagination.current, pagination.pageSize, searchKeyword);
  };

  // 打开添加角色模态框
  const showAddRoleModal = () => {
    setRoleModalTitle('添加角色');
    setEditingRole(null);
    roleForm.resetFields();
    setRoleModalVisible(true);
  };

  // 打开编辑角色模态框
  const showEditRoleModal = (role: Role) => {
    setRoleModalTitle('编辑角色');
    setEditingRole(role);
    roleForm.setFieldsValue({
      name: role.name,
      description: role.description,
      status: role.status,
    });
    setRoleModalVisible(true);
  };

  // 关闭角色模态框
  const handleRoleModalCancel = () => {
    setRoleModalVisible(false);
  };

  // 提交角色表单
  const handleRoleSubmit = async () => {
    try {
      const values = await roleForm.validateFields();
      setSubmitting(true);
      
      if (editingRole) {
        // 更新角色
        await updateRole(editingRole.id, values);
        message.success('角色更新成功');
      } else {
        // 创建角色
        await createRole(values);
        message.success('角色创建成功');
      }
      
      setRoleModalVisible(false);
      fetchRoleList();
      setSubmitting(false);
    } catch (error) {
      console.error('保存角色失败:', error);
      message.error('保存角色失败');
      setSubmitting(false);
    }
  };

  // 处理删除角色
  const handleDeleteRole = async (id: number) => {
    try {
      await deleteRole(id);
      message.success('删除角色成功');
      fetchRoleList();
    } catch (error) {
      message.error('删除角色失败');
    }
  };

  // 打开权限分配模态框
  const showPermissionModal = (roleId: number) => {
    setCurrentRoleId(roleId);
    setPermissionModalVisible(true);
  };

  // 关闭权限分配模态框
  const handlePermissionModalCancel = () => {
    setPermissionModalVisible(false);
  };

  // 权限分配完成回调
  const handlePermissionAssigned = () => {
    setPermissionModalVisible(false);
    fetchRoleList(); // 刷新角色列表
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
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: boolean) => (
        status ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>
      ),
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
      render: (_: any, record: Role) => (
        <Space size="middle">
          <Tooltip title="编辑角色">
            <Button 
              type="link" 
              icon={<EditOutlined />} 
              onClick={() => showEditRoleModal(record)}
            />
          </Tooltip>
          <Tooltip title="分配权限">
            <Button 
              type="link" 
              icon={<KeyOutlined />} 
              onClick={() => showPermissionModal(record.id)}
            />
          </Tooltip>
          <Tooltip title="删除角色">
            <Popconfirm
              title="确定要删除该角色吗?"
              onConfirm={() => handleDeleteRole(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
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
              placeholder="搜索角色名称或描述"
              allowClear
              enterButton={<Button type="primary" icon={<SearchOutlined />}>搜索</Button>}
              size="middle"
              onSearch={handleSearch}
              style={{ width: 300 }}
            />
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={showAddRoleModal}
            >
              添加角色
            </Button>
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={roles}
          rowKey="id"
          pagination={{
            current,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total: number) => `共 ${total} 条记录`,
          }}
          onChange={handleTableChange}
          loading={loading}
        />
      </Card>

      {/* 角色表单模态框 */}
      <Modal
        title={roleModalTitle}
        open={roleModalVisible}
        onCancel={handleRoleModalCancel}
        footer={[
          <Button key="back" onClick={handleRoleModalCancel}>
            取消
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            loading={submitting} 
            onClick={handleRoleSubmit}
          >
            保存
          </Button>,
        ]}
        maskClosable={false}
      >
        <Form
          form={roleForm}
          layout="vertical"
          initialValues={{
            status: true
          }}
        >
          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="请输入角色名称" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="角色描述"
          >
            <Input.TextArea placeholder="请输入角色描述" />
          </Form.Item>
          
          <Form.Item
            name="status"
            label="状态"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 权限分配模态框 */}
      {permissionModalVisible && currentRoleId && (
        <RolePermissionForm
          roleId={currentRoleId}
          open={permissionModalVisible}
          onCancel={handlePermissionModalCancel}
          onSuccess={handlePermissionAssigned}
        />
      )}
    </div>
  );
};

export default RoleList; 