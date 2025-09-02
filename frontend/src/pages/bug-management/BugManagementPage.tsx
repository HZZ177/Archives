import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Typography, Button, Input, Space, Table, Tag, Select, Modal, Form, message, Popconfirm, Row, Col, Badge, Divider, TreeSelect, Spin, Timeline, Tabs, Descriptions, Tree } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined, ExclamationCircleOutlined, FileTextOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { usePermission } from '../../contexts/PermissionContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { BugProfileResponse, BugSeverity, BugStatus, BugListParams, BugProfileCreate, BugProfileUpdate, SEVERITY_OPTIONS, STATUS_OPTIONS, BugLogResponse, BugAnalysisResponse } from '../../types/bug';
import { ModuleStructure } from '../../types/module';
import { unwrapResponse } from '../../utils/request';
import request from '../../utils/request';
import '../module-content/components/sections/SectionStyles.css';


const { Title } = Typography;
const { Option } = Select;

// 格式化日期显示
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// 检查节点下是否有内容页面节点
const hasContentPageDescendant = (node: ModuleStructure): boolean => {
  if (node.is_content_page) return true;
  if (node.children && node.children.length > 0) {
    return node.children.some(child => hasContentPageDescendant(child));
  }
  return false;
};

// 构建模块树形数据（用于TreeSelect）
const buildModuleTree = (modules: ModuleStructure[]): any[] => {
  return modules.map(module => {
    const hasContentPage = hasContentPageDescendant(module);
    return {
      title: module.name,
      value: module.id,
      key: module.id,
      children: module.children ? buildModuleTree(module.children) : undefined,
      // 只有内容页面节点可以被选择
      disabled: !module.is_content_page
    };
  });
};

// 构建模块树形数据（用于Tree组件，带样式）
const buildModuleTreeWithStyle = (modules: ModuleStructure[]): any[] => {
  return modules.map(module => {
    const hasContentPage = hasContentPageDescendant(module);
    return {
      title: module.name,
      key: module.id.toString(),
      children: module.children ? buildModuleTreeWithStyle(module.children) : undefined,
      icon: module.is_content_page
        ? <span className="custom-tree-icon file-icon"><FileTextOutlined /></span>
        : <span className="custom-tree-icon folder-icon"><FolderOpenOutlined /></span>,
      className: module.is_content_page
        ? 'content-node'
        : hasContentPage
          ? 'structure-node'
          : 'empty-structure-node',
      // 只有内容页面节点可以被选择
      disabled: !module.is_content_page,
      isContentPage: module.is_content_page,
      hasContentPage: hasContentPage,
      moduleId: module.id
    };
  });
};



const BugManagementPage: React.FC = () => {
  const { hasPermission } = usePermission();
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  
  // 状态管理
  const [searchKeyword, setSearchKeyword] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [bugList, setBugList] = useState<BugProfileResponse[]>([]);
  const [total, setTotal] = useState(0);
  
  // 模态框状态
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editModalLoading, setEditModalLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentBug, setCurrentBug] = useState<BugProfileResponse | null>(null);
  const [bugLogs, setBugLogs] = useState<BugLogResponse[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  
  // 表单实例
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [logForm] = Form.useForm();
  
  // 模块相关状态
  const [moduleList, setModuleList] = useState<ModuleStructure[]>([]);
  const [moduleLoading, setModuleLoading] = useState(false);
  const canAnalyze = hasPermission('/workspaces/bug-management/analysis');

  // 分析相关状态
  const [activeTab, setActiveTab] = useState('list');
  const [analysisData, setAnalysisData] = useState<BugAnalysisResponse | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // 分析树：根据模块结构渲染健康分
  const getHealthColor = (score: number | undefined) => {
    if (score === undefined || score === null) return '#d9d9d9';
    if (score >= 85) return '#52c41a'; // 绿
    if (score >= 70) return '#a0d911'; // 黄绿
    if (score >= 50) return '#faad14'; // 橙
    return '#ff4d4f'; // 红
  };

  const buildAnalysisTreeData = () => {
    if (!analysisData) return [] as any[];
    const scoreMap = new Map<number, number>();
    analysisData.module_health_scores.forEach(s => scoreMap.set(s.module_id, s.health_score));

    const mapNode = (node: ModuleStructure): any => {
      const score = scoreMap.get(node.id);
      const color = getHealthColor(score);
      const title = (
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', border: '1px solid #f0f0f0', borderRadius: 6 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 8, backgroundColor: color, marginRight: 8 }} />
          <span style={{ marginRight: 8 }}>{node.name}</span>
          {score !== undefined && (
            <Typography.Text type="secondary">{Math.round(score)} 分</Typography.Text>
          )}
        </span>
      );
      return {
        key: node.id,
        title,
        children: node.children ? node.children.map(mapNode) : undefined
      };
    };

    return moduleList.map(mapNode);
  };

  const fetchAnalysisData = async () => {
    if (!currentWorkspace?.id) return;
    
    setAnalysisLoading(true);
    try {
      const response = await request.post('/bugs/analysis', { 
        workspace_id: currentWorkspace.id,
        analysis_type: 'overview'
      });
      const data = unwrapResponse(response.data) as BugAnalysisResponse;
      setAnalysisData(data);
    } catch (error) {
      message.error('获取分析数据失败');
      setAnalysisData(null);
    } finally {
      setAnalysisLoading(false);
    }
  };

  // 权限检查 - 只需要页面权限即可
  const hasPagePermission = hasPermission('/workspaces/bug-management');
  const canCreate = hasPagePermission;
  const canEdit = hasPagePermission;
  const canDelete = hasPagePermission;
  const canView = hasPagePermission;

  // 表格列定义
  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: BugProfileResponse) => (
        <Button 
          type="link" 
          style={{ padding: 0, height: 'auto' }}
          onClick={() => handleViewBug(record)}
        >
          {text}
        </Button>
      )
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: BugSeverity) => {
        const color = severity === 'CRITICAL' ? 'red' : 
                     severity === 'HIGH' ? 'orange' : 
                     severity === 'MEDIUM' ? 'gold' : 'green';
        const text = severity === 'CRITICAL' ? '严重' :
                    severity === 'HIGH' ? '高' :
                    severity === 'MEDIUM' ? '中' : '低';
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: BugStatus | string | undefined) => {
        const raw = (status ?? '').toString();
        const upper = raw.toUpperCase();
        const statusOption = STATUS_OPTIONS.find(option => option.value === upper) 
          || STATUS_OPTIONS.find(option => option.value === raw as any);
        const label = statusOption?.label || (raw || '-');
        const color = statusOption?.color || undefined;
        return <Tag color={color}>{label}</Tag>;
      }
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 150,
      render: (tags: string[]) => (
        <div>
          {tags?.slice(0, 2).map(tag => (
            <Tag key={tag}>{tag}</Tag>
          ))}
          {tags && tags.length > 2 && (
            <Tag>+{tags.length - 2}</Tag>
          )}
        </div>
      )
    },
    {
      title: '发生次数',
      dataIndex: 'occurrence_count',
      key: 'occurrence_count',
      width: 100,
      render: (count: number) => (
        <span style={{ color: count > 0 ? '#1890ff' : '#999' }}>{count || 0}</span>
      )
    },
    {
      title: '最后发生',
      dataIndex: 'last_occurrence',
      key: 'last_occurrence',
      width: 150,
      render: (date: string) => date ? formatDate(date) : '-'
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date: string) => formatDate(date)
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: any, record: BugProfileResponse) => (
        <Space size="small">
          <Button 
            type="text" 
            icon={<EyeOutlined />} 
            size="small" 
            onClick={() => handleViewBug(record)}
            title="查看详情"
          />
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            size="small" 
            disabled={!canEdit}
            onClick={() => handleEditBug(record)}
            title={!canEdit ? '无编辑权限' : '编辑'}
          />
          <Popconfirm
            title="确定要删除这个Bug吗？"
            description="删除后无法恢复，请谨慎操作。"
            onConfirm={() => handleDeleteBug(record.id)}
            okText="确定"
            cancelText="取消"
            icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
          >
            <Button 
              type="text" 
              icon={<DeleteOutlined />} 
              size="small" 
              danger 
              disabled={!canDelete}
              title={!canDelete ? '无删除权限' : '删除'}
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 处理函数
  const fetchBugLogs = async (bugId: number) => {
    setLogsLoading(true);
    try {
      const response = await request.post('/bugs/get-logs', { bug_id: bugId, page_size: 100 });
      const data = unwrapResponse(response.data) as any;
      setBugLogs(data.items || []);
    } catch (error) {
      message.error('获取发生历史失败');
      setBugLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleViewBug = async (bug: BugProfileResponse) => {
    setDetailModalVisible(true);
    // 获取详情（包含 module_links）
    try {
      const detailResp = await request.post('/bugs/get-detail', { bug_id: bug.id });
      const bugDetail = unwrapResponse(detailResp.data) as any;
      setCurrentBug(bugDetail);
    } catch (e) {
      setCurrentBug(bug);
    }
    fetchBugLogs(bug.id);
  };

  const handleLogOccurrence = async (values: { notes?: string; module_id: number }) => {
    if (!currentBug) return;
    setLogSubmitting(true);
    try {
      const resp = await request.post('/bugs/log-occurrence', {
        bug_id: currentBug.id,
        notes: values.notes || undefined,
        module_id: values.module_id
      });
      unwrapResponse(resp.data);
      message.success('已记录一次发生');

      // 清理表单并关闭弹窗
      setLogModalVisible(false);
      logForm.resetFields();

      // 刷新时间线、当前Bug详情与列表
      await fetchBugLogs(currentBug.id);
      const detailResp = await request.post('/bugs/get-detail', { bug_id: currentBug.id });
      const bugDetail = unwrapResponse(detailResp.data) as any;
      setCurrentBug(bugDetail);
      fetchBugList();
    } catch (error) {
      message.error('记录失败：' + (error as Error).message);
    } finally {
      setLogSubmitting(false);
    }
  };

    const [originalModuleIds, setOriginalModuleIds] = useState<number[]>([]);

  const handleEditBug = async (bug: BugProfileResponse) => {
    setCurrentBug(bug);
    setEditModalVisible(true);
    setEditModalLoading(true);
    try {
      const response = await request.post('/bugs/get-detail', { bug_id: bug.id });
      const bugDetail = unwrapResponse(response.data) as any;
      const moduleIds = bugDetail.module_links.map((link: any) => link.module_id);
      setOriginalModuleIds(moduleIds); // 保留但编辑不再处理关联
      editForm.setFieldsValue({
        title: bugDetail.title,
        description: bugDetail.description,
        severity: bugDetail.severity,
        status: bugDetail.status,
        tags: bugDetail.tags
      });
    } catch (error) {
      message.error('获取Bug详情失败');
    } finally {
      setEditModalLoading(false);
    }
  };

  const handleDeleteBug = async (bugId: number) => {
    try {
      const response = await request.post('/bugs/delete', { bug_id: bugId });
      if (response.data && response.data.success) {
        message.success(response.data.message || 'Bug删除成功');
      } else {
        message.error(response.data?.message || '删除失败');
        return;
      }
      fetchBugList();
    } catch (error) {
      message.error('删除失败：' + (error as Error).message);
    }
  };

  const handleCreateBug = async (values: BugProfileCreate) => {
    try {
      const response = await request.post('/bugs/', values);
      unwrapResponse(response.data);
      message.success('Bug创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      fetchBugList();
    } catch (error) {
      message.error('创建失败：' + (error as Error).message);
    }
  };

  const handleUpdateBug = async (values: any) => {
    if (!currentBug) return;

    try {
      // 仅更新核心信息
      await request.post('/bugs/update', { bug_id: currentBug.id, data: values });

      message.success('Bug更新成功');
      setEditModalVisible(false);
      fetchBugList(); // 刷新列表

      // 强制刷新当前Bug的详情，确保数据一致性
      const response = await request.post('/bugs/get-detail', { bug_id: currentBug.id });
      const bugDetail = unwrapResponse(response.data) as any;
      setCurrentBug(bugDetail);

    } catch (error) {
      message.error('更新失败：' + (error as Error).message);
    }
  };

  const fetchBugList = async () => {
    if (!currentWorkspace?.id) return;
    
    setLoading(true);
    try {
      const params: BugListParams = {
        workspace_id: currentWorkspace.id,
        page: currentPage,
        page_size: pageSize,
        keyword: searchKeyword || undefined,
        severity: severityFilter === 'ALL' ? undefined : (severityFilter as BugSeverity),
        status: statusFilter === 'ALL' ? undefined : (statusFilter as BugStatus)
      };
      
      const response = await request.get('/bugs/', { params });
      
      if (!response.data.success) {
        message.error(response.data.message || '获取Bug列表失败');
        setLoading(false);
        return;
      }
      
      const data = unwrapResponse(response.data) as any;
      const normalizeStatus = (raw: any): BugStatus | string | undefined => {
        if (!raw && raw !== 0) return undefined;
        const str = String(raw).trim();
        // 直接匹配英文枚举
        const upper = str.toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_');
        const direct = ['OPEN','IN_PROGRESS','RESOLVED','CLOSED'].includes(upper) ? upper as BugStatus : undefined;
        if (direct) return direct;
        // 中文标签映射
        if (str === '待处理') return BugStatus.OPEN;
        if (str === '处理中') return BugStatus.IN_PROGRESS;
        if (str === '已解决') return BugStatus.RESOLVED;
        if (str === '已关闭') return BugStatus.CLOSED;
        return str; // 保留原值以便前端显示
      };

      const items = (data.items || []).map((it: any) => {
        const rawStatus = it.status ?? it.bug_status ?? it.state ?? it.current_status;
        const normalized = normalizeStatus(rawStatus);
        return { ...it, status: normalized } as BugProfileResponse;
      });
      setBugList(items);
      setTotal(data.total);
    } catch (error) {
      message.error('获取Bug列表失败：' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 获取模块列表
  const fetchModuleList = async () => {
    if (!currentWorkspace?.id) return;
    
    setModuleLoading(true);
    try {
      const response = await request.get('/module-structures', {
        params: { workspace_id: currentWorkspace.id }
      });
      
      if (response.data.success) {
        const data = unwrapResponse(response.data) as any;
        setModuleList(data.items || []);
      }
    } catch (error) {
      console.error('获取模块列表失败:', error);
    } finally {
      setModuleLoading(false);
    }
  };

  // 初始数据加载
  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchBugList();
      fetchModuleList();
    }
  }, [currentWorkspace?.id]);

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Title level={2}>缺陷管理</Title>

        <Tabs activeKey={activeTab} onChange={(key) => {
          setActiveTab(key);
          if (key === 'analysis') {
            fetchAnalysisData();
          }
        }}>
          <Tabs.TabPane tab="缺陷列表" key="list">
            {/* 搜索和筛选区域 */}
            <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索Bug标题或描述"
            prefix={<SearchOutlined />}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{ width: 300 }}
            allowClear
            onPressEnter={() => fetchBugList()}
          />
          <Select
            placeholder="严重程度"
            value={severityFilter}
            onChange={setSeverityFilter}
            style={{ width: 120 }}
          >
            <Option value="ALL">全部</Option>
            <Option value="CRITICAL">严重</Option>
            <Option value="HIGH">高</Option>
            <Option value="MEDIUM">中</Option>
            <Option value="LOW">低</Option>
          </Select>
          <Select
            placeholder="状态"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 120 }}
          >
            <Option value="ALL">全部</Option>
            {STATUS_OPTIONS.map(option => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
          <Button 
            type="primary" 
            icon={<SearchOutlined />}
            onClick={fetchBugList}
            loading={loading}
          >
            查询
          </Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            disabled={!canCreate}
            title={!canCreate ? '无创建权限' : '新建Bug'}
            onClick={() => setCreateModalVisible(true)}
          >
            新建Bug
          </Button>
        </Space>
        
        {/* Bug列表表格 */}
        <Table
          columns={columns}
          dataSource={bugList}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size || 10);
              // 分页时重新查询
              setTimeout(() => fetchBugList(), 0);
            }
          }}
        />
          </Tabs.TabPane>
          {canAnalyze && (
            <Tabs.TabPane tab="数据分析" key="analysis">
              <Spin spinning={analysisLoading} tip="分析中...">
                {analysisData ? (
                  <div>
                    <Title level={4} style={{ marginBottom: 8 }}>模块健康分（结构树）</Title>
                    <Tree
                      treeData={buildAnalysisTreeData()}
                      defaultExpandAll
                      selectable={false}
                      style={{ marginBottom: 16 }}
                    />
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
                      <strong>评分规则：</strong><br/>
                      <strong>内容节点：</strong>健康分 = max(0, 100 − 总扣分)<br/>
                      • 严重程度分数：CRITICAL=10分，HIGH=8分，MEDIUM=5分，LOW=1分<br/>
                      • 时间衰减系数：距今0天=1.0，距今30天=0.0，线性衰减<br/>
                      • 扣分计算：每次发生单独计算（严重程度分数 × 时间衰减系数），然后累加<br/>
                      <strong>结构节点：</strong>由子节点聚合计算<br/>
                      • 有Bug时：按Bug数量加权平均子节点健康分<br/>
                      • 无Bug时：简单平均子节点健康分<br/>
                      • Bug统计：直接累加子节点Bug数量
                    </Typography.Paragraph>
                    <Table
                      dataSource={analysisData.module_health_scores}
                      rowKey="module_id"
                      columns={[
                        { title: '模块名称', dataIndex: 'module_name', key: 'module_name' },
                        { title: '健康分', dataIndex: 'health_score', key: 'health_score', sorter: (a, b) => a.health_score - b.health_score },
                        { title: '严重问题', dataIndex: 'critical_count', key: 'critical_count', sorter: (a, b) => a.critical_count - b.critical_count },
                        { title: '高危问题', dataIndex: 'high_count', key: 'high_count', sorter: (a, b) => a.high_count - b.high_count },
                        { title: '中等问题', dataIndex: 'medium_count', key: 'medium_count', sorter: (a, b) => a.medium_count - b.medium_count },
                        { title: '低危问题', dataIndex: 'low_count', key: 'low_count', sorter: (a, b) => a.low_count - b.low_count },
                      ]}
                      pagination={false}
                    />
                  </div>
                ) : <p>暂无分析数据</p>}
              </Spin>
            </Tabs.TabPane>
          )}
        </Tabs>
      </Card>

      {/* 创建Bug模态框 */}
      <Modal
        title="创建Bug档案"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateBug}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="title"
                label="Bug标题"
                rules={[{ required: true, message: '请输入Bug标题' }]}
              >
                <Input placeholder="请输入Bug标题" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="severity"
                label="严重程度"
                rules={[{ required: true, message: '请选择严重程度' }]}
              >
                <Select placeholder="请选择严重程度">
                  {SEVERITY_OPTIONS.map(option => (
                    <Select.Option key={option.value} value={option.value}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label="状态"
                initialValue={BugStatus.OPEN}
                rules={[{ required: true, message: '请选择状态' }]}
              >
                <Select placeholder="请选择状态">
                  {STATUS_OPTIONS.map(option => (
                    <Select.Option key={option.value} value={option.value}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          
          <Form.Item
            name="description"
            label="Bug描述"
          >
            <Input.TextArea 
              rows={4} 
              placeholder="请描述Bug的详细情况"
            />
          </Form.Item>
          
          <Form.Item
            name="tags"
            label="标签"
          >
            <Select
              mode="tags"
              placeholder="请输入标签，按回车确认"
              style={{ width: '100%' }}
            />
          </Form.Item>
          
          {/* 关联模块选择已迁移到“记录一次发生”流程中 */}
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
              <Button onClick={() => {
                setCreateModalVisible(false);
                createForm.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑Bug模态框 */}
      <Modal
        title="编辑Bug档案"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          editForm.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Spin spinning={editModalLoading} tip="加载中...">
          <Form
          form={editForm}
          layout="vertical"
          onFinish={handleUpdateBug}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="title"
                label="Bug标题"
                rules={[{ required: true, message: '请输入Bug标题' }]}
              >
                <Input placeholder="请输入Bug标题" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="severity"
                label="严重程度"
                rules={[{ required: true, message: '请选择严重程度' }]}
              >
                <Select placeholder="请选择严重程度">
                  {SEVERITY_OPTIONS.map(option => (
                    <Select.Option key={option.value} value={option.value}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label="状态"
                initialValue={BugStatus.OPEN}
                rules={[{ required: true, message: '请选择状态' }]}
              >
                <Select placeholder="请选择状态">
                  {STATUS_OPTIONS.map(option => (
                    <Select.Option key={option.value} value={option.value}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item
            name="description"
            label="Bug描述"
          >
            <Input.TextArea 
              rows={4} 
              placeholder="请描述Bug的详细情况"
            />
          </Form.Item>
          
          <Form.Item
            name="tags"
            label="标签"
          >
            <Select
              mode="tags"
              placeholder="请输入标签，按回车确认"
              style={{ width: '100%' }}
            />
          </Form.Item>
          
          {/* 关联模块选择已迁移到“记录一次发生”流程中 */}
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                更新
              </Button>
              <Button onClick={() => {
                setEditModalVisible(false);
                editForm.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
        </Spin>
      </Modal>

      {/* Bug详情模态框 */}
      <Modal
        title="Bug详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="log" type="primary" onClick={() => setLogModalVisible(true)} disabled={!currentBug}>
            记录一次发生
          </Button>,
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {currentBug && (
          <div>
            <Descriptions
              column={2}
              size="middle"
              colon={false}
              labelStyle={{ width: 96, color: 'rgba(0,0,0,0.45)' }}
            >
              <Descriptions.Item label="标题" span={2}>
                <Typography.Text strong>{currentBug.title}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="严重程度">
                <Typography.Text>
                  {currentBug.severity === 'CRITICAL' ? '严重' : currentBug.severity === 'HIGH' ? '高' : currentBug.severity === 'MEDIUM' ? '中' : '低'}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Badge status={
                  currentBug.status === 'IN_PROGRESS' ? 'processing' :
                  currentBug.status === 'RESOLVED' ? 'success' :
                  currentBug.status === 'CLOSED' ? 'default' : 'default'
                } />
                <span style={{ marginLeft: 8 }}>
                  {STATUS_OPTIONS.find(o => o.value === currentBug.status)?.label}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="发生次数">
                {currentBug.occurrence_count}
              </Descriptions.Item>
              <Descriptions.Item label="最后发生">
                {currentBug.last_occurrence ? formatDate(currentBug.last_occurrence) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatDate(currentBug.created_at)}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {formatDate(currentBug.updated_at)}
              </Descriptions.Item>
              {currentBug.tags && currentBug.tags.length > 0 && (
                <Descriptions.Item label="标签" span={2}>
                  <Space wrap>
                    {currentBug.tags.map(tag => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </Space>
                </Descriptions.Item>
              )}
            </Descriptions>

            {currentBug.description && (
              <>
                <Divider />
                <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }}>
                  {currentBug.description}
                </Typography.Paragraph>
              </>
            )}

            {Array.isArray((currentBug as any).module_links) && (currentBug as any).module_links.length > 0 && (
              <>
                <Divider orientation="left">已关联模块</Divider>
                <Space wrap>
                  {(currentBug as any).module_links.map((link: any) => (
                    <Tag key={`${link.module_id}`}>{link.module_name || `模块 ${link.module_id}`}</Tag>
                  ))}
                </Space>
              </>
            )}

            <Divider orientation="left">发生历史</Divider>
            <Spin spinning={logsLoading} tip="加载中...">
              {bugLogs.length > 0 ? (
                <Timeline style={{ marginLeft: 8 }}>
                  {bugLogs.map(log => (
                    <Timeline.Item key={log.id}>
                      <Typography.Text>{formatDate(log.occurred_at)}</Typography.Text>
                      <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                        {log.module_name ? `（${log.module_name}）` : (log.module_id ? `（ID：${log.module_id}）` : '')}
                      </Typography.Text>
                      {log.notes && (
                        <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                          {log.notes}
                        </Typography.Paragraph>
                      )}
                    </Timeline.Item>
                  ))}
                </Timeline>
              ) : (
                <Typography.Text type="secondary">暂无发生记录</Typography.Text>
              )}
            </Spin>
          </div>
        )}
      </Modal>

      {/* 记录发生模态框 */}
      <Modal
        title="记录一次发生"
        open={logModalVisible}
        onCancel={() => {
          setLogModalVisible(false);
          logForm.resetFields();
          setSelectedModuleId(null);
        }}
        footer={null}
        width={520}
      >
        <Form form={logForm} layout="vertical" onFinish={handleLogOccurrence}>
          <Form.Item name="module_id" label="发生所在模块" rules={[{ required: true, message: '请选择发生所在模块' }]}>
            <div className="module-tree-container">
              <Tree
                treeData={buildModuleTreeWithStyle(moduleList)}
                selectable={true}
                showIcon={true}
                height={200}
                selectedKeys={selectedModuleId ? [selectedModuleId.toString()] : []}
                onSelect={(selectedKeys, info) => {
                  if (selectedKeys.length > 0 && !info.node.disabled) {
                    const moduleId = parseInt(selectedKeys[0].toString());
                    setSelectedModuleId(moduleId);
                    logForm.setFieldsValue({ module_id: moduleId });
                  } else {
                    setSelectedModuleId(null);
                    logForm.setFieldsValue({ module_id: undefined });
                  }
                }}
                className="modules-tree"
              />
            </div>
            <div className="select-help-text">
              <span className="custom-tree-icon file-icon" style={{ marginRight: 4, verticalAlign: 'middle' }}>
                <FileTextOutlined />
              </span>
              内容页面节点可选择，
              <span className="custom-tree-icon folder-icon" style={{ marginLeft: 8, marginRight: 4, verticalAlign: 'middle' }}>
                <FolderOpenOutlined />
              </span>
              结构节点不可选择
            </div>
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="可选，补充说明本次发生的情况" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={logSubmitting}>
                确认记录
              </Button>
              <Button onClick={() => {
                setLogModalVisible(false);
                logForm.resetFields();
                setSelectedModuleId(null);
              }} disabled={logSubmitting}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BugManagementPage;