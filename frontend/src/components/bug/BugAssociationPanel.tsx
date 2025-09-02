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
  PlusOutlined,
  LinkOutlined,
  DisconnectOutlined,
  ExclamationCircleOutlined,
  SearchOutlined
} from '@ant-design/icons';

import { usePermission } from '../../contexts/PermissionContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import {
  BugProfileResponse,
  BugSeverity,
  BugLogListParams,
  SEVERITY_OPTIONS
} from '../../types/bug';
import { unwrapResponse } from '../../utils/request';
import request from '../../utils/request';

// 格式化日期显示
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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
  const [bugList, setBugList] = useState<BugProfileResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // 模态框状态
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [selectedBug, setSelectedBug] = useState<BugProfileResponse | null>(null);

  // 表单
  const [linkForm] = Form.useForm();
  const [logForm] = Form.useForm();

  // 搜索相关
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<BugProfileResponse[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // 权限检查
  const canView = hasPermission('workspace:resources:bugs:view');
  const canLink = hasPermission('workspace:resources:bugs:link');
  const canLog = hasPermission('workspace:resources:bugs:log');
  const canCreate = hasPermission('workspace:resources:bugs:create');

  // 获取模块关联的Bug列表
  const fetchModuleBugs = async () => {
    if (!canView) return;

    setLoading(true);
    try {
      const params: BugLogListParams = {
        page: currentPage,
        page_size: pageSize
      };

      const response = await request.post('/bugs/get-module-bugs', { module_id: moduleId, ...params });
      const data = unwrapResponse(response.data);
      
      setBugList(data.items);
      setTotal(data.total);
    } catch (error) {
      message.error('获取关联Bug失败');
      console.error('获取关联Bug失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 搜索Bug
  const searchBugs = async () => {
    if (!searchKeyword.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await request.get('/bugs/', {
        params: {
          keyword: searchKeyword,
          workspace_id: currentWorkspace?.id,
          page: 1,
          page_size: 10
        }
      });
      const data = unwrapResponse(response.data);
      setSearchResults(data.items);
    } catch (error) {
      message.error('搜索Bug失败');
      console.error('搜索Bug失败:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  // 关联Bug到模块
  const handleLinkBug = async (values: { manifestation_description?: string }) => {
    if (!selectedBug) return;

    try {
      const response = await request.post('/bugs/link-module', {
        bug_id: selectedBug.id,
        module_id: moduleId,
        manifestation_description: values.manifestation_description
      });
      unwrapResponse(response.data);
      message.success('Bug关联成功');
      setLinkModalVisible(false);
      linkForm.resetFields();
      setSelectedBug(null);
      fetchModuleBugs();
    } catch (error) {
      message.error('关联Bug失败');
      console.error('关联Bug失败:', error);
    }
  };

  // 取消关联
  const handleUnlinkBug = async (bugId: number) => {
    try {
      const response = await request.post('/bugs/unlink-module', {
        bug_id: bugId,
        module_id: moduleId
      });
      unwrapResponse(response.data);
      message.success('取消关联成功');
      fetchModuleBugs();
    } catch (error) {
      message.error('取消关联失败');
      console.error('取消关联失败:', error);
    }
  };

  // 记录Bug发生
  const handleLogOccurrence = async (values: { notes?: string }) => {
    if (!selectedBug) return;

    try {
      const response = await request.post('/bugs/log-occurrence', {
        bug_id: selectedBug.id,
        notes: values.notes
      });
      unwrapResponse(response.data);
      message.success('Bug发生记录创建成功');
      setLogModalVisible(false);
      logForm.resetFields();
      setSelectedBug(null);
      fetchModuleBugs();
    } catch (error) {
      message.error('记录Bug发生失败');
      console.error('记录Bug发生失败:', error);
    }
  };

  // 初始化
  useEffect(() => {
    if (canView) {
      fetchModuleBugs();
    }
  }, [moduleId, currentPage, pageSize, canView]);

  if (!canView) {
    return null;
  }

  return (
    <Card
      title={
        <Space>
          <BugOutlined />
          关联缺陷记录
          <Badge count={total} showZero />
        </Space>
      }
      size="small"
      extra={
        <Space>
          {canLink && (
            <Tooltip title="关联已有问题">
              <Button
                type="text"
                icon={<LinkOutlined />}
                onClick={() => setSearchModalVisible(true)}
                size="small"
              >
                关联
              </Button>
            </Tooltip>
          )}
          {canCreate && (
            <Tooltip title="记录新问题">
              <Button
                type="text"
                icon={<PlusOutlined />}
                onClick={() => {
                  // 跳转到Bug管理页面，并预填充当前模块
                  const url = `/workspace/${currentWorkspace?.id}/bug-management?module_id=${moduleId}`;
                  window.open(url, '_blank');
                }}
                size="small"
              >
                新建
              </Button>
            </Tooltip>
          )}
        </Space>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin />
        </div>
      ) : bugList.length === 0 ? (
        <Empty
          description="暂无关联的Bug"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          dataSource={bugList}
          renderItem={(bug) => {
            const severityOption = SEVERITY_OPTIONS.find(opt => opt.value === bug.severity);
            return (
              <List.Item
                key={bug.id}
                actions={[
                  <Tooltip title="记录发生" key="log">
                    <Button
                      type="text"
                      icon={<ExclamationCircleOutlined />}
                      onClick={() => {
                        setSelectedBug(bug);
                        setLogModalVisible(true);
                      }}
                      disabled={!canLog}
                      size="small"
                    />
                  </Tooltip>,
                  <Tooltip title="取消关联" key="unlink">
                    <Popconfirm
                      title="确定要取消关联这个Bug吗？"
                      onConfirm={() => handleUnlinkBug(bug.id)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button
                        type="text"
                        icon={<DisconnectOutlined />}
                        danger
                        disabled={!canLink}
                        size="small"
                      />
                    </Popconfirm>
                  </Tooltip>
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span style={{ fontSize: '14px' }}>{bug.title}</span>
                      <Tag color={severityOption?.color} size="small">
                        {severityOption?.label}
                      </Tag>
                      <Badge count={bug.occurrence_count} showZero size="small" />
                    </Space>
                  }
                  description={
                    <div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {bug.last_occurrence && (
                          <span>最近发生: {formatDate(bug.last_occurrence)}</span>
                        )}
                      </div>
                      {bug.tags && bug.tags.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          {bug.tags.slice(0, 3).map(tag => (
                            <Tag key={tag} size="small">{tag}</Tag>
                          ))}
                          {bug.tags.length > 3 && (
                            <Tag size="small">+{bug.tags.length - 3}</Tag>
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
              showTotal: (total) => `共 ${total} 个`,
              onChange: (page) => setCurrentPage(page)
            } : false
          }
        />
      )}

      {/* 搜索Bug模态框 */}
      <Modal
        title="关联已有问题"
        open={searchModalVisible}
        onCancel={() => {
          setSearchModalVisible(false);
          setSearchKeyword('');
          setSearchResults([]);
        }}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="搜索Bug标题或描述"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onSearch={searchBugs}
            loading={searchLoading}
            enterButton
          />
        </div>

        {searchResults.length > 0 && (
          <List
            dataSource={searchResults}
            renderItem={(bug) => {
              const severityOption = SEVERITY_OPTIONS.find(opt => opt.value === bug.severity);
              return (
                <List.Item
                  key={bug.id}
                  actions={[
                    <Button
                      type="link"
                      onClick={() => {
                        setSelectedBug(bug);
                        setSearchModalVisible(false);
                        setLinkModalVisible(true);
                      }}
                    >
                      关联
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>{bug.title}</span>
                        <Tag color={severityOption?.color} size="small">
                          {severityOption?.label}
                        </Tag>
                      </Space>
                    }
                    description={
                      <div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          发生次数: {bug.occurrence_count}
                          {bug.last_occurrence && (
                            <span style={{ marginLeft: 16 }}>
                              最近: {formatDate(bug.last_occurrence)}
                            </span>
                          )}
                        </div>
                        {bug.tags && bug.tags.length > 0 && (
                          <div style={{ marginTop: 4 }}>
                            {bug.tags.slice(0, 3).map(tag => (
                              <Tag key={tag} size="small">{tag}</Tag>
                            ))}
                          </div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}

        {searchKeyword && searchResults.length === 0 && !searchLoading && (
          <Empty description="未找到相关Bug" />
        )}
      </Modal>

      {/* 关联Bug模态框 */}
      <Modal
        title="关联Bug到模块"
        open={linkModalVisible}
        onCancel={() => {
          setLinkModalVisible(false);
          linkForm.resetFields();
          setSelectedBug(null);
        }}
        footer={null}
        width={500}
      >
        {selectedBug && (
          <div style={{ marginBottom: 16 }}>
            <p><strong>Bug标题：</strong>{selectedBug.title}</p>
            <p><strong>严重程度：</strong>
              <Tag color={SEVERITY_OPTIONS.find(opt => opt.value === selectedBug.severity)?.color}>
                {SEVERITY_OPTIONS.find(opt => opt.value === selectedBug.severity)?.label}
              </Tag>
            </p>
          </div>
        )}

        <Form
          form={linkForm}
          layout="vertical"
          onFinish={handleLinkBug}
        >
          <Form.Item
            name="manifestation_description"
            label="在该模块下的表现"
          >
            <Input.TextArea
              rows={3}
              placeholder="描述该Bug在此模块下的特定表现"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                关联
              </Button>
              <Button onClick={() => {
                setLinkModalVisible(false);
                linkForm.resetFields();
                setSelectedBug(null);
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 记录Bug发生模态框 */}
      <Modal
        title="记录Bug发生"
        open={logModalVisible}
        onCancel={() => {
          setLogModalVisible(false);
          logForm.resetFields();
          setSelectedBug(null);
        }}
        footer={null}
        width={500}
      >
        {selectedBug && (
          <div style={{ marginBottom: 16 }}>
            <p><strong>Bug标题：</strong>{selectedBug.title}</p>
          </div>
        )}

        <Form
          form={logForm}
          layout="vertical"
          onFinish={handleLogOccurrence}
        >
          <Form.Item
            name="notes"
            label="补充说明"
          >
            <Input.TextArea
              rows={3}
              placeholder="请输入本次发生的补充说明"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                记录
              </Button>
              <Button onClick={() => {
                setLogModalVisible(false);
                logForm.resetFields();
                setSelectedBug(null);
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default BugAssociationPanel;
