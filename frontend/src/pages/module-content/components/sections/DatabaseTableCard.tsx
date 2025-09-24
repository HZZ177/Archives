import React, { useState, useRef, useEffect } from 'react';
import { Card, Typography, Tag, Space, Button, Tooltip, Table } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  DatabaseOutlined,
  KeyOutlined,
  DownOutlined,
  UpOutlined,
  NumberOutlined,
  CalendarOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { DatabaseTable, DatabaseTableColumn } from '../../../../types/modules';
import { CSSTransition } from 'react-transition-group';
import './SectionStyles.css';

interface CustomIconProps {
    style?: React.CSSProperties;
}

// 自定义图标，因为 antd 的 FieldStringOutlined 不在主包中
const FieldStringOutlined: React.FC<CustomIconProps> = ({ style }) => (
    <svg viewBox="64 64 896 896" focusable="false" data-icon="field-string" width="1em" height="1em" fill="currentColor" aria-hidden="true" style={style}>
      <path d="M368 744c0 4.4-3.6 8-8 8h-80c-4.4 0-8-3.6-8-8V280c0-4.4 3.6-8 8-8h80c4.4 0 8 3.6 8 8v464zm192 0c0 4.4-3.6 8-8 8h-80c-4.4 0-8-3.6-8-8V280c0-4.4 3.6-8 8-8h80c4.4 0 8 3.6 8 8v464zm192 0c0 4.4-3.6 8-8 8h-80c-4.4 0-8-3.6-8-8V280c0-4.4 3.6-8 8-8h80c4.4 0 8 3.6 8 8v464z" />
    </svg>
  );
  
  const FieldBinaryOutlined: React.FC<CustomIconProps> = ({ style }) => (
    <svg viewBox="64 64 896 896" focusable="false" data-icon="field-binary" width="1em" height="1em" fill="currentColor" aria-hidden="true" style={style}>
      <path d="M880 112H144c-17.7 0-32 14.3-32 32v736c0 17.7 14.3 32 32 32h736c17.7 0 32-14.3 32-32V144c0-17.7-14.3-32-32-32zM320 744c0 4.4-3.6 8-8 8h-80c-4.4 0-8-3.6-8-8V280c0-4.4 3.6-8 8-8h80c4.4 0 8 3.6 8 8v464zm192 0c0 4.4-3.6 8-8 8h-80c-4.4 0-8-3.6-8-8V280c0-4.4 3.6-8 8-8h80c4.4 0 8 3.6 8 8v464zm192 0c0 4.4-3.6 8-8 8h-80c-4.4 0-8-3.6-8-8V280c0-4.4 3.6-8 8-8h80c4.4 0 8 3.6 8 8v464z" />
    </svg>
  );

const { Text, Title } = Typography;

interface DatabaseTableCardProps {
  data: DatabaseTable;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isEditMode: boolean;
}

const getFieldTypeIcon = (fieldType: string) => {
    const type = fieldType.toLowerCase();
    const style = { color: '#8c8c8c', marginRight: '6px', fontSize: '14px' };
    if (type.includes('int') || type.includes('float') || type.includes('double') || type.includes('decimal')) {
      return <NumberOutlined style={{...style, color: '#1890ff'}} />;
    } else if (type.includes('char') || type.includes('text') || type === 'json' || type === 'enum' || type === 'set') {
      return <FieldStringOutlined style={{...style, color: '#52c41a'}} />;
    } else if (type.includes('date') || type.includes('time') || type === 'year') {
      return <CalendarOutlined style={{...style, color: '#fa8c16'}} />;
    } else if (type.includes('blob') || type.includes('binary')) {
      return <FieldBinaryOutlined style={{...style, color: '#722ed1'}} />;
    } else {
      return <InfoCircleOutlined style={{...style, color: '#d9d9d9'}} />;
    }
  };


const DatabaseTableCard: React.FC<DatabaseTableCardProps> = ({
  data,
  isCollapsed,
  onToggleCollapse,
  onEdit,
  onDelete,
  isEditMode,
}) => {
  const contentRef = useRef(null);
  const primaryKey = data.columns.find(col => col.is_primary_key);

  const columns = [
    {
      title: '字段名',
      dataIndex: 'field_name',
      key: 'field_name',
      width: '20%',
      render: (text: string, record: DatabaseTableColumn) => (
        <Space>
          <span style={{ fontWeight: record.is_primary_key ? 500 : 400 }}>{text}</span>
          {record.is_primary_key && (
            <Tooltip title="主键" color="white" styles={{ body: { color: 'black' } }}>
              <KeyOutlined style={{ color: '#faad14' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
        title: '类型',
        dataIndex: 'field_type',
        key: 'field_type',
        width: '15%',
        render: (text: string, record: DatabaseTableColumn) => (
          <Space>
            {getFieldTypeIcon(text)}
            <Tag>{text.toUpperCase()}{record.length ? `(${record.length})` : ''}</Tag>
          </Space>
        ),
      },
    {
      title: '可空',
      dataIndex: 'nullable',
      key: 'nullable',
      width: '8%',
      render: (nullable: boolean) => (nullable ? <Tag color="green">是</Tag> : <Tag color="red">否</Tag>),
    },
    {
      title: '默认值',
      dataIndex: 'default_value',
      key: 'default_value',
      width: '15%',
      render: (text: any) => <Text style={{color: '#8c8c8c'}}>{text || '-'}</Text>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => <Tooltip title={text} color="white" styles={{ body: { color: 'black' } }}><Text type="secondary">{text || '-'}</Text></Tooltip>,
    },
  ];

  const renderCardContent = () => (
    <div className="db-table-card-container">
      <div className="db-table-card-header" onClick={onToggleCollapse}>
        <div className="db-table-card-icon-container">
          <DatabaseOutlined />
        </div>
        <div className="db-table-card-content">
          <Text strong className="db-table-card-title-text">{data.name}</Text>
          <div className="db-table-card-desc">
            <Text type="secondary" ellipsis>{data.description || '暂无表描述'}</Text>
          </div>
        </div>
        <div className="db-table-card-right-panel">
            <div className="db-table-card-tags">
                <Tag>{`${data.columns.length} 个字段`}</Tag>
                {primaryKey && <Tag icon={<KeyOutlined />} color="gold">{primaryKey.field_name}</Tag>}
            </div>
            <div className="db-table-card-actions">
            <Button type="primary" size="small" onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}>
                {isCollapsed ? '查看详情' : '收起'}
            </Button>
            {isEditMode && (
                <div className="db-table-card-icon-buttons">
                {onEdit && (
                    <Tooltip title="编辑" color="white" styles={{ body: { color: 'black' } }}>
                    <Button
                        type="text"
                        size="small"
                        className="db-table-card-icon-button edit-button"
                        icon={<EditOutlined />}
                        onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    />
                    </Tooltip>
                )}
                {onDelete && (
                    <Tooltip title="删除" color="white" styles={{ body: { color: 'black' } }}>
                    <Button
                        type="text"
                        size="small"
                        className="db-table-card-icon-button delete-button"
                        icon={<DeleteOutlined />}
                        danger
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    />
                    </Tooltip>
                )}
                </div>
            )}
            </div>
        </div>
      </div>
      <CSSTransition
        in={!isCollapsed}
        timeout={300}
        classNames="api-expand"
        unmountOnExit
        nodeRef={contentRef}
      >
        <div className="db-table-card-details-container" ref={contentRef}>
          <Table
            columns={columns}
            dataSource={data.columns}
            rowKey="field_name"
            pagination={false}
            size="small"
          />
        </div>
      </CSSTransition>
    </div>
  );

  return (
    <Card
      className={`db-table-card ${!isCollapsed ? 'expanded' : 'collapsed'}`}
      hoverable={false}
      styles={{ body: { padding: '0' } }}
    >
      {renderCardContent()}
    </Card>
  );
};

export default DatabaseTableCard; 