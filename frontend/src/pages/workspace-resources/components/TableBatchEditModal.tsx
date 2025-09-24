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
  DatabaseOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { WorkspaceTableRead } from '../../../types/workspace';
import { getWorkspaceTablesPaginated } from '../../../services/workspaceTableService';
import { deleteWorkspaceTable } from '../../../apis/workspaceService';
import { debounce } from '../../../utils/throttle';

const { Search } = Input;

interface TableBatchEditModalProps {
  open: boolean;
  onCancel: () => void;
  workspaceId?: number;
  onSuccess: () => void;
}

/**
 * 数据库表批量编辑Modal组件
 */
const TableBatchEditModal: React.FC<TableBatchEditModalProps> = ({
  open,
  onCancel,
  workspaceId,
  onSuccess
}) => {
  const [tables, setTables] = useState<WorkspaceTableRead[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [selectedTableIds, setSelectedTableIds] = useState<React.Key[]>([]);
  
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
      loadTables(1, pagination.pageSize, value.trim());
    }, 500), // 500ms的去抖延迟
    [workspaceId, pagination.pageSize]
  );

  // 处理搜索框输入变化
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    debouncedSearch(value);
  };
  
  // 加载表列表
  const loadTables = async (
    page = pagination.current,
    pageSize = pagination.pageSize,
    search = searchKeyword
  ) => {
    if (!workspaceId) return;
    
    setLoading(true);
    try {
      const data = await getWorkspaceTablesPaginated(workspaceId, page, pageSize, search);
      // 更新表列表和分页信息
      setTables(data.items || []);
      setPagination({
        current: data.page || 1,
        pageSize: data.page_size || 10,
        total: data.total || 0
      });
    } catch (error) {
      console.error('加载工作区数据库表失败:', error);
      message.error('加载工作区数据库表失败');
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
    loadTables(page, pageSize || pagination.pageSize);
  };
  
  // 当弹窗打开时加载数据
  React.useEffect(() => {
    if (open && workspaceId) {
      // 重置状态
      setSelectedTableIds([]);
      setSearchKeyword('');
      setPagination({
        current: 1,
        pageSize: 10,
        total: 0
      });

      // 加载数据
      loadTables(1, 10, '');
    }
  }, [open, workspaceId]);

  // 处理批量删除
  const handleBatchDelete = async () => {
    if (!workspaceId || selectedTableIds.length === 0) {
      return;
    }
    
    setDeleting(true);
    
    try {
      // 依次删除选中的表
      for (const id of selectedTableIds) {
        await deleteWorkspaceTable(workspaceId, Number(id));
      }
      
      message.success(`成功删除${selectedTableIds.length}个数据库表`);
      
      // 清空选择
      setSelectedTableIds([]);
      
      // 重新加载当前页数据
      loadTables();
      
      // 通知父组件刷新
      onSuccess();
    } catch (error) {
      console.error('批量删除数据库表失败:', error);
      message.error('批量删除数据库表失败');
    } finally {
      setDeleting(false);
    }
  };
  
  // 获取字段数量
  const getFieldCount = (table: WorkspaceTableRead) => {
    if (!table.columns_json || !Array.isArray(table.columns_json)) {
      return 0;
    }
    return table.columns_json.length;
  };
  
  // 表格列定义
  const columns = [
    {
      title: '表名',
      dataIndex: 'name',
      key: 'name',
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
      title: '字段数量',
      key: 'field_count',
      render: (text: string, record: WorkspaceTableRead) => (
        <Tag color="blue">{getFieldCount(record)}</Tag>
      )
    }
  ];

  // 行选择配置
  const rowSelection = {
    selectedRowKeys: selectedTableIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      setSelectedTableIds(selectedRowKeys);
    }
  };

  return (
    <Modal
      title={
        <div>
          <Space>
            <DatabaseOutlined />
            <span>批量编辑数据库表</span>
          </Space>
        </div>
      }
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          关闭
        </Button>,
        <Popconfirm
          key="delete"
          title="删除确认"
          description={`确定要删除选中的 ${selectedTableIds.length} 个数据库表吗？此操作不可恢复。`}
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
            disabled={selectedTableIds.length === 0}
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
          placeholder="搜索表名或描述"
          allowClear
          onSearch={(value) => debouncedSearch(value)}
          onChange={handleSearchInputChange}
          style={{ width: '100%' }}
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
        />
      </div>
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin tip="加载中...">
            <div style={{ minHeight: '100px' }} />
          </Spin>
        </div>
      ) : tables.length === 0 ? (
        <Empty 
          description={
            searchKeyword 
              ? `没有找到与"${searchKeyword}"相关的数据库表` 
              : "暂无数据库表"
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <>
          <Table
            dataSource={tables}
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

export default TableBatchEditModal; 