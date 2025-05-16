import React, { ChangeEvent, useState } from 'react';
import { Button, Input, Form, Table, Space, Select, Checkbox, Tooltip, Card, Tabs, Typography, Row, Col, message, Modal } from 'antd';
import { MinusCircleOutlined, PlusOutlined, InfoCircleOutlined, LinkOutlined, KeyOutlined, ExclamationCircleOutlined, ImportOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { DatabaseTable, DatabaseTableColumn } from '../../../../types/modules';
import './SectionStyles.css';

const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;
const { Text } = Typography;

interface DatabaseTablesSectionProps {
  tables: DatabaseTable[];
  onChange: (tables: DatabaseTable[]) => void;
}

// 数据库字段类型选项
const FIELD_TYPE_OPTIONS = [
  { value: 'int', label: 'INT' },
  { value: 'bigint', label: 'BIGINT' },
  { value: 'smallint', label: 'SMALLINT' },
  { value: 'tinyint', label: 'TINYINT' },
  { value: 'varchar', label: 'VARCHAR' },
  { value: 'char', label: 'CHAR' },
  { value: 'text', label: 'TEXT' },
  { value: 'mediumtext', label: 'MEDIUMTEXT' },
  { value: 'longtext', label: 'LONGTEXT' },
  { value: 'date', label: 'DATE' },
  { value: 'datetime', label: 'DATETIME' },
  { value: 'timestamp', label: 'TIMESTAMP' },
  { value: 'decimal', label: 'DECIMAL' },
  { value: 'float', label: 'FLOAT' },
  { value: 'double', label: 'DOUBLE' },
  { value: 'boolean', label: 'BOOLEAN' },
  { value: 'enum', label: 'ENUM' },
  { value: 'json', label: 'JSON' },
  { value: 'binary', label: 'BINARY' },
  { value: 'blob', label: 'BLOB' },
];

// 为了表格中的列宽度计算
const FIELD_NAME_WIDTH = '12%';
const FIELD_TYPE_WIDTH = '12%';
const FIELD_LENGTH_WIDTH = '8%';
const NULLABLE_WIDTH = '7%';
const PK_WIDTH = '7%';
const DEFAULT_VALUE_WIDTH = '12%';
const OPTIONS_WIDTH = '18%';
const ACTION_WIDTH = '8%';

// 解析MySQL CREATE TABLE语句
const parseSql = (sql: string): DatabaseTable | null => {
  try {
    // 检查是否包含CREATE TABLE关键字
    if (!sql.match(/CREATE\s+TABLE/i)) {
      message.error('无法识别CREATE TABLE语句，请检查SQL语法');
      return null;
    }

    // 基本的正则表达式匹配CREATE TABLE语句
    const tableNameMatch = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`?(?:(\w+))`?\.)?`?(?:(\w+))`?\s*\(/i);
    if (!tableNameMatch) {
      message.error('无法解析表名，请检查SQL语句格式');
      return null;
    }

    const schemaName = tableNameMatch[1];
    const tableName = tableNameMatch[2];
    
    if (!tableName) {
      message.error('表名解析失败，请检查SQL语法');
      return null;
    }
    
    // 获取表主体内容（括号内的部分）
    const tableBodyMatch = sql.match(/\(([\s\S]*)\)(?:(?:\s+ENGINE|\s+CHARSET|\s+COLLATE|\s+AUTO_INCREMENT|\s+COMMENT).*)?\s*;?/i);
    if (!tableBodyMatch) {
      message.error('无法解析表结构，请检查SQL语句格式，确保有完整的括号');
      return null;
    }
    
    const tableBody = tableBodyMatch[1].trim();
    
    if (!tableBody) {
      message.error('表结构内容为空，请确保CREATE TABLE语句包含字段定义');
      return null;
    }
    
    // 提取表描述（COMMENT）
    let tableDescription: string | undefined;
    const tableCommentMatch = sql.match(/COMMENT\s*=?\s*'([^']*)'/i);
    if (tableCommentMatch) {
      tableDescription = tableCommentMatch[1];
    }
    
    // 将表主体分割成字段和约束定义
    // 使用更复杂的逻辑来正确分割字段（考虑引号、括号等）
    const definitions: string[] = [];
    let currentDef = '';
    let inQuotes = false;
    let parenCount = 0;
    
    for (let i = 0; i < tableBody.length; i++) {
      const char = tableBody[i];
      
      if (char === "'" && tableBody[i-1] !== '\\') {
        inQuotes = !inQuotes;
      } else if (char === '(' && !inQuotes) {
        parenCount++;
      } else if (char === ')' && !inQuotes) {
        parenCount--;
      }
      
      if (char === ',' && !inQuotes && parenCount === 0) {
        definitions.push(currentDef.trim());
        currentDef = '';
      } else {
        currentDef += char;
      }
    }
    
    if (currentDef.trim()) {
      definitions.push(currentDef.trim());
    }
    
    if (definitions.length === 0) {
      message.error('未能识别任何字段定义，请检查SQL语法');
      return null;
    }
    
    // 初始化结果对象
    const table: DatabaseTable = {
      table_name: tableName,
      schema_name: schemaName,
      description: tableDescription,
      columns: []
    };
    
    // 处理主键和外键约束
    const primaryKeyFields = new Set<string>();
    const uniqueFields = new Set<string>();
    const indexFields = new Set<string>();
    const foreignKeys: {[field: string]: {table: string, column: string}} = {};
    
    // 首先提取所有约束
    definitions.forEach(def => {
      try {
        // 主键约束
        const primaryKeyMatch = def.match(/PRIMARY\s+KEY\s*\((?:`?([^`,\)]+)`?)(?:\s*,\s*`?([^`,\)]+)`?)*\)/i);
        if (primaryKeyMatch) {
          for (let i = 1; i < primaryKeyMatch.length; i++) {
            if (primaryKeyMatch[i]) {
              primaryKeyFields.add(primaryKeyMatch[i]);
            }
          }
          return; // 跳过，不作为字段处理
        }
        
        // 唯一约束
        const uniqueMatch = def.match(/UNIQUE(?:\s+KEY|INDEX)?\s*(?:`?\w+`?)?\s*\((?:`?([^`,\)]+)`?)(?:\s*,\s*`?([^`,\)]+)`?)*\)/i);
        if (uniqueMatch) {
          for (let i = 1; i < uniqueMatch.length; i++) {
            if (uniqueMatch[i]) {
              uniqueFields.add(uniqueMatch[i]);
            }
          }
          return; // 跳过，不作为字段处理
        }
        
        // 普通索引
        const indexMatch = def.match(/(?:KEY|INDEX)\s+`?\w+`?\s*\((?:`?([^`,\)]+)`?)(?:\s*,\s*`?([^`,\)]+)`?)*\)/i);
        if (indexMatch) {
          for (let i = 1; i < indexMatch.length; i++) {
            if (indexMatch[i]) {
              indexFields.add(indexMatch[i]);
            }
          }
          return; // 跳过，不作为字段处理
        }
        
        // 外键约束
        const foreignKeyMatch = def.match(/FOREIGN\s+KEY\s*\(`?([^`\)]+)`?\)\s*REFERENCES\s+`?(\w+)`?\s*\(`?([^`\)]+)`?\)/i);
        if (foreignKeyMatch) {
          const [, field, referenceTable, referenceColumn] = foreignKeyMatch;
          foreignKeys[field] = {
            table: referenceTable,
            column: referenceColumn
          };
          return; // 跳过，不作为字段处理
        }
      } catch (error) {
        console.error('解析约束时出错:', error);
        // 继续处理其他定义
      }
    });
    
    // 处理字段定义
    let fieldCount = 0;
    
    definitions.forEach(def => {
      try {
        // 跳过约束定义
        if (def.match(/^(?:PRIMARY|UNIQUE|FOREIGN)\s+KEY/i) || def.match(/^KEY\s/i) || def.match(/^INDEX\s/i) || def.match(/^CONSTRAINT\s/i)) {
          return;
        }
        
        // 匹配字段定义：字段名 类型(长度) [NULL|NOT NULL] [DEFAULT 值] [其他约束]
        const fieldMatch = def.match(/^`?([^`]+)`?\s+(\w+)(?:\((\d+)(?:,\s*\d+)?\))?(.*)$/i);
        if (!fieldMatch) return;
        
        fieldCount++;
        const [, fieldName, fieldType, fieldLength, rest] = fieldMatch;
        
        // 检查是否为NOT NULL
        const isNullable = !rest.match(/\bNOT\s+NULL\b/i);
        
        // 提取默认值
        let defaultValue: string | undefined;
        const defaultMatch = rest.match(/DEFAULT\s+(?:'([^']*)'|(\d+(?:\.\d+)?)|(\bNULL\b)|\b(CURRENT_TIMESTAMP)(?:\(\d\))?\b)/i);
        if (defaultMatch) {
          defaultValue = defaultMatch[1] !== undefined ? defaultMatch[1] : 
                        defaultMatch[2] !== undefined ? defaultMatch[2] : 
                        defaultMatch[3] !== undefined ? defaultMatch[3] :
                        defaultMatch[4];
        }
        
        // 提取字段描述
        let fieldDescription: string | undefined;
        const commentMatch = rest.match(/COMMENT\s+'([^']*)'/i);
        if (commentMatch) {
          fieldDescription = commentMatch[1];
        }
        
        // 检查是否有PRIMARY KEY约束
        const isPrimaryKey = primaryKeyFields.has(fieldName) || rest.includes('PRIMARY KEY');
        
        // 检查是否有UNIQUE约束
        const isUnique = uniqueFields.has(fieldName) || rest.includes('UNIQUE');
        
        // 检查是否有索引
        const isIndex = indexFields.has(fieldName);
        
        // 创建列对象
        const column: DatabaseTableColumn = {
          field_name: fieldName,
          field_type: fieldType.toLowerCase(),
          length: fieldLength ? parseInt(fieldLength) : undefined,
          nullable: isNullable && !isPrimaryKey, // 主键不能为空
          default_value: defaultValue,
          description: fieldDescription,
          is_primary_key: isPrimaryKey,
          is_unique: isUnique,
          is_index: isIndex
        };
        
        // 设置外键信息
        if (foreignKeys[fieldName]) {
          column.foreign_key = {
            reference_table: foreignKeys[fieldName].table,
            reference_column: foreignKeys[fieldName].column
          };
        }
        
        table.columns.push(column);
      } catch (error) {
        console.error('解析字段时出错:', error);
        // 继续处理其他字段
      }
    });
    
    // 如果没有解析出任何列，返回错误
    if (table.columns.length === 0) {
      if (fieldCount > 0) {
        message.error('字段解析失败，请检查字段定义格式');
      } else {
        message.error('未能解析出任何字段，请检查SQL语句格式');
      }
      return null;
    }
    
    return table;
  } catch (error) {
    console.error('SQL解析错误:', error);
    message.error('SQL解析失败，请检查语法');
    return null;
  }
};

const DatabaseTablesSection: React.FC<DatabaseTablesSectionProps> = ({ tables, onChange }) => {
  const [activeTabKeys, setActiveTabKeys] = useState<Record<number, string>>({});
  const [tableErrors, setTableErrors] = useState<Record<number, string[]>>({});
  const [sqlInput, setSqlInput] = useState<string>('');
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const [collapsedTables, setCollapsedTables] = useState<Record<number, boolean>>({});
  const [sqlImportModalVisible, setSqlImportModalVisible] = useState<boolean>(false);
  const newTableRef = React.useRef<HTMLDivElement>(null);
  
  // 验证单个表的数据
  const validateTable = (table: DatabaseTable, tableIndex: number): string[] => {
    const errors: string[] = [];
    
    // 验证表名
    if (!table.table_name || table.table_name.trim() === '') {
      errors.push('表名不能为空');
    }
    
    // 验证是否有重复的字段名
    const fieldNames = new Set<string>();
    let hasDuplicateFieldName = false;
    const duplicateFieldNames = new Set<string>();
    
    table.columns.forEach(column => {
      const fieldName = column.field_name.trim();
      if (fieldName === '') {
        errors.push('字段名不能为空');
      } else if (fieldNames.has(fieldName)) {
        hasDuplicateFieldName = true;
        duplicateFieldNames.add(fieldName);
      } else {
        fieldNames.add(fieldName);
      }
    });
    
    if (hasDuplicateFieldName) {
      errors.push(`存在重复的字段名: ${Array.from(duplicateFieldNames).join(', ')}`);
    }
    
    // 验证主键
    const primaryKeys = table.columns.filter(col => col.is_primary_key);
    if (primaryKeys.length > 1) {
      errors.push('一个表只能有一个主键字段');
    }
    
    // 验证外键引用
    table.columns.forEach(column => {
      if (column.foreign_key) {
        if (!column.foreign_key.reference_table || column.foreign_key.reference_table.trim() === '') {
          errors.push(`字段 "${column.field_name}" 的外键引用表不能为空`);
        }
        if (!column.foreign_key.reference_column || column.foreign_key.reference_column.trim() === '') {
          errors.push(`字段 "${column.field_name}" 的外键引用列不能为空`);
    }
      }
    });
    
    // 更新错误状态
    setTableErrors(prev => ({
      ...prev,
      [tableIndex]: errors
    }));
    
    return errors;
  };
  
  // 验证所有表
  const validateAllTables = (): boolean => {
    let isValid = true;
    const newTableErrors: Record<number, string[]> = {};
    
    tables.forEach((table, index) => {
      const errors = validateTable(table, index);
      newTableErrors[index] = errors;
      if (errors.length > 0) {
        isValid = false;
      }
    });
    
    setTableErrors(newTableErrors);
    return isValid;
  };

  // 设置表格激活的Tab页
  const setTableActiveTab = (tableIndex: number, activeKey: string) => {
    setActiveTabKeys({
      ...activeTabKeys,
      [tableIndex]: activeKey
    });
  };

  // 获取表格激活的Tab页
  const getTableActiveTab = (tableIndex: number) => {
    return activeTabKeys[tableIndex] || 'columns';
  };

  // 添加新表
  const addTable = () => {
    const newTable: DatabaseTable = {
      table_name: '',
      description: '',
      schema_name: '',
      columns: []
    };
    onChange([...tables, newTable]);
  };

  // 更新表信息
  const updateTableField = (index: number, field: keyof DatabaseTable, value: any) => {
    const newTables = [...tables];
    newTables[index] = {
      ...newTables[index],
      [field]: value
    };
    onChange(newTables);
    
    // 重新验证表
    validateTable(newTables[index], index);
  };

  // 删除表
  const removeTable = (index: number) => {
    const newTables = [...tables];
    newTables.splice(index, 1);
    onChange(newTables);
    
    // 更新错误状态
    setTableErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[index];
      // 重新映射索引
      const updatedErrors: Record<number, string[]> = {};
      Object.keys(newErrors).forEach(key => {
        const keyNum = parseInt(key);
        if (keyNum > index) {
          updatedErrors[keyNum - 1] = newErrors[keyNum];
        } else {
          updatedErrors[keyNum] = newErrors[keyNum];
        }
      });
      return updatedErrors;
    });
  };

  // 添加列
  const addColumn = (tableIndex: number) => {
    const newColumn: DatabaseTableColumn = {
      field_name: '',
      field_type: 'varchar',
      length: 255,
      nullable: true,
      is_primary_key: false,
      is_unique: false,
      is_index: false,
      description: ''
    };
    
    const newTables = [...tables];
    newTables[tableIndex] = {
      ...newTables[tableIndex],
      columns: [...newTables[tableIndex].columns, newColumn]
    };
    onChange(newTables);
    
    // 重新验证表
    validateTable(newTables[tableIndex], tableIndex);
  };

  // 更新列信息
  const updateColumn = (tableIndex: number, columnIndex: number, field: keyof DatabaseTableColumn, value: any) => {
    const newTables = [...tables];
    const newColumns = [...newTables[tableIndex].columns];
    
    // 处理特殊情况：如果是主键，设置非空和唯一
    if (field === 'is_primary_key' && value === true) {
      // 确保其他列不是主键
      newColumns.forEach((col, idx) => {
        if (idx !== columnIndex && col.is_primary_key) {
          col.is_primary_key = false;
          message.info('一个表只能有一个主键，之前的主键已被取消');
        }
      });
      
      newColumns[columnIndex] = {
        ...newColumns[columnIndex],
        nullable: false,
        is_unique: true,
        [field]: value
      };
    } else {
    newColumns[columnIndex] = {
      ...newColumns[columnIndex],
        [field]: value
      };
    }
    
    newTables[tableIndex] = {
      ...newTables[tableIndex],
      columns: newColumns
    };
    onChange(newTables);
    
    // 重新验证表
    validateTable(newTables[tableIndex], tableIndex);
  };

  // 更新外键信息
  const updateForeignKey = (tableIndex: number, columnIndex: number, field: string, value: string) => {
    const newTables = [...tables];
    const newColumns = [...newTables[tableIndex].columns];
    
    // 初始化外键对象（如果不存在）
    if (!newColumns[columnIndex].foreign_key) {
      newColumns[columnIndex].foreign_key = {
        reference_table: '',
        reference_column: ''
      };
    }
    
    // 更新外键字段
    newColumns[columnIndex].foreign_key = {
      ...newColumns[columnIndex].foreign_key!,
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

  // 生成SQL预览
  const generateSql = (table: DatabaseTable): string => {
    let sql = `CREATE TABLE ${table.schema_name ? `${table.schema_name}.` : ''}${table.table_name} (\n`;
    
    // 添加列定义
    const columnDefinitions = table.columns.map(column => {
      let def = `  ${column.field_name} ${column.field_type.toUpperCase()}`;
      
      // 添加长度/精度
      if (column.length) {
        def += `(${column.length})`;
      }
      
      // 添加是否可为空
      def += column.nullable ? ' NULL' : ' NOT NULL';
      
      // 添加默认值
      if (column.default_value) {
        def += ` DEFAULT ${column.default_value}`;
      }
      
      // 添加主键、唯一约束
      if (column.is_primary_key) {
        def += ' PRIMARY KEY';
      } else if (column.is_unique) {
        def += ' UNIQUE';
      }
      
      return def;
    });
    
    sql += columnDefinitions.join(',\n');
    
    // 添加外键定义
    const foreignKeys = table.columns
      .filter(column => column.foreign_key)
      .map(column => {
        return `  FOREIGN KEY (${column.field_name}) REFERENCES ${column.foreign_key?.reference_table}(${column.foreign_key?.reference_column})`;
      });
    
    if (foreignKeys.length > 0) {
      sql += ',\n' + foreignKeys.join(',\n');
    }
    
    sql += '\n);';
    
    // 添加索引
    const indexes = table.columns
      .filter(column => column.is_index && !column.is_primary_key && !column.is_unique)
      .map(column => {
        return `CREATE INDEX idx_${table.table_name}_${column.field_name} ON ${table.table_name}(${column.field_name});`;
      });
    
    if (indexes.length > 0) {
      sql += '\n\n' + indexes.join('\n');
    }
    
    return sql;
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
          <Select
            value={text}
            onChange={(value: string) => updateColumn(tableIndex, index, 'field_type', value)}
            style={{ width: '100%' }}
          >
            {FIELD_TYPE_OPTIONS.map(option => (
              <Option key={option.value} value={option.value}>{option.label}</Option>
            ))}
          </Select>
        )
      },
      {
        title: '长度/精度',
        dataIndex: 'length',
        key: 'length',
        width: FIELD_LENGTH_WIDTH,
        render: (text: number | undefined, record: DatabaseTableColumn, index: number) => (
          <Input
            type="number"
            value={text}
            onChange={(e: ChangeEvent<HTMLInputElement>) => 
              updateColumn(tableIndex, index, 'length', e.target.value ? parseInt(e.target.value) : undefined)
            }
            placeholder="长度"
          />
        )
      },
      {
        title: '可为空',
        dataIndex: 'nullable',
        key: 'nullable',
        width: NULLABLE_WIDTH,
        render: (nullable: boolean, record: DatabaseTableColumn, index: number) => (
          <Checkbox
            checked={nullable}
            onChange={(e) => updateColumn(tableIndex, index, 'nullable', e.target.checked)}
            disabled={record.is_primary_key} // 主键不能为空
          />
        )
      },
      {
        title: '主键',
        dataIndex: 'is_primary_key',
        key: 'is_primary_key',
        width: PK_WIDTH,
        render: (isPrimaryKey: boolean, record: DatabaseTableColumn, index: number) => (
          <Checkbox
            checked={isPrimaryKey}
            onChange={(e) => updateColumn(tableIndex, index, 'is_primary_key', e.target.checked)}
          />
        )
      },
      {
        title: '默认值',
        dataIndex: 'default_value',
        key: 'default_value',
        width: DEFAULT_VALUE_WIDTH,
        render: (text: string | undefined, record: DatabaseTableColumn, index: number) => (
          <Input
            value={text}
            onChange={(e) => updateColumn(tableIndex, index, 'default_value', e.target.value)}
            placeholder="默认值"
          />
        )
      },
      {
        title: '选项',
        key: 'options',
        width: OPTIONS_WIDTH,
        render: (_, record: DatabaseTableColumn, index: number) => (
          <Space size="small">
            <Tooltip title="唯一约束">
              <Checkbox
                checked={record.is_unique}
                onChange={(e) => updateColumn(tableIndex, index, 'is_unique', e.target.checked)}
                disabled={record.is_primary_key} // 主键已经是唯一的
              >
                唯一
              </Checkbox>
            </Tooltip>
            <Tooltip title="索引">
              <Checkbox
                checked={record.is_index}
                onChange={(e) => updateColumn(tableIndex, index, 'is_index', e.target.checked)}
              >
                索引
              </Checkbox>
            </Tooltip>
          </Space>
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

  // 渲染字段详情tab
  const renderFieldDetailsTab = (tableIndex: number) => {
    const table = tables[tableIndex];
    
    return (
      <div className="field-details">
        {table.columns.map((column, columnIndex) => (
          <Card 
            key={`${tableIndex}_column_detail_${columnIndex}`}
            title={
              <div className="column-detail-header">
                <span>
                  {column.field_name || '未命名字段'} 
                  {column.is_primary_key && <KeyOutlined style={{ marginLeft: 8 }} />}
                </span>
                <Text type="secondary">{column.field_type}{column.length ? `(${column.length})` : ''}</Text>
              </div>
            }
            className="column-detail-card"
            style={{ marginBottom: 16 }}
            size="small"
          >
            <Form.Item label="描述">
              <TextArea
                value={column.description || ''}
                onChange={(e) => updateColumn(tableIndex, columnIndex, 'description', e.target.value)}
                placeholder="输入字段描述"
                autoSize={{ minRows: 3, maxRows: 6 }}
              />
            </Form.Item>
          </Card>
        ))}
        
        {table.columns.length === 0 && (
          <div className="empty-columns">尚未定义字段，请在「字段列表」标签页添加字段</div>
        )}
      </div>
    );
  };

  // 处理SQL导入
  const handleSqlImport = () => {
    if (!sqlInput.trim()) {
      message.warning('请输入SQL创建语句');
      return;
    }
    
    setImportLoading(true);
    
    try {
      const parsedTable = parseSql(sqlInput.trim());
      if (parsedTable) {
        // 成功解析，添加到表格列表
        const newTables = [...tables, parsedTable];
        onChange(newTables);
        message.success(`成功导入表 ${parsedTable.table_name}`);
        setSqlInput(''); // 清空输入框
        closeSqlImportModal(); // 关闭弹窗
        
        // 使用setTimeout以确保DOM已更新
        setTimeout(() => {
          // 滚动到新添加的表格
          if (newTableRef.current) {
            newTableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }
    } catch (error) {
      console.error('导入SQL时发生错误:', error);
      message.error('导入失败，请检查SQL语句格式');
    } finally {
      setImportLoading(false);
    }
  };

  // 填充示例SQL
  const fillExampleSql = () => {
    const exampleSql = `CREATE TABLE \`users\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`username\` varchar(50) NOT NULL COMMENT '用户登录名',
  \`email\` varchar(100) NOT NULL COMMENT '用户邮箱',
  \`mobile\` varchar(20) DEFAULT NULL COMMENT '手机号码',
  \`password\` varchar(255) NOT NULL COMMENT '登录密码',
  \`nickname\` varchar(50) DEFAULT NULL COMMENT '用户昵称',
  \`avatar\` varchar(255) DEFAULT NULL COMMENT '头像URL',
  \`gender\` tinyint(1) DEFAULT 0 COMMENT '性别：0-未知，1-男，2-女',
  \`birth_date\` date DEFAULT NULL COMMENT '出生日期',
  \`balance\` decimal(10,2) DEFAULT 0.00 COMMENT '账户余额',
  \`role_id\` int(11) DEFAULT NULL COMMENT '角色ID',
  \`is_active\` tinyint(1) DEFAULT 1 COMMENT '是否激活：0-未激活，1-已激活',
  \`last_login\` datetime DEFAULT NULL COMMENT '最后登录时间',
  \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  \`is_deleted\` tinyint(1) DEFAULT 0 COMMENT '是否删除：0-未删除，1-已删除',
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_username\` (\`username\`),
  UNIQUE KEY \`uk_email\` (\`email\`),
  INDEX \`idx_mobile\` (\`mobile\`),
  INDEX \`idx_is_active\` (\`is_active\`),
  INDEX \`idx_created_at\` (\`created_at\`),
  FOREIGN KEY (\`role_id\`) REFERENCES \`roles\`(\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户信息表';`;
    
    setSqlInput(exampleSql);
    message.info('已填充示例SQL，您可以根据需要修改并导入');
  };

  // 切换表格折叠状态
  const toggleTableCollapse = (tableIndex: number) => {
    setCollapsedTables(prev => ({
      ...prev,
      [tableIndex]: !prev[tableIndex]
    }));
  };

  // 检查表格是否折叠
  const isTableCollapsed = (tableIndex: number): boolean => {
    return !!collapsedTables[tableIndex];
  };

  // 打开SQL导入弹窗
  const showSqlImportModal = () => {
    setSqlImportModalVisible(true);
  };

  // 关闭SQL导入弹窗
  const closeSqlImportModal = () => {
    setSqlImportModalVisible(false);
  };

  return (
    <div className="section-content database-tables-section">
      {tables.map((table, tableIndex) => (
        <div 
          key={tableIndex} 
          className={`database-table-container ${isTableCollapsed(tableIndex) ? 'collapsed' : ''}`}
          ref={tableIndex === tables.length - 1 ? newTableRef : null}
        >
          <Card 
            title={
              <div className="table-header" style={{ padding: '0 12px' }}>
                <Row gutter={[16, 16]} align="middle" style={{ marginBottom: '12px', marginTop: '8px' }}>
                  <Col span={16}>
                    <Form.Item 
                      label="表名" 
                      style={{ marginBottom: 0, marginTop: 12 }}
                      validateStatus={table.table_name.trim() === '' ? 'error' : 'success'}
                      help={table.table_name.trim() === '' ? '表名不能为空' : ''}
                    >
              <Input
                value={table.table_name}
                        onChange={(e) => updateTableField(tableIndex, 'table_name', e.target.value)}
                placeholder="输入表名"
                        status={table.table_name.trim() === '' ? 'error' : ''}
              />
            </Form.Item>
                  </Col>
                  <Col span={8} style={{ textAlign: 'right' }}>
                    <Space>
                      <Button
                        type="text"
                        className="table-collapse-button"
                        icon={isTableCollapsed(tableIndex) ? <PlusOutlined /> : <MinusCircleOutlined />}
                        onClick={() => toggleTableCollapse(tableIndex)}
                      >
                        {isTableCollapsed(tableIndex) ? '展开' : '折叠'}
                      </Button>
            <Button
              type="text"
              danger
              icon={<MinusCircleOutlined />}
              onClick={() => removeTable(tableIndex)}
            >
              删除表
            </Button>
                    </Space>
                  </Col>
                </Row>
                <Row>
                  <Col span={24}>
                    <Form.Item label="表描述" style={{ marginBottom: 12 }}>
                      <Input
                        value={table.description}
                        onChange={(e) => updateTableField(tableIndex, 'description', e.target.value)}
                        placeholder="表描述"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            }
            style={{ marginBottom: 24 }}
            extra={
              tableErrors[tableIndex] && tableErrors[tableIndex].length > 0 ? (
                <div className="table-validation-errors">
                  <Tooltip 
                    title={
                      <ul className="error-list">
                        {tableErrors[tableIndex].map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    }
                  >
                    <span className="error-indicator">
                      <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> 
                      {tableErrors[tableIndex].length}个错误
                    </span>
                  </Tooltip>
          </div>
              ) : isTableCollapsed(tableIndex) ? (
                <span className="table-collapsed-summary">
                  共{table.columns.length}个字段
                  {table.columns.filter(col => col.is_primary_key).length > 0 && '，含主键'}
                  {table.columns.filter(col => col.foreign_key).length > 0 && '，含外键'}
                </span>
              ) : null
            }
          >
            {!isTableCollapsed(tableIndex) && (
              <Tabs 
                activeKey={getTableActiveTab(tableIndex)}
                onChange={(activeKey) => setTableActiveTab(tableIndex, activeKey)}
                style={{ paddingLeft: '8px', paddingRight: '8px' }}
              >
                <TabPane tab="字段列表" key="columns">
          <Table
            dataSource={table.columns}
            columns={getColumnsDefinition(tableIndex)}
            pagination={false}
                    rowKey={(record, index) => `${tableIndex}_column_${index}`}
            size="small"
                    style={{ marginBottom: 16 }}
                    rowClassName={(record, index) => {
                      if (!record.field_name || record.field_name.trim() === '') {
                        return 'error-row';
                      }
                      return '';
                    }}
          />
          
          <Button
            type="dashed"
            onClick={() => addColumn(tableIndex)}
            block
            icon={<PlusOutlined />}
                    style={{ marginTop: 8, marginBottom: 8 }}
          >
            添加字段
          </Button>
                </TabPane>
                
                <TabPane tab="字段详情" key="details">
                  {renderFieldDetailsTab(tableIndex)}
                </TabPane>
              </Tabs>
            )}
          </Card>
        </div>
      ))}
      
      <Button
        type="dashed"
        onClick={addTable}
        block
        icon={<PlusOutlined />}
        style={{ marginTop: 16 }}
      >
        添加数据库表
      </Button>
      
      {/* 操作按钮组 */}
      <Space style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}>
        <Button
          type="primary"
          style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
          icon={<ImportOutlined />}
          onClick={showSqlImportModal}
        >
          从SQL导入表结构
        </Button>
        
        <Button
          type="primary"
          onClick={() => {
            const isValid = validateAllTables();
            if (isValid) {
              message.success('所有表格数据验证通过');
            } else {
              message.error('表格数据存在错误，请查看错误提示修复');
            }
          }}
          disabled={tables.length === 0}
        >
          验证表结构
          <Tooltip title="验证所有表格结构是否符合规范，包括检查表名是否为空、字段名是否重复、主键是否唯一、外键引用是否完整等">
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </Button>
        
        <Button
          onClick={() => {
            // 全部展开
            const newCollapsedState: Record<number, boolean> = {};
            tables.forEach((_, index) => {
              newCollapsedState[index] = false;
            });
            setCollapsedTables(newCollapsedState);
          }}
          disabled={tables.length === 0}
        >
          全部展开
        </Button>
        
        <Button
          onClick={() => {
            // 全部折叠
            const newCollapsedState: Record<number, boolean> = {};
            tables.forEach((_, index) => {
              newCollapsedState[index] = true;
            });
            setCollapsedTables(newCollapsedState);
          }}
          disabled={tables.length === 0}
        >
          全部折叠
        </Button>
      </Space>
      
      {/* SQL导入弹窗 */}
      <Modal
        title="从SQL导入表结构"
        open={sqlImportModalVisible}
        onCancel={closeSqlImportModal}
        footer={null}
        width={800}
        destroyOnClose={true}
      >
        <div className="sql-import">
          <Form layout="vertical">
            <Form.Item label="粘贴MySQL CREATE TABLE语句">
              <TextArea
                value={sqlInput}
                onChange={(e) => setSqlInput(e.target.value)}
                placeholder="请粘贴MySQL CREATE TABLE语句..."
                autoSize={{ minRows: 10, maxRows: 20 }}
                className="sql-import-textarea"
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button 
                  type="primary" 
                  icon={<ImportOutlined />}
                  onClick={handleSqlImport}
                  loading={importLoading}
                >
                  解析并导入
                </Button>
                <Button 
                  onClick={fillExampleSql}
                  disabled={importLoading}
                >
                  填充示例SQL
                </Button>
                <Button 
                  onClick={() => setSqlInput('')}
                  disabled={!sqlInput.trim() || importLoading}
                >
                  清空
                </Button>
                <Button onClick={closeSqlImportModal}>
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
      </Modal>
    </div>
  );
};

export default DatabaseTablesSection; 