import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Space, Card, Popconfirm, message, Tag, Modal, Form, Select, InputNumber, Switch, Tooltip, Tree } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, AppstoreOutlined, LinkOutlined } from '@ant-design/icons';
import { Permission, PermissionFormData } from '../../types/permission';
import { fetchPermissions, fetchPermissionTree, createPermission, updatePermission, deletePermission } from '../../apis/permissionService';
import { DEFAULT_PAGE_SIZE } from '../../config/constants';

const { Search } = Input;
const { Option } = Select;

// 分页响应接口
interface PaginatedResponse {
  items: Permission[];
  total: number;
}

// 权限类型选项
const permissionTypes = [
  { label: '目录', value: 'directory' },
  { label: '页面', value: 'page' },
];

const PermissionList: React.FC = () => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permissionTree, setPermissionTree] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [displayMode, setDisplayMode] = useState<'list' | 'tree'>('tree');
  const [refreshKey, setRefreshKey] = useState(0);
  
  // 权限表单状态
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [permissionModalTitle, setPermissionModalTitle] = useState('添加权限');
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [permissionForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // 获取权限列表
  const fetchPermissionList = async (page = current, size = pageSize, keyword = searchKeyword) => {
    try {
      setLoading(true);
      const params = {
        page,
        page_size: size,
        ...(keyword ? { keyword } : {}),
      };
      
      const data = await fetchPermissions(params);
      
      // 处理不同格式的响应
      if (Array.isArray(data)) {
        setPermissions(data);
        setTotal(data.length);
      } else if ((data as PaginatedResponse).items) {
        setPermissions((data as PaginatedResponse).items);
        setTotal((data as PaginatedResponse).total);
      } else {
        setPermissions([]);
        setTotal(0);
      }
      
      setCurrent(page);
      setPageSize(size);
      setLoading(false);
    } catch (error) {
      message.error('获取权限列表失败');
      setLoading(false);
    }
  };

  // 获取权限树
  const fetchPermissionTreeData = async () => {
    try {
      setLoading(true);
      const data = await fetchPermissionTree();
      setPermissionTree(data);
      setLoading(false);
    } catch (error) {
      message.error('获取权限树失败');
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    if (displayMode === 'list') {
      fetchPermissionList();
    } else {
      fetchPermissionTreeData();
    }
  }, [displayMode, refreshKey]);

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    fetchPermissionList(1, pageSize, value);
  };

  // 处理分页变化
  const handleTableChange = (pagination: any) => {
    fetchPermissionList(pagination.current, pagination.pageSize, searchKeyword);
  };

  // 打开添加权限模态框
  const showAddPermissionModal = () => {
    setPermissionModalTitle('添加页面权限');
    setEditingPermission(null);
    permissionForm.resetFields();
    permissionForm.setFieldsValue({
      parent_id: null,
      sort: 0,
      is_visible: true,
    });
    setPermissionModalVisible(true);
  };

  // 打开编辑权限模态框
  const showEditPermissionModal = (permission: Permission) => {
    setPermissionModalTitle('编辑页面权限');
    setEditingPermission(permission);
    permissionForm.setFieldsValue({
      code: permission.code,
      name: permission.name,
      page_path: permission.page_path,
      parent_id: permission.parent_id,
      icon: permission.icon,
      sort: permission.sort,
      is_visible: permission.is_visible,
      description: permission.description,
    });
    setPermissionModalVisible(true);
  };

  // 关闭权限模态框
  const handlePermissionModalCancel = () => {
    setPermissionModalVisible(false);
  };

  // 提交权限表单
  const handlePermissionSubmit = async () => {
    try {
      const values = await permissionForm.validateFields();
      setSubmitting(true);
      
      if (editingPermission) {
        // 更新权限
        await updatePermission(editingPermission.id, values);
        message.success('权限更新成功');
      } else {
        // 创建权限
        await createPermission(values);
        message.success('权限创建成功');
      }
      
      setPermissionModalVisible(false);
      setRefreshKey(prev => prev + 1); // 刷新数据
      setSubmitting(false);
    } catch (error) {
      console.error('保存权限失败:', error);
      message.error('保存权限失败');
      setSubmitting(false);
    }
  };

  // 处理删除权限
  const handleDeletePermission = async (id: number) => {
    try {
      await deletePermission(id);
      message.success('删除权限成功');
      setRefreshKey(prev => prev + 1); // 刷新数据
    } catch (error) {
      message.error('删除权限失败');
    }
  };

  // 切换显示模式
  const toggleDisplayMode = () => {
    setDisplayMode(prev => prev === 'list' ? 'tree' : 'list');
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
      title: '权限名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '权限代码',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: '页面路径',
      dataIndex: 'page_path',
      key: 'page_path',
    },
    {
      title: '排序',
      dataIndex: 'sort',
      key: 'sort',
      width: 80,
    },
    {
      title: '可见性',
      dataIndex: 'is_visible',
      key: 'is_visible',
      render: (isVisible: boolean) => (
        isVisible ? <Tag color="green">显示</Tag> : <Tag color="red">隐藏</Tag>
      ),
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Permission) => (
        <Space size="middle">
          <Button 
            type="link" 
            icon={<EditOutlined />} 
            onClick={() => showEditPermissionModal(record)}
          />
          <Popconfirm
            title="确定要删除该权限吗? 删除后相关角色将失去此权限。"
            onConfirm={() => handleDeletePermission(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 渲染权限树节点
  const renderTreeNodes = (data: Permission[]): { title: React.ReactNode; key: React.Key; children?: any[] }[] => {
    return data.map(item => ({
      title: (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Space>
            {!item.page_path && <AppstoreOutlined />}
            {item.page_path && <LinkOutlined />}
            <span>{item.name}</span>
            <Tag color="blue">{item.code}</Tag>
            {item.page_path && <Tag color="green">{item.page_path}</Tag>}
          </Space>
          <Space size="small">
            <Button 
              type="link" 
              size="small" 
              icon={<EditOutlined />} 
              onClick={(e) => { e.stopPropagation(); showEditPermissionModal(item); }}
            />
            <Popconfirm
              title="确定要删除该权限吗? 删除后相关角色将失去此权限。"
              onConfirm={(e) => { if (e) e.stopPropagation(); handleDeletePermission(item.id); }}
              okText="确定"
              cancelText="取消"
            >
              <Button 
                type="link" 
                size="small" 
                danger 
                icon={<DeleteOutlined />} 
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>
          </Space>
        </div>
      ),
      key: item.id,
      children: item.children ? renderTreeNodes(item.children) : [],
    }));
  };

  return (
    <div>
      <Card
        title="页面权限管理"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={showAddPermissionModal}
            >
              添加权限
            </Button>
            <Button
              onClick={toggleDisplayMode}
            >
              {displayMode === 'list' ? '树形视图' : '列表视图'}
            </Button>
          </Space>
        }
      >
        {displayMode === 'list' ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <Search
                placeholder="搜索权限"
                onSearch={handleSearch}
                enterButton={<SearchOutlined />}
                style={{ width: 300 }}
              />
            </div>
            <Table
              columns={columns}
              dataSource={permissions}
              rowKey="id"
              loading={loading}
              pagination={{
                current,
                pageSize,
                total,
                showSizeChanger: true,
                showQuickJumper: true,
              }}
              onChange={handleTableChange}
            />
          </>
        ) : (
          <Tree
            showLine
            treeData={renderTreeNodes(permissionTree)}
            defaultExpandAll
          />
        )}
      </Card>

      {/* 权限表单模态框 */}
      <Modal
        title={permissionModalTitle}
        open={permissionModalVisible}
        onCancel={handlePermissionModalCancel}
        width={700}
        footer={[
          <Button key="back" onClick={handlePermissionModalCancel}>
            取消
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            loading={submitting} 
            onClick={handlePermissionSubmit}
          >
            保存
          </Button>,
        ]}
        maskClosable={false}
      >
        <Form
          form={permissionForm}
          layout="vertical"
          initialValues={{
            parent_id: null,
            sort: 0,
            is_visible: true,
          }}
        >
          <Form.Item
            name="parent_id"
            label="上级权限"
          >
            <Select
              placeholder="请选择上级权限"
              allowClear
            >
              <Option value={null}>顶级权限</Option>
              {permissions.map(permission => (
                <Option key={permission.id} value={permission.id}>
                  {permission.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="name"
            label="权限名称"
            rules={[{ required: true, message: '请输入权限名称' }]}
          >
            <Input placeholder="请输入权限名称" />
          </Form.Item>
          
          <Form.Item
            name="code"
            label="权限代码"
            rules={[{ required: true, message: '请输入权限代码' }]}
          >
            <Input placeholder="请输入权限代码，例如 system:user" />
          </Form.Item>
          
          <Form.Item
            name="page_path"
            label="页面路径"
            rules={[{ required: true, message: '请输入页面路径' }]}
          >
            <Input placeholder="请输入页面路径，如 /users 或 /roles" />
          </Form.Item>
          
          <Form.Item
            name="icon"
            label="图标"
          >
            <Input placeholder="请输入图标名称" />
          </Form.Item>
          
          <Form.Item
            name="sort"
            label="排序"
          >
            <InputNumber min={0} />
          </Form.Item>
          
          <Form.Item
            name="is_visible"
            label="是否可见"
            valuePropName="checked"
            tooltip="是否在菜单中显示此项"
          >
            <Switch checkedChildren="显示" unCheckedChildren="隐藏" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea placeholder="请输入权限描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PermissionList; 