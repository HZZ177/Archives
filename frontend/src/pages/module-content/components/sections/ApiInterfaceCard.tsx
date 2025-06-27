import React, { useState, useRef, useEffect } from 'react';
import { Card, Typography, Tag, Space, Button, Collapse, Divider, Empty, Tooltip, Modal } from 'antd';
import { EditOutlined, DeleteOutlined, EllipsisOutlined, DownOutlined, RightOutlined, EyeOutlined } from '@ant-design/icons';
import { ApiInterfaceCard as ApiCardType, ApiParam } from '../../../../types/modules';
import { CSSTransition } from 'react-transition-group';
import './SectionStyles.css';

const { Text, Title } = Typography;
const { Panel } = Collapse;

// 请求方法对应的颜色
const METHOD_COLORS: Record<string, string> = {
  GET: 'green',
  POST: 'blue',
  PUT: 'orange',
  DELETE: 'red',
  PATCH: 'purple'
};

interface ApiInterfaceCardProps {
  data: ApiCardType;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  isEditable?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: (id: string, expanded: boolean) => void;
  showEditButton?: boolean;
}

const ApiInterfaceCard: React.FC<ApiInterfaceCardProps> = ({
  data,
  onEdit,
  onDelete,
  isEditable = true,
  isExpanded = false,
  onToggleExpand,
  showEditButton = true
}) => {
  const [expanded, setExpanded] = useState(isExpanded);
  const [expandedParams, setExpandedParams] = useState<string[]>([]);
  // 添加示例值弹窗相关状态
  const [exampleModalVisible, setExampleModalVisible] = useState(false);
  const [currentExample, setCurrentExample] = useState<string>('');
  const [currentParamName, setCurrentParamName] = useState<string>('');

  // 监听外部isExpanded属性变化
  useEffect(() => {
    setExpanded(isExpanded);
  }, [isExpanded]);

  // 切换展开状态
  const toggleExpand = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    
    // 通知父组件
    if (onToggleExpand) {
      onToggleExpand(data.id, newExpanded);
    }
  };

  // 切换参数展开状态
  const toggleParamExpand = (paramId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (expandedParams.includes(paramId)) {
      setExpandedParams(expandedParams.filter(id => id !== paramId));
    } else {
      setExpandedParams([...expandedParams, paramId]);
    }
  };

  // 获取方法对应的颜色
  const getMethodColor = (method: string | null | undefined): string => {
    if (!method) return 'default';
    return METHOD_COLORS[method.toUpperCase()] || 'default';
  };

  // 显示示例值弹窗
  const showExampleModal = (example: string | null | undefined, paramName: string) => {
    setCurrentExample(example || '-');
    setCurrentParamName(paramName);
    setExampleModalVisible(true);
  };

  // 关闭示例值弹窗
  const closeExampleModal = () => {
    setExampleModalVisible(false);
  };

  // 渲染单个参数行
  const renderParamRow = (param: ApiParam, index: number, level: number = 0, isResponse: boolean = false) => {
    const hasChildren = param.children && param.children.length > 0;
    const paramId = `param-${level}-${index}`;
    const isExpanded = expandedParams.includes(paramId);
    
    return (
      <div key={paramId}>
        <div className={`api-param-row ${level > 0 ? 'child-param-row' : ''}`}>
          <div className="api-param-name">
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              paddingLeft: level * 24 
            }}>
              {hasChildren && (
                <span 
                  className={`ant-table-row-expand-icon ${isExpanded ? 'ant-table-row-expand-icon-expanded' : 'ant-table-row-expand-icon-collapsed'}`}
                  onClick={(e) => toggleParamExpand(paramId, e)}
                />
              )}
              <Tooltip title={param.name} align={{ offset: [0, 0] }} arrow={{ pointAtCenter: true }}>
                <span className={hasChildren ? 'has-children' : ''}>{param.name}</span>
              </Tooltip>
            </div>
          </div>
          <div className="api-param-type">
            <Tag>{param.type}</Tag>
          </div>
          {!isResponse && (
            <div className="api-param-required">
              {param.required ? <Tag color="red">是</Tag> : <Tag color="green">否</Tag>}
            </div>
          )}
          <div className="api-param-desc">
            <Text ellipsis={{ tooltip: param.description }}>
              {param.description || '-'}
            </Text>
          </div>
          <div className="api-param-example">
            <Button 
              type="link" 
              size="small" 
              icon={<EyeOutlined />} 
              onClick={(e) => {
                e.stopPropagation();
                showExampleModal(param.example, param.name);
              }}
            >
              查看
            </Button>
          </div>
        </div>
        
        {/* 渲染子参数 */}
        {hasChildren && isExpanded && (
          <div className="param-children">
            {param.children!.map((childParam, childIndex) => 
              renderParamRow(childParam, childIndex, level + 1, isResponse)
            )}
          </div>
        )}
      </div>
    );
  };

  // 渲染参数表格
  const renderParamTable = (params: ApiParam[] | undefined, isResponse: boolean = false) => {
    if (!params || params.length === 0) {
      return <div className="api-param-empty">暂无参数</div>;
    }

    return (
      <div className="api-param-table-container">
        <div className="api-param-table">
          <div className="api-param-header">
            <div className="api-param-name">参数名</div>
            <div className="api-param-type">类型</div>
            {!isResponse && <div className="api-param-required">必填</div>}
            <div className="api-param-desc">描述</div>
            <div className="api-param-example">示例值</div>
          </div>
          <div className="api-param-body">
            {params.map((param, index) => renderParamRow(param, index, 0, isResponse))}
          </div>
        </div>
      </div>
    );
  };

  // 创建对内容区域的引用，用于动画效果
  const contentRef = useRef(null);

  // 渲染统一的卡片内容
  const renderCardContent = () => (
    <div className="api-card-container">
      {/* 卡片头部区域 - 始终显示 */}
      <div className="api-card-header" onClick={toggleExpand}>
        <div className="api-card-method-container">
          <Tag color={getMethodColor(data.method)}>
            {data.method || "GET"}
          </Tag>
        </div>
        <div className="api-card-content">
          <div className="api-card-path">
            <Text strong>{data.path}</Text>
          </div>
          <div className="api-card-desc">
            {data.description ? (
              <Text type="secondary" ellipsis={{ tooltip: data.description }}>
                {data.description}
              </Text>
            ) : (
              <Text type="secondary" className="api-card-empty-desc">
                暂无接口描述
              </Text>
            )}
          </div>
        </div>
        <div className="api-card-actions">
          <Button
            type="primary"
            size="small"
            onClick={toggleExpand}
          >
            {expanded ? '收起' : '查看详情'}
          </Button>
          {isEditable && (
            <div className="api-card-icon-buttons">
              {showEditButton && (
                <Tooltip title="编辑">
                  <Button
                    type="text"
                    size="small"
                    className="api-card-icon-button edit-button"
                    icon={<EditOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(data.id);
                    }}
                  />
                </Tooltip>
              )}
              <Tooltip title="删除">
                <Button
                  type="text"
                  size="small"
                  className="api-card-icon-button delete-button"
                  icon={<DeleteOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(data.id);
                  }}
                />
              </Tooltip>
            </div>
          )}
        </div>
      </div>

      {/* 详细内容区域 - 使用CSSTransition实现展开/收起动效 */}
      <CSSTransition
        in={expanded}
        timeout={300}
        classNames="api-expand"
        unmountOnExit
        nodeRef={contentRef}
      >
        <div className="api-card-details-container" ref={contentRef}>
          <div className="api-card-details">
            {data.contentType && (
              <div className="api-detail-item">
                <Text type="secondary">内容类型:</Text>
                <Text>{data.contentType}</Text>
              </div>
            )}
          </div>

          <Divider orientation="left">请求参数</Divider>
          {renderParamTable(data.requestParams)}

          <Divider orientation="left">响应参数</Divider>
          {renderParamTable(data.responseParams, true)}
        </div>
      </CSSTransition>
    </div>
  );

  return (
    <>
      <Card 
        className={`api-interface-card ${expanded ? 'expanded' : 'collapsed'}`}
        hoverable={false}
        bodyStyle={{ padding: expanded ? '16px' : '12px 16px' }}
      >
        {renderCardContent()}
      </Card>

      {/* 示例值弹窗 */}
      <Modal
        title={`参数 "${currentParamName}" 的示例值`}
        open={exampleModalVisible}
        onCancel={closeExampleModal}
        footer={[
          <Button key="close" onClick={closeExampleModal}>
            关闭
          </Button>
        ]}
        width={500}
      >
        <div className="example-content">
          {currentExample && currentExample !== '-' ? (
            <pre className="example-code">
              {typeof currentExample === 'object' 
                ? JSON.stringify(currentExample, null, 2) 
                : currentExample}
            </pre>
          ) : (
            <Empty description="暂无示例值" />
          )}
        </div>
      </Modal>
    </>
  );
};

export default ApiInterfaceCard; 