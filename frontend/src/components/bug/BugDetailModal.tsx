import React, { useState, useEffect } from 'react';
import { Modal, Descriptions, Typography, Badge, Tag, Space, Divider, Timeline, Spin, Button, message } from 'antd';
import { BugProfileResponse, BugLogResponse, STATUS_OPTIONS } from '../../types/bug';
import request from '../../utils/request';
import { unwrapResponse } from '../../utils/request';

interface BugDetailModalProps {
  visible: boolean;
  bug: BugProfileResponse | null;
  onClose: () => void;
  onLogOccurrence?: (bug: BugProfileResponse) => void;
  showLogButton?: boolean;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const BugDetailModal: React.FC<BugDetailModalProps> = ({
  visible,
  bug,
  onClose,
  onLogOccurrence,
  showLogButton = false
}) => {
  const [bugDetail, setBugDetail] = useState<any>(null);
  const [bugLogs, setBugLogs] = useState<BugLogResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  // 获取Bug详情
  const fetchBugDetail = async (bugId: number) => {
    try {
      setLoading(true);
      const response = await request.post('/bugs/get-detail', { bug_id: bugId });
      const detail = unwrapResponse(response.data) as any;
      setBugDetail(detail);
    } catch (error) {
      message.error('获取Bug详情失败');
      console.error('获取Bug详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取Bug发生日志
  const fetchBugLogs = async (bugId: number) => {
    try {
      setLogsLoading(true);
      const response = await request.post('/bugs/get-logs', { bug_id: bugId, page_size: 100 });
      const data = unwrapResponse(response.data) as any;
      setBugLogs(data.items || []);
    } catch (error) {
      message.error('获取发生历史失败');
      console.error('获取发生历史失败:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  // 当bug变化时，获取详情和日志
  useEffect(() => {
    if (visible && bug) {
      fetchBugDetail(bug.id);
      fetchBugLogs(bug.id);
    }
  }, [visible, bug]);

  // 关闭时清理状态
  const handleClose = () => {
    setBugDetail(null);
    setBugLogs([]);
    onClose();
  };

  const currentBug = bugDetail || bug;

  return (
    <Modal
      title="Bug详情"
      open={visible}
      onCancel={handleClose}
      footer={[
        ...(showLogButton && currentBug ? [
          <Button 
            key="log" 
            type="primary" 
            onClick={() => onLogOccurrence && onLogOccurrence(currentBug)}
          >
            记录一次发生
          </Button>
        ] : []),
        <Button key="close" onClick={handleClose}>
          关闭
        </Button>
      ]}
      width={800}
    >
      <Spin spinning={loading} tip="加载中...">
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
                  {currentBug.severity === 'CRITICAL' ? '严重' : 
                   currentBug.severity === 'HIGH' ? '高' : 
                   currentBug.severity === 'MEDIUM' ? '中' : '低'}
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
                    {currentBug.tags.map((tag: string) => (
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

            <Divider orientation="left">发生历史</Divider>
            <Spin spinning={logsLoading} tip="加载中...">
              {bugLogs.length > 0 ? (
                <Timeline style={{ marginLeft: 8 }}>
                  {bugLogs.map(log => (
                    <Timeline.Item key={log.id}>
                      <Typography.Text>{formatDate(log.occurred_at)}</Typography.Text>
                      <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                        {log.module_name ? `（${log.module_name}）` :
                         (log.module_id ? `（ID：${log.module_id}）` : '')}
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
      </Spin>
    </Modal>
  );
};

export default BugDetailModal;
