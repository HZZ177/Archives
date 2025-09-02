import React, { useEffect, useState } from 'react';
import { Card, Table, Space, Tag, Button, Select, Input, message, Modal, Form } from 'antd';
import { EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { BugProfileResponse, BugSeverity, BugStatus, STATUS_OPTIONS, SEVERITY_OPTIONS, BugProfileCreate } from '../../types/bug';
import request from '../../utils/request';
import { unwrapResponse } from '../../utils/request';
import '../../pages/module-content/components/sections/SectionStyles.css';

const { Option } = Select;

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

interface ModuleBugListProps {
  moduleId: number;
  onViewBug?: (bug: BugProfileResponse) => void;
  onAfterChange?: () => void;
}

const ModuleBugList: React.FC<ModuleBugListProps> = ({ moduleId, onViewBug, onAfterChange }) => {
  const [loading, setLoading] = useState(false);
  const [bugs, setBugs] = useState<BugProfileResponse[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [severity, setSeverity] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');

  const [logModalVisible, setLogModalVisible] = useState(false);
  const [logForm] = Form.useForm();
  const [currentBug, setCurrentBug] = useState<BugProfileResponse | null>(null);
  const [logSubmitting, setLogSubmitting] = useState(false);

  // 新建Bug相关状态
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm] = Form.useForm();

  const fetchData = async () => {
    if (!moduleId) return;
    setLoading(true);
    try {
      const resp = await request.post('/bugs/get-module-bugs', { module_id: moduleId, page, page_size: pageSize });
      if (!resp.data.success) {
        message.error(resp.data.message || '获取模块相关Bug失败');
        setLoading(false);
        return;
      }
      const data = unwrapResponse(resp.data) as any;
      const items = (data.items || []).map((it: any) => ({
        ...it,
        status: it.status || it.bug_status || it.state || it.current_status
      })) as BugProfileResponse[];

      // 前端过滤（如需后端过滤，可扩展接口参数）
      const filtered = items.filter(it => {
        const textMatch = !keyword || it.title.includes(keyword) || (it.description || '').includes(keyword);
        const sevMatch = severity === 'ALL' || it.severity === severity;
        const stMatch = status === 'ALL' || (it.status && it.status.toString().toUpperCase() === status);
        return textMatch && sevMatch && stMatch;
      });

      setBugs(filtered);
      setTotal(data.total || filtered.length);
    } catch (e) {
      message.error('获取模块相关Bug失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, page, pageSize, keyword, severity, status]);

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title', render: (text: string, record: BugProfileResponse) => (
      <Button type="link" style={{ padding: 0, height: 'auto' }} onClick={() => onViewBug && onViewBug(record)}>{text}</Button>
    ) },
    { title: '严重程度', dataIndex: 'severity', key: 'severity', width: 100, render: (sev: BugSeverity) => {
      const color = sev === 'CRITICAL' ? 'red' : sev === 'HIGH' ? 'orange' : sev === 'MEDIUM' ? 'gold' : 'green';
      const text = sev === 'CRITICAL' ? '严重' : sev === 'HIGH' ? '高' : sev === 'MEDIUM' ? '中' : '低';
      return <Tag color={color}>{text}</Tag>;
    }},
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (st: BugStatus | string | undefined) => {
      const raw = (st ?? '').toString();
      const upper = raw.toUpperCase();
      const opt = STATUS_OPTIONS.find(o => o.value === upper) || STATUS_OPTIONS.find(o => o.value === raw as any);
      return <Tag color={opt?.color}>{opt?.label || raw || '-'}</Tag>;
    }},
    { title: '发生次数', dataIndex: 'occurrence_count', key: 'occurrence_count', width: 100, render: (count: number) => (
      <span style={{ color: count > 0 ? '#1890ff' : '#999' }}>{count || 0}</span>
    )},
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160, render: (d: string) => formatDate(d) },
    { title: '操作', key: 'actions', width: 180, render: (_: any, record: BugProfileResponse) => (
      <Space size="small">
        <Button type="text" icon={<EyeOutlined />} onClick={() => onViewBug && onViewBug(record)} title="查看详情" />
        <Button type="text" icon={<PlusOutlined />} onClick={() => { setCurrentBug(record); setLogModalVisible(true); }} title="记录一次发生" />
      </Space>
    )}
  ];

  const handleLog = async (values: { notes?: string }) => {
    if (!currentBug) return;
    setLogSubmitting(true);
    try {
      const resp = await request.post('/bugs/log-occurrence', { bug_id: currentBug.id, module_id: moduleId, notes: values.notes || undefined });
      unwrapResponse(resp.data);
      message.success('已记录一次发生');
      setLogModalVisible(false);
      logForm.resetFields();
      fetchData();
      onAfterChange && onAfterChange();
    } catch (e) {
      message.error('记录失败');
    } finally {
      setLogSubmitting(false);
    }
  };

  // 处理新建Bug
  const handleCreateBug = async (values: any) => {
    setCreateSubmitting(true);
    try {
      // 创建Bug档案
      const bugData: BugProfileCreate = {
        title: values.title,
        description: values.description || '',
        severity: values.severity,
        status: values.status || BugStatus.OPEN,
        tags: values.tags || []
      };

      const createResp = await request.post('/bugs/', bugData);
      const newBug = unwrapResponse(createResp.data) as any;

      // 自动记录一次发生（关联到当前模块）
      await request.post('/bugs/log-occurrence', {
        bug_id: newBug.id,
        module_id: moduleId,
        notes: values.notes || undefined
      });

      message.success('Bug创建成功并已记录一次发生');
      setCreateModalVisible(false);
      createForm.resetFields();
      fetchData();
      onAfterChange && onAfterChange();
    } catch (e) {
      message.error('创建失败');
    } finally {
      setCreateSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size="small" wrap>
          <Input placeholder="关键词" value={keyword} onChange={e => setKeyword(e.target.value)} allowClear style={{ width: 220 }} />
          <Select value={severity} onChange={setSeverity} style={{ width: 140 }}>
            <Option value="ALL">全部严重度</Option>
            {SEVERITY_OPTIONS.map(op => <Option key={op.value} value={op.value}>{op.label}</Option>)}
          </Select>
          <Select value={status} onChange={setStatus} style={{ width: 140 }}>
            <Option value="ALL">全部状态</Option>
            {STATUS_OPTIONS.map(op => <Option key={op.value} value={op.value}>{op.label}</Option>)}
          </Select>
        </Space>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalVisible(true)}
          size="small"
        >
          新建Bug
        </Button>
      </div>
      <Table
        columns={columns as any}
        dataSource={bugs}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          onChange: (p: number, s?: number) => { setPage(p); setPageSize(s || 10); },
          showTotal: (t: number) => `共 ${t} 条`
        }}
      />

      <Modal
        title="记录一次发生"
        open={logModalVisible}
        onCancel={() => { setLogModalVisible(false); logForm.resetFields(); }}
        footer={null}
        width={520}
      >
        <Form form={logForm} layout="vertical" onFinish={handleLog}>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="可选，补充说明本次发生的情况" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={logSubmitting}>确认记录</Button>
              <Button onClick={() => { setLogModalVisible(false); logForm.resetFields(); }} disabled={logSubmitting}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 新建Bug模态框 */}
      <Modal
        title="新建Bug"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateBug}>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <Form.Item
                name="title"
                label="Bug标题"
                rules={[{ required: true, message: '请输入Bug标题' }]}
              >
                <Input placeholder="请输入Bug标题" />
              </Form.Item>
            </div>
            <div style={{ flex: 1 }}>
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
            </div>
          </div>

          <Form.Item
            name="description"
            label="Bug描述"
          >
            <Input.TextArea
              rows={3}
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

          <Form.Item
            name="notes"
            label="发生说明"
          >
            <Input.TextArea
              rows={2}
              placeholder="可选，补充说明本次在该模块下的发生情况"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={createSubmitting}>
                创建并记录发生
              </Button>
              <Button onClick={() => {
                setCreateModalVisible(false);
                createForm.resetFields();
              }} disabled={createSubmitting}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ModuleBugList;


