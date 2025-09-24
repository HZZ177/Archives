import React, { useEffect, useState, useCallback } from 'react';
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
  Badge,
  TablePaginationConfig
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  SearchOutlined, 
  ApiOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  ImportOutlined
} from '@ant-design/icons';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { getWorkspaceInterfaces, deleteInterface } from '../../services/workspaceInterfaceService';
import { WorkspaceInterface, PaginatedInterfaces } from '../../types/workspace';
import InterfaceForm from './components/InterfaceForm';
import InterfaceImportModal from './components/InterfaceImportModal';
import { debounce } from '../../utils/throttle';

const { Title, Text } = Typography;

const WorkspaceInterfacesPage: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const [interfaces, setInterfaces] = useState<WorkspaceInterface[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchInputValue, setSearchInputValue] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [currentInterface, setCurrentInterface] = useState<WorkspaceInterface | null>(null);
  const [modalTitle, setModalTitle] = useState('添加接口');
  const [importModalVisible, setImportModalVisible] = useState(false);
  
  // 分页状态
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50', '100'],
    showTotal: (total) => `共 ${total} 条`
  });

  // 加载工作区接口
  const loadInterfaces = async (
    page = pagination.current, 
    pageSize = pagination.pageSize,
    search = searchText
  ) => {
    if (!currentWorkspace) return;
    
    try {
      setLoading(true);

      const paginatedData = await getWorkspaceInterfaces(
        currentWorkspace.id,
        page as number,
        pageSize as number,
        search
      );
      
      // 直接使用后端返回的数据，不再进行本地过滤
      setInterfaces(paginatedData.items);
      setPagination({
        ...pagination,
        current: paginatedData.page,
        pageSize: paginatedData.page_size,
        total: paginatedData.total
      });
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
      loadInterfaces(1); // 重置到第一页
    }
  }, [currentWorkspace]);

  // 使用useCallback和debounce创建去抖的搜索函数
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchText(value);
      // 搜索时重置到第一页，并使用新的搜索条件加载数据
      loadInterfaces(1, pagination.pageSize, value);
    }, 500), // 500ms的去抖延迟
    [currentWorkspace, pagination.pageSize]
  );

  // 处理搜索框输入变化
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInputValue(value);
    debouncedSearch(value);
  };

  // 处理搜索按钮点击（如果需要）
  const handleSearch = (value: string) => {
    setSearchInputValue(value);
    setSearchText(value);
    // 搜索时重置到第一页，并使用新的搜索条件加载数据
    loadInterfaces(1, pagination.pageSize, value);
  };

  // 处理分页变化
  const handleTableChange = (newPagination: TablePaginationConfig) => {
    loadInterfaces(newPagination.current, newPagination.pageSize, searchText);
  };

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
      loadInterfaces(); // 保持在当前页
    } catch (error) {
      console.error('删除接口失败:', error);
      message.error('删除失败，请稍后重试');
    }
  };

  // 表单提交成功后的回调
  const handleFormSuccess = () => {
    setModalVisible(false);
    loadInterfaces(); // 保持在当前页
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

  // 处理导入按钮点击
  const handleImport = () => {
    setImportModalVisible(true);
  };

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
              value={searchInputValue}
              onChange={handleSearchInputChange}
              style={{ width: 250 }}
              allowClear
            />
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => {
                setSearchText('');
                setSearchInputValue('');
                loadInterfaces(1, pagination.pageSize, '');
              }}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
          <Space>
            <Button 
              icon={<ImportOutlined />}
              onClick={handleImport}
            >
              导入接口
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={handleAdd}
            >
              添加接口
            </Button>
          </Space>
        </div>
        
        <Table
          columns={columns}
          dataSource={interfaces} // 直接使用interfaces，不再使用filteredInterfaces
          rowKey="id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
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

      {/* 导入接口Modal */}
      <InterfaceImportModal
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        workspaceId={currentWorkspace?.id}
        onSuccess={() => {
          loadInterfaces(); // 重新加载接口列表，但不关闭弹窗
        }}
      />
    </div>
  );
};

export default WorkspaceInterfacesPage; 