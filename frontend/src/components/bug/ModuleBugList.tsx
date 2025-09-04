import React, { useEffect, useState } from 'react';
import { Card, Table, Space, Tag, Button, Select, Input, message, Modal, Form } from 'antd';
import { EyeOutlined, LinkOutlined, DisconnectOutlined } from '@ant-design/icons';
import request from '../../utils/request';
import { unwrapResponse } from '../../utils/request';
import '../../pages/module-content/components/sections/SectionStyles.css';

const { Option } = Select;

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

interface ModuleBugListProps {
  moduleId: number;
  onViewBug?: (bug: any) => void;
  onAfterChange?: () => void;
}

const ModuleBugList: React.FC<ModuleBugListProps> = ({ moduleId, onViewBug, onAfterChange }) => {
  const [loading, setLoading] = useState(false);
  const [bugs, setBugs] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [priority, setPriority] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');

  // 关联/取消关联相关状态
  const [linkLoading, setLinkLoading] = useState<number | null>(null);

  const fetchData = async () => {
    if (!moduleId) return;
    setLoading(true);
    try {
      const resp = await request.post('/coding-bugs/get-module-bugs', {
        module_id: moduleId,
        page,
        page_size: pageSize
      });
      if (!resp.data.success) {
        message.error(resp.data.message || '获取模块关联的缺陷失败');
        setLoading(false);
        return;
      }
      const data = unwrapResponse(resp.data) as any;
      const items = data.items || [];

      // 前端过滤
      const filtered = items.filter((it: any) => {
        const textMatch = !keyword || it.title.includes(keyword) || (it.description || '').includes(keyword);
        const priorityMatch = priority === 'ALL' || it.priority === priority;
        const statusMatch = status === 'ALL' || it.status_name === status;
        return textMatch && priorityMatch && statusMatch;
      });

      setBugs(filtered);
      setTotal(data.total || filtered.length);
    } catch (e) {
      message.error('获取模块关联的缺陷失败');
    } finally {
      setLoading(false);
    }
  };

  // 关联缺陷到模块
  const handleLinkBug = async (codingBugId: number) => {
    setLinkLoading(codingBugId);
    try {
      const resp = await request.post('/coding-bugs/link-module', {
        coding_bug_id: codingBugId,
        module_id: moduleId,
        manifestation_description: ''
      });
      if (resp.data.success) {
        message.success('关联成功');
        fetchData();
        onAfterChange?.();
      } else {
        message.error(resp.data.message || '关联失败');
      }
    } catch (error) {
      message.error('关联失败');
    } finally {
      setLinkLoading(null);
    }
  };

  // 取消关联缺陷
  const handleUnlinkBug = async (codingBugId: number) => {
    setLinkLoading(codingBugId);
    try {
      const resp = await request.post('/coding-bugs/unlink-from-module', {
        coding_bug_id: codingBugId,
        module_id: moduleId
      });
      if (resp.data.success) {
        message.success('取消关联成功');
        fetchData();
        onAfterChange?.();
      } else {
        message.error(resp.data.message || '取消关联失败');
      }
    } catch (error) {
      message.error('取消关联失败');
    } finally {
      setLinkLoading(null);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, page, pageSize, keyword, priority, status]);

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
      render: (text: string, record: any) => (
        <Button type="link" style={{ padding: 0, height: 'auto' }} onClick={() => onViewBug && onViewBug(record)}>
          {text}
        </Button>
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
      width: 160,
      render: (timestamp: number) => formatDate(timestamp)
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: any, record: any) => (
        <Space size="small">
        <Button
          type="text"
          icon={<EyeOutlined />}
          onClick={() => onViewBug && onViewBug(record)}
          title="查看详情"
        />
        {record.is_linked ? (
          <Button
            type="text"
            icon={<DisconnectOutlined />}
            onClick={() => handleUnlinkBug(record.coding_bug_id)}
            loading={linkLoading === record.coding_bug_id}
            title="取消关联"
            danger
          />
        ) : (
          <Button
            type="text"
            icon={<LinkOutlined />}
            onClick={() => handleLinkBug(record.coding_bug_id)}
            loading={linkLoading === record.coding_bug_id}
            title="关联到模块"
          />
        )}
      </Space>
    )}
  ];



  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size="small" wrap>
          <Input
            placeholder="搜索缺陷标题或描述"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            allowClear
            style={{ width: 220 }}
          />
          <Select value={priority} onChange={setPriority} style={{ width: 140 }}>
            <Option value="ALL">全部严重程度</Option>
            <Option value="最高">最高</Option>
            <Option value="高">高</Option>
            <Option value="中">中</Option>
            <Option value="低">低</Option>
          </Select>
          <Select value={status} onChange={setStatus} style={{ width: 140 }}>
            <Option value="ALL">全部状态</Option>
            <Option value="待处理">待处理</Option>
            <Option value="处理中">处理中</Option>
            <Option value="已解决">已解决</Option>
            <Option value="已关闭">已关闭</Option>
          </Select>
        </Space>
      </div>
      <Table
        columns={columns as any}
        dataSource={bugs}
        rowKey="coding_bug_id"
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
        locale={{
          emptyText: '暂无关联的缺陷数据'
        }}
      />

    </div>
  );
};

export default ModuleBugList;


