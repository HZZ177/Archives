import React, { ChangeEvent, useState } from 'react';
import { Button, Input, Form, Table, Space, Select, Checkbox, Tooltip, Card, Tabs, Typography, Row, Col, message, Modal } from 'antd';
import { MinusCircleOutlined, PlusOutlined, InfoCircleOutlined, LinkOutlined, KeyOutlined, ExclamationCircleOutlined, ImportOutlined, ExpandOutlined, CompressOutlined, DeleteOutlined, MinusOutlined, DownOutlined, UpOutlined, FileTextOutlined, DatabaseOutlined, MenuFoldOutlined, MenuUnfoldOutlined, NumberOutlined, CalendarOutlined, FieldStringOutlined, FieldTimeOutlined, FieldBinaryOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { DatabaseTable, DatabaseTableColumn } from '../../../../types/modules';
import './SectionStyles.css';
import { CSSTransition } from 'react-transition-group';

const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;
const { Text } = Typography;

interface DatabaseTablesSectionProps {
  tables: DatabaseTable[];
  onChange: (tables: DatabaseTable[]) => void;
  onValidationChange: (tableIndex: number, errors: string[]) => void;
  collapsedTables?: Set<number>;
  setCollapsedTables?: React.Dispatch<React.SetStateAction<Set<number>>>;
  isEditMode?: boolean;
}

// 数据库字段类型选项
const FIELD_TYPE_OPTIONS = [
  { label: 'VARCHAR', value: 'varchar' },
  { label: 'CHAR', value: 'char' },
  { label: 'TEXT', value: 'text' },
  { label: 'TINYTEXT', value: 'tinytext' },
  { label: 'MEDIUMTEXT', value: 'mediumtext' },
  { label: 'LONGTEXT', value: 'longtext' },
  { label: 'INT', value: 'int' },
  { label: 'TINYINT', value: 'tinyint' },
  { label: 'SMALLINT', value: 'smallint' },
  { label: 'MEDIUMINT', value: 'mediumint' },
  { label: 'BIGINT', value: 'bigint' },
  { label: 'FLOAT', value: 'float' },
  { label: 'DOUBLE', value: 'double' },
  { label: 'DECIMAL', value: 'decimal' },
  { label: 'DATE', value: 'date' },
  { label: 'DATETIME', value: 'datetime' },
  { label: 'TIMESTAMP', value: 'timestamp' },
  { label: 'TIME', value: 'time' },
  { label: 'YEAR', value: 'year' },
  { label: 'BOOLEAN', value: 'boolean' },
  { label: 'JSON', value: 'json' },
  { label: 'ENUM', value: 'enum' },
  { label: 'SET', value: 'set' },
  { label: 'BLOB', value: 'blob' },
  { label: 'BINARY', value: 'binary' },
  { label: 'VARBINARY', value: 'varbinary' },
];

// 为了表格中的列宽度计算
const FIELD_NAME_WIDTH = '12%';
const FIELD_TYPE_WIDTH = '12%';
const FIELD_LENGTH_WIDTH = '8%';
const NULLABLE_WIDTH = '7%';
const PK_WIDTH = '7%';
const DEFAULT_VALUE_WIDTH = '12%';
const OPTIONS_WIDTH = '18%';
const DESCRIPTION_WIDTH = '10%';
const ACTION_WIDTH = '8%';

const formItemLayout = {
  labelCol: { flex: '60px' },
  wrapperCol: { flex: '1' },
  colon: false,
  labelAlign: 'left' as const,
};

const inputStyle = { maxWidth: 400 };

// 添加parseSql函数
const parseSql = (sql: string): DatabaseTable | null => {
  try {
    // 提取表名
    const tableNameMatch = sql.match(/CREATE\s+TABLE\s+(?:`|")?([^`"\s(]+)(?:`|")?/i);
    if (!tableNameMatch) {
      throw new Error('无法解析表名');
    }
    const tableName = tableNameMatch[1];
    
    // 提取表描述
    const tableCommentMatch = sql.match(/COMMENT\s*=\s*['"]([^'"]+)['"]/i);
    const tableDescription = tableCommentMatch ? tableCommentMatch[1] : '';
    
    // 提取字段定义
    const columnsText = sql.substring(
      sql.indexOf('(') + 1,
      sql.lastIndexOf(')')
    );
    
    // 分割字段定义
    const columnDefinitions = columnsText.split(',').filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('PRIMARY KEY') && 
             !trimmed.startsWith('UNIQUE KEY') && !trimmed.startsWith('INDEX') && 
             !trimmed.startsWith('FOREIGN KEY') && !trimmed.startsWith('KEY');
    });
    
    // 解析主键
    const primaryKeyMatch = columnsText.match(/PRIMARY\s+KEY\s+\(([^)]+)\)/i);
    const primaryKeys = primaryKeyMatch 
      ? primaryKeyMatch[1].split(',').map(key => key.trim().replace(/[`"]/g, ''))
      : [];
    
    // 解析唯一键
    const uniqueKeyMatches = [...columnsText.matchAll(/UNIQUE\s+KEY\s+(?:`|")?[^`"\s(]+(?:`|")?\s*\(([^)]+)\)/gi)];
    const uniqueKeys: string[] = [];
    uniqueKeyMatches.forEach(match => {
      match[1].split(',').forEach(key => {
        uniqueKeys.push(key.trim().replace(/[`"]/g, ''));
      });
    });
    
    // 解析索引
    const indexMatches = [...columnsText.matchAll(/INDEX\s+(?:`|")?[^`"\s(]+(?:`|")?\s*\(([^)]+)\)/gi)];
    const indexKeys: string[] = [];
    indexMatches.forEach(match => {
      match[1].split(',').forEach(key => {
        indexKeys.push(key.trim().replace(/[`"]/g, ''));
      });
    });
    
    // 解析外键
    const foreignKeyMatches = [...columnsText.matchAll(/FOREIGN\s+KEY\s+\(([^)]+)\)\s+REFERENCES\s+(?:`|")?([^`"\s(]+)(?:`|")?\s*\(([^)]+)\)/gi)];
    const foreignKeys: Record<string, { reference_table: string, reference_column: string }> = {};
    foreignKeyMatches.forEach(match => {
      const localColumn = match[1].trim().replace(/[`"]/g, '');
      const referenceTable = match[2].trim();
      const referenceColumn = match[3].trim().replace(/[`"]/g, '');
      foreignKeys[localColumn] = { reference_table: referenceTable, reference_column: referenceColumn };
    });
    
    // 解析字段
    const columns: DatabaseTableColumn[] = [];
    columnDefinitions.forEach(def => {
      const fieldMatch = def.match(/^\s*(?:`|")?([^`"\s]+)(?:`|")?\s+([^\s(]+)(?:\(([^)]+)\))?\s*(.*)/i);
        if (!fieldMatch) return;
        
      const fieldName = fieldMatch[1];
      const fieldType = fieldMatch[2].toLowerCase();
      const fieldLength = fieldMatch[3] ? parseInt(fieldMatch[3]) : undefined;
      const fieldOptions = fieldMatch[4];
      
      // 检查是否可为空
      const nullable = !fieldOptions.includes('NOT NULL');
        
        // 提取默认值
      const defaultValueMatch = fieldOptions.match(/DEFAULT\s+(?:'([^']*)'|(\d+(?:\.\d+)?)|([^'\s,]+))/i);
      const defaultValue = defaultValueMatch 
        ? (defaultValueMatch[1] || defaultValueMatch[2] || defaultValueMatch[3])
        : undefined;
      
      // 提取注释
      const commentMatch = fieldOptions.match(/COMMENT\s+['"]([^'"]+)['"]/i);
      const description = commentMatch ? commentMatch[1] : '';
      
      // 检查是否为主键、唯一键或索引
      const isPrimaryKey = primaryKeys.includes(fieldName);
      const isUnique = uniqueKeys.includes(fieldName);
      const isIndex = indexKeys.includes(fieldName);
      
      // 检查是否有外键
      const foreignKey = foreignKeys[fieldName];
      
      columns.push({
          field_name: fieldName,
        field_type: fieldType,
        length: fieldLength,
        nullable,
          default_value: defaultValue,
        description,
          is_primary_key: isPrimaryKey,
          is_unique: isUnique,
        is_index: isIndex,
        foreign_key: foreignKey
      });
    });
    
    return {
      table_name: tableName,
      description: tableDescription,
      schema_name: '',
      columns
    };
  } catch (error) {
    console.error('SQL解析错误:', error);
    message.error('SQL解析失败，请检查格式');
    return null;
  }
};

// 添加字段类型图标映射
const getFieldTypeIcon = (fieldType: string) => {
  const type = fieldType.toLowerCase();
  if (type.includes('int') || type.includes('float') || type.includes('double') || type.includes('decimal')) {
    return <NumberOutlined style={{ color: '#1890ff', marginRight: 5 }} />;
  } else if (type.includes('char') || type.includes('text') || type === 'json' || type === 'enum' || type === 'set') {
    return <FieldStringOutlined style={{ color: '#52c41a', marginRight: 5 }} />;
  } else if (type.includes('date') || type.includes('time') || type === 'year') {
    return <CalendarOutlined style={{ color: '#fa8c16', marginRight: 5 }} />;
  } else if (type.includes('blob') || type.includes('binary')) {
    return <FieldBinaryOutlined style={{ color: '#722ed1', marginRight: 5 }} />;
  } else {
    return <InfoCircleOutlined style={{ color: '#d9d9d9', marginRight: 5 }} />;
  }
};

const DatabaseTablesSection: React.FC<DatabaseTablesSectionProps> = ({
  tables,
  onChange,
  onValidationChange,
  collapsedTables = new Set<number>(),
  setCollapsedTables = () => {},
  isEditMode = false,
}) => {
  const [expandedRowKeys, setExpandedRowKeys] = useState<Record<number, React.Key[]>>({});
  const [tableErrors, setTableErrors] = useState<Record<number, string[]>>({});
  const [sqlInput, setSqlInput] = useState<string>('');
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const [sqlImportModalVisible, setSqlImportModalVisible] = useState<boolean>(false);
  const newTableRef = React.useRef<HTMLDivElement>(null);
  const [validationErrors, setValidationErrors] = useState<Record<number, string[]>>({});
  const [currentTableIndex, setCurrentTableIndex] = useState<number>(0);
  const [newTableName, setNewTableName] = useState<string>('');
  const [newTableDesc, setNewTableDesc] = useState<string>('');
  const [newFieldName, setNewFieldName] = useState<string>('');
  const [newFieldType, setNewFieldType] = useState<string | undefined>(undefined);
  const [newFieldLength, setNewFieldLength] = useState<string>('');
  const [newFieldNullable, setNewFieldNullable] = useState<boolean | undefined>(undefined);
  const [newFieldDesc, setNewFieldDesc] = useState<string>('');
  const [newFieldDefaultValue, setNewFieldDefaultValue] = useState<string>('');
  const [newFieldIsPrimaryKey, setNewFieldIsPrimaryKey] = useState<boolean>(false);
  const [newFieldIsIndex, setNewFieldIsIndex] = useState<boolean>(false);
  const [newFieldForeignKey, setNewFieldForeignKey] = useState<string>('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleCollapse = (tableIndex: number) => {
    setCollapsedTables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tableIndex)) {
        newSet.delete(tableIndex);
      } else {
        newSet.add(tableIndex);
      }
      return newSet;
    });
  };

  const handleTableChange = (tableIndex: number, changes: Partial<DatabaseTable>) => {
    const updatedTables = tables.map((table, index) => 
      index === tableIndex ? { ...table, ...changes } : table
    );
    onChange(updatedTables);
  };

  const handleDeleteTable = (tableIndex: number) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除表 "${tables[tableIndex].table_name}" 吗？此操作不可撤销。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        const newTables = [...tables];
        newTables.splice(tableIndex, 1);
        onChange(newTables);
        if (currentTableIndex === tableIndex) {
          setCurrentTableIndex(0);
        } else if (currentTableIndex > tableIndex) {
          setCurrentTableIndex(currentTableIndex - 1);
        }
        message.success('数据表已删除');
      },
    });
  };

  const renderTableHeader = (table: DatabaseTable, tableIndex: number) => {
    const errors = validationErrors[tableIndex] || [];

    // 自定义label，星号右上角
    const requiredLabel = (
      <span className="form-label-required">
        表名
        <span className="form-label-star">*</span>
      </span>
    );

    return (
      <div className="table-header-inline">
        <Row gutter={[16, 8]} align="middle" justify="space-between">
          <Col span={10}>
            <Form.Item
              label={requiredLabel}
              validateStatus={errors.some(e => e.includes('表名')) ? 'error' : ''}
              help={errors.find(e => e.includes('表名')) || ''}
              {...formItemLayout}
              style={{ marginBottom: 0 }}
            >
              <Input
                value={table.table_name}
                onChange={(e) => handleTableChange(tableIndex, { table_name: e.target.value })}
                placeholder="请输入表名"
              />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item label="描述" {...formItemLayout} style={{ marginBottom: 0 }}>
              <Input
                value={table.description}
                onChange={(e) => handleTableChange(tableIndex, { description: e.target.value })}
                placeholder="请输入表描述"
              />
            </Form.Item>
          </Col>
          <Col span={4} style={{ textAlign: 'right' }}>
            <Button
              type="primary"
              onClick={() => {
                const sql = generateSql(tables[currentTableIndex]);
                Modal.info({
                  title: `${tables[currentTableIndex].table_name} SQL定义`,
                  content: (
                    <pre style={{ maxHeight: '400px', overflow: 'auto' }}>
                      {sql}
                    </pre>
                  ),
                  width: 800,
                });
              }}
            >
              查看SQL
            </Button>
          </Col>
        </Row>
      </div>
    );
  };

  const renderTableActions = (table: DatabaseTable, tableIndex: number) => {
    return (
      <div className="database-tables-actions">
        <Button
          type="text"
          size="small"
          icon={<DeleteOutlined />}
          danger
          onClick={(e) => {
            e.stopPropagation(); // 防止点击事件冒泡到header触发展开/折叠
            handleDeleteTable(tableIndex);
          }}
        >
          删除
        </Button>
      </div>
    );
  };

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
  
  React.useEffect(() => {
    const allErrors: Record<number, string[]> = {};
    tables.forEach((table, index) => {
      const tableSpecificErrors = validateTable(table, index);
      if (tableSpecificErrors.length > 0) {
        allErrors[index] = tableSpecificErrors;
      }
      onValidationChange(index, tableSpecificErrors);
    });
    setValidationErrors(allErrors);
  }, [tables]);

  const validateAllTables = (): boolean => {
    let isValid = true;
    const allErrors: Record<number, string[]> = {};
    tables.forEach((table, index) => {
      const errors = validateTable(table, index);
      if (errors.length > 0) {
        isValid = false;
        allErrors[index] = errors;
      }
    });
    setTableErrors(allErrors);
    return isValid;
  };

  // 控制行展开
  const handleRowExpand = (tableIndex: number, rowKey: React.Key) => {
    const currentExpandedKeys = expandedRowKeys[tableIndex] || [];
    const newExpandedKeys = currentExpandedKeys.includes(rowKey)
      ? currentExpandedKeys.filter(key => key !== rowKey)
      : [...currentExpandedKeys, rowKey];

    setExpandedRowKeys({
      ...expandedRowKeys,
      [tableIndex]: newExpandedKeys,
    });
  };

  // 打开SQL导入弹窗
  const showSqlImportModal = () => {
    setSqlImportModalVisible(true);
  };

  // 关闭SQL导入弹窗
  const closeSqlImportModal = () => {
    setSqlImportModalVisible(false);
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

  // 添加新表，使用状态中的新表名和描述
  const handleAddTable = () => {
    if (!newTableName.trim()) {
      message.warning('表名不能为空');
      return;
    }
    
    const newTable: DatabaseTable = {
      table_name: newTableName,
      description: newTableDesc,
      schema_name: '',
      columns: []
    };
    
    const newTables = [...tables, newTable];
    onChange(newTables);
    setCurrentTableIndex(newTables.length - 1);
    
    // 清空输入
    setNewTableName('');
    setNewTableDesc('');
    
    // 确保新添加的表默认展开
    setCollapsedTables(prev => {
      const newSet = new Set(prev);
      newSet.delete(newTables.length - 1);
      return newSet;
    });

    // 延迟滚动，确保DOM更新
    setTimeout(() => {
      newTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // 处理添加新字段
  const handleAddField = () => {
    if (!newFieldName) {
      message.warning('字段名不能为空');
      return;
    }

    if (newFieldType === undefined) {
      message.warning('请选择字段类型');
      return;
    }

    if (newFieldNullable === undefined) {
      message.warning('请选择是否可否为空');
      return;
    }

    if (tables.length === 0 || currentTableIndex < 0 || currentTableIndex >= tables.length) {
      message.warning('请先选择或创建一个表');
      return;
    }

    // 处理外键 - 虽然UI上不显示，但我们仍然保留这部分逻辑以保持数据结构的完整性
    let foreignKey = undefined;
    if (newFieldForeignKey) {
      const parts = newFieldForeignKey.split('.');
      if (parts.length === 2) {
        foreignKey = {
          reference_table: parts[0],
          reference_column: parts[1]
        };
      } else {
        message.warning('外键格式不正确，请使用"表名.字段名"格式');
        return;
      }
    }

    // 添加新字段
    const newColumn: DatabaseTableColumn = {
      field_name: newFieldName,
      field_type: newFieldType,
      length: newFieldLength ? parseInt(newFieldLength) : undefined,
      nullable: newFieldNullable,
      default_value: newFieldDefaultValue,
      is_primary_key: newFieldIsPrimaryKey,
      is_unique: false,
      is_index: newFieldIsIndex,
      foreign_key: foreignKey,
      description: newFieldDesc
    };
    
    const newTables = [...tables];
    newTables[currentTableIndex].columns.push(newColumn);
    onChange(newTables);
    
    // 清空输入
    setNewFieldName('');
    setNewFieldType(undefined);
    setNewFieldLength('');
    setNewFieldNullable(undefined);
    setNewFieldDefaultValue('');
    setNewFieldDesc('');
    setNewFieldIsPrimaryKey(false);
    setNewFieldIsIndex(false);
    setNewFieldForeignKey('');
  };

  // 更新列信息
  const handleColumnChange = (tableIndex: number, columnIndex: number, field: keyof DatabaseTableColumn, value: any) => {
    const newTables = [...tables];
    const newColumns = [...newTables[tableIndex].columns];
    const columnToUpdate = { ...newColumns[columnIndex] };

    // 根据字段类型处理值
    if (field === 'nullable' || field === 'is_primary_key' || field === 'is_unique' || field === 'is_index') {
      columnToUpdate[field] = Boolean(value);
    } else if (field === 'length') {
      columnToUpdate[field] = value === '' ? undefined : Number(value);
    } else {
      (columnToUpdate as any)[field] = value;
    }

    newColumns[columnIndex] = columnToUpdate;
    
    // 如果设置为主键，则自动设为不可为空和唯一
    if (field === 'is_primary_key' && value === true) {
      newColumns[columnIndex].nullable = false;
      newColumns[columnIndex].is_unique = true;
    }

    newTables[tableIndex] = {
      ...newTables[tableIndex],
      columns: newColumns,
    };
    onChange(newTables);
  };

  // 添加新列
  const addColumn = (tableIndex: number) => {
    const newColumn: DatabaseTableColumn = {
      field_name: '',
      field_type: 'varchar',
      length: 255,
      nullable: true,
      is_primary_key: false,
      is_unique: false,
      is_index: false,
      description: '',
      default_value: ''
    };

    const newTables = [...tables];
    newTables[tableIndex].columns.push(newColumn);
    onChange(newTables);
  };
  
  // 删除列
  const deleteColumn = (tableIndex: number, columnIndex: number) => {
    const newTables = [...tables];
    newTables[tableIndex].columns.splice(columnIndex, 1);
    onChange(newTables);
  };

  // 生成SQL预览
  const generateSql = (table: DatabaseTable): string => {
    const tableName = table.table_name;
    const tableComment = table.description ? ` COMMENT='${table.description}'` : '';
    
    // 生成字段定义
    const columnDefinitions = table.columns.map(column => {
      const fieldName = `\`${column.field_name}\``;
      const fieldType = column.field_type.toUpperCase();
      const fieldLength = column.length ? `(${column.length})` : '';
      const nullableStr = column.nullable ? '' : ' NOT NULL';
      const defaultValue = column.default_value 
        ? ` DEFAULT ${isNaN(Number(column.default_value)) ? `'${column.default_value}'` : column.default_value}`
        : '';
      const commentStr = column.description ? ` COMMENT '${column.description}'` : '';
      
      return `  ${fieldName} ${fieldType}${fieldLength}${nullableStr}${defaultValue}${commentStr}`;
    }).join(',\n');
    
    // 生成主键定义
    const primaryKeys = table.columns
      .filter(column => column.is_primary_key)
      .map(column => `\`${column.field_name}\``);
    
    const primaryKeyStr = primaryKeys.length > 0 
      ? `,\n  PRIMARY KEY (${primaryKeys.join(', ')})`
      : '';
    
    // 生成唯一键定义
    const uniqueKeys = table.columns
      .filter(column => column.is_unique && !column.is_primary_key)
      .map((column, index) => `  UNIQUE KEY \`uk_${column.field_name}\` (\`${column.field_name}\`)`)
      .join(',\n');
    
    const uniqueKeyStr = uniqueKeys ? `,\n${uniqueKeys}` : '';
    
    // 生成索引定义
    const indexes = table.columns
      .filter(column => column.is_index && !column.is_unique && !column.is_primary_key)
      .map((column, index) => `  INDEX \`idx_${column.field_name}\` (\`${column.field_name}\`)`)
      .join(',\n');
    
    const indexStr = indexes ? `,\n${indexes}` : '';
    
    // 生成外键定义
    const foreignKeys = table.columns
      .filter(column => column.foreign_key)
      .map((column, index) => {
        const fk = column.foreign_key!;
        return `  FOREIGN KEY (\`${column.field_name}\`) REFERENCES \`${fk.reference_table}\`(\`${fk.reference_column}\`)`;
      })
      .join(',\n');
    
    const foreignKeyStr = foreignKeys ? `,\n${foreignKeys}` : '';
    
    // 组合SQL语句
    return `CREATE TABLE \`${tableName}\` (\n${columnDefinitions}${primaryKeyStr}${uniqueKeyStr}${indexStr}${foreignKeyStr}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4${tableComment};`;
  };

  // 阅读模式下的渲染
  const renderReadMode = () => {
    return (
      <div className="database-tables-section-content">
        <div className="database-tables-header">
          <div className="database-tables-count">
            共 {tables.length} 个数据表
          </div>
          <div className="database-tables-actions">
            <Button 
              type="default"
              size="small"
              onClick={() => {
                setCollapsedTables(new Set());
              }}
              className="expand-all-button"
              icon={<ExpandOutlined />}
            >
              全部展开
            </Button>
            <Button 
              type="default"
              size="small"
              onClick={() => {
                setCollapsedTables(new Set(tables.map((_, index) => index)));
              }}
              className="collapse-all-button"
              icon={<CompressOutlined />}
            >
              全部折叠
            </Button>
          </div>
        </div>

        {tables.map((table, index) => {
          const isCollapsed = collapsedTables.has(index);
          const primaryKeyField = table.columns.find(col => col.is_primary_key);
          const fieldsCount = table.columns.length;
          
          return (
            <div 
              key={index} 
              className={`database-table-container${isCollapsed ? ' collapsed' : ''}`}
              ref={index === tables.length - 1 ? newTableRef : null}
            >
              <div 
                className="database-table-header"
                onClick={() => toggleCollapse(index)}
              >
                <div className="database-table-icon">
                  <DatabaseOutlined />
                </div>
                <div className="database-table-title">
                  <div className="table-name">{table.table_name}</div>
                  {table.description && <div className="table-description">{table.description}</div>}
                </div>
                {isCollapsed && (
                  <div className="table-summary">
                    <span>{fieldsCount} 个字段</span>
                    {primaryKeyField && (
                      <span className="primary-key-info">
                        <KeyOutlined style={{ marginRight: 4 }} /> {primaryKeyField.field_name}
                      </span>
                    )}
                  </div>
                )}
                <div className="database-table-toggle">
                  {isCollapsed ? <DownOutlined /> : <UpOutlined />}
                </div>
              </div>
              <CSSTransition
                in={!isCollapsed}
                timeout={300}
                classNames="table-fade"
                unmountOnExit
              >
                <div className="database-table-content">
                  <Table
                    dataSource={table.columns}
                    pagination={false}
                    size="small"
                    rowKey={(record, index) => `${index}_${index}`}
                    columns={[
                      {
                        title: '字段名',
                        dataIndex: 'field_name',
                        key: 'field_name',
                        width: '12%',
                        render: (text, record) => (
                          <div className="field-name-cell">
                            <span className="field-name-text">{text}</span>
                            {record.is_primary_key && (
                              <Tooltip title="主键">
                                <KeyOutlined className="field-primary-icon" />
                              </Tooltip>
                            )}
                          </div>
                        )
                      },
                      {
                        title: '类型',
                        dataIndex: 'field_type',
                        key: 'field_type',
                        width: '10%',
                        render: (text, record) => (
                          <span className="field-type-cell">
                            {getFieldTypeIcon(text)}
                            <span className="field-type-text">{text.toUpperCase()}</span>
                          </span>
                        )
                      },
                      {
                        title: '长度',
                        dataIndex: 'length',
                        key: 'length',
                        width: '10%',
                        render: (text) => text || '-'
                      },
                      {
                        title: '可否为空',
                        dataIndex: 'nullable',
                        key: 'nullable',
                        width: '7%',
                        render: (nullable) => (
                          <span className={`nullable-status ${nullable ? 'nullable' : 'not-nullable'}`}>
                            {nullable ? '是' : '否'}
                          </span>
                        )
                      },
                      {
                        title: '默认值',
                        dataIndex: 'default_value',
                        key: 'default_value',
                        width: '12%',
                        render: (text) => text || '-'
                      },
                      {
                        title: '主键',
                        dataIndex: 'is_primary_key',
                        key: 'is_primary_key',
                        width: '7%',
                        render: (isPrimary) => (
                          <span className={`key-status ${isPrimary ? 'is-key' : 'not-key'}`}>
                            {isPrimary ? '' : '-'}
                          </span>
                        )
                      },
                      {
                        title: '索引',
                        dataIndex: 'is_index',
                        key: 'is_index',
                        width: '7%',
                        render: (isIndex) => (
                          <span className={`index-status ${isIndex ? 'is-index' : 'not-index'}`}>
                            {isIndex ? '' : '-'}
                          </span>
                        )
                      },
                      {
                        title: '说明',
                        dataIndex: 'description',
                        key: 'description',
                        width: '29%',
                        render: (text) => text || '-'
                      },
                    ]}
                  />
                  <div className="database-table-footer">
                    <Button
                      type="primary"
                      size="small"
                      icon={<FileTextOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        const sql = generateSql(table);
                        Modal.info({
                          title: `${table.table_name} SQL定义`,
                          content: (
                            <pre style={{ maxHeight: '400px', overflow: 'auto' }}>
                              {sql}
                            </pre>
                          ),
                          width: 800,
                        });
                      }}
                    >
                      查看SQL
                    </Button>
                  </div>
                </div>
              </CSSTransition>
            </div>
          );
        })}
      </div>
    );
  };

  // 编辑模式下的渲染
  const renderEditMode = () => {
    return (
      <div className={`database-tables-edit-mode ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="database-tables-edit-layout">
          <div className="database-tables-sidebar">
            {isSidebarCollapsed ? (
              <div className="sidebar-collapsed-handle" onClick={() => setIsSidebarCollapsed(false)}>
                <div className="sidebar-collapsed-content">
                  <div className="sidebar-collapsed-icon">
                    <DatabaseOutlined />
                  </div>
                  <div className="sidebar-collapsed-text">数据表</div>
                  {tables.length > 0 && (
                    <div className="sidebar-collapsed-badge">
                      {tables.length}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="database-tables-sidebar-header">
                  <div className="database-tables-sidebar-title">数据库列表</div>
                  <Space>
                    <Tooltip title="导入SQL" placement="top">
                      <Button 
                        type="text"
                        icon={<ImportOutlined />}
                        onClick={showSqlImportModal}
                        className="sidebar-action-button"
                      />
                    </Tooltip>
                    <Tooltip title="收起" placement="top">
                      <Button
                        type="text"
                        icon={<MenuFoldOutlined />}
                        onClick={() => setIsSidebarCollapsed(true)}
                        className="sidebar-collapse-button"
                      />
                    </Tooltip>
                  </Space>
                </div>
            
                <div className="database-tables-list">
                  {tables.map((table, index) => (
                    <div 
                      key={index} 
                      className={`database-table-item ${currentTableIndex === index ? 'active' : ''}`}
                      onClick={() => setCurrentTableIndex(index)}
                    >
                      <div className="database-table-item-icon">
                        <DatabaseOutlined />
                      </div>
                      <div className="database-table-item-content">
                        <div className="database-table-item-name">{table.table_name}</div>
                        <div className="database-table-item-desc">{table.description || '无描述'}</div>
                      </div>
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTable(index);
                        }}
                      >
                        删除
                      </Button>
                    </div>
                  ))}
                </div>
            
                <div className="database-tables-add">
                  <div className="database-tables-add-form">
                    <Input 
                      placeholder="新表名称" 
                      className="new-table-name"
                      value={newTableName}
                      onChange={(e) => setNewTableName(e.target.value)}
                    />
                    <Input 
                      placeholder="表描述" 
                      className="new-table-desc"
                      value={newTableDesc}
                      onChange={(e) => setNewTableDesc(e.target.value)}
                    />
                    <Button
                      type="primary"
                      block
                      onClick={handleAddTable}
                      icon={<PlusOutlined />}
                    >
                      添加新表
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
          
          <div className="database-tables-content">
            {tables.length > 0 && currentTableIndex < tables.length ? (
              <>
                <div className="database-table-edit-header-form">
                  {renderTableHeader(tables[currentTableIndex], currentTableIndex)}
                </div>
                
                <div className="database-table-fields">
                  <Table
                    dataSource={tables[currentTableIndex].columns}
                    pagination={false}
                    size="small"
                    rowKey={(record, index) => `field_${index}`}
                    columns={[
                      {
                        title: '字段名',
                        dataIndex: 'field_name',
                        key: 'field_name',
                        width: '12%',
                        render: (text, record, index) => (
                          <Input
                            value={text}
                            onChange={(e) => handleColumnChange(currentTableIndex, index, 'field_name', e.target.value)}
                            placeholder="输入字段名"
                          />
                        )
                      },
                      {
                        title: '类型',
                        dataIndex: 'field_type',
                        key: 'field_type',
                        width: '10%',
                        render: (text, record, index) => (
                          <Select
                            value={text}
                            onChange={(value) => handleColumnChange(currentTableIndex, index, 'field_type', value)}
                            style={{ width: '100%' }}
                          >
                            {FIELD_TYPE_OPTIONS.map(option => (
                              <Option key={option.value} value={option.value}>{option.label}</Option>
                            ))}
                          </Select>
                        )
                      },
                      {
                        title: '长度',
                        dataIndex: 'length',
                        key: 'length',
                        width: '10%',
                        render: (text, record, index) => (
                          <Input
                            type="number"
                            value={text}
                            onChange={(e) => handleColumnChange(currentTableIndex, index, 'length', e.target.value)}
                            placeholder="长度"
                          />
                        )
                      },
                      {
                        title: '可否为空',
                        dataIndex: 'nullable',
                        key: 'nullable',
                        width: '8%',
                        render: (nullable, record, index) => (
                          <Select
                            value={nullable ? '是' : '否'}
                            onChange={(value) => handleColumnChange(currentTableIndex, index, 'nullable', value === '是')}
                            style={{ width: '100%' }}
                          >
                            <Option value="是">是</Option>
                            <Option value="否">否</Option>
                          </Select>
                        )
                      },
                      {
                        title: '默认值',
                        dataIndex: 'default_value',
                        key: 'default_value',
                        width: '10%',
                        render: (text, record, index) => (
                          <Input
                            value={text}
                            onChange={(e) => handleColumnChange(currentTableIndex, index, 'default_value', e.target.value)}
                            placeholder="默认值"
                          />
                        )
                      },
                      {
                        title: '主键',
                        dataIndex: 'is_primary_key',
                        key: 'is_primary_key',
                        width: '6%',
                        render: (isPrimary, record, index) => (
                          <Checkbox
                            checked={isPrimary}
                            onChange={(e) => handleColumnChange(currentTableIndex, index, 'is_primary_key', e.target.checked)}
                          />
                        )
                      },
                      {
                        title: '索引',
                        dataIndex: 'is_index',
                        key: 'is_index',
                        width: '6%',
                        render: (isIndex, record, index) => (
                          <Checkbox
                            checked={isIndex}
                            onChange={(e) => handleColumnChange(currentTableIndex, index, 'is_index', e.target.checked)}
                          />
                        )
                      },
                      {
                        title: '说明',
                        dataIndex: 'description',
                        key: 'description',
                        width: '30%',
                        render: (text, record, index) => (
                          <Input
                            value={text}
                            onChange={(e) => handleColumnChange(currentTableIndex, index, 'description', e.target.value)}
                            placeholder="字段说明"
                          />
                        )
                      },
                      {
                        title: '操作',
                        key: 'action',
                        width: '8%',
                        render: (_, record, index) => (
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => deleteColumn(currentTableIndex, index)}
                            size="small"
                          >
                            删除
                          </Button>
                        )
                      }
                    ]}
                  />
                </div>
                
                <div className="database-table-add-field">
                  <div className="field-inputs">
                    <Input 
                      placeholder="字段名" 
                      className="field-name-input" 
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                    />
                    <Select 
                      placeholder="类型" 
                      className="field-type-input"
                      value={newFieldType}
                      onChange={(value) => setNewFieldType(value)}
                    >
                      {FIELD_TYPE_OPTIONS.map(option => (
                        <Option key={option.value} value={option.value}>{option.label}</Option>
                      ))}
                    </Select>
                    <Input 
                      placeholder="长度" 
                      type="number" 
                      className="field-length-input"
                      value={newFieldLength}
                      onChange={(e) => setNewFieldLength(e.target.value)}
                    />
                    <Select 
                      placeholder="可否为空" 
                      className="field-nullable-input"
                      value={newFieldNullable === undefined ? undefined : (newFieldNullable ? '是' : '否')}
                      onChange={(value) => setNewFieldNullable(value === '是')}
                    >
                      <Option value="是">是</Option>
                      <Option value="否">否</Option>
                    </Select>
                    <Input 
                      placeholder="默认值" 
                      className="field-default-input"
                      value={newFieldDefaultValue}
                      onChange={(e) => setNewFieldDefaultValue(e.target.value)}
                    />
                    <div className="field-checkbox-group">
                      <Checkbox
                        checked={newFieldIsPrimaryKey}
                        onChange={(e) => setNewFieldIsPrimaryKey(e.target.checked)}
                      >
                        主键
                      </Checkbox>
                      <Checkbox
                        checked={newFieldIsIndex}
                        onChange={(e) => setNewFieldIsIndex(e.target.checked)}
                      >
                        索引
                      </Checkbox>
                    </div>
                    <Input 
                      placeholder="说明" 
                      className="field-desc-input"
                      value={newFieldDesc}
                      onChange={(e) => setNewFieldDesc(e.target.value)}
                    />
                  </div>
                  <Button
                    type="primary"
                    block
                    onClick={handleAddField}
                    className="add-field-button"
                  >
                    添加字段
                  </Button>
                </div>
              </>
            ) : (
              <div className="database-tables-empty">
                <div className="empty-message">
                  <InfoCircleOutlined /> 请在左侧添加数据表或导入SQL
                </div>
              </div>
            )}
          </div>
        </div>
      
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

  return isEditMode ? renderEditMode() : renderReadMode();
};

export default DatabaseTablesSection; 