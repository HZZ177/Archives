import React, { useState, useEffect } from 'react';
import { Tree, Typography, Space, Tooltip } from 'antd';
import {
  FileTextOutlined,
  FolderOutlined,
  BugOutlined
} from '@ant-design/icons';
import { ModuleTreeNode } from '../../../types/bug-analysis';

const { Text } = Typography;

interface ModuleHealthTreeProps {
  treeData: ModuleTreeNode[];
  selectedModuleId: number | null;
  onSelect: (moduleId: number | null) => void;
}

interface TreeDataNode {
  key: string;
  title: React.ReactNode;
  icon: React.ReactNode;
  children?: TreeDataNode[];
  isLeaf: boolean;
  originNode: ModuleTreeNode;
}

const ModuleHealthTree: React.FC<ModuleHealthTreeProps> = ({
  treeData,
  selectedModuleId,
  onSelect
}) => {
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // 同步选中状态
  useEffect(() => {
    if (selectedModuleId) {
      setSelectedKeys([selectedModuleId.toString()]);
    } else {
      setSelectedKeys([]);
    }
  }, [selectedModuleId]);

  // 获取健康分颜色和等级
  const getHealthScoreStyle = (score: number) => {
    if (score >= 90) {
      return { className: 'excellent', text: '优秀' };
    } else if (score >= 70) {
      return { className: 'good', text: '良好' };
    } else if (score >= 50) {
      return { className: 'warning', text: '警告' };
    } else {
      return { className: 'danger', text: '危险' };
    }
  };

  // 构建树节点标题
  const buildNodeTitle = (node: ModuleTreeNode): React.ReactNode => {
    const healthStyle = getHealthScoreStyle(node.healthScore);
    
    return (
      <div className="module-tree-node">
        <div className="module-tree-node-info">
          <span className="module-tree-node-name">{node.name}</span>
        </div>
        <div className="module-tree-node-stats">
          <Tooltip title={`健康分: ${node.healthScore} (${healthStyle.text})`}>
            <span className={`health-score ${healthStyle.className}`}>
              {node.healthScore}
            </span>
          </Tooltip>
          {node.bugCount > 0 && (
            <Tooltip title={`缺陷数量: ${node.bugCount}`}>
              <span className="bug-count">
                <BugOutlined style={{ marginRight: 2 }} />
                {node.bugCount}
              </span>
            </Tooltip>
          )}
        </div>
      </div>
    );
  };

  // 递归构建树数据
  const buildTreeData = (nodes: ModuleTreeNode[]): TreeDataNode[] => {
    return nodes.map(node => ({
      key: node.id.toString(),
      title: buildNodeTitle(node),
      icon: node.isContentPage ? <FileTextOutlined /> : <FolderOutlined />,
      isLeaf: node.isContentPage,
      children: node.children ? buildTreeData(node.children) : undefined,
      originNode: node
    }));
  };

  // 处理节点选择
  const handleSelect = (selectedKeys: React.Key[], info: any) => {
    if (selectedKeys.length > 0) {
      const moduleId = parseInt(selectedKeys[0] as string);
      onSelect(moduleId);
    } else {
      onSelect(null);
    }
  };

  // 处理节点展开 - 允许用户手动控制展开状态
  const handleExpand = (expandedKeys: React.Key[]) => {
    setExpandedKeys(expandedKeys as string[]);
  };

  // 自动展开所有节点
  useEffect(() => {
    const getAllKeys = (nodes: ModuleTreeNode[], keys: string[] = []): string[] => {
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          keys.push(node.id.toString());
          getAllKeys(node.children, keys);
        }
      });
      return keys;
    };

    if (treeData.length > 0) {
      const allKeys = getAllKeys(treeData);
      setExpandedKeys(allKeys);
    }
  }, [treeData]);

  const treeDataFormatted = buildTreeData(treeData);

  return (
    <div className="module-health-tree">
      <div className="tree-header">
        <Space>
          <Text strong>模块健康分析</Text>
          <Tooltip title="点击模块查看详细分析，健康分基于缺陷数量和优先级计算">
            <Text type="secondary" style={{ fontSize: '12px' }}>
              (点击查看详情)
            </Text>
          </Tooltip>
        </Space>
      </div>
      
      <div className="tree-legend">
        <Space size="small">
          <span className="legend-item">
            <span className="health-score excellent">90+</span>
            <Text type="secondary" style={{ fontSize: '11px' }}>优秀</Text>
          </span>
          <span className="legend-item">
            <span className="health-score good">70+</span>
            <Text type="secondary" style={{ fontSize: '11px' }}>良好</Text>
          </span>
          <span className="legend-item">
            <span className="health-score warning">50+</span>
            <Text type="secondary" style={{ fontSize: '11px' }}>警告</Text>
          </span>
          <span className="legend-item">
            <span className="health-score danger">&lt;50</span>
            <Text type="secondary" style={{ fontSize: '11px' }}>危险</Text>
          </span>
        </Space>
      </div>

      <Tree
        treeData={treeDataFormatted}
        selectedKeys={selectedKeys}
        expandedKeys={expandedKeys}
        onSelect={handleSelect}
        onExpand={handleExpand}
        showIcon
        blockNode
        defaultExpandAll
        style={{ marginTop: 12 }}
      />


    </div>
  );
};

export default ModuleHealthTree;
