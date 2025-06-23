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
  Tooltip
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  SearchOutlined, 
  DatabaseOutlined,
  ReloadOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { getWorkspaceTables, deleteTable } from '../../services/workspaceTableService';
import { WorkspaceTable } from '../../types/workspace';
import TableForm from './components/TableForm';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const WorkspaceTablesPage: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const [tables, setTables] = useState<WorkspaceTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [currentTable, setCurrentTable] = useState<WorkspaceTable | null>(null);
  const [modalTitle, setModalTitle] = useState('添加数据库表');

  // 加载工作区数据库表
  const loadTables = async () => {
    if (!currentWorkspace) return;
    
    try {
      setLoading(true);
      const data = await getWorkspaceTables(currentWorkspace.id);
      setTables(data);
    } catch (error) {
      console.error('加载数据库表失败:', error);
      message.error('加载数据库表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 首次加载和工作区变更时重新加载数据
  useEffect(() => {
    if (currentWorkspace) {
      loadTables();
    }
  }, [currentWorkspace]);

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  // 过滤表格数据
  const filteredTables = tables.filter(table => 
    table.name.toLowerCase().includes(searchText.toLowerCase()) ||
    (table.description && table.description.toLowerCase().includes(searchText.toLowerCase()))
  );

  // 添加数据库表
  const handleAdd = () => {
    setCurrentTable(null);
    setModalTitle('添加数据库表');
    setModalVisible(true);
  };

  // 编辑数据库表
  const handleEdit = (record: WorkspaceTable) => {
    setCurrentTable(record);
    setModalTitle('编辑数据库表');
    setModalVisible(true);
  };

  // 删除数据库表
  const handleDelete = async (id: number) => {
    try {
      await deleteTable(id);
      message.success('删除成功');
      loadTables();
    } catch (error) {
      console.error('删除数据库表失败:', error);
      message.error('删除失败，请稍后重试');
    }
  };

  // 表单提交成功后的回调
  const handleFormSuccess = () => {
    setModalVisible(false);
    loadTables();
  };

  // 表格列定义
  const columns = [
    {
      title: '表名',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <DatabaseOutlined style={{ color: '#1890ff' }} />
          <Text strong>{text}</Text>
        </Space>
      )
    },
    {
      title: '模式',
      dataIndex: 'schema_name',
      key: 'schema_name',
      render: (text: string) => text || '-'
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => text || '-'
    },
    {
      title: '字段数',
      key: 'columns_count',
      render: (_: any, record: WorkspaceTable) => (
        <Tag color="blue">{record.columns_json.length}</Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString()
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (text: string) => new Date(text).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: WorkspaceTable) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除此数据库表吗？"
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
              placeholder="搜索表名或描述"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={e => handleSearch(e.target.value)}
              style={{ width: 250 }}
              allowClear
            />
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadTables}
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
            添加数据库表
          </Button>
        </div>
        
        <Table
          columns={columns}
          dataSource={filteredTables}
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
            <DatabaseOutlined style={{ marginRight: 8 }} />
            工作区数据库表管理
            <Tooltip title="在这里统一管理工作区的数据库表，可以被内容页面引用">
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
          <TableForm
            workspaceId={currentWorkspace?.id}
            initialValues={currentTable}
            onSuccess={handleFormSuccess}
            onCancel={() => setModalVisible(false)}
          />
        )}
      </Modal>
    </div>
  );
};

export default WorkspaceTablesPage; 