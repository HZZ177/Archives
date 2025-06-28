import React, { ChangeEvent, useState, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import { Button, Input, Form, Table, Space, Select, Checkbox, Tooltip, Card, Tabs, Typography, Row, Col, message, Modal, Empty, Tag, Pagination, Spin } from 'antd';
import { MinusCircleOutlined, PlusOutlined, InfoCircleOutlined, LinkOutlined, KeyOutlined, ExclamationCircleOutlined, ImportOutlined, ExpandOutlined, CompressOutlined, DeleteOutlined, MinusOutlined, DownOutlined, UpOutlined, FileTextOutlined, DatabaseOutlined, MenuFoldOutlined, MenuUnfoldOutlined, NumberOutlined, CalendarOutlined, FieldStringOutlined, FieldTimeOutlined, FieldBinaryOutlined, SelectOutlined, EditOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { DatabaseTable, DatabaseTableColumn } from '../../../../types/modules';
import './SectionStyles.css';
import { CSSTransition } from 'react-transition-group';
import { useWorkspace } from '../../../../contexts/WorkspaceContext';
import { getWorkspaceTables } from '../../../../apis/workspaceService';
import { WorkspaceTable } from '../../../../types/workspace';
import { debounce } from '../../../../utils/throttle';
import DatabaseTableCard from './DatabaseTableCard';

const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;
const { Text } = Typography;
const { Search } = Input;

export interface ValidationHandle {
  validate: () => boolean;
}

interface DatabaseTablesSectionProps {
  tables: DatabaseTable[];
  onChange: (tables: DatabaseTable[]) => void;
  collapsedTables?: Set<number>;
  setCollapsedTables?: React.Dispatch<React.SetStateAction<Set<number>>>;
  isEditMode?: boolean;
  enableWorkspaceTableSelection?: boolean;
  showActionButtons?: boolean;
  enableRealtimeValidation?: boolean;
  onDelete?: (tableIndex: number) => void;
  onEdit?: (tableIndex: number) => void;
  hideTableHeader?: boolean;
  hideToggleButton?: boolean;
  showClearButton?: boolean;
  readOnlyInEditMode?: boolean;
  showWorkspaceTableSelectionInReadMode?: boolean;
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
      name: tableName,
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

const getColumns = (
  tableIndex: number,
  handleColumnChange: (tableIndex: number, columnIndex: number, field: keyof DatabaseTableColumn, value: any) => void,
  deleteColumn: (tableIndex: number, columnIndex: number) => void,
  validationErrors: Record<number, { name?: string; columns?: { [key: number]: { field_name?: string } } }>
): ColumnsType<DatabaseTableColumn> => [
  {
    title: '字段名',
    dataIndex: 'field_name',
    key: 'field_name',
    render: (text, record, index) => {
      const colError = validationErrors[tableIndex]?.columns?.[index]?.field_name;
      return (
        <Form.Item
          validateStatus={colError ? 'error' : ''}
          help={colError || ''}
          style={{ marginBottom: 0 }}
        >
          <Input
            value={text}
            onChange={(e) => handleColumnChange(tableIndex, index, 'field_name', e.target.value)}
            placeholder="字段名"
          />
        </Form.Item>
      );
    },
  },
  {
    title: '类型',
    dataIndex: 'field_type',
    key: 'field_type',
    width: '10%',
    render: (text, record, index) => (
      <Select
        value={text}
        onChange={(value) => handleColumnChange(tableIndex, index, 'field_type', value)}
        style={{ width: '100%' }}
      >
        {FIELD_TYPE_OPTIONS.map(option => (
          <Option key={option.value} value={option.value}>{option.label}</Option>
        ))}
      </Select>
    ),
  },
  {
    title: '长度',
    dataIndex: 'length',
    key: 'length',
    width: '10%',
    render: (text, record, index) => (
      <Input
        value={text}
        onChange={(e) => {
          const value = e.target.value;
          if (value === '' || /^\d+$/.test(value)) {
            handleColumnChange(tableIndex, index, 'length', value ? parseInt(value) : undefined);
          }
        }}
        placeholder="长度"
      />
    ),
  },
  {
    title: '可否为空',
    dataIndex: 'nullable',
    key: 'nullable',
    width: '7%',
    render: (checked, record, index) => (
      <Checkbox
        checked={checked}
        onChange={(e) => handleColumnChange(tableIndex, index, 'nullable', e.target.checked)}
      />
    ),
  },
  {
    title: '默认值',
    dataIndex: 'default_value',
    key: 'default_value',
    width: '12%',
    render: (text, record, index) => (
      <Input
        value={text}
        onChange={(e) => handleColumnChange(tableIndex, index, 'default_value', e.target.value)}
        placeholder="默认值"
      />
    ),
  },
  {
    title: '主键',
    dataIndex: 'is_primary_key',
    key: 'is_primary_key',
    width: '7%',
    render: (checked, record, index) => (
      <Checkbox
        checked={checked}
        onChange={(e) => handleColumnChange(tableIndex, index, 'is_primary_key', e.target.checked)}
      />
    ),
  },
  {
    title: '索引',
    dataIndex: 'is_index',
    key: 'is_index',
    width: '7%',
    render: (checked, record, index) => (
      <Checkbox
        checked={checked}
        onChange={(e) => handleColumnChange(tableIndex, index, 'is_index', e.target.checked)}
      />
    ),
  },
  {
    title: '说明',
    dataIndex: 'description',
    key: 'description',
    width: '29%',
    render: (text, record, index) => (
      <Input
        value={text}
        onChange={(e) => handleColumnChange(tableIndex, index, 'description', e.target.value)}
        placeholder="字段说明"
      />
    ),
  },
  {
    title: '操作',
    key: 'action',
    render: (_, record, index) => (
      <Button
        type="text"
        danger
        icon={<MinusCircleOutlined />}
        onClick={() => deleteColumn(tableIndex, index)}
      />
    ),
  },
];

const DatabaseTablesSection = forwardRef<ValidationHandle, DatabaseTablesSectionProps>(({
  tables,
  onChange,
  collapsedTables = new Set<number>(),
  setCollapsedTables = () => {},
  isEditMode = false,
  enableWorkspaceTableSelection = true,
  showActionButtons = true,
  enableRealtimeValidation = true,
  onDelete,
  onEdit,
  hideTableHeader = false,
  hideToggleButton = false,
  showClearButton = false,
  readOnlyInEditMode = false,
  showWorkspaceTableSelectionInReadMode = true,
}, ref) => {
  const [expandedRowKeys, setExpandedRowKeys] = useState<Record<number, React.Key[]>>({});
  const [validationErrors, setValidationErrors] = useState<Record<number, {
    name?: string;
    columns?: { [key: number]: { field_name?: string } };
  }>>({});
  const [sqlInput, setSqlInput] = useState<string>('');
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const [sqlImportModalVisible, setSqlImportModalVisible] = useState<boolean>(false);
  const newTableRef = React.useRef<HTMLDivElement>(null);
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
  
  // 新增状态用于工作区表选择
  const [workspaceTables, setWorkspaceTables] = useState<WorkspaceTable[]>([]);
  const [workspaceTableSelectVisible, setWorkspaceTableSelectVisible] = useState<boolean>(false);
  const [selectedWorkspaceTableIds, setSelectedWorkspaceTableIds] = useState<number[]>([]);
  const { currentWorkspace } = useWorkspace();
  
  // 新增状态用于分页和搜索
  const [tablesLoading, setTablesLoading] = useState<boolean>(false);
  const [tablesPagination, setTablesPagination] = useState<{
    current: number;
    pageSize: number;
    total: number;
  }>({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [tableSearchKeyword, setTableSearchKeyword] = useState<string>('');
  const [tableSearchInputValue, setTableSearchInputValue] = useState<string>('');
  
  // 获取工作区表列表
  useEffect(() => {
    if (isEditMode && currentWorkspace && enableWorkspaceTableSelection) {
      fetchWorkspaceTables();
    }
  }, [currentWorkspace, isEditMode, enableWorkspaceTableSelection]);

  // 获取工作区表，支持分页和搜索
  const fetchWorkspaceTables = async (
    page = tablesPagination.current,
    pageSize = tablesPagination.pageSize,
    search = tableSearchKeyword
  ) => {
    if (!currentWorkspace) return;
    
    try {
      setTablesLoading(true);
      console.log('获取工作区表列表，参数:', { page, pageSize, search });
      
      // 使用分页参数和搜索关键词调用API
      const result = await getWorkspaceTables(
        currentWorkspace.id, 
        page, 
        pageSize, 
        search
      );
      
      console.log('获取到的工作区表列表:', result);
      
      // 更新状态
      if (Array.isArray(result.items)) {
        setWorkspaceTables(result.items);
        setTablesPagination({
          ...tablesPagination,
          current: result.page,
          total: result.total
        });
      } else {
        console.error('获取到的工作区表列表格式不正确:', result);
        setWorkspaceTables([]);
      }
    } catch (error) {
      console.error('获取工作区表失败:', error);
      setWorkspaceTables([]);
    } finally {
      setTablesLoading(false);
    }
  };
  
  const debouncedFetchTables = useMemo(() => {
    return debounce((searchVal: string) => {
      fetchWorkspaceTables(1, tablesPagination.pageSize, searchVal);
    }, 500);
  }, [currentWorkspace, tablesPagination.pageSize]);

  const handleTableSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setTableSearchKeyword(value);
    debouncedFetchTables(value);
  };

  const handleTablePageChange = (page: number, pageSize?: number) => {
    const newPageSize = pageSize || tablesPagination.pageSize;
    setTablesPagination(prev => ({
      ...prev,
      current: page,
      pageSize: newPageSize
    }));
    fetchWorkspaceTables(page, newPageSize);
  };

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
    const newTables = [...tables];
    // 当表名改变时，检查是否与其他表名重复
    if (changes.name !== undefined) {
      const isDuplicate = newTables.some((table, index) => index !== tableIndex && table.name === changes.name);
      if (isDuplicate) {
        message.error(`表名 "${changes.name}" 已存在，请使用唯一的表名。`);
        // 可选择不更新，或者标记为错误状态
        // 这里我们选择不更新重复的表名
        delete changes.name;
      }
    }
    newTables[tableIndex] = { ...newTables[tableIndex], ...changes };
    onChange(newTables);
  };

  const handleDeleteTable = (tableIndex: number) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除表 "${tables[tableIndex].name}" 吗？此操作不可撤销。`,
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

  // 处理清空表（清空所有字段，但保留表名和表描述）
  const handleClearTable = (tableIndex: number) => {
    Modal.confirm({
      title: '确认清空',
      content: `确定要清空表 "${tables[tableIndex].name}" 的所有字段吗？此操作不可撤销。`,
      okText: '清空',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        const newTables = [...tables];
        // 保留表名和表描述，但清空所有字段
        newTables[tableIndex] = {
          ...newTables[tableIndex],
          columns: []
        };
        onChange(newTables);
        message.success('表字段已清空');
      },
    });
  };

  const renderTableHeader = (table: DatabaseTable, tableIndex: number) => {
    const errors = validationErrors[tableIndex] || {};

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
              validateStatus={errors.name ? 'error' : ''}
              help={errors.name || ''}
              {...formItemLayout}
              style={{ marginBottom: 0 }}
            >
              <Input
                value={table.name}
                onChange={(e) => handleTableChange(tableIndex, { name: e.target.value })}
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
                  title: `${tables[currentTableIndex].name} SQL定义`,
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
    // 在编辑模式下始终显示删除按钮，不再依赖于 showActionButtons 参数
    if (isEditMode) {
    return (
      <div className="database-table-actions">
        {onEdit && (
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation(); // 防止点击事件冒泡到header触发展开/折叠
              onEdit(tableIndex);
            }}
          >
            编辑
          </Button>
        )}
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
    }
    return null;
  };

  // 验证单个表的数据
  const validateTable = (table: DatabaseTable, tableIndex: number): { name?: string; columns?: { [key: number]: { field_name?: string } } } => {
    const errors: { name?: string; columns: { [key: number]: { field_name?: string } } } = { columns: {} };
    
    // 1. 验证表名
    if (!table.name || table.name.trim() === '') {
      errors.name = '表名不能为空';
    } else if (!/^[a-zA-Z0-9_]+$/.test(table.name)) {
      errors.name = '表名只能包含字母、数字和下划线';
    } else {
      // 检查表名是否重复
      const isDuplicate = tables.some((t, i) => i !== tableIndex && t.name === table.name);
      if (isDuplicate) {
        errors.name = `表名 "${table.name}" 与当前模块内的另一张表重复`;
      }
    }
    
    // 验证是否有重复的字段名
    const fieldNames = new Set<string>();
    let hasDuplicateFieldName = false;
    const duplicateFieldNames = new Set<string>();
    
    table.columns.forEach((column, colIndex) => {
      const fieldName = column.field_name.trim();
      if (fieldName === '') {
        errors.columns[colIndex] = { ...errors.columns[colIndex], field_name: '字段名不能为空' };
      } else if (fieldNames.has(fieldName)) {
        hasDuplicateFieldName = true;
        duplicateFieldNames.add(fieldName);
        errors.columns[colIndex] = { ...errors.columns[colIndex], field_name: '字段名重复' };
      } else {
        fieldNames.add(fieldName);
      }
    });
    
    // 验证主键
    const primaryKeys = table.columns.filter(col => col.is_primary_key);
    if (primaryKeys.length > 1) {
      // 标记所有主键字段为错误
      primaryKeys.forEach(keyCol => {
        const colIndex = table.columns.findIndex(c => c.field_name === keyCol.field_name);
        if (colIndex !== -1) {
          errors.columns[colIndex] = { ...errors.columns[colIndex], field_name: '一个表只能有一个主键' };
        }
      });
    }
    
    // 验证外键引用
    table.columns.forEach((column, colIndex) => {
      if (column.foreign_key) {
        if (!column.foreign_key.reference_table || column.foreign_key.reference_table.trim() === '') {
          errors.columns[colIndex] = { ...errors.columns[colIndex], field_name: '外键引用表不能为空' };
        }
        if (!column.foreign_key.reference_column || column.foreign_key.reference_column.trim() === '') {
          errors.columns[colIndex] = { ...errors.columns[colIndex], field_name: '外键引用列不能为空' };
        }
      }
    });
    
    return errors;
  };
  
  React.useEffect(() => {
    if (enableRealtimeValidation) {
      const allErrors: Record<number, { name?: string; columns?: { [key: number]: { field_name?: string } } }> = {};
    tables.forEach((table, index) => {
      const tableSpecificErrors = validateTable(table, index);
        if (Object.keys(tableSpecificErrors).length > 0 && (tableSpecificErrors.name || (tableSpecificErrors.columns && Object.keys(tableSpecificErrors.columns).length > 0))) {
        allErrors[index] = tableSpecificErrors;
      }
    });
    setValidationErrors(allErrors);
    }
  }, [tables, enableRealtimeValidation]);

  const validateAllTables = (): boolean => {
    let isValid = true;
    const allErrors: Record<number, { name?: string; columns?: { [key: number]: { field_name?: string } } }> = {};
    tables.forEach((table, index) => {
      const errors = validateTable(table, index);
      if (Object.keys(errors).length > 0 && (errors.name || (errors.columns && Object.keys(errors.columns).length > 0))) {
        isValid = false;
        allErrors[index] = errors;
      }
    });
    setValidationErrors(allErrors);
    return isValid;
  };

  useImperativeHandle(ref, () => ({
    validate: validateAllTables,
  }));

  // 处理行展开
  const handleRowExpand = (tableIndex: number, expandedRows: readonly React.Key[]) => {
    setExpandedRowKeys(prev => ({
      ...prev,
      [tableIndex]: [...expandedRows] // 创建新数组以避免只读问题
    }));
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
        message.success(`成功导入表 ${parsedTable.name}`);
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
      name: newTableName,
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

    const newTables = tables.map((table, index) => {
      if (index === tableIndex) {
        return {
          ...table,
          columns: [...table.columns, newColumn],
        };
      }
      return table;
    });
    onChange(newTables);
  };
  
  // 删除列
  const deleteColumn = (tableIndex: number, columnIndex: number) => {
    const newTables = tables.map((table, index) => {
      if (index === tableIndex) {
        return {
          ...table,
          columns: table.columns.filter((_, colIdx) => colIdx !== columnIndex),
        };
      }
      return table;
    });
    onChange(newTables);
  };

  // 生成SQL预览
  const generateSql = (table: DatabaseTable): string => {
    const tableName = table.name;
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

  // 打开工作区表选择对话框
  const openWorkspaceTableSelect = () => {
    setWorkspaceTableSelectVisible(true);
    // 重置搜索和分页状态
    setTableSearchKeyword('');
    setTableSearchInputValue('');
    setTablesPagination({
      current: 1,
      pageSize: 10,
      total: 0
    });
    // 打开弹窗时自动加载第一页数据
    fetchWorkspaceTables(1, 10, '');
  };

  // 关闭工作区表选择对话框
  const closeWorkspaceTableSelect = () => {
    setWorkspaceTableSelectVisible(false);
    // 清空选择状态
    setSelectedWorkspaceTableIds([]);
  };
  
  // 渲染工作区表选择对话框内容
  const renderWorkspaceTableModalContent = () => {
    return (
      <>
        <div style={{ marginBottom: 16 }}>
          <Search
            placeholder="搜索库表名称或描述"
            value={tableSearchKeyword}
            onChange={handleTableSearchInputChange}
            style={{ width: '100%' }}
            enterButton
            allowClear
          />
        </div>
        
        <div style={{ marginBottom: 12 }}>
          <span style={{ color: '#888', fontSize: '13px' }}>注: 已导入的库表将被禁用选择，无法重复导入</span>
        </div>
        
        {/* 表格内容 */}
        {tablesLoading ? (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <Spin tip="加载中..." />
          </div>
        ) : (
          <>
            {!Array.isArray(workspaceTables) || workspaceTables.length === 0 ? (
              <Empty description="工作区中暂无可用的表" />
            ) : (
              <Table
                dataSource={workspaceTables}
                rowKey="id"
                pagination={false}
                rowSelection={{
                  selectedRowKeys: selectedWorkspaceTableIds,
                  onChange: (selectedRowKeys) => {
                    setSelectedWorkspaceTableIds(selectedRowKeys as number[]);
                  },
                  getCheckboxProps: (record) => {
                    // 检查该表是否已经被导入
                    const existingWorkspaceTableIds = new Set(
                      tables
                        .filter(table => table.workspace_table_id !== undefined)
                        .map(table => table.workspace_table_id)
                    );
                    const isImported = existingWorkspaceTableIds.has(record.id);
                    
                    return {
                      disabled: isImported, // 禁用已导入的表选择
                    };
                  }
                }}
                columns={[
                  {
                    title: '表名',
                    dataIndex: 'name',
                    key: 'name',
                  },
                  {
                    title: '描述',
                    dataIndex: 'description',
                    key: 'description',
                    render: (text) => text || '-'
                  },
                  {
                    title: '字段数',
                    key: 'columns_count',
                    render: (_, record) => record.columns_json?.length || 0
                  },
                  {
                    title: '状态',
                    key: 'status',
                    render: (_, record) => {
                      // 检查该表是否已经被导入
                      const existingWorkspaceTableIds = new Set(
                        tables
                          .filter(table => table.workspace_table_id !== undefined)
                          .map(table => table.workspace_table_id)
                      );
                      const isImported = existingWorkspaceTableIds.has(record.id);
                      
                      return isImported ? (
                        <Tag color="green">已导入</Tag>
                      ) : null;
                    }
                  }
                ]}
              />
            )}
            
            {/* 分页控件 */}
            {!tablesLoading && workspaceTables.length > 0 && (
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <Pagination
                  current={tablesPagination.current}
                  pageSize={tablesPagination.pageSize}
                  total={tablesPagination.total}
                  onChange={handleTablePageChange}
                  showSizeChanger
                  showQuickJumper
                  showTotal={(total) => `共 ${total} 条数据`}
                />
              </div>
            )}
          </>
        )}
      </>
    );
  };
  
  // 确认选择工作区表
  const confirmWorkspaceTableSelect = () => {
    // 获取选中的工作区表
    const selectedTables = workspaceTables.filter(table => 
      selectedWorkspaceTableIds.includes(table.id)
    );
    
    // 检查哪些表已经被导入（通过workspace_table_id判断）
    const existingWorkspaceTableIds = new Set(
      tables
        .filter(table => table.workspace_table_id !== undefined)
        .map(table => table.workspace_table_id)
    );
    
    // 过滤出未导入的表
    const newSelectedTables = selectedTables.filter(
      table => !existingWorkspaceTableIds.has(table.id)
    );
    
    // 如果所有选中的表都已导入，则提示用户
    if (newSelectedTables.length === 0 && selectedTables.length > 0) {
      Modal.info({
        title: '提示',
        content: '所选库表已全部导入，请选择其他库表。'
      });
      return;
    }
    
    // 如果没有选择任何表，提示用户
    if (selectedTables.length === 0) {
      Modal.info({
        title: '提示',
        content: '请至少选择一个库表进行导入'
      });
      return;
    }
    
    // 将工作区表转换为模块内容表格式
    const newTables = newSelectedTables.map(table => ({
      name: table.name,
      schema_name: table.schema_name || '',
      description: table.description || '',
      columns: table.columns_json,
      workspace_table_id: table.id // 添加工作区表ID以便后续引用
    }));
    
    // 更新表格列表
    onChange([...tables, ...newTables]);
    
    message.success(`成功导入 ${newTables.length} 个库表`);
    
    // 清空选择状态并关闭对话框
    setSelectedWorkspaceTableIds([]);
    closeWorkspaceTableSelect();
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
            {/* 在阅读模式下显示工作区表选择按钮（如果启用） */}
            {enableWorkspaceTableSelection && showWorkspaceTableSelectionInReadMode && (
              <Button 
                type="default"
                size="small"
                icon={<SelectOutlined />}
                onClick={openWorkspaceTableSelect}
                style={{ marginRight: 8 }}
                className="database-action-button"
              >
                从资源池导入库表
              </Button>
            )}
            
            <Button 
              type="default"
              size="small"
              onClick={() => {
                setCollapsedTables(new Set());
              }}
              className="expand-all-button database-action-button"
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
              className="collapse-all-button database-action-button"
              icon={<CompressOutlined />}
            >
              全部折叠
            </Button>
          </div>
        </div>

        {tables.map((table, index) => (
          <DatabaseTableCard
            key={index}
            data={table}
            isCollapsed={collapsedTables.has(index)}
            onToggleCollapse={() => toggleCollapse(index)}
            onEdit={onEdit ? () => onEdit(index) : undefined}
            onDelete={onDelete ? () => onDelete(index) : undefined}
            isEditMode={!!isEditMode}
          />
        ))}
      </div>
    );
  };

  // 编辑模式下的渲染
  const renderEditMode = () => {
    // 在编辑模式下，我们通常只处理一个表
    const table = tables[0];
    const tableIndex = 0;
    
    if (!table) {
      return (
        <div className="db-editor-container">
            <div className="db-editor-actions">
                <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={handleAddTable}
                >
                添加一个新表以开始
                </Button>
            </div>
        </div>
      );
    }

    const errors = validationErrors[tableIndex] || {};

    return (
        <div className="db-editor-container">
            <div className="db-editor-header">
                <Form layout="vertical">
                    <Row gutter={24}>
                        <Col span={8}>
                            <Form.Item
                                label="表名"
                                required
                                validateStatus={errors.name ? 'error' : ''}
                                help={errors.name || ''}
                            >
                                <Input
                                    value={table.name}
                                    onChange={(e) => handleTableChange(tableIndex, { name: e.target.value })}
                                    placeholder="请输入表名，如 users"
                                />
                            </Form.Item>
                        </Col>
                        <Col span={10}>
                            <Form.Item label="表描述">
                                <Input
                                    value={table.description}
                                    onChange={(e) => handleTableChange(tableIndex, { description: e.target.value })}
                                    placeholder="请输入表描述，如 用户信息表"
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6} style={{ textAlign: 'right', alignSelf: 'center' }}>
                            <Space>
                                <Button
                                    icon={<FileTextOutlined />}
                                    onClick={() => {
                                        const sql = generateSql(table);
                                        Modal.info({
                                            title: `SQL 定义 - ${table.name}`,
                                            content: <pre style={{ maxHeight: '400px', overflow: 'auto' }}>{sql}</pre>,
                                            width: 800,
                                        });
                                    }}
                                >
                                    查看SQL
                                </Button>
                                {showClearButton && (
                                    <Button
                                        icon={<DeleteOutlined />}
                                        danger
                                        onClick={() => handleClearTable(tableIndex)}
                                    >
                                        清空
                                    </Button>
                                )}
                            </Space>
                        </Col>
                    </Row>
                </Form>
            </div>

            <div className="db-editor-table-wrapper">
                <Table
                    columns={getColumns(tableIndex, handleColumnChange, deleteColumn, validationErrors)}
                    dataSource={table.columns.map((col, colIndex) => ({ ...col, key: `col-${colIndex}` }))}
                    pagination={false}
                    size="middle"
                    rowKey="key"
                    footer={() => (
                        <Button
                            type="dashed"
                            onClick={() => addColumn(tableIndex)}
                            style={{ width: '100%' }}
                            icon={<PlusOutlined />}
                        >
                            添加字段
                        </Button>
                    )}
                />
            </div>
        </div>
    );
  };

  // 渲染主要内容
  const mainContent = isEditMode && !readOnlyInEditMode ? renderEditMode() : renderReadMode();

  // 返回主要内容和模态框
  return (
    <>
      {mainContent}
      
      {/* 工作区表选择对话框 */}
      <Modal
        title="从资源池导入库表"
        open={workspaceTableSelectVisible}
        onCancel={closeWorkspaceTableSelect}
        onOk={confirmWorkspaceTableSelect}
        width={900}
        okButtonProps={{ 
          disabled: selectedWorkspaceTableIds.length === 0 || tablesLoading,
          loading: tablesLoading
        }}
        okText="导入选中库表"
        cancelText="取消"
        destroyOnClose
      >
        {renderWorkspaceTableModalContent()}
      </Modal>
    </>
  );
});

export default DatabaseTablesSection; 