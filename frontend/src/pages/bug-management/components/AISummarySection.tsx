import React from 'react';
import { Card, Typography, Space, Tag, Timeline, Empty } from 'antd';
import {
  RobotOutlined,
  CalendarOutlined,
  BulbOutlined,
  ExperimentOutlined
} from '@ant-design/icons';
import { AISummary } from '../../../types/bug-analysis';

const { Title, Text, Paragraph } = Typography;

interface AISummarySectionProps {
  summaries: AISummary[];
}

const AISummarySection: React.FC<AISummarySectionProps> = ({
  summaries
}) => {
  if (!summaries || summaries.length === 0) {
    return (
      <Empty 
        description="暂无AI分析报告" 
        style={{ padding: '40px 0' }}
      />
    );
  }

  return (
    <div className="ai-summary-section">
      <div className="section-header">
        <Title level={4} style={{ margin: 0 }}>
          <RobotOutlined /> AI智能分析报告
        </Title>
        <Text type="secondary">
          基于缺陷数据的智能分析和建议
        </Text>
      </div>

      <Timeline
        className="ai-summary-timeline"
        mode="left"
        items={summaries.map((summary, index) => ({
          key: index,
          dot: <CalendarOutlined style={{ fontSize: '16px' }} />,
          color: summary.status === 'placeholder' ? 'gray' : 'blue',
          label: (
            <div className="timeline-label">
              <Tag color={summary.status === 'placeholder' ? 'default' : 'blue'}>
                {summary.month}
              </Tag>
            </div>
          ),
          children: (
            <Card 
              className={`ai-summary-item ${summary.status}`}
              size="small"
              hoverable={summary.status !== 'placeholder'}
            >
              <div className="ai-summary-header">
                <Title level={5} className="ai-summary-title">
                  {summary.title}
                </Title>
                {summary.status === 'placeholder' && (
                  <Tag icon={<ExperimentOutlined />} color="processing">
                    开发中
                  </Tag>
                )}
              </div>

              <Paragraph className="ai-summary-content">
                {summary.summary}
              </Paragraph>

              {summary.keyPoints && summary.keyPoints.length > 0 && (
                <div className="ai-summary-points">
                  <Text strong style={{ fontSize: '12px', marginBottom: '8px', display: 'block' }}>
                    <BulbOutlined /> 关键要点：
                  </Text>
                  <Space wrap>
                    {summary.keyPoints.map((point, pointIndex) => (
                      <Tag 
                        key={pointIndex}
                        className={`ai-summary-point ${summary.status}`}
                        color={summary.status === 'placeholder' ? 'default' : 'blue'}
                      >
                        {point}
                      </Tag>
                    ))}
                  </Space>
                </div>
              )}
            </Card>
          )
        }))}
      />


    </div>
  );
};

export default AISummarySection;
