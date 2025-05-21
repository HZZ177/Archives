import React, { useRef, useState } from 'react';
import { Typography, Spin, Card, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useModules } from '../../contexts/ModuleContext';
import { useWorkspaceContext } from '../../contexts/WorkspaceContext';
import ModuleGraph from '../../components/ModuleGraph/ModuleGraph';
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
  const [currentModuleId, setCurrentModuleId] = useState<number | null>(null);
  const graphRef = useRef<any>(null);

  // 处理节点点击，导航到对应的模块内容页面
  const handleNodeClick = (moduleId: number) => {
    navigate(`/module-content/${moduleId}`);
  };

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
              currentModuleId={currentModuleId || modules[0].id}
              onNodeClick={handleNodeClick}
            />
          ) : (
            <div className="no-modules-message">暂无模块数据</div>
          )
        )}
      </div>
    </div>
  );
};

export default HomePage; 