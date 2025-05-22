import React, { useRef, useState, useEffect } from 'react';
import { Typography, Spin, Card, Space, Button } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useModules } from '../../contexts/ModuleContext';
import { useWorkspaceContext } from '../../contexts/WorkspaceContext';
import { ModuleGraph } from '../../components/ModuleGraph/ModuleGraph';
import { PlusOutlined, ProjectOutlined } from '@ant-design/icons';
import './HomePage.css';

const { Title, Text } = Typography;

/**
 * 首页组件
 * 显示当前工作区信息
 */
const HomePage: React.FC = () => {
  const { modules, loading: modulesLoading } = useModules();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspaceContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentModuleId, setCurrentModuleId] = useState<number | null>(null);
  const graphRef = useRef<any>(null);
  const prevPathRef = useRef<string | null>(null);

  // 处理节点点击，导航到对应的模块内容页面
  const handleNodeClick = (moduleId: number) => {
    navigate(`/module-content/${moduleId}`);
  };

  // 添加useEffect，确保图谱正确定位
  useEffect(() => {
    // 当modules加载完成且图谱组件已初始化时重置图谱
    if (!modulesLoading && modules.length > 0 && graphRef.current) {
      // 使用setTimeout确保DOM已完全渲染
      setTimeout(() => {
        if (graphRef.current && graphRef.current.resetAutoFit) {
          graphRef.current.resetAutoFit();
        }
      }, 100);
    }
  }, [modulesLoading, modules]);

  // 监听路由变化，当从其他页面切换到首页时重置图谱
  useEffect(() => {
    // 检查是否是从其他页面导航到首页
    if (prevPathRef.current && prevPathRef.current !== location.pathname && location.pathname === '/') {
      if (graphRef.current && graphRef.current.resetAutoFit && !modulesLoading && modules.length > 0) {
        setTimeout(() => {
          graphRef.current.resetAutoFit();
        }, 100);
      }
    }
    
    // 更新之前的路径
    prevPathRef.current = location.pathname;
  }, [location, modulesLoading, modules]);

  const cardTitle = workspaceLoading ? (
    <Spin size="small" />
  ) : currentWorkspace ? (
    <Space align="center">
      <div 
        className="workspace-color-indicator-home" 
        style={{ backgroundColor: currentWorkspace.color || '#1890ff' }} 
      />
      <Text strong style={{ fontSize: '18px' }}>{currentWorkspace.name}</Text>
    </Space>
  ) : (
    "当前工作区"
  );

  return (
    <div className="home-page-container">
      <Card className="workspace-info-card-home" title={cardTitle}>
        {workspaceLoading ? (
          <Spin tip="加载工作区信息..." />
        ) : currentWorkspace ? (
          <Text strong style={{ fontSize: '20px' }}>工作区结构图谱</Text> 
        ) : (
          <Text type="secondary">未找到工作区信息</Text>
        )}
      </Card>

      <div className="module-graph-container-home">
        {modulesLoading ? (
          <div className="module-graph-loading">
            <Spin tip="加载模块关系图谱..." />
          </div>
        ) : (
          modules.length > 0 ? (
            <ModuleGraph
              ref={graphRef}
              currentModuleId={null}
              onNodeClick={handleNodeClick}
            />
          ) : (
            <Card className="empty-modules-card">
              <div className="empty-modules-content">
                <ProjectOutlined className="empty-modules-icon" />
                <Typography.Title level={4} className="empty-modules-title">
                  当前工作区暂无模块数据
                </Typography.Title>
                <Typography.Text type="secondary" className="empty-modules-description">
                  开始创建您的第一个模块，构建资料体系
                </Typography.Text>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={() => navigate('/structure-management')}
                  className="empty-modules-button"
                >
                  创建模块
                </Button>
              </div>
            </Card>
          )
        )}
      </div>
    </div>
  );
};

export default HomePage; 