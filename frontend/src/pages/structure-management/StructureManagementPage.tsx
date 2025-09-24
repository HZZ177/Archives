import React, { useState, useEffect } from 'react';
import { Card, message, Row, Col, Typography } from 'antd';
import StructureTreeEditor from './components/StructureTreeEditor';
import NodeDetailPanel from './components/NodeDetailPanel';
import { ModuleStructureNode } from '../../types/modules';
import { fetchModuleTree, fetchModuleNode } from '../../apis/moduleService';
import { useSearchParams } from 'react-router-dom';
import { useModules } from '../../contexts/ModuleContext';
import './components/treeStyles.css';

const { Title } = Typography;

// 使用React.memo优化StructureManagementPage组件，减少不必要的重渲染
const StructureManagementPage: React.FC = React.memo(() => {
  const [loading, setLoading] = useState<boolean>(false);
  // 不再使用本地treeData，而是使用ModuleContext中的modules
  const { modules, loading: modulesLoading, fetchModules } = useModules();
  const [searchParams] = useSearchParams();
  const urlNodeId = searchParams.get('nodeId');
  
  // 当前选中的节点
  const [selectedNode, setSelectedNode] = useState<ModuleStructureNode | null>(null);
  // 节点加载状态
  const [nodeLoading, setNodeLoading] = useState<boolean>(false);

  // 组件生命周期
  useEffect(() => {
    return () => {
      // 清理工作
    };
  }, []); // 仅在组件挂载和卸载时执行

  // 获取模块结构树 - 使用ModuleContext的fetchModules方法
  const loadModuleTree = async () => {
    try {
      setLoading(true);
      // 明确使用ModuleContext，避免不必要的请求
      await fetchModules(true); // 强制刷新数据，不使用缓存
      setLoading(false);
      
      // 如果URL中有nodeId参数，加载该节点信息
      if (urlNodeId) {
        await loadNodeDetail(parseInt(urlNodeId));
      }
    } catch (error) {
      console.error('加载模块结构树失败:', error);
      message.error('加载模块结构树失败');
      setLoading(false);
    }
  };

  // 加载节点详情
  const loadNodeDetail = async (nodeId: number) => {
    try {
      setNodeLoading(true);
      const nodeData = await fetchModuleNode(nodeId);
      setSelectedNode(nodeData);
      setNodeLoading(false);
    } catch (error) {
      console.error('加载节点详情失败:', error);
      message.error('加载节点详情失败');
      setNodeLoading(false);
    }
  };

  // 处理节点选择
  const handleNodeSelect = async (node: ModuleStructureNode) => {
    setSelectedNode(node);
    // 也可以在这里重新加载节点详情，以确保数据最新
    await loadNodeDetail(node.id);
  };

  // 节点更新后的处理
  const handleNodeUpdated = () => {
    // 由于节点已更新，需要强制刷新模块树缓存
    const refreshWithForce = async () => {
      try {
        setLoading(true);
        await fetchModules(true); // 强制刷新
        setLoading(false);
      } catch (error) {
        console.error('强制刷新模块树失败:', error);
        setLoading(false);
      }
    };
    
    refreshWithForce();
    
    // 如果有选中的节点，刷新节点详情
    if (selectedNode) {
      loadNodeDetail(selectedNode.id);
    }
  };

  // 初始加载
  useEffect(() => {
    loadModuleTree();
  }, []);

  // 监听工作区变更事件
  useEffect(() => {
    // 处理工作区变更事件
    const handleWorkspaceChange = () => {
      loadModuleTree();
    };
    
    // 添加事件监听器
    window.addEventListener('workspaceChanged', handleWorkspaceChange);
    window.addEventListener('refreshModuleTree', handleWorkspaceChange);
    
    // 清理监听器
    return () => {
      window.removeEventListener('workspaceChanged', handleWorkspaceChange);
      window.removeEventListener('refreshModuleTree', handleWorkspaceChange);
    };
  }, []);

  return (
    <div className="structure-management-container">
      <Card 
        title={
          <div className="structure-page-header">
            <Title level={4} style={{ margin: 0 }}>结构管理</Title>
            <span className="page-subtitle">管理文档结构和内容</span>
          </div>
        }
        variant="borderless"
        className="structure-management-card"
      >
        <Row gutter={16} className="structure-management-row">
          {/* 左侧树结构区域 */}
          <Col span={9} className="tree-column">
            <div className="tree-panel">
        <StructureTreeEditor 
                treeData={modules} // 使用ModuleContext中的modules
                loading={loading || modulesLoading} // 合并加载状态
          onTreeDataChange={loadModuleTree} 
                focusNodeId={urlNodeId ? parseInt(urlNodeId) : (selectedNode?.id || undefined)}
                onNodeSelect={handleNodeSelect}
              />
            </div>
          </Col>
          
          {/* 右侧节点详情区域 */}
          <Col span={15} className="detail-column">
            <div className="detail-panel">
              <NodeDetailPanel
                node={selectedNode}
                loading={nodeLoading}
                onNodeUpdated={handleNodeUpdated}
                treeData={modules} // 传递完整的树数据
              />
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
});

export default StructureManagementPage; 