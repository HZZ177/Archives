import React from 'react';
import { Table, Typography, Tag, Tooltip } from 'antd';
import { KeyOutlined, LinkOutlined } from '@ant-design/icons';
import { DatabaseTable } from '../../../types/modules';

// 扩展 DatabaseTable 类型以兼容旧版本的表结构
interface ExtendedDatabaseTable extends DatabaseTable {
  table_name?: string; // 兼容旧版本的表名属性
  columns_json?: any[]; // 兼容 WorkspaceTableRead 格式
}
import styles from './DatabaseTableDetail.module.css';

const { Title, Paragraph } = Typography;

interface DatabaseTableDetailProps {
  table: ExtendedDatabaseTable;
  simple?: boolean; // 是否为简化版（用于悬停预览）
}

const DatabaseTableDetail: React.FC<DatabaseTableDetailProps> = ({ table, simple = false }) => {

  
  // 确保表名存在
  const tableName = table?.table_name || table?.name || '未命名表';
  
  // 获取表字段，兼容多种可能的数据格式
  const tableColumns = table?.columns || table?.columns_json || [];
  // 构建字段列表的列配置
  const columns = [
    {
      title: '字段名',
      dataIndex: 'field_name',
      key: 'field_name',
      render: (text: string, record: any) => (
        <span>
          {text}
          {record.is_primary_key && (
            <Tooltip title="主键" color="white" overlayInnerStyle={{ color: 'black' }}>
              <KeyOutlined style={{ marginLeft: 4, color: '#1890ff' }} />
            </Tooltip>
          )}
          {record.foreign_key && (
            <Tooltip title={`外键: ${record.foreign_key.reference_table}.${record.foreign_key.reference_column}`} color="white" overlayInnerStyle={{ color: 'black' }}>
              <LinkOutlined style={{ marginLeft: 4, color: '#722ed1' }} />
            </Tooltip>
          )}
        </span>
      ),
    },
    {
      title: '类型',
      dataIndex: 'field_type',
      key: 'field_type',
      render: (text: string, record: any) => (
        <span>
          {text}
          {record.length && `(${record.length})`}
        </span>
      ),
    },
    {
      title: '约束',
      key: 'constraints',
      render: (text: string, record: any) => (
        <>
          {!record.nullable && <Tag color="red">非空</Tag>}
          {record.is_unique && <Tag color="blue">唯一</Tag>}
          {record.is_index && <Tag color="green">索引</Tag>}
        </>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
  ];

  // 简化版只显示前两列
  const simpleColumns = columns.slice(0, 2);

  // 检查是否有有效的表字段数据
  const hasValidColumns = Array.isArray(tableColumns) && tableColumns.length > 0;
  
  // 根据表格行数决定是否显示滚动条
  const rowCount = tableColumns.length;
  const showScroll = simple ? rowCount > 3 : rowCount > 5; // 简化版和完整版使用不同的阈值

  return (
    <div className={styles.tableDetail}>
      <Title level={4} className={styles.tableName}>
        {tableName}
      </Title>
      
      {table?.description && (
        <Paragraph className={styles.tableDescription}>
          {table.description}
        </Paragraph>
      )}
      
      {!hasValidColumns ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#999' }}>
          <p>表结构数据不完整或格式不正确</p>
          <p style={{ fontSize: '12px' }}>请检查表定义是否包含字段信息</p>
        </div>
      ) : (
      <Table
          dataSource={tableColumns}
        columns={simple ? simpleColumns : columns}
        pagination={false}
        size="small"
        rowKey="field_name"
        className={styles.fieldsTable}
          scroll={showScroll ? { y: simple ? 150 : 300 } : undefined}
      />
      )}
    </div>
  );
};

export default DatabaseTableDetail; 