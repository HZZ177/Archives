import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, message, Spin, Typography } from 'antd';
import { ModuleStructureNode } from '../../types/modules';
import { fetchModuleNode } from '../../apis/moduleService';
import ModuleContentEditor from './components/ModuleContentEditor';

const { Title } = Typography;

const ModuleContentPage: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [moduleNode, setModuleNode] = useState<ModuleStructureNode | null>(null);

  useEffect(() => {
    const loadModuleNode = async () => {
      if (!moduleId) return;
      
      try {
        setLoading(true);
        const node = await fetchModuleNode(parseInt(moduleId));
        setModuleNode(node);
        setLoading(false);
      } catch (error) {
        console.error('加载模块节点信息失败:', error);
        message.error('加载模块节点信息失败');
        setLoading(false);
      }
    };
    
    loadModuleNode();
  }, [moduleId, navigate]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Card bordered={false}>
        {moduleNode && (
          <>
            <Title level={4} style={{ textAlign: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #f0f0f0' }}>
              {moduleNode.name}
            </Title>
            <ModuleContentEditor moduleNodeId={parseInt(moduleId || '0')} />
          </>
        )}
      </Card>
    </div>
  );
};

export default ModuleContentPage; 