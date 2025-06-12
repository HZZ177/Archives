import React from 'react';
import { Table, Typography, Tag, Tooltip } from 'antd';
import { KeyOutlined, LinkOutlined } from '@ant-design/icons';
import { DatabaseTable } from '../../../types/modules';
import styles from './DatabaseTableDetail.module.css';

const { Title, Paragraph } = Typography;

interface DatabaseTableDetailProps {
  table: DatabaseTable;
  simple?: boolean; // 是否为简化版（用于悬停预览）
}

const DatabaseTableDetail: React.FC<DatabaseTableDetailProps> = ({ table, simple = false }) => {
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
            <Tooltip title="主键">
              <KeyOutlined style={{ marginLeft: 4, color: '#1890ff' }} />
            </Tooltip>
          )}
          {record.foreign_key && (
            <Tooltip title={`外键: ${record.foreign_key.reference_table}.${record.foreign_key.reference_column}`}>
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

  return (
    <div className={styles.tableDetail}>
      <Title level={4} className={styles.tableName}>
        {table.table_name}
      </Title>
      
      {table.description && (
        <Paragraph className={styles.tableDescription}>
          {table.description}
        </Paragraph>
      )}
      
      <Table
        dataSource={table.columns}
        columns={simple ? simpleColumns : columns}
        pagination={false}
        size="small"
        rowKey="field_name"
        className={styles.fieldsTable}
        scroll={{ y: simple ? 150 : 300 }}
      />
    </div>
  );
};

export default DatabaseTableDetail; 