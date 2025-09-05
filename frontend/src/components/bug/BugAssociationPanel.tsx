import React, { useState, useEffect } from 'react';
import {
  Card,
  List,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  Input,
  message,
  Popconfirm,
  Tooltip,
  Badge,
  Empty,
  Spin
} from 'antd';
import {
  BugOutlined,
  LinkOutlined,
  DisconnectOutlined,
  ExclamationCircleOutlined,
  SearchOutlined,
  SyncOutlined,
  EyeOutlined
} from '@ant-design/icons';
import '../../pages/module-content/components/sections/SectionStyles.css';

import { usePermission } from '../../contexts/PermissionContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { unwrapResponse } from '../../utils/request';
import request from '../../utils/request';

// 导入详情弹窗组件
import BugDetailModal from './BugDetailModal';

// 格式化日期显示
const formatDate = (timestamp: number) => {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// 优先级颜色映射
const getPriorityColor = (priority: string) => {
  switch (priority) {
    case '紧急': return '#ff4d4f';
    case '高': return '#ff7a45';
    case '中': return '#faad14';
    case '低': return '#52c41a';
    default: return '#d9d9d9';
  }
};

// 状态颜色映射
const getStatusColor = (status: string) => {
  switch (status) {
    case '新': return 'red';
    case '待处理': return 'magenta';
    case '处理中': return 'blue';
    case '已解决': return 'green';
    case '已关闭': return 'default';
    default: return 'default';
  }
};

interface BugAssociationPanelProps {
  moduleId: number;
  moduleName: string;
}

const BugAssociationPanel: React.FC<BugAssociationPanelProps> = ({
  moduleId,
  moduleName
}) => {
  const { hasPermission } = usePermission();
  const { currentWorkspace } = useWorkspace();

  // 状态管理
  const [loading, setLoading] = useState(false);
  const [bugList, setBugList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // 模态框状态
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [selectedBug, setSelectedBug] = useState<any | null>(null);

  // 详情弹窗状态
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailBug, setDetailBug] = useState<any | null>(null);

  // 搜索相关
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState<number | null>(null);

  // 弹窗中的缺陷列表状态
  const [modalBugList, setModalBugList] = useState<any[]>([]);
  const [modalCurrentPage, setModalCurrentPage] = useState(1);
  const [modalPageSize, setModalPageSize] = useState(10);
  const [modalTotal, setModalTotal] = useState(0);
  const [modalLoading, setModalLoading] = useState(false);

  // 权限检查
  const canView = hasPermission('/workspaces/bug-management');
  const canLink = hasPermission('/workspaces/bug-management');

  // 获取模块关联的Coding缺陷列表
  const fetchModuleBugs = async () => {
    if (!canView) return;

    setLoading(true);
    try {
      const response = await request.post('/coding-bugs/get-module-bugs', {
        module_id: moduleId,
        page: currentPage,
        page_size: pageSize
      });
      const data = unwrapResponse(response.data) as any;

      setBugList(data.items || []);
      setTotal(data.total || 0);
    } catch (error) {
      message.error('获取关联缺陷失败');
      console.error('获取关联缺陷失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取弹窗中的所有缺陷列表
  const fetchModalBugs = async (keyword: string = '') => {
    setModalLoading(true);
    try {
      const response = await request.get('/coding-bugs', {
        params: {
          page: modalCurrentPage,
          page_size: modalPageSize,
          keyword: keyword || undefined
        }
      });
      const data = unwrapResponse(response.data) as any;

      setModalBugList(data.items || []);
      setModalTotal(data.total || 0);
    } catch (error) {
      message.error('获取缺陷列表失败');
      console.error('获取缺陷列表失败:', error);
    } finally {
      setModalLoading(false);
    }
  };

  // 搜索Coding缺陷
  const searchBugs = async () => {
    if (!searchKeyword.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await request.get('/coding-bugs/', {
        params: {
          keyword: searchKeyword,
          workspace_id: currentWorkspace?.id,
          page: 1,
          page_size: 10
        }
      });
      const data = unwrapResponse(response.data) as any;
      setSearchResults(data.items || []);
    } catch (error) {
      message.error('搜索缺陷失败');
      console.error('搜索缺陷失败:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  // 检查缺陷是否已关联到当前模块
  const isAlreadyLinked = (codingBugId: number) => {
    return bugList.some(bug => bug.coding_bug_id === codingBugId);
  };

  // 关联Coding缺陷到模块
  const handleLinkBug = async (codingBugId: number, manifestationDescription?: string) => {
    setLinkLoading(codingBugId);
    try {
      const response = await request.post('/coding-bugs/link-module', {
        coding_bug_id: codingBugId,
        module_id: moduleId,
        manifestation_description: manifestationDescription || ''
      });
      unwrapResponse(response.data);
      message.success('缺陷关联成功');
      // 刷新已关联的缺陷列表
      fetchModuleBugs();
      // 刷新弹窗中的缺陷列表以更新关联状态
      fetchModalBugs(searchKeyword);
    } catch (error) {
      message.error('关联缺陷失败');
      console.error('关联缺陷失败:', error);
    } finally {
      setLinkLoading(null);
    }
  };

  // 强制关联（处理已被其他模块关联的缺陷）
  const handleForceLink = (bug: any) => {
    const linkedModules = bug.module_links?.map((link: any) => link.module_name).join('、') || '未知模块';

    Modal.confirm({
      title: '确认强制关联',
      content: (
        <div>
          <p>该缺陷已被以下模块关联：</p>
          <p style={{ color: '#fa8c16', fontWeight: 'bold' }}>{linkedModules}</p>
          <p>确定要变更关联到当前模块吗？</p>
          <p style={{ color: '#999', fontSize: '12px' }}>注意：此操作会取消与其他模块的关联关系</p>
        </div>
      ),
      okText: '确定关联',
      cancelText: '取消',
      okType: 'danger',
      onOk: () => {
        handleLinkBug(bug.coding_bug_id);
      }
    });
  };

  // 查看缺陷详情
  const handleViewDetail = (bug: any) => {
    setDetailBug(bug);
    setDetailModalVisible(true);
  };

  // 取消关联
  const handleUnlinkBug = async (codingBugId: number) => {
    setLinkLoading(codingBugId);
    try {
      const response = await request.post('/coding-bugs/unlink-from-module', {
        coding_bug_id: codingBugId,
        module_id: moduleId
      });
      unwrapResponse(response.data);
      message.success('取消关联成功');
      fetchModuleBugs();
    } catch (error) {
      message.error('取消关联失败');
      console.error('取消关联失败:', error);
    } finally {
      setLinkLoading(null);
    }
  };


  // 初始化
  useEffect(() => {
    if (canView) {
      fetchModuleBugs();
    }
  }, [moduleId, currentPage, pageSize, canView]);

  // 监听弹窗分页变化
  useEffect(() => {
    if (searchModalVisible) {
      fetchModalBugs(searchKeyword);
    }
  }, [modalCurrentPage, modalPageSize]);

  if (!canView) {
    return null;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <BugOutlined style={{ marginRight: 8, color: '#1890ff' }} />
          <span style={{ fontWeight: 600, fontSize: 16 }}>关联缺陷记录</span>
          <span style={{ marginLeft: '8px', color: total > 0 ? '#1890ff' : '#999', fontSize: '12px' }}>
            ({total || 0})
          </span>
        </div>
        <Space>
          {canLink && (
            <Tooltip title="关联Coding缺陷">
              <Button
                type="text"
                icon={<LinkOutlined />}
                onClick={() => {
                  setSearchModalVisible(true);
                  setModalCurrentPage(1);
                  setSearchKeyword('');
                  fetchModalBugs(); // 打开弹窗时立即加载缺陷列表
                }}
                size="small"
              >
                关联缺陷
              </Button>
            </Tooltip>
          )}
          <Tooltip title="同步最新数据">
            <Button
              type="text"
              icon={<SyncOutlined />}
              onClick={fetchModuleBugs}
              size="small"
              loading={loading}
            >
              刷新
            </Button>
          </Tooltip>
        </Space>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin />
        </div>
      ) : bugList.length === 0 ? (
        <Empty
          description="暂无关联的缺陷"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          dataSource={bugList}
          renderItem={(bug) => {
            return (
              <List.Item
                key={bug.coding_bug_id}
                actions={[
                  <Tooltip title="查看详情" key="view">
                    <Button
                      type="text"
                      icon={<EyeOutlined />}
                      onClick={() => handleViewDetail(bug)}
                      size="small"
                    />
                  </Tooltip>,
                  <Tooltip title="取消关联" key="unlink">
                    <Popconfirm
                      title="确定要取消关联这个缺陷吗？"
                      onConfirm={() => handleUnlinkBug(bug.coding_bug_id)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button
                        type="text"
                        icon={<DisconnectOutlined />}
                        danger
                        disabled={!canLink}
                        loading={linkLoading === bug.coding_bug_id}
                        size="small"
                      />
                    </Popconfirm>
                  </Tooltip>
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag color="blue">#{bug.coding_bug_code}</Tag>
                      <span style={{ fontSize: '14px' }}>{bug.title}</span>
                      <Tag color={getPriorityColor(bug.priority)} style={{ fontSize: '12px', color: '#fff' }}>
                        {bug.priority}
                      </Tag>
                      <Tag color={getStatusColor(bug.status_name)} style={{ fontSize: '12px' }}>
                        {bug.status_name}
                      </Tag>
                    </Space>
                  }
                  description={
                    <div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: 4 }}>
                        {bug.description && (
                          <div style={{ marginBottom: 4 }}>
                            {bug.description.length > 100
                              ? `${bug.description.substring(0, 100)}...`
                              : bug.description
                            }
                          </div>
                        )}
                        <span>创建时间: {formatDate(bug.coding_created_at)}</span>
                        {bug.assignees && bug.assignees.length > 0 && (
                          <span style={{ marginLeft: 16 }}>
                            指派人: {bug.assignees.slice(0, 2).join(', ')}
                            {bug.assignees.length > 2 && ` 等${bug.assignees.length}人`}
                          </span>
                        )}
                      </div>
                      {bug.labels && bug.labels.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          {bug.labels.slice(0, 3).map((label: string, index: number) => (
                            <Tag key={index} style={{ fontSize: '11px' }}>{label}</Tag>
                          ))}
                          {bug.labels.length > 3 && (
                            <Tag style={{ fontSize: '11px' }}>+{bug.labels.length - 3}</Tag>
                          )}
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            );
          }}
          pagination={
            total > pageSize ? {
              current: currentPage,
              pageSize: pageSize,
              total: total,
              size: 'small',
              showSizeChanger: false,
              showQuickJumper: false,
              showTotal: (total: number) => `共 ${total} 个`,
              onChange: (page: number) => setCurrentPage(page)
            } : false
          }
        />
      )}

      {/* 搜索Coding缺陷模态框 */}
      <Modal
        title="关联Coding缺陷"
        open={searchModalVisible}
        onCancel={() => {
          setSearchModalVisible(false);
          setSearchKeyword('');
          setSearchResults([]);
        }}
        footer={null}
        width={1100}
        style={{ maxHeight: '80vh' }}
        bodyStyle={{
          maxHeight: '70vh',
          overflowY: 'auto',
          padding: '24px'
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="搜索缺陷标题或描述"
            value={searchKeyword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchKeyword(e.target.value)}
            onSearch={(value) => {
              setModalCurrentPage(1);
              fetchModalBugs(value);
            }}
            loading={modalLoading}
            enterButton
          />
        </div>

        <List
          dataSource={modalBugList}
          loading={modalLoading}
          renderItem={(bug) => (
            <List.Item
              key={bug.coding_bug_id}
              actions={[
                isAlreadyLinked(bug.coding_bug_id) ? (
                  <Button
                    key="linked"
                    size="small"
                    disabled
                    style={{ color: '#52c41a', borderColor: '#52c41a' }}
                  >
                    已关联
                  </Button>
                ) : bug.module_links && bug.module_links.length > 0 ? (
                  <Button
                    key="force-link"
                    type="primary"
                    danger
                    size="small"
                    onClick={() => handleForceLink(bug)}
                    loading={linkLoading === bug.coding_bug_id}
                  >
                    强制关联
                  </Button>
                ) : (
                  <Button
                    key="link"
                    type="primary"
                    size="small"
                    onClick={() => handleLinkBug(bug.coding_bug_id)}
                    loading={linkLoading === bug.coding_bug_id}
                  >
                    关联
                  </Button>
                )
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Tag color="blue">#{bug.coding_bug_code}</Tag>
                    <span>{bug.title}</span>
                    <Tag color={getPriorityColor(bug.priority)} style={{ fontSize: '12px', color: '#fff' }}>
                      {bug.priority}
                    </Tag>
                    <Tag color={getStatusColor(bug.status_name)} style={{ fontSize: '12px' }}>
                      {bug.status_name}
                    </Tag>
                    {bug.module_links && bug.module_links.length > 0 && (
                      <Tag color="orange" style={{ fontSize: '11px' }}>
                        已关联: {bug.module_links.map((link: any) => link.module_name).join('、')}
                      </Tag>
                    )}
                  </Space>
                }
                description={
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {bug.description && (
                      <div style={{ marginBottom: 4 }}>
                        {bug.description.length > 100
                          ? `${bug.description.substring(0, 100)}...`
                          : bug.description
                        }
                      </div>
                    )}
                    <span>项目: {bug.project_name}</span>
                    <span style={{ marginLeft: 16 }}>创建时间: {formatDate(bug.coding_created_at)}</span>
                    {bug.assignees && bug.assignees.length > 0 && (
                      <span style={{ marginLeft: 16 }}>
                        指派人: {bug.assignees.slice(0, 2).join(', ')}
                        {bug.assignees.length > 2 && ` 等${bug.assignees.length}人`}
                      </span>
                    )}
                    {bug.labels && bug.labels.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        {bug.labels.slice(0, 3).map((label: string, index: number) => (
                          <Tag key={index}>{label}</Tag>
                        ))}
                      </div>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
          pagination={{
            current: modalCurrentPage,
            pageSize: modalPageSize,
            total: modalTotal,
            showSizeChanger: true,
            showQuickJumper: true,
            onChange: (page, size) => {
              setModalCurrentPage(page);
              if (size !== modalPageSize) {
                setModalPageSize(size);
              }
            },
            showTotal: (total) => `共 ${total} 条缺陷`
          }}
          locale={{
            emptyText: modalBugList.length === 0 && !modalLoading ?
              (searchKeyword ? '未找到相关缺陷' : '暂无缺陷数据') : undefined
          }}
        />
      </Modal>

      {/* 缺陷详情弹窗 */}
      <BugDetailModal
        visible={detailModalVisible}
        bug={detailBug}
        onClose={() => {
          setDetailModalVisible(false);
          setDetailBug(null);
        }}
      />
    </div>
  );
};

export default BugAssociationPanel;
