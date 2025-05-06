import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Space, Card, Popconfirm, message, Tag, Modal, Form, Select, InputNumber, Switch, Tooltip, Tree } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, AppstoreOutlined, LinkOutlined, LockOutlined } from '@ant-design/icons';
import { Permission, PermissionFormData } from '../../types/permission';
import { fetchPermissions, fetchPermissionTree, createPermission, updatePermission, deletePermission } from '../../apis/permissionService';
import { DEFAULT_PAGE_SIZE } from '../../config/constants';

const { Search } = Input;
const { Option } = Select;

// 权限类型选项
const permissionTypes = [
  { label: '目录', value: 'directory' },
  { label: '菜单', value: 'menu' },
  { label: '按钮/接口', value: 'button' },
];

const PermissionList: React.FC = () => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permissionTree, setPermissionTree] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  
  // 权限表单状态
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [permissionModalTitle, setPermissionModalTitle] = useState('添加权限');
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [permissionForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  
  // 展示方式：列表或树形
  const [displayMode, setDisplayMode] = useState<'list' | 'tree'>('list');

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
      } else if (data.items) {
        setPermissions(data.items);
        setTotal(data.total);
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
    setPermissionModalTitle('添加权限');
    setEditingPermission(null);
    permissionForm.resetFields();
    permissionForm.setFieldsValue({
      parent_id: null,
      type: 'menu',
      sort: 0,
      visible: true,
    });
    setPermissionModalVisible(true);
  };

  // 打开编辑权限模态框
  const showEditPermissionModal = (permission: Permission) => {
    setPermissionModalTitle('编辑权限');
    setEditingPermission(permission);
    permissionForm.setFieldsValue({
      code: permission.code,
      name: permission.name,
      type: permission.type,
      parent_id: permission.parent_id,
      path: permission.path,
      component: permission.component,
      permission: permission.permission,
      icon: permission.icon,
      sort: permission.sort,
      visible: permission.visible,
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
      setRefreshKey(prev => prev + 1); // 触发刷新
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
      setRefreshKey(prev => prev + 1); // 触发刷新
    } catch (error) {
      message.error('删除权限失败');
    }
  };

  // 切换展示模式
  const toggleDisplayMode = () => {
    setDisplayMode(prev => prev === 'list' ? 'tree' : 'list');
  };

  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '权限名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '权限编码',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        switch (type) {
          case 'directory':
            return <Tag color="blue">目录</Tag>;
          case 'menu':
            return <Tag color="green">菜单</Tag>;
          case 'button':
            return <Tag color="orange">按钮/接口</Tag>;
          default:
            return <Tag color="default">{type}</Tag>;
        }
      },
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
    },
    {
      title: '组件',
      dataIndex: 'component',
      key: 'component',
    },
    {
      title: '权限标识',
      dataIndex: 'permission',
      key: 'permission',
    },
    {
      title: '可见',
      dataIndex: 'visible',
      key: 'visible',
      render: (visible: boolean) => (
        visible ? <Tag color="green">是</Tag> : <Tag color="red">否</Tag>
      ),
    },
    {
      title: '排序',
      dataIndex: 'sort',
      key: 'sort',
      width: 60,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Permission) => (
        <Space size="middle">
          <Tooltip title="编辑权限">
            <Button 
              type="link" 
              icon={<EditOutlined />} 
              onClick={() => showEditPermissionModal(record)}
            />
          </Tooltip>
          <Tooltip title="删除权限">
            <Popconfirm
              title="确定要删除该权限吗? 删除后相关角色将失去此权限。"
              onConfirm={() => handleDeletePermission(record.id)}
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

  // 渲染权限树节点
  const renderTreeNodes = (data: Permission[]): { title: React.ReactNode; key: React.Key; children?: any[] }[] => {
    return data.map(item => ({
      title: (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Space>
            {item.type === 'directory' && <AppstoreOutlined />}
            {item.type === 'menu' && <LinkOutlined />}
            {item.type === 'button' && <LockOutlined />}
            <span>{item.name}</span>
            <Tag color="blue">{item.code}</Tag>
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

  // 根据权限类型更新表单字段的可见性
  const handlePermissionTypeChange = (value: string) => {
    permissionForm.setFieldsValue({
      path: undefined,
      component: undefined,
      permission: undefined,
    });
  };

  return (
    <div>
      <Card bordered={false}>
        <div style={{ marginBottom: 16 }}>
          <Space>
            {displayMode === 'list' && (
              <Search
                placeholder="搜索权限名称/编码"
                allowClear
                enterButton={<Button type="primary" icon={<SearchOutlined />}>搜索</Button>}
                size="middle"
                onSearch={handleSearch}
                style={{ width: 300 }}
              />
            )}
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={showAddPermissionModal}
            >
              添加权限
            </Button>
            <Button
              type="default"
              onClick={toggleDisplayMode}
            >
              {displayMode === 'list' ? '树形视图' : '列表视图'}
            </Button>
          </Space>
        </div>
        
        {displayMode === 'list' ? (
          <Table
            columns={columns}
            dataSource={permissions}
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
        ) : (
          <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '4px' }}>
            {permissionTree && permissionTree.length > 0 ? (
              <Tree
                defaultExpandAll
                showLine={{ showLeafIcon: false }}
                treeData={renderTreeNodes(permissionTree)}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '20px' }}>暂无数据</div>
            )}
          </div>
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
            type: 'menu',
            sort: 0,
            visible: true,
          }}
        >
          <Form.Item
            name="type"
            label="权限类型"
            rules={[{ required: true, message: '请选择权限类型' }]}
          >
            <Select onChange={handlePermissionTypeChange}>
              {permissionTypes.map(type => (
                <Option key={type.value} value={type.value}>{type.label}</Option>
              ))}
            </Select>
          </Form.Item>
          
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
            label="权限编码"
            rules={[{ required: true, message: '请输入权限编码' }]}
          >
            <Input placeholder="请输入权限编码" />
          </Form.Item>
          
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
          >
            {({ getFieldValue }) => {
              const permissionType = getFieldValue('type');
              
              // 仅菜单和目录需要展示路径
              return (permissionType === 'menu' || permissionType === 'directory') ? (
                <Form.Item
                  name="path"
                  label="路由路径"
                  rules={[{ required: true, message: '请输入路由路径' }]}
                >
                  <Input placeholder="请输入路由路径，如 /system/user" />
                </Form.Item>
              ) : null;
            }}
          </Form.Item>
          
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
          >
            {({ getFieldValue }) => {
              const permissionType = getFieldValue('type');
              
              // 仅菜单需要展示组件
              return permissionType === 'menu' ? (
                <Form.Item
                  name="component"
                  label="组件路径"
                >
                  <Input placeholder="请输入组件路径，如 system/user/index" />
                </Form.Item>
              ) : null;
            }}
          </Form.Item>
          
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
          >
            {({ getFieldValue }) => {
              const permissionType = getFieldValue('type');
              
              // 按钮类型需要展示权限标识
              return permissionType === 'button' ? (
                <Form.Item
                  name="permission"
                  label="权限标识"
                  rules={[{ required: true, message: '请输入权限标识' }]}
                >
                  <Input placeholder="请输入权限标识，如 system:user:add" />
                </Form.Item>
              ) : null;
            }}
          </Form.Item>
          
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
          >
            {({ getFieldValue }) => {
              const permissionType = getFieldValue('type');
              
              // 仅菜单和目录需要展示图标
              return (permissionType === 'menu' || permissionType === 'directory') ? (
                <Form.Item
                  name="icon"
                  label="图标"
                >
                  <Input placeholder="请输入图标名称，如 UserOutlined" />
                </Form.Item>
              ) : null;
            }}
          </Form.Item>
          
          <Form.Item
            name="sort"
            label="排序"
            tooltip="数值越小排序越靠前"
          >
            <InputNumber min={0} />
          </Form.Item>
          
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
          >
            {({ getFieldValue }) => {
              const permissionType = getFieldValue('type');
              
              // 仅菜单和目录需要展示可见性
              return (permissionType === 'menu' || permissionType === 'directory') ? (
                <Form.Item
                  name="visible"
                  label="是否可见"
                  valuePropName="checked"
                  tooltip="是否在菜单中显示此项"
                >
                  <Switch checkedChildren="显示" unCheckedChildren="隐藏" />
                </Form.Item>
              ) : null;
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PermissionList; 