import React from 'react';
import { Row, Col, Statistic, Card, Typography, Space, Progress } from 'antd';
import {
  BugOutlined,
  PlusCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { ModuleStats } from '../../../types/bug-analysis';

const { Title, Text } = Typography;

interface BugStatisticsProps {
  statistics: ModuleStats;
  selectedModuleId: number | null;
}

const BugStatistics: React.FC<BugStatisticsProps> = ({
  statistics,
  selectedModuleId
}) => {
  // 计算解决率
  const resolveRate = statistics.totalBugs > 0 
    ? Math.round((statistics.resolvedBugs / statistics.totalBugs) * 100)
    : 0;

  // 获取优先级颜色
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case '紧急': return '#ff4d4f';
      case '高': return '#ff7a45';
      case '中': return '#faad14';
      case '低': return '#52c41a';
      default: return '#d9d9d9';
    }
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case '待处理': return '#faad14';
      case '处理中': return '#1890ff';
      case '已解决': return '#52c41a';
      case '已关闭': return '#d9d9d9';
      default: return '#d9d9d9';
    }
  };

  return (
    <div className="bug-statistics">
      <div className="statistics-header">
        <Title level={4} style={{ margin: 0 }}>
          <BarChartOutlined /> 缺陷统计
          {selectedModuleId && (
            <Text type="secondary" style={{ fontSize: '14px', marginLeft: '8px' }}>
              (已选择模块)
            </Text>
          )}
        </Title>
      </div>

      {/* 主要统计指标 */}
      <Row gutter={16} className="statistics-cards">
        <Col span={6}>
          <Card className="statistic-card total" size="small">
            <Statistic
              title="总缺陷数"
              value={statistics.totalBugs}
              prefix={<BugOutlined />}
              valueStyle={{ color: 'inherit' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="statistic-card new" size="small">
            <Statistic
              title="新增缺陷"
              value={statistics.newBugs}
              prefix={<PlusCircleOutlined />}
              suffix="(7天)"
              valueStyle={{ color: 'inherit' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="statistic-card resolved" size="small">
            <Statistic
              title="已解决"
              value={statistics.resolvedBugs}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: 'inherit' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="statistic-card pending" size="small">
            <Statistic
              title="待处理"
              value={statistics.pendingBugs}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: 'inherit' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 解决率进度条 */}
      <Card size="small" style={{ marginTop: 16 }}>
        <div className="resolve-rate-section">
          <div className="resolve-rate-header">
            <Text strong>解决率</Text>
            <Text type="secondary">{resolveRate}%</Text>
          </div>
          <Progress
            percent={resolveRate}
            strokeColor={{
              '0%': '#ff4d4f',
              '50%': '#faad14',
              '100%': '#52c41a',
            }}
            showInfo={false}
            style={{ marginTop: 8 }}
          />
        </div>
      </Card>

      {/* 优先级分布 */}
      {Object.keys(statistics.priorityDistribution).length > 0 && (
        <Card size="small" style={{ marginTop: 16 }} title="优先级分布">
          <Row gutter={8}>
            {['紧急', '高', '中', '低', '未指定'].filter(priority =>
              statistics.priorityDistribution[priority] > 0
            ).map((priority) => (
              <Col span={6} key={priority}>
                <div className="distribution-item">
                  <div
                    className="distribution-color"
                    style={{ backgroundColor: getPriorityColor(priority) }}
                  />
                  <div className="distribution-info">
                    <Text style={{ fontSize: '12px' }}>{priority}</Text>
                    <Text strong style={{ fontSize: '14px' }}>{statistics.priorityDistribution[priority]}</Text>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* 状态分布 */}
      {Object.keys(statistics.statusDistribution).length > 0 && (
        <Card size="small" style={{ marginTop: 16 }} title="状态分布">
          <Row gutter={8}>
            {Object.entries(statistics.statusDistribution).map(([status, count]) => (
              <Col span={6} key={status}>
                <div className="distribution-item">
                  <div 
                    className="distribution-color" 
                    style={{ backgroundColor: getStatusColor(status) }}
                  />
                  <div className="distribution-info">
                    <Text style={{ fontSize: '12px' }}>{status}</Text>
                    <Text strong style={{ fontSize: '14px' }}>{count}</Text>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      )}


    </div>
  );
};

export default BugStatistics;
