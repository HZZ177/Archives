import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  message,
  Popconfirm,
  Tag,
  Typography,
  Card,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { Role } from '../../types/role';
import {
  fetchRoles,
  createRole,
  updateRole,
  deleteRole,
  fetchRoleById,
} from '../../apis/roleService';
import RoleForm from './components/RoleForm';

const { Title } = Typography;

const RoleList: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 获取角色列表
  const loadRoles = async () => {
    try {
      setLoading(true);
      const data = await fetchRoles();
      setRoles(data);
    } catch (error) {
      console.error('获取角色列表失败:', error);
      message.error('获取角色列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  // 处理创建/更新角色
  const handleSubmit = async (values: any) => {
    try {
      setSubmitting(true);
      if (currentRole) {
        // 更新角色
        await updateRole(currentRole.id, values);
        message.success('角色更新成功');
      } else {
        // 创建角色
        await createRole(values);
        message.success('角色创建成功');
      }
      setModalVisible(false);
      loadRoles();
    } catch (error) {
      console.error('保存角色失败:', error);
      message.error('保存角色失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 处理删除角色
  const handleDelete = async (roleId: number) => {
    try {
      const result = await deleteRole(roleId);
      
      if (result.success) {
        message.success(result.message || '角色删除成功');
        loadRoles();
      } else {
        // 显示业务逻辑错误（例如，角色正在被使用）
        message.warning(result.message);
      }
    } catch (error) {
      console.error('删除角色失败:', error);
      message.error('删除角色失败');
    }
  };

  // 处理编辑角色
  const handleEdit = async (role: Role) => {
    try {
      setLoading(true);
      // 获取角色的完整信息（包括权限）
      const roleDetail = await fetchRoleById(role.id);
      setCurrentRole(roleDetail);
      setModalVisible(true);
    } catch (error) {
      console.error('获取角色详情失败:', error);
      message.error('获取角色详情失败');
    } finally {
      setLoading(false);
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: boolean) => (
        <Tag color={status ? 'success' : 'error'}>
          {status ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Role) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个角色吗？"
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
    <Card>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4}>角色管理</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setCurrentRole(null);
            setModalVisible(true);
          }}
        >
          创建角色
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={roles}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title={currentRole ? '编辑角色' : '创建角色'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        <RoleForm
          role={currentRole}
          onSubmit={handleSubmit}
          onCancel={() => setModalVisible(false)}
          submitting={submitting}
        />
      </Modal>
    </Card>
  );
};

export default RoleList; 