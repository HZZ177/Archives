import React from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Space
} from 'antd';
import ReactMarkdown from 'react-markdown';
import {
  TrophyOutlined,
  BugOutlined,
  ExclamationCircleOutlined,
  BarChartOutlined,
  BulbOutlined
} from '@ant-design/icons';
import PriorityTrendChart from './PriorityTrendChart';
import { ReportData } from '../../../services/monthlyReportService';

const { Title, Text, Paragraph } = Typography;

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




  return (
    <div>
      <Card>
        {/* 报告标题和生成信息 */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
              📊 {year}年{month}月缺陷分析报告
            </Title>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#52c41a', fontWeight: 'bold', marginBottom: '4px' }}>已完成</div>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                报告生成时间: {reportData.generation_metadata?.generated_at ?
                  new Date(reportData.generation_metadata.generated_at).toLocaleString() : ''}
              </Text>
            </div>
          </div>
          <Text type="secondary" style={{ fontSize: '14px' }}>
            基于AI智能分析生成的月度缺陷分析报告
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
            <Col xs={24} sm={8}>
              <Statistic
                title="缺陷总数"
                value={reportData.key_metrics.total_bugs}
                prefix={<BugOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col xs={24} sm={8}>
              <Statistic
                title="解决率"
                value={reportData.key_metrics.resolution_rate}
                suffix="%"
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col xs={24} sm={8}>
              <Statistic
                title="严重缺陷"
                value={reportData.key_metrics.critical_bugs}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
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
          <PriorityTrendChart
            data={Array.isArray(reportData.trend_analysis) ? reportData.trend_analysis : []}
            loading={false}
          />
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
          <div style={{
            backgroundColor: '#f6ffed',
            padding: '16px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '14px',
            lineHeight: '1.6'
          }}>
            <ReactMarkdown
              components={{
                h1: ({children}) => <Typography.Title level={2} style={{marginTop: '1.5em', marginBottom: '0.5em'}}>{children}</Typography.Title>,
                h2: ({children}) => <Typography.Title level={3} style={{marginTop: '1.5em', marginBottom: '0.5em'}}>{children}</Typography.Title>,
                h3: ({children}) => <Typography.Title level={4} style={{marginTop: '1.5em', marginBottom: '0.5em'}}>{children}</Typography.Title>,
                h4: ({children}) => <Typography.Title level={5} style={{marginTop: '1.5em', marginBottom: '0.5em'}}>{children}</Typography.Title>,
                p: ({children}) => <Typography.Paragraph style={{marginBottom: '1em'}}>{children}</Typography.Paragraph>,
                ul: ({children}) => <ul style={{paddingLeft: '1.5em', marginBottom: '1em'}}>{children}</ul>,
                ol: ({children}) => <ol style={{paddingLeft: '1.5em', marginBottom: '1em'}}>{children}</ol>,
                li: ({children}) => <li style={{marginBottom: '0.25em'}}>{children}</li>,
                code: ({children}) => <Typography.Text code>{children}</Typography.Text>,
                pre: ({children}) => <pre style={{backgroundColor: '#f0f0f0', padding: '12px', borderRadius: '6px', overflow: 'auto'}}>{children}</pre>
              }}
            >
              {reportData.ai_insights}
            </ReactMarkdown>
          </div>
        </Card>


      </Card>
    </div>
  );
};

export default ReportViewer;
