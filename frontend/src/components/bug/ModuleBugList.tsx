import React, { useEffect, useState } from 'react';
import { Card, Table, Space, Tag, Button, Select, Input, message, Modal, Form } from 'antd';
import { EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { BugProfileResponse, BugSeverity, BugStatus, STATUS_OPTIONS, SEVERITY_OPTIONS } from '../../types/bug';
import request from '../../utils/request';
import { unwrapResponse } from '../../utils/request';

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

  return (
    <Card title="缺陷">
      <div style={{ marginBottom: 12 }}>
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
          onChange: (p, s) => { setPage(p); setPageSize(s || 10); },
          showTotal: (t) => `共 ${t} 条`
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
    </Card>
  );
};

export default ModuleBugList;


