import React, { useEffect, useState } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  message, 
  Popconfirm, 
  Typography, 
  Input, 
  Tabs, 
  Modal, 
  Spin, 
  Empty,
  Tag,
  Tooltip,
  Badge
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  SearchOutlined, 
  ApiOutlined,
  ReloadOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { getWorkspaceInterfaces, deleteInterface } from '../../services/workspaceInterfaceService';
import { WorkspaceInterface } from '../../types/workspace';
import InterfaceForm from './components/InterfaceForm';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const WorkspaceInterfacesPage: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const [interfaces, setInterfaces] = useState<WorkspaceInterface[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [currentInterface, setCurrentInterface] = useState<WorkspaceInterface | null>(null);
  const [modalTitle, setModalTitle] = useState('添加接口');

  // 加载工作区接口
  const loadInterfaces = async () => {
    if (!currentWorkspace) return;
    
    try {
      setLoading(true);
      const data = await getWorkspaceInterfaces(currentWorkspace.id);
      setInterfaces(data);
    } catch (error) {
      console.error('加载接口失败:', error);
      message.error('加载接口失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 首次加载和工作区变更时重新加载数据
  useEffect(() => {
    if (currentWorkspace) {
      loadInterfaces();
    }
  }, [currentWorkspace]);

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  // 过滤表格数据
  const filteredInterfaces = interfaces.filter(item => 
    item.path.toLowerCase().includes(searchText.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchText.toLowerCase()))
  );

  // 添加接口
  const handleAdd = () => {
    setCurrentInterface(null);
    setModalTitle('添加接口');
    setModalVisible(true);
  };

  // 编辑接口
  const handleEdit = (record: WorkspaceInterface) => {
    setCurrentInterface(record);
    setModalTitle('编辑接口');
    setModalVisible(true);
  };

  // 删除接口
  const handleDelete = async (id: number) => {
    try {
      await deleteInterface(id);
      message.success('删除成功');
      loadInterfaces();
    } catch (error) {
      console.error('删除接口失败:', error);
      message.error('删除失败，请稍后重试');
    }
  };

  // 表单提交成功后的回调
  const handleFormSuccess = () => {
    setModalVisible(false);
    loadInterfaces();
  };

  // 获取HTTP方法对应的颜色
  const getMethodColor = (method: string) => {
    const methodColors: Record<string, string> = {
      GET: 'green',
      POST: 'blue',
      PUT: 'orange',
      DELETE: 'red',
      PATCH: 'purple'
    };
    
    return methodColors[method.toUpperCase()] || 'default';
  };

  // 表格列定义
  const columns = [
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      render: (text: string) => (
        <Space>
          <ApiOutlined style={{ color: '#1890ff' }} />
          <Text strong>{text}</Text>
        </Space>
      )
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      render: (text: string) => (
        <Tag color={getMethodColor(text)}>
          {text.toUpperCase()}
        </Tag>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => text || '-'
    },
    {
      title: '内容类型',
      dataIndex: 'content_type',
      key: 'content_type',
      render: (text: string) => text || 'application/json'
    },
    {
      title: '参数',
      key: 'params',
      render: (_: any, record: WorkspaceInterface) => (
        <Space>
          <Badge count={(record.request_params_json || []).length} showZero color="blue" overflowCount={99} />
          <Text>请求参数</Text>
          <Badge count={(record.response_params_json || []).length} showZero color="green" overflowCount={99} />
          <Text>响应参数</Text>
        </Space>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: WorkspaceInterface) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除此接口吗？"
            description="此操作不可逆，删除后将无法恢复。"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 渲染页面内容
  const renderContent = () => {
    if (!currentWorkspace) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="请先选择一个工作区"
        />
      );
    }

    return (
      <div>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Input
              placeholder="搜索路径或描述"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={e => handleSearch(e.target.value)}
              style={{ width: 250 }}
              allowClear
            />
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadInterfaces}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={handleAdd}
          >
            添加接口
          </Button>
        </div>
        
        <Table
          columns={columns}
          dataSource={filteredInterfaces}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </div>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ marginBottom: 24 }}>
          <Title level={4}>
            <ApiOutlined style={{ marginRight: 8 }} />
            工作区接口管理
            <Tooltip title="在这里统一管理工作区的API接口，可以被内容页面引用">
              <InfoCircleOutlined style={{ marginLeft: 8, color: '#1890ff' }} />
            </Tooltip>
          </Title>
        </div>
        
        {renderContent()}
      </Card>

      <Modal
        title={modalTitle}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        {modalVisible && (
          <InterfaceForm
            workspaceId={currentWorkspace?.id}
            initialValues={currentInterface}
            onSuccess={handleFormSuccess}
            onCancel={() => setModalVisible(false)}
          />
        )}
      </Modal>
    </div>
  );
};

export default WorkspaceInterfacesPage; 