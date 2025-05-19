import React from 'react';
import { Typography, Card, Space } from 'antd';
import { useWorkspaceContext } from '../../contexts/WorkspaceContext';
import './HomePage.css';

const { Title, Text } = Typography;

/**
 * 首页组件
 * 显示当前工作区信息
 */
const HomePage: React.FC = () => {
  const { currentWorkspace, loading } = useWorkspaceContext();

  if (loading) {
    return <div className="home-page-loading">正在加载工作区信息...</div>;
  }

  if (!currentWorkspace) {
    return <div className="home-page-error">未找到工作区信息</div>;
  }

  return (
    <div className="home-page-container">
      <Card className="workspace-info-card">
        <Space direction="vertical" size="middle">
          <Title level={2}>欢迎来到工作区</Title>
          
          <Space align="center">
            <div 
              className="workspace-color-indicator" 
              style={{ backgroundColor: currentWorkspace.color || '#1890ff' }} 
            />
            <Title level={3} style={{ margin: 0 }}>
              {currentWorkspace.name}
            </Title>
          </Space>

          {currentWorkspace.description && (
            <Text type="secondary">{currentWorkspace.description}</Text>
          )}
        </Space>
      </Card>
    </div>
  );
};

export default HomePage; 