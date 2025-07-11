import React, { useState, useCallback } from 'react';
import { 
  Modal, 
  Button, 
  Table, 
  Input, 
  Pagination, 
  Spin, 
  Empty, 
  message, 
  Tag,
  Space,
  Popconfirm
} from 'antd';
import { 
  SearchOutlined,
  DeleteOutlined,
  ApiOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { WorkspaceInterface } from '../../../types/workspace';
import { getWorkspaceInterfaces, deleteWorkspaceInterface } from '../../../apis/workspaceService';
import { debounce } from '../../../utils/throttle';

const { Search } = Input;

interface InterfaceBatchEditModalProps {
  visible: boolean;
  onCancel: () => void;
  workspaceId?: number;
  onSuccess: () => void;
}

/**
 * 接口批量编辑Modal组件
 */
const InterfaceBatchEditModal: React.FC<InterfaceBatchEditModalProps> = ({
  visible,
  onCancel,
  workspaceId,
  onSuccess
}) => {
  const [interfaces, setInterfaces] = useState<WorkspaceInterface[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [selectedInterfaceIds, setSelectedInterfaceIds] = useState<React.Key[]>([]);
  
  // 搜索相关状态
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  
  // 分页相关状态
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  
  // 使用useCallback和debounce创建去抖的搜索函数
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchKeyword(value.trim());
      // 搜索时重置到第一页
      setPagination(prev => ({ ...prev, current: 1 }));
      // 使用新的搜索条件加载数据
      loadInterfaces(1, pagination.pageSize, value.trim());
    }, 500), // 500ms的去抖延迟
    [workspaceId, pagination.pageSize]
  );

  // 处理搜索框输入变化
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    debouncedSearch(value);
  };
  
  // 加载接口列表
  const loadInterfaces = async (
    page = pagination.current,
    pageSize = pagination.pageSize,
    search = searchKeyword
  ) => {
    if (!workspaceId) return;
    
    setLoading(true);
    try {
      const data = await getWorkspaceInterfaces(workspaceId, page, pageSize, search);
      // 更新接口列表和分页信息
      setInterfaces(data.items || []);
      setPagination({
        current: data.page || 1,
        pageSize: data.page_size || 10,
        total: data.total || 0
      });
    } catch (error) {
      console.error('加载工作区接口失败:', error);
      message.error('加载工作区接口失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理分页变化
  const handlePageChange = (page: number, pageSize?: number) => {
    setPagination(prev => ({
      ...prev,
      current: page,
      pageSize: pageSize || prev.pageSize
    }));
    loadInterfaces(page, pageSize || pagination.pageSize);
  };
  
  // 当弹窗打开时加载数据
  React.useEffect(() => {
    if (visible && workspaceId) {
      // 重置状态
      setSelectedInterfaceIds([]);
      setSearchKeyword('');
      setPagination({
        current: 1,
        pageSize: 10,
        total: 0
      });
      
      // 加载数据
      loadInterfaces(1, 10, '');
    }
  }, [visible, workspaceId]);

  // 处理批量删除
  const handleBatchDelete = async () => {
    if (!workspaceId || selectedInterfaceIds.length === 0) {
      return;
    }
    
    setDeleting(true);
    
    try {
      // 依次删除选中的接口
      for (const id of selectedInterfaceIds) {
        await deleteWorkspaceInterface(workspaceId, Number(id));
      }
      
      message.success(`成功删除${selectedInterfaceIds.length}个接口`);
      
      // 清空选择
      setSelectedInterfaceIds([]);
      
      // 重新加载当前页数据
      loadInterfaces();
      
      // 通知父组件刷新
      onSuccess();
    } catch (error) {
      console.error('批量删除接口失败:', error);
      message.error('批量删除接口失败');
    } finally {
      setDeleting(false);
    }
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
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      render: (method: string) => (
        <Tag color={getMethodColor(method)}>{method}</Tag>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => text || '-'
    }
  ];

  // 行选择配置
  const rowSelection = {
    selectedRowKeys: selectedInterfaceIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      setSelectedInterfaceIds(selectedRowKeys);
    }
  };

  return (
    <Modal
      title={
        <div>
          <Space>
            <ApiOutlined />
            <span>批量编辑接口</span>
          </Space>
        </div>
      }
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          关闭
        </Button>,
        <Popconfirm
          key="delete"
          title="删除确认"
          description={`确定要删除选中的 ${selectedInterfaceIds.length} 个接口吗？此操作不可恢复。`}
          icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
          onConfirm={handleBatchDelete}
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button 
            type="primary" 
            danger
            icon={<DeleteOutlined />}
            disabled={selectedInterfaceIds.length === 0}
            loading={deleting}
          >
            删除选中
          </Button>
        </Popconfirm>
      ]}
      width={800}
      destroyOnClose
    >
      <div style={{ marginBottom: 16 }}>
        <Search
          placeholder="搜索接口路径或描述"
          allowClear
          onSearch={(value) => debouncedSearch(value)}
          onChange={handleSearchInputChange}
          style={{ width: '100%' }}
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
        />
      </div>
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin tip="加载中..." />
        </div>
      ) : interfaces.length === 0 ? (
        <Empty 
          description={
            searchKeyword 
              ? `没有找到与"${searchKeyword}"相关的接口` 
              : "暂无接口"
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <>
          <Table
            dataSource={interfaces}
            columns={columns}
            rowKey="id"
            rowSelection={rowSelection}
            pagination={false}
            size="small"
          />
          
          {pagination.total > 0 && (
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Pagination
                current={pagination.current}
                pageSize={pagination.pageSize}
                total={pagination.total}
                onChange={handlePageChange}
                showSizeChanger
                showQuickJumper
                showTotal={(total) => `共 ${total} 条数据`}
                size="small"
              />
            </div>
          )}
        </>
      )}
    </Modal>
  );
};

export default InterfaceBatchEditModal; 