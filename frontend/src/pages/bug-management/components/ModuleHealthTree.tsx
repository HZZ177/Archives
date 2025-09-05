import React, { useState, useEffect } from 'react';
import { Tree, Typography, Space, Tooltip } from 'antd';
import {
  FileTextOutlined,
  FolderOutlined,
  BugOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import { ModuleTreeNode } from '../../../types/bug-analysis';

const { Text } = Typography;

// 健康分规则说明内容
const HealthScoreRules = () => (
  <div
    style={{ maxWidth: '400px', lineHeight: '1.6', color: '#262626' }}
    onClick={(e) => e.stopPropagation()}
  >
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#262626' }}>模块健康分计算规则</div>
    </div>

    <div style={{ marginBottom: '8px', color: '#262626' }}>
      <span style={{ fontWeight: 'bold' }}>基础规则：</span>起始分数100分
    </div>

    <div style={{ marginBottom: '8px', color: '#262626' }}>
      <span style={{ fontWeight: 'bold' }}>优先级扣分：</span>
      <div style={{ marginLeft: '12px', fontSize: '12px', color: '#595959' }}>
        • 紧急：10分 &nbsp;&nbsp; • 高：8分<br/>
        • 中：5分 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; • 低：2分<br/>
        • 未指定：1分
      </div>
    </div>

    <div style={{ marginBottom: '8px', color: '#262626' }}>
      <span style={{ fontWeight: 'bold' }}>时间衰减：</span>
      <div style={{ marginLeft: '12px', fontSize: '12px', color: '#595959' }}>
        • 30天内：影响逐渐衰减<br/>
        • 30天后：影响归零
      </div>
    </div>

    <div style={{ marginBottom: '8px', color: '#262626' }}>
      <span style={{ fontWeight: 'bold' }}>状态调整：</span>
      <div style={{ marginLeft: '12px', fontSize: '12px', color: '#595959' }}>
        • 已解决/已关闭：影响减半<br/>
        • 其他状态：正常影响
      </div>
    </div>

    <div style={{ marginBottom: '8px', color: '#262626' }}>
      <span style={{ fontWeight: 'bold' }}>计算示例：</span>
      <div style={{
        marginLeft: '12px',
        fontSize: '12px',
        background: '#f5f5f5',
        padding: '8px',
        borderRadius: '4px',
        color: '#262626',
        border: '1px solid #e8e8e8'
      }}>
        紧急bug（5天前，未解决）：<br/>
        10 × (1-5/30) × 1.0 = 8.3分扣分<br/>
        <br/>
        高优先级bug（15天前，已解决）：<br/>
        8 × (1-15/30) × 0.5 = 2分扣分<br/>
        <br/>
        最终健康分：100 - 8.3 - 2 = 89.7分
      </div>
    </div>

    <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
      父节点使用加权平均汇总子节点健康分
    </div>
  </div>
);

// 模块健康分计算详情
const ModuleHealthScoreDetail = ({ node }: { node: ModuleTreeNode }) => {
  const details = node.calculationDetails;
  const isAggregated = node.isAggregated;
  const aggregationDetails = node.aggregationDetails;

  return (
    <div
      style={{ maxWidth: '450px', lineHeight: '1.6', color: '#262626' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#262626' }}>
          {node.name} - 健康分计算
        </div>
      </div>

      {node.bugCount === 0 ? (
        <div style={{ color: '#52c41a', fontSize: '12px' }}>
          无缺陷，健康分：100分
        </div>
      ) : isAggregated && aggregationDetails && aggregationDetails.length > 0 ? (
        // 显示汇总计算过程
        <div>
          <div style={{ marginBottom: '8px', fontSize: '12px', color: '#595959' }}>
            总缺陷数量：{node.bugCount}个（包含子模块）
          </div>

          <div style={{
            background: '#f5f5f5',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '12px',
            border: '1px solid #e8e8e8',
            marginBottom: '8px'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>加权平均计算过程：</div>
            <div style={{ fontFamily: 'monospace', lineHeight: '1.4' }}>
              {aggregationDetails.map((agg, index) => (
                <div key={index}>
                  {agg.calculation} = {agg.result}分
                </div>
              ))}
            </div>
          </div>

          {aggregationDetails.length > 0 && (
            <div style={{ fontSize: '11px', color: '#8c8c8c' }}>
              <div style={{ marginBottom: '4px', fontWeight: 'bold' }}>子模块贡献：</div>
              {aggregationDetails[0].childNodes.map((child, index) => (
                <div key={index} style={{ marginBottom: '2px' }}>
                  • {child.name}: {child.score}分 ({child.bugCount}个缺陷)
                </div>
              ))}
            </div>
          )}
        </div>
      ) : details ? (
        // 显示直接计算过程
        <div>
          <div style={{ marginBottom: '8px', fontSize: '12px', color: '#595959' }}>
            缺陷数量：{node.bugCount}个
          </div>

          <div style={{
            background: '#f5f5f5',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '12px',
            border: '1px solid #e8e8e8',
            marginBottom: '8px'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>计算过程：</div>
            <div style={{ fontFamily: 'monospace', lineHeight: '1.4' }}>
              {details.base_score}
              {details.details.map((detail, index) => (
                <span key={index}>
                  {' - '}({detail.base_deduction} × {detail.decay_factor} × {detail.status_factor})
                </span>
              ))}
              {' = '}{details.final_score}分
            </div>
          </div>

          {details.details.length > 0 && (
            <div style={{ fontSize: '11px', color: '#8c8c8c' }}>
              <div style={{ marginBottom: '4px', fontWeight: 'bold' }}>缺陷详情：</div>
              {details.details.slice(0, 3).map((detail, index) => (
                <div key={index} style={{ marginBottom: '2px' }}>
                  • {detail.title} ({detail.priority}, {detail.days_passed}天前) = {detail.deduction}分
                </div>
              ))}
              {details.details.length > 3 && (
                <div style={{ color: '#bfbfbf' }}>
                  ...还有{details.details.length - 3}个缺陷
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
          计算详情加载中...
        </div>
      )}
    </div>
  );
};

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
          <Tooltip
            title={<ModuleHealthScoreDetail node={node} />}
            color="#fff"
          >
            <span className={`health-score ${healthStyle.className}`}>
              {node.healthScore}
            </span>
          </Tooltip>
          {node.bugCount > 0 && (
            <span className="bug-count">
              <BugOutlined style={{ marginRight: 2 }} />
              {node.bugCount}
            </span>
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
  const handleSelect = (selectedKeys: React.Key[]) => {
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
          <Tooltip
            title={<HealthScoreRules />}
            placement="rightTop"
            color="#fff"
          >
            <QuestionCircleOutlined
              style={{
                color: '#1890ff',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            />
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
