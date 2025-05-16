import React, { useState } from 'react';
import { Card, Typography, Tag, Space, Button, Collapse, Divider, Empty } from 'antd';
import { EditOutlined, DeleteOutlined, EllipsisOutlined } from '@ant-design/icons';
import { ApiInterfaceCard as ApiCardType, ApiParam } from '../../../../types/modules';
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
}

const ApiInterfaceCard: React.FC<ApiInterfaceCardProps> = ({
  data,
  onEdit,
  onDelete,
  isEditable = true
}) => {
  const [expanded, setExpanded] = useState(false);

  // 获取方法对应的颜色
  const getMethodColor = (method: string | null | undefined): string => {
    if (!method) return 'default';
    return METHOD_COLORS[method.toUpperCase()] || 'default';
  };

  // 渲染参数表格
  const renderParamTable = (params: ApiParam[] | undefined) => {
    if (!params || params.length === 0) {
      return <div className="api-param-empty">暂无参数</div>;
    }

    return (
      <div className="api-param-table-container">
        <div className="api-param-table">
          <div className="api-param-header">
            <div className="api-param-name">参数名</div>
            <div className="api-param-type">类型</div>
            <div className="api-param-required">必填</div>
            <div className="api-param-desc">描述</div>
            <div className="api-param-example">示例值</div>
          </div>
          {params.map((param, index) => (
            <div key={index} className="api-param-row">
              <div className="api-param-name">{param.name}</div>
              <div className="api-param-type">
                <Tag>{param.type}</Tag>
              </div>
              <div className="api-param-required">
                {param.required ? <Tag color="red">是</Tag> : <Tag color="green">否</Tag>}
              </div>
              <div className="api-param-desc">{param.description || '-'}</div>
              <div className="api-param-example">{param.example || '-'}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 卡片折叠状态内容 - 改进为更紧凑的水平布局
  const renderCollapsedContent = () => (
    <div className="api-card-collapsed">
      <div className="api-card-method">
        <Tag color={getMethodColor(data.method)}>{data.method}</Tag>
      </div>
      <div className="api-card-content">
        <div className="api-card-path">
          <Text strong>{data.path}</Text>
        </div>
        {data.description && (
          <div className="api-card-desc">
            <Text type="secondary" ellipsis={{ tooltip: data.description }}>
              {data.description}
            </Text>
          </div>
        )}
      </div>
      <div className="api-card-actions">
        <Button
          type="primary"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? '收起' : '查看详情'}
        </Button>
        {isEditable && (
          <>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(data.id);
              }}
            />
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(data.id);
              }}
            />
          </>
        )}
      </div>
    </div>
  );

  // 卡片展开状态内容
  const renderExpandedContent = () => (
    <div className="api-card-expanded">
      <div className="api-card-header">
        <Space align="center">
          <Tag color={getMethodColor(data.method)}>{data.method}</Tag>
          <Text strong>{data.path}</Text>
        </Space>
        <div className="api-card-actions">
          <Button
            type="primary"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            收起
          </Button>
          {isEditable && (
            <>
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(data.id);
                }}
              />
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(data.id);
                }}
              />
            </>
          )}
        </div>
      </div>

      <div className="api-card-details">
        {data.description && (
          <div className="api-detail-item">
            <Text type="secondary">描述:</Text>
            <Text>{data.description}</Text>
          </div>
        )}
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
      {renderParamTable(data.responseParams)}
    </div>
  );

  return (
    <Card 
      className={`api-interface-card ${expanded ? 'expanded' : 'collapsed'}`}
      hoverable={false}
      bodyStyle={{ padding: expanded ? '16px' : '12px 16px' }}
    >
      {expanded ? renderExpandedContent() : renderCollapsedContent()}
    </Card>
  );
};

export default ApiInterfaceCard; 