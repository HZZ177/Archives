import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Select,

  message,
  Tag,
  Tabs,
  Row,
  Col,
  Statistic,
  Typography,
  Spin,
  Empty,
  Tooltip,
  Alert,
  Descriptions,
  Modal,
  List,
  Tree
} from 'antd';
import {
  SearchOutlined,
  BarChartOutlined,
  BugOutlined,
  ApiOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  FolderOutlined
} from '@ant-design/icons';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { usePermission } from '../../contexts/PermissionContext';
import { unwrapResponse } from '../../utils/request';
import request from '../../utils/request';
import { ROUTES } from '../../config/constants';
import CodingConfigModal from '../../components/coding/CodingConfigModal';
import BugAnalysisPage from './components/BugAnalysisPage';
import './components/BugAnalysisPage.css';
import '../module-content/components/sections/SectionStyles.css';

const { Title } = Typography;
const { Option } = Select;

// 格式化日期显示
const formatDate = (timestamp: number) => {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// 优先级颜色映射
const getPriorityColor = (priority: string) => {
  switch (priority) {
    case '紧急': return '#ff4d4f';
    case '高': return '#ff7a45';
    case '中': return '#faad14';
    case '低': return '#52c41a';
    case '未指定': return '#d9d9d9';
    default: return '#d9d9d9';
  }
};

// 状态颜色映射
const getStatusColor = (status: string) => {
  switch (status) {
    case '待处理': return 'magenta';
    case '处理中': return 'blue';
    case '已解决': return 'green';
    case '已关闭': return 'default';
    default: return 'default';
  }
};

const BugManagementPage: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const { hasPermission } = usePermission();

  // 状态管理
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [bugList, setBugList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [labelsFilter, setLabelsFilter] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('list');
  const [analysisRefreshKey, setAnalysisRefreshKey] = useState(0);

  // 标签相关状态
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [labelsLoading, setLabelsLoading] = useState(false);

  // 配置相关状态
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [codingConfig, setCodingConfig] = useState<any>(null);

  // 详情相关状态
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [bugDetail, setBugDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 关联模块相关状态
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [selectedBugId, setSelectedBugId] = useState<number | null>(null);
  const [organizationTree, setOrganizationTree] = useState<any[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [currentBugLinks, setCurrentBugLinks] = useState<any[]>([]);



  // 删除相关状态
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 权限检查
  const canView = hasPermission(ROUTES.BUG_MANAGEMENT);
  const canSync = hasPermission(ROUTES.BUG_MANAGEMENT);
  const canConfig = hasPermission(ROUTES.BUG_MANAGEMENT);



  // 获取组织树
  const fetchOrganizationTree = async () => {
    try {
      const response = await request.get('/module-structures');
      if (response.data.success) {
        const tree = unwrapResponse(response.data) as any;
        // 处理响应数据格式，确保是数组
        const treeData = Array.isArray(tree) ? tree : (tree.items || []);
        console.log('获取到的组织树数据:', treeData); // 调试日志
        setOrganizationTree(treeData);
      } else {
        message.error('获取组织树失败');
      }
    } catch (error) {
      message.error('获取组织树失败');
    }
  };

  // 关联模块
  const handleLinkModule = async (codingBugId: number) => {
    setSelectedBugId(codingBugId);

    // 查找当前bug的关联信息
    const currentBug = bugList.find(bug => bug.coding_bug_id === codingBugId);
    const bugLinks = currentBug?.module_links || [];
    setCurrentBugLinks(bugLinks);

    // 如果已有关联，预选第一个关联的模块
    if (bugLinks.length > 0) {
      setSelectedModuleId(bugLinks[0].module_id);
    } else {
      setSelectedModuleId(null);
    }

    setLinkModalVisible(true);
    await fetchOrganizationTree();
  };

  // 确认关联
  const handleConfirmLink = async () => {
    if (!selectedBugId || !selectedModuleId) {
      message.warning('请选择要关联的模块');
      return;
    }

    setLinkLoading(true);
    try {
      // 检查是否已经关联到选中的模块
      const alreadyLinked = currentBugLinks.some(link => link.module_id === selectedModuleId);

      if (alreadyLinked) {
        message.info('该缺陷已关联到此模块');
        setLinkModalVisible(false);
        setSelectedBugId(null);
        setSelectedModuleId(null);
        setCurrentBugLinks([]);
        return;
      }

      // 创建关联（后端会自动处理一对一关系，删除旧关联）
      const response = await request.post('/coding-bugs/link-module', {
        coding_bug_id: selectedBugId,
        module_id: selectedModuleId,
        manifestation_description: '' // 可以后续添加描述输入框
      });

      if (response.data.success) {
        message.success(currentBugLinks.length > 0 ? '修改关联成功' : '关联成功');
        setLinkModalVisible(false);
        setSelectedBugId(null);
        setSelectedModuleId(null);
        setCurrentBugLinks([]);
        // 刷新列表以更新关联状态
        fetchBugList();
      } else {
        message.error(response.data.message || '关联失败');
      }
    } catch (error) {
      message.error('操作失败');
    } finally {
      setLinkLoading(false);
    }
  };

  // 查看详情
  const handleViewDetail = async (codingBugId: number) => {
    setDetailLoading(true);
    setDetailModalVisible(true);

    try {
      const response = await request.post('/coding-bugs/get-detail', {
        coding_bug_id: codingBugId
      });

      if (response.data.success) {
        const detail = unwrapResponse(response.data);
        setBugDetail(detail);
      } else {
        message.error(response.data.message || '获取详情失败');
        setDetailModalVisible(false);
      }
    } catch (error) {
      message.error('获取详情失败');
      setDetailModalVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // 获取Coding配置
  const fetchCodingConfig = async () => {
    if (!currentWorkspace?.id) return;

    try {
      const response = await request.get(`/coding-bugs/config/${currentWorkspace.id}`);
      if (response.data.success) {
        const config = unwrapResponse(response.data) as any;
        setCodingConfig(config); // config可能为null，表示未配置
      }
    } catch (error) {
      console.error('获取Coding配置失败:', error);
      // 配置获取失败时，设置为null
      setCodingConfig(null);
    }
  };

  // 单个删除缺陷
  const handleDeleteBug = async (codingBugId: number) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除这个缺陷吗？删除后无法恢复。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        setDeleteLoading(true);
        try {
          const response = await request.delete(`/coding-bugs/${codingBugId}`);
          if (response.data.success) {
            message.success('删除成功');
            fetchBugList();
            // 清除选中状态
            setSelectedRowKeys(selectedRowKeys.filter(key => key !== codingBugId));
          } else {
            message.error(response.data.message || '删除失败');
          }
        } catch (error) {
          message.error('删除失败');
        } finally {
          setDeleteLoading(false);
        }
      }
    });
  };

  // 批量删除缺陷
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的缺陷');
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除选中的 ${selectedRowKeys.length} 个缺陷吗？删除后无法恢复。`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        setDeleteLoading(true);
        try {
          const response = await request.post('/coding-bugs/batch-delete', {
            coding_bug_ids: selectedRowKeys
          });
          if (response.data.success) {
            message.success(`成功删除 ${selectedRowKeys.length} 个缺陷`);
            fetchBugList();
            setSelectedRowKeys([]);
          } else {
            message.error(response.data.message || '批量删除失败');
          }
        } catch (error) {
          message.error('批量删除失败');
        } finally {
          setDeleteLoading(false);
        }
      }
    });
  };

  // 获取可用标签
  const fetchAvailableLabels = async () => {
    if (!currentWorkspace?.id) return;

    setLabelsLoading(true);
    try {
      const response = await request.get('/coding-bugs/available-labels', {
        params: { workspace_id: currentWorkspace.id }
      });

      if (response.data.success) {
        const labels = unwrapResponse(response.data) as string[];
        setAvailableLabels(labels);
      } else {
        message.error(response.data.message || '获取标签失败');
      }
    } catch (error) {
      message.error('获取标签失败');
      console.error('获取可用标签失败:', error);
    } finally {
      setLabelsLoading(false);
    }
  };

  // 获取缺陷列表
  const fetchBugList = async () => {
    if (!currentWorkspace?.id || !canView) return;

    setLoading(true);
    try {
      const params = {
        workspace_id: currentWorkspace.id,
        page: currentPage,
        page_size: pageSize,
        keyword: searchKeyword || undefined,
        priority: priorityFilter === 'ALL' ? undefined : priorityFilter,
        status_name: statusFilter === 'ALL' ? undefined : statusFilter,
        labels: labelsFilter.length > 0 ? labelsFilter.join(',') : undefined
      };

      const response = await request.get('/coding-bugs/', { params });

      if (response.data.success) {
        const data = unwrapResponse(response.data) as any;
        console.log('分页数据调试:', {
          page: currentPage,
          pageSize: pageSize,
          itemsCount: data.items?.length || 0,
          total: data.total,
          dataKeys: Object.keys(data || {})
        });
        setBugList(data.items || []);
        setTotal(data.total || 0);
      } else {
        message.warning(response.data.message || '获取缺陷列表失败');
        setBugList([]);
        setTotal(0);
      }
    } catch (error) {
      message.error('获取缺陷列表失败');
      setBugList([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // 从Coding同步数据
  const handleSyncFromCoding = async () => {
    if (!currentWorkspace?.id || !canSync) return;

    setSyncing(true);
    try {
      const response = await request.post('/coding-bugs/sync-from-coding', {
        workspace_id: currentWorkspace.id,
        force_sync: true
      });

      if (response.data.success) {
        const result = unwrapResponse(response.data);
        message.success(`同步成功！新增 ${result.created_count} 个，更新 ${result.updated_count} 个缺陷`);
        fetchBugList(); // 重新获取列表
      } else {
        message.error(response.data.message || '同步失败');
      }
    } catch (error) {
      message.error('同步失败，请检查Coding配置');
    } finally {
      setSyncing(false);
    }
  };





  // 初始化
  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchCodingConfig();
      fetchBugList();
      fetchAvailableLabels();
    }
  }, [currentWorkspace?.id, currentPage, pageSize]);

  // 搜索和筛选变化时重新获取数据
  useEffect(() => {
    if (currentWorkspace?.id) {
      setCurrentPage(1); // 重置到第一页
      fetchBugList();
    }
  }, [searchKeyword, priorityFilter, statusFilter, labelsFilter]);

  // 处理Tab切换
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    // 切换到数据分析页面时触发刷新
    if (key === 'analysis') {
      setAnalysisRefreshKey(prev => prev + 1);
    }
  };

  if (!canView) {
    return (
      <Card>
        <Empty description="您没有权限查看缺陷管理" />
      </Card>
    );
  }

  // 如果没有配置，显示配置界面
  if (codingConfig === null) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <ApiOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
            <Title level={3}>配置Coding同步</Title>
            <p style={{ color: '#666', marginBottom: '24px' }}>
              首次使用需要配置Coding平台的API连接信息和同步条件
            </p>
            <Button
              type="primary"
              size="large"
              onClick={() => setConfigModalVisible(true)}
            >
              立即配置
            </Button>
          </div>
        </Card>

        <CodingConfigModal
          visible={configModalVisible}
          onClose={() => setConfigModalVisible(false)}
          onSuccess={() => {
            setConfigModalVisible(false);
            fetchCodingConfig();
          }}
        />
      </div>
    );
  }

  // 表格列定义
  const columns = [
    {
      title: 'Coding编号',
      dataIndex: 'coding_bug_code',
      key: 'coding_bug_code',
      width: 120,
      render: (code: number) => (
        <Tag color="blue">#{code}</Tag>
      )
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title: string) => (
        <Tooltip title={title}>
          <span>{title}</span>
        </Tooltip>
      )
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: string) => (
        <Tag color={getPriorityColor(priority)} style={{ color: '#fff' }}>
          {priority}
        </Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status_name',
      key: 'status_name',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status}
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'coding_created_at',
      key: 'coding_created_at',
      width: 150,
      render: (timestamp: number) => formatDate(timestamp)
    },
    {
      title: '指派人',
      dataIndex: 'assignees',
      key: 'assignees',
      width: 120,
      render: (assignees: string[]) => (
        <div>
          {assignees?.slice(0, 2).map((assignee, index) => (
            <Tag key={index}>{assignee}</Tag>
          ))}
          {assignees?.length > 2 && <Tag>+{assignees.length - 2}</Tag>}
        </div>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (record: any) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => handleViewDetail(record.coding_bug_id)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => handleLinkModule(record.coding_bug_id)}
          >
            {record.module_links && record.module_links.length > 0 ? '修改关联' : '关联'}
          </Button>
          <Button
            type="link"
            size="small"
            danger
            onClick={() => handleDeleteBug(record.coding_bug_id)}
            loading={deleteLoading}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="bug-management-page">
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Title level={3}>
            <BugOutlined /> 缺陷管理
          </Title>

          {!codingConfig && (
            <Alert
              message="未配置Coding API"
              description="请先配置Coding API Token和项目名称，以便从Coding平台同步缺陷数据。"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              action={
                canConfig && (
                  <Button size="small" onClick={() => setConfigModalVisible(true)}>
                    立即配置
                  </Button>
                )
              }
            />
          )}
        </div>

        <Tabs activeKey={activeTab} onChange={handleTabChange}>
          <Tabs.TabPane tab="缺陷列表" key="list">
            <div style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Input
                    placeholder="搜索缺陷标题或描述"
                    prefix={<SearchOutlined />}
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    allowClear
                  />
                </Col>
                <Col span={3}>
                  <Select
                    placeholder="优先级"
                    value={priorityFilter === 'ALL' ? undefined : priorityFilter}
                    onChange={(value) => setPriorityFilter(value || 'ALL')}
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Option value="紧急">紧急</Option>
                    <Option value="高">高</Option>
                    <Option value="中">中</Option>
                    <Option value="低">低</Option>
                    <Option value="未指定">未指定</Option>
                  </Select>
                </Col>
                <Col span={3}>
                  <Select
                    placeholder="状态"
                    value={statusFilter === 'ALL' ? undefined : statusFilter}
                    onChange={(value) => setStatusFilter(value || 'ALL')}
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Option value="新">新</Option>
                    <Option value="待处理">待处理</Option>
                    <Option value="处理中">处理中</Option>
                    <Option value="已解决">已解决</Option>
                    <Option value="已关闭">已关闭</Option>
                  </Select>
                </Col>
                <Col span={4}>
                  <Select
                    mode="multiple"
                    placeholder="标签"
                    value={labelsFilter}
                    onChange={setLabelsFilter}
                    allowClear
                    style={{ width: '100%' }}
                    loading={labelsLoading}
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ||
                      (option?.value as string)?.toLowerCase().includes(input.toLowerCase())
                    }
                    maxTagCount="responsive"
                  >
                    {availableLabels.map(label => (
                      <Option key={label} value={label}>
                        {label}
                      </Option>
                    ))}
                  </Select>
                </Col>
                <Col span={8} style={{ textAlign: 'right' }}>
                  <Space>
                    <Button
                      onClick={fetchBugList}
                      loading={loading}
                    >
                      查询
                    </Button>
                    {canSync && codingConfig && (
                      <Button
                        type="primary"
                        loading={syncing}
                        onClick={handleSyncFromCoding}
                      >
                        从Coding同步
                      </Button>
                    )}
                    {canConfig && (
                      <Button
                        onClick={() => setConfigModalVisible(true)}
                      >
                        Coding同步配置
                      </Button>
                    )}
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      loading={deleteLoading}
                      disabled={selectedRowKeys.length === 0}
                      onClick={handleBatchDelete}
                    >
                      批量删除 {selectedRowKeys.length > 0 && `(${selectedRowKeys.length})`}
                    </Button>
                  </Space>
                </Col>
              </Row>
            </div>

            <Table
              columns={columns}
              dataSource={bugList}
              rowKey="coding_bug_id"
              loading={loading}
              rowSelection={{
                selectedRowKeys,
                onChange: (selectedRowKeys: React.Key[]) => {
                  setSelectedRowKeys(selectedRowKeys);
                },
                getCheckboxProps: (record: any) => ({
                  disabled: deleteLoading, // 删除时禁用选择
                }),
              }}
              pagination={{
                current: currentPage,
                pageSize: pageSize,
                total: total,
                showSizeChanger: true,
                showQuickJumper: total > pageSize, // 只有在确实有多页时才显示快速跳转
                showTotal: (total, range) => {
                  if (total === 0) return '暂无数据';
                  if (total <= pageSize) return `共 ${total} 条`;
                  return `第 ${range[0]}-${range[1]} 条，共 ${total} 条`;
                },
                onChange: (page, size) => {
                  setCurrentPage(page);
                  setPageSize(size || 20);
                },
                // 如果总数看起来不准确，隐藏一些分页控件
                hideOnSinglePage: false
              }}
              locale={{
                emptyText: codingConfig ? '暂无缺陷数据' : '请先配置Coding API'
              }}
            />
          </Tabs.TabPane>

          <Tabs.TabPane tab="数据分析" key="analysis">
            <BugAnalysisPage key={analysisRefreshKey} />
          </Tabs.TabPane>
        </Tabs>
      </Card>

      {/* 使用统一的配置组件 */}
      <CodingConfigModal
        visible={configModalVisible}
        onClose={() => setConfigModalVisible(false)}
        onSuccess={() => {
          setConfigModalVisible(false);
          fetchCodingConfig();
        }}
      />

      {/* 缺陷详情弹窗 */}
      <Modal
        title="缺陷详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setBugDetail(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setDetailModalVisible(false);
            setBugDetail(null);
          }}>
            关闭
          </Button>
        ]}
        width={1200}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>加载中...</div>
          </div>
        ) : bugDetail ? (
          <div>
            <Descriptions
              title="基本信息"
              bordered
              column={2}
              size="small"
              style={{ marginBottom: 24 }}
              labelStyle={{
                width: '120px',
                whiteSpace: 'nowrap',
                textAlign: 'left'
              }}
              contentStyle={{
                minWidth: '200px'
              }}
            >
              <Descriptions.Item label="缺陷编号" span={2}>
                {bugDetail.coding_bug_code}
              </Descriptions.Item>
              <Descriptions.Item label="标题" span={2}>
                {bugDetail.title}
              </Descriptions.Item>
              <Descriptions.Item label="优先级">
                <Tag color={getPriorityColor(bugDetail.priority)} style={{ color: '#fff' }}>
                  {bugDetail.priority}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={getStatusColor(bugDetail.status_name)}>
                  {bugDetail.status_name}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatDate(bugDetail.coding_created_at)}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {formatDate(bugDetail.coding_updated_at)}
              </Descriptions.Item>
              <Descriptions.Item label="项目名称">
                {bugDetail.project_name}
              </Descriptions.Item>
              <Descriptions.Item label="迭代">
                {bugDetail.iteration_name || '未指定'}
              </Descriptions.Item>
              <Descriptions.Item label="指派人" span={2}>
                {bugDetail.assignees?.length > 0 ? (
                  <Space wrap>
                    {bugDetail.assignees.map((assignee: string, index: number) => (
                      <Tag key={index}>{assignee}</Tag>
                    ))}
                  </Space>
                ) : '未指派'}
              </Descriptions.Item>
              <Descriptions.Item label="标签" span={2}>
                {bugDetail.labels?.length > 0 ? (
                  <Space wrap>
                    {bugDetail.labels.map((label: string, index: number) => (
                      <Tag key={index} color="blue">{label}</Tag>
                    ))}
                  </Space>
                ) : '无标签'}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                <div style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  padding: '8px',
                  backgroundColor: '#fafafa',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px'
                }}>
                  {bugDetail.description || '无描述'}
                </div>
              </Descriptions.Item>
            </Descriptions>

            {/* 模块关联信息 */}
            {bugDetail.module_links && bugDetail.module_links.length > 0 && (
              <div>
                <h4>关联模块</h4>
                <List
                  size="small"
                  bordered
                  dataSource={bugDetail.module_links}
                  renderItem={(link: any) => (
                    <List.Item>
                      <div>
                        <strong>模块：</strong>{link.module_name || '未知模块'}
                        {link.manifestation_description && (
                          <div style={{ marginTop: 4, color: '#666' }}>
                            <strong>表现描述：</strong>{link.manifestation_description}
                          </div>
                        )}
                      </div>
                    </List.Item>
                  )}
                />
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div>暂无详情数据</div>
          </div>
        )}
      </Modal>

      {/* 关联模块弹窗 */}
      <Modal
        title={currentBugLinks.length > 0 ? "修改模块关联" : "关联模块"}
        open={linkModalVisible}
        onCancel={() => {
          setLinkModalVisible(false);
          setSelectedBugId(null);
          setSelectedModuleId(null);
          setCurrentBugLinks([]);
        }}
        onOk={handleConfirmLink}
        confirmLoading={linkLoading}
        width={600}
      >
        <div style={{ marginBottom: 12 }}>
          {currentBugLinks.length > 0 && (
            <Alert
              message={`当前已关联到：${currentBugLinks.map(link => link.module_name).join(', ')}`}
              type="warning"
              showIcon
              style={{
                marginBottom: 8,
                padding: '8px 12px',
                fontSize: '12px'
              }}
            />
          )}
          <Alert
            message="请选择要关联的内容模块（节点模块不可选择）"
            type="info"
            showIcon
            style={{
              marginBottom: 8,
              padding: '8px 12px',
              fontSize: '12px'
            }}
          />
        </div>

        {organizationTree.length > 0 ? (
          <Tree
            treeData={organizationTree}
            onSelect={(selectedKeys, info) => {
              console.log('选中的节点:', info.node); // 调试日志
              console.log('selectedKeys:', selectedKeys); // 调试选中的keys
              if (selectedKeys.length > 0) {
                // 检查节点类型，只允许选择内容模块
                if (info.node.is_content_page === true) {
                  const moduleId = Number(selectedKeys[0]);
                  setSelectedModuleId(moduleId);
                  console.log('选中内容模块ID:', moduleId);
                } else {
                  setSelectedModuleId(null);
                  message.warning('只能选择内容模块，节点模块不可选择');
                }
              } else {
                setSelectedModuleId(null);
              }
            }}
            selectedKeys={selectedModuleId ? [selectedModuleId] : []}
            selectable={true}
            titleRender={(nodeData: any) => {
              const isContentModule = nodeData.is_content_page === true;
              const isLinked = currentBugLinks.some(link => link.module_id === nodeData.id);

              return (
                <div className="module-tree-node">
                  <div className="module-tree-node-info">
                    <span
                      className="module-tree-node-name"
                      style={{
                        color: isLinked ? '#52c41a' : (isContentModule ? '#262626' : '#999'),
                        fontWeight: isLinked ? '600' : 'normal'
                      }}
                    >
                      {nodeData.name}
                      {isLinked && (
                        <span style={{
                          marginLeft: '6px',
                          fontSize: '10px',
                          color: '#52c41a',
                          opacity: 0.8
                        }}>
                          ●
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              );
            }}
            showIcon={true}
            icon={(props: any) => {
              const isContentModule = props.is_content_page === true;
              return isContentModule ? <FileTextOutlined /> : <FolderOutlined />;
            }}
            fieldNames={{
              title: 'name',
              key: 'id',
              children: 'children'
            }}
            className="module-health-tree"
            style={{
              maxHeight: '400px',
              overflow: 'auto'
            }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>加载组织树中...</div>
          </div>
        )}
      </Modal>

    </div>
  );
};

export default BugManagementPage;