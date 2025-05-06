import React from 'react';
import { Button, Input, Form, Table, Space } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { DatabaseTable, DatabaseTableColumn } from '../../../../types/modules';

interface DatabaseTablesSectionProps {
  tables: DatabaseTable[];
  onChange: (tables: DatabaseTable[]) => void;
}

const DatabaseTablesSection: React.FC<DatabaseTablesSectionProps> = ({ tables, onChange }) => {
  // 添加新表
  const addTable = () => {
    const newTable: DatabaseTable = {
      table_name: '',
      columns: []
    };
    onChange([...tables, newTable]);
  };

  // 更新表信息
  const updateTableName = (index: number, tableName: string) => {
    const newTables = [...tables];
    newTables[index] = {
      ...newTables[index],
      table_name: tableName
    };
    onChange(newTables);
  };

  // 删除表
  const removeTable = (index: number) => {
    const newTables = [...tables];
    newTables.splice(index, 1);
    onChange(newTables);
  };

  // 添加列
  const addColumn = (tableIndex: number) => {
    const newColumn: DatabaseTableColumn = {
      field_name: '',
      field_type: 'varchar',
      description: '',
    };
    
    const newTables = [...tables];
    newTables[tableIndex] = {
      ...newTables[tableIndex],
      columns: [...newTables[tableIndex].columns, newColumn]
    };
    onChange(newTables);
  };

  // 更新列信息
  const updateColumn = (tableIndex: number, columnIndex: number, field: keyof DatabaseTableColumn, value: string) => {
    const newTables = [...tables];
    const newColumns = [...newTables[tableIndex].columns];
    newColumns[columnIndex] = {
      ...newColumns[columnIndex],
      [field]: value
    };
    newTables[tableIndex] = {
      ...newTables[tableIndex],
      columns: newColumns
    };
    onChange(newTables);
  };

  // 删除列
  const removeColumn = (tableIndex: number, columnIndex: number) => {
    const newTables = [...tables];
    const newColumns = [...newTables[tableIndex].columns];
    newColumns.splice(columnIndex, 1);
    newTables[tableIndex] = {
      ...newTables[tableIndex],
      columns: newColumns
    };
    onChange(newTables);
  };

  // 表格列定义
  const getColumnsDefinition = (tableIndex: number): ColumnsType<DatabaseTableColumn> => {
    return [
      {
        title: '字段名',
        dataIndex: 'field_name',
        key: 'field_name',
        width: '20%',
        render: (text, record, index) => (
          <Input
            value={text}
            onChange={(e) => updateColumn(tableIndex, index, 'field_name', e.target.value)}
            placeholder="输入字段名"
          />
        )
      },
      {
        title: '字段类型',
        dataIndex: 'field_type',
        key: 'field_type',
        width: '15%',
        render: (text, record, index) => (
          <Input
            value={text}
            onChange={(e) => updateColumn(tableIndex, index, 'field_type', e.target.value)}
            placeholder="输入字段类型"
          />
        )
      },
      {
        title: '描述',
        dataIndex: 'description',
        key: 'description',
        render: (text, record, index) => (
          <Input
            value={text || ''}
            onChange={(e) => updateColumn(tableIndex, index, 'description', e.target.value)}
            placeholder="输入字段描述"
          />
        )
      },
      {
        title: '操作',
        key: 'action',
        width: '10%',
        render: (_, record, index) => (
          <Button
            type="text"
            danger
            icon={<MinusCircleOutlined />}
            onClick={() => removeColumn(tableIndex, index)}
          >
            删除
          </Button>
        )
      }
    ];
  };

  return (
    <div className="section-content">
      {tables.map((table, tableIndex) => (
        <div key={tableIndex} style={{ marginBottom: '24px', border: '1px solid #f0f0f0', padding: '16px', borderRadius: '2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <Form.Item label="表名" style={{ marginBottom: 0, width: '80%' }}>
              <Input
                value={table.table_name}
                onChange={(e) => updateTableName(tableIndex, e.target.value)}
                placeholder="输入表名"
              />
            </Form.Item>
            <Button
              type="text"
              danger
              icon={<MinusCircleOutlined />}
              onClick={() => removeTable(tableIndex)}
            >
              删除表
            </Button>
          </div>
          
          <Table
            dataSource={table.columns}
            columns={getColumnsDefinition(tableIndex)}
            pagination={false}
            rowKey={(record, index) => `${tableIndex}_column_${index}`}
            size="small"
            style={{ marginBottom: '16px' }}
          />
          
          <Button
            type="dashed"
            onClick={() => addColumn(tableIndex)}
            block
            icon={<PlusOutlined />}
          >
            添加字段
          </Button>
        </div>
      ))}
      
      <Button
        type="dashed"
        onClick={addTable}
        block
        icon={<PlusOutlined />}
        style={{ marginTop: '16px' }}
      >
        添加数据库表
      </Button>
    </div>
  );
};

export default DatabaseTablesSection; 