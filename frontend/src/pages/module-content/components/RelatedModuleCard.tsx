import React from 'react';
import { Button, Card, Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import './RelatedModuleCard.css';

const { Title, Paragraph } = Typography;

interface RelatedModuleCardProps {
  module: {
    id: number;
    name: string;
  };
  overview?: string;
}

const RelatedModuleCard: React.FC<RelatedModuleCardProps> = ({ module, overview }) => {
  const handleViewDetails = () => {
    window.location.href = `/module-content/${module.id}`;
  };

  return (
    <Card className="related-module-card">
      <div className="card-content">
        <div className="card-header">
          <FileTextOutlined className="card-icon" />
          <Title level={5} className="card-title" title={module.name}>
            {module.name}
          </Title>
        </div>
        <Paragraph className="card-description" ellipsis={{ rows: 3, expandable: true, symbol: '更多' }}>
          {overview || '暂无功能概述'}
        </Paragraph>
        <div className="card-footer">
          <Button onClick={handleViewDetails} className="view-details-btn">
            查看详情
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default RelatedModuleCard; 