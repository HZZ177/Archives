import React, { useState, useEffect } from 'react';
import { Modal, Descriptions, Typography, Badge, Tag, Space, Divider, Timeline, Spin, Button, message } from 'antd';
import request from '../../utils/request';
import { unwrapResponse } from '../../utils/request';

interface BugDetailModalProps {
  open: boolean;
  bug: any | null;
  onClose: () => void;
}

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
    case '新': return 'red';
    case '待处理': return 'magenta';
    case '处理中': return 'blue';
    case '已解决': return 'green';
    case '已关闭': return 'default';
    default: return 'default';
  }
};

const BugDetailModal: React.FC<BugDetailModalProps> = ({
  open,
  bug,
  onClose
}) => {
  const [bugDetail, setBugDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // 获取Coding缺陷详情
  const fetchBugDetail = async (codingBugId: number) => {
    try {
      setLoading(true);
      const response = await request.post('/coding-bugs/get-detail', { coding_bug_id: codingBugId });
      const detail = unwrapResponse(response.data) as any;
      setBugDetail(detail);
    } catch (error) {
      message.error('获取缺陷详情失败');
      console.error('获取缺陷详情失败:', error);
    } finally {
      setLoading(false);
    }
  };
  // 当bug变化时，获取详情
  useEffect(() => {
    if (open && bug && bug.coding_bug_id) {
      fetchBugDetail(bug.coding_bug_id);
    }
  }, [open, bug]);

  // 关闭时清理状态
  const handleClose = () => {
    setBugDetail(null);
    onClose();
  };

  const currentBug = bugDetail || bug;

  return (
    <Modal
      title="缺陷详情"
      open={open}
      onCancel={handleClose}
      footer={[
        <Button key="close" onClick={handleClose}>
          关闭
        </Button>
      ]}
      width={1200}
      style={{ maxHeight: '80vh' }}
      styles={{
        body: {
          maxHeight: '70vh',
          overflowY: 'auto',
          padding: '24px'
        }
      }}
    >
      <Spin spinning={loading} tip="加载中..." style={{ minHeight: '200px' }}>
        {currentBug && (
          <div>
            <Descriptions
              column={2}
              size="middle"
              colon={false}
              labelStyle={{ width: 120, color: 'rgba(0,0,0,0.45)' }}
            >
              <Descriptions.Item label="Coding编号">
                <Tag color="blue">#{currentBug.coding_bug_code}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="项目名称">
                <Typography.Text>{currentBug.project_name}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="标题" span={2}>
                <Typography.Text strong>{currentBug.title}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="优先级">
                <Tag color={getPriorityColor(currentBug.priority)} style={{ color: '#fff' }}>
                  {currentBug.priority}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={getStatusColor(currentBug.status_name)}>
                  {currentBug.status_name}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatDate(currentBug.coding_created_at)}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {formatDate(currentBug.coding_updated_at)}
              </Descriptions.Item>
              {currentBug.assignees && currentBug.assignees.length > 0 && (
                <Descriptions.Item label="指派人" span={2}>
                  <Space wrap>
                    {currentBug.assignees.map((assignee: string, index: number) => (
                      <Tag key={index}>{assignee}</Tag>
                    ))}
                  </Space>
                </Descriptions.Item>
              )}
              {currentBug.labels && currentBug.labels.length > 0 && (
                <Descriptions.Item label="标签" span={2}>
                  <Space wrap>
                    {currentBug.labels.map((label: string, index: number) => (
                      <Tag key={index}>{label}</Tag>
                    ))}
                  </Space>
                </Descriptions.Item>
              )}
              {currentBug.iteration_name && (
                <Descriptions.Item label="迭代" span={2}>
                  <Typography.Text>{currentBug.iteration_name}</Typography.Text>
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

            {Array.isArray(bugDetail?.module_links) && bugDetail.module_links.length > 0 && (
              <>
                <Divider orientation="left">已关联模块</Divider>
                <Space wrap>
                  {bugDetail.module_links.map((link: any) => (
                    <Tag key={`${link.module_id}`}>
                      {link.module_name || `模块 ${link.module_id}`}
                    </Tag>
                  ))}
                </Space>
              </>
            )}
          </div>
        )}
      </Spin>
    </Modal>
  );
};

export default BugDetailModal;
