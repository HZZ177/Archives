import React, { ChangeEvent, useState } from 'react';
import { Button, Input, Form, Table, Space } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { DatabaseTable, DatabaseTableColumn } from '../../../../types/modules';
import { MdEditor } from 'md-editor-rt';
import 'md-editor-rt/lib/style.css';
import './SectionStyles.css';

const { TextArea } = Input;

interface DatabaseTablesSectionProps {
  tables: DatabaseTable[];
  onChange: (tables: DatabaseTable[]) => void;
}

// 为了表格中的列宽度计算
const FIELD_NAME_WIDTH = '20%';
const FIELD_TYPE_WIDTH = '15%';
const ACTION_WIDTH = '10%';

const DatabaseTablesSection: React.FC<DatabaseTablesSectionProps> = ({ tables, onChange }) => {
  // 为描述字段的编辑器创建唯一ID
  const [editorIdsMap] = useState<Record<string, string>>({});
  
  // 获取或创建编辑器ID
  const getEditorId = (tableIndex: number, columnIndex: number) => {
    const key = `table-${tableIndex}-column-${columnIndex}`;
    if (!editorIdsMap[key]) {
      editorIdsMap[key] = `${key}-${Date.now()}`;
    }
    return editorIdsMap[key];
  };

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
      description: ''
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
        width: FIELD_NAME_WIDTH,
        render: (text: string, record: DatabaseTableColumn, index: number) => (
          <Input
            value={text}
            onChange={(e: ChangeEvent<HTMLInputElement>) => updateColumn(tableIndex, index, 'field_name', e.target.value)}
            placeholder="输入字段名"
          />
        )
      },
      {
        title: '字段类型',
        dataIndex: 'field_type',
        key: 'field_type',
        width: FIELD_TYPE_WIDTH,
        render: (text: string, record: DatabaseTableColumn, index: number) => (
          <Input
            value={text}
            onChange={(e: ChangeEvent<HTMLInputElement>) => updateColumn(tableIndex, index, 'field_type', e.target.value)}
            placeholder="输入字段类型"
          />
        )
      },
      {
        title: (
          <div>
            描述 <span style={{ fontSize: '12px', color: '#888' }}>(支持Markdown)</span>
          </div>
        ),
        dataIndex: 'description',
        key: 'description',
        render: (text: string | undefined, record: DatabaseTableColumn, index: number) => (
          <MdEditor
            modelValue={text || ''}
            onChange={(value) => updateColumn(tableIndex, index, 'description', value)}
            id={getEditorId(tableIndex, index)}
            language="zh-CN"
            previewTheme="github"
            codeTheme="atom"
            preview={true}
            style={{ height: '150px', boxShadow: '0 0 0 1px #f0f0f0' }}
            placeholder="输入字段描述（支持Markdown语法）"
            noMermaid // 禁用mermaid图表以减小空间占用
            noKatex // 禁用数学公式以减小空间占用
            tabWidth={2} // 减小tab宽度以节省空间
            toolbarsExclude={['github', 'save', 'fullscreen']} // 减少工具栏按钮
          />
        )
      },
      {
        title: '操作',
        key: 'action',
        width: ACTION_WIDTH,
        render: (_: any, record: DatabaseTableColumn, index: number) => (
          <Button
            type="text"
            danger
            icon={<MinusCircleOutlined />}
            onClick={() => removeColumn(tableIndex, index)}
            size="small"
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
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateTableName(tableIndex, e.target.value)}
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
            rowKey={(record: DatabaseTableColumn, index: number) => `${tableIndex}_column_${index}`}
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