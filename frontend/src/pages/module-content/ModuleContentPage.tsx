import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, message, Spin, Typography, Breadcrumb } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { ModuleStructureNode } from '../../types/modules';
import { fetchModuleNode } from '../../apis/moduleService';
import ModuleContentEditor from './components/ModuleContentEditor';
import { ROUTES } from '../../config/constants';

const { Title } = Typography;

const ModuleContentPage: React.FC = () => {
  const { moduleNodeId } = useParams<{ moduleNodeId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [moduleNode, setModuleNode] = useState<ModuleStructureNode | null>(null);

  useEffect(() => {
    const loadModuleNode = async () => {
      if (!moduleNodeId) return;
      
      try {
        setLoading(true);
        const node = await fetchModuleNode(parseInt(moduleNodeId));
        setModuleNode(node);
        setLoading(false);
      } catch (error) {
        console.error('加载模块节点信息失败:', error);
        message.error('加载模块节点信息失败');
        navigate('/structure-management');
        setLoading(false);
      }
    };
    
    loadModuleNode();
  }, [moduleNodeId, navigate]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item>
          <Link to="/"><HomeOutlined /></Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <Link to="/structure-management">结构管理</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          {moduleNode?.name || '模块内容'}
        </Breadcrumb.Item>
      </Breadcrumb>

      <Card bordered={false}>
        {moduleNode && (
          <>
            <Title level={4}>{moduleNode.name}</Title>
            <ModuleContentEditor moduleNodeId={parseInt(moduleNodeId || '0')} />
          </>
        )}
      </Card>
    </div>
  );
};

export default ModuleContentPage; 