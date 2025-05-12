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
  Tooltip,
  Switch,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { Role } from '../../types/role';
import {
  fetchRoles,
  createRole,
  updateRole,
  deleteRole,
  fetchRoleById,
  updateRoleStatus,
} from '../../apis/roleService';
import RoleForm from './components/RoleForm';

const { Title } = Typography;

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

const RoleList: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formResetKey, setFormResetKey] = useState<number>(Date.now());

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
    } catch (error: any) {
      console.error('保存角色失败:', error);
      
      // 提取详细错误信息
      let errorMessage = '保存角色失败';
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
    } finally {
      setSubmitting(false);
    }
  };

  // 处理删除角色
  const handleDelete = async (roleId: number) => {
    try {
      const response = await deleteRole(roleId);
      
      if (response.success) {
        message.success(response.message || '角色删除成功');
        loadRoles();
      } else {
        // 显示业务逻辑错误（例如，角色正在被使用）
        message.warning(response.message || '删除角色失败');
      }
    } catch (error: any) {
      console.error('删除角色失败:', error);
      
      // 提取详细错误信息
      let errorMessage = '删除角色失败';
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

  // 处理编辑角色
  const handleEdit = async (role: Role) => {
    try {
      // 先重置当前角色状态，确保不显示旧数据
      setCurrentRole(null);
      
      setLoading(true);
      // 获取角色的完整信息（包括权限）
      const roleDetail = await fetchRoleById(role.id);
      
      // 设置新的角色数据并打开Modal
      setCurrentRole(roleDetail);
      setModalVisible(true);
    } catch (error: any) {
      console.error('获取角色详情失败:', error);
      
      // 提取详细错误信息
      let errorMessage = '获取角色详情失败';
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
    } finally {
      setLoading(false);
    }
  };

  // 处理Modal关闭
  const handleModalClose = () => {
    setModalVisible(false);
    setCurrentRole(null); // 确保关闭Modal时清除当前角色数据
    setFormResetKey(Date.now()); // 重置表单键
  };

  // 处理角色状态切换
  const handleRoleStatusChange = async (roleId: number, checked: boolean) => {
    try {
      // 调用API更新角色状态
      await updateRoleStatus(roleId, checked);
      
      // 更新本地数据
      setRoles(prev => 
        prev.map(role => 
          role.id === roleId 
            ? { ...role, status: checked } 
            : role
        )
      );
      
      message.success(`角色${checked ? '启用' : '禁用'}成功`);
    } catch (error: any) {
      console.error('更新角色状态失败:', error);
      
      // 提取详细错误信息
      let errorMessage = '更新角色状态失败';
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

  // 表格列定义
  const columns = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (name: string) => (
        <EllipsisTooltip title={name} widthLimit={140}>
          {name}
        </EllipsisTooltip>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 300,
      render: (description: string) => (
        <EllipsisTooltip title={description || '-'} widthLimit={290}>
          {description || '-'}
        </EllipsisTooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center' as 'center',
      render: (status: boolean, record: Role) => (
        <Switch
          checked={status}
          onChange={(checked) => handleRoleStatusChange(record.id, checked)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as 'right',
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

  // 添加表头居中的样式
  const centerHeaderStyle = `
    .center-header .ant-table-thead th {
      text-align: center !important;
    }
  `;

  return (
    <Card>
      <style>{centerHeaderStyle}</style>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4}>角色管理</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setCurrentRole(null);
            setFormResetKey(Date.now());
            setModalVisible(true);
          }}
        >
          创建角色
        </Button>
      </div>

      <Table
        className="center-header"
        columns={columns}
        dataSource={roles}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title={currentRole ? '编辑角色信息与权限' : '创建新角色'}
        open={modalVisible}
        onCancel={handleModalClose}
        footer={null}
        width={1200}
      >
        <RoleForm
          role={currentRole}
          onSubmit={handleSubmit}
          onCancel={handleModalClose}
          submitting={submitting}
          resetKey={formResetKey}
        />
      </Modal>
    </Card>
  );
};

export default RoleList; 