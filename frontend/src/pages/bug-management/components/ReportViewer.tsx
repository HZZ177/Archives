import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Divider,
  List,
  Tag,
  Progress,
  Collapse,
  Table,
  Empty,
  Space,
  Button
} from 'antd';
import {
  TrophyOutlined,
  BugOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  BarChartOutlined,
  BulbOutlined,
  DownOutlined,
  UpOutlined
} from '@ant-design/icons';
import { ReportData } from '../../../services/monthlyReportService';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface ReportViewerProps {
  reportData: ReportData;
  year: number;
  month: number;
}

const ReportViewer: React.FC<ReportViewerProps> = ({
  reportData,
  year,
  month
}) => {
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  // 优先级颜色映射
  const getPriorityColor = (priority: string) => {
    const colorMap: Record<string, string> = {
      '紧急': 'red',
      '高': 'orange',
      '中': 'blue',
      '低': 'green',
      '未指定': 'default'
    };
    return colorMap[priority] || 'default';
  };

  // 状态颜色映射
  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      '已解决': 'green',
      '已关闭': 'green',
      '处理中': 'blue',
      '待处理': 'orange',
      '新建': 'red'
    };
    return colorMap[status] || 'default';
  };

  // 详细数据表格列配置
  const bugColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: string) => (
        <Tag color={getPriorityColor(priority)}>{priority}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date: string) => date ? new Date(date).toLocaleDateString() : '-',
    },
  ];

  return (
    <div style={{ padding: '24px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <Card style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* 报告标题 */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
            📊 {year}年{month}月缺陷分析报告
          </Title>
          <Text type="secondary" style={{ fontSize: '16px' }}>
            基于AI智能分析生成 • {reportData.generation_metadata.generated_at ? 
              new Date(reportData.generation_metadata.generated_at).toLocaleString() : ''}
          </Text>
        </div>

        {/* 执行摘要 */}
        <Card 
          title={
            <Space>
              <TrophyOutlined style={{ color: '#1890ff' }} />
              <span>执行摘要</span>
            </Space>
          }
          style={{ marginBottom: '24px' }}
        >
          <Paragraph style={{ fontSize: '16px', lineHeight: '1.6' }}>
            {reportData.executive_summary}
          </Paragraph>
        </Card>

        {/* 关键指标 */}
        <Card 
          title={
            <Space>
              <BarChartOutlined style={{ color: '#52c41a' }} />
              <span>关键指标</span>
            </Space>
          }
          style={{ marginBottom: '24px' }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={6}>
              <Statistic
                title="缺陷总数"
                value={reportData.key_metrics.total_bugs}
                prefix={<BugOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="解决率"
                value={reportData.key_metrics.resolution_rate}
                suffix="%"
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="严重缺陷"
                value={reportData.key_metrics.critical_bugs}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="平均处理时间"
                value={reportData.key_metrics.avg_processing_time}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Col>
          </Row>
        </Card>

        {/* 趋势分析 */}
        <Card 
          title={
            <Space>
              <BarChartOutlined style={{ color: '#fa8c16' }} />
              <span>趋势分析</span>
            </Space>
          }
          style={{ marginBottom: '24px' }}
        >
          <Row gutter={[24, 24]}>
            <Col xs={24} md={12}>
              <Title level={5}>优先级分布</Title>
              <div>
                {Object.entries(reportData.trend_analysis.priority_distribution).map(([priority, count]) => (
                  <div key={priority} style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <Text>{priority}</Text>
                      <Text strong>{count}</Text>
                    </div>
                    <Progress 
                      percent={Math.round((count / reportData.key_metrics.total_bugs) * 100)} 
                      strokeColor={getPriorityColor(priority)}
                      showInfo={false}
                      size="small"
                    />
                  </div>
                ))}
              </div>
            </Col>
            <Col xs={24} md={12}>
              <Title level={5}>状态分布</Title>
              <div>
                {Object.entries(reportData.trend_analysis.status_distribution).map(([status, count]) => (
                  <div key={status} style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <Text>{status}</Text>
                      <Text strong>{count}</Text>
                    </div>
                    <Progress 
                      percent={Math.round((count / reportData.key_metrics.total_bugs) * 100)} 
                      strokeColor={getStatusColor(status)}
                      showInfo={false}
                      size="small"
                    />
                  </div>
                ))}
              </div>
            </Col>
          </Row>
        </Card>

        {/* 问题热点分析 */}
        <Card 
          title={
            <Space>
              <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
              <span>问题热点分析</span>
            </Space>
          }
          style={{ marginBottom: '24px' }}
        >
          {reportData.hotspot_analysis.length > 0 ? (
            <List
              dataSource={reportData.hotspot_analysis.slice(0, 10)}
              renderItem={(item, index) => (
                <List.Item>
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong>
                        {index + 1}. {item.module}
                      </Text>
                      <Space>
                        <Text type="secondary">{item.count} 个问题</Text>
                        <Text type="secondary">({item.percentage}%)</Text>
                      </Space>
                    </div>
                    <Progress 
                      percent={item.percentage} 
                      strokeColor="#ff4d4f"
                      showInfo={false}
                      size="small"
                      style={{ marginTop: '4px' }}
                    />
                  </div>
                </List.Item>
              )}
            />
          ) : (
            <Empty description="暂无热点数据" />
          )}
        </Card>

        {/* AI洞察与建议 */}
        <Card 
          title={
            <Space>
              <BulbOutlined style={{ color: '#722ed1' }} />
              <span>AI洞察与建议</span>
            </Space>
          }
          style={{ marginBottom: '24px' }}
        >
          <div style={{ backgroundColor: '#f6ffed', padding: '16px', borderRadius: '6px', marginBottom: '16px' }}>
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
              {reportData.ai_insights}
            </pre>
          </div>
          
          <Title level={5}>改进建议</Title>
          <List
            dataSource={reportData.improvement_suggestions}
            renderItem={(suggestion, index) => (
              <List.Item>
                <Text>
                  <Text strong>{index + 1}. </Text>
                  {suggestion}
                </Text>
              </List.Item>
            )}
          />
        </Card>

        {/* 详细数据 */}
        <Card 
          title={
            <Space>
              <Button 
                type="text" 
                icon={detailsExpanded ? <UpOutlined /> : <DownOutlined />}
                onClick={() => setDetailsExpanded(!detailsExpanded)}
              >
                详细数据 ({reportData.detailed_data.raw_bugs.length} 条记录)
              </Button>
            </Space>
          }
          style={{ marginBottom: '24px' }}
        >
          {detailsExpanded && (
            <Table
              dataSource={reportData.detailed_data.raw_bugs}
              columns={bugColumns}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条记录`
              }}
              scroll={{ x: 800 }}
            />
          )}
        </Card>
      </Card>
    </div>
  );
};

export default ReportViewer;
