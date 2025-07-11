import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Typography, Spin, Empty, Row, Col, message, Modal, Input, Pagination } from 'antd';
import { PlusOutlined, DatabaseOutlined, EditOutlined, DeleteOutlined, ImportOutlined, CalendarOutlined, NumberOutlined, InfoCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { usePermission } from '../../contexts/PermissionContext';
import { getWorkspaceTables, createWorkspaceTable, updateWorkspaceTable, deleteWorkspaceTable } from '../../apis/workspaceService';
import { WorkspaceTableRead, WorkspaceTableCreate, WorkspaceTableUpdate } from '../../types/workspace';
import { DatabaseTable, DatabaseTableColumn } from '../../types/modules';
import { ROUTES } from '../../config/constants';
import { Navigate } from 'react-router-dom';
import './WorkspaceResourcesPage.css';
import { getWorkspaceTablesPaginated } from '../../services/workspaceTableService';
import { debounce } from '../../utils/throttle';

// 复用内容页面中的数据库表组件
import DatabaseTablesSection, { ValidationHandle } from '../module-content/components/sections/DatabaseTablesSection';
import TableBatchEditModal from './components/TableBatchEditModal';

const { Title } = Typography;
const { TextArea } = Input;
const { Search } = Input;

// 自定义图标组件
interface IconProps {
  style?: React.CSSProperties;
}

const FieldStringOutlined: React.FC<IconProps> = ({ style }) => (
  <svg viewBox="64 64 896 896" focusable="false" data-icon="field-string" width="1em" height="1em" fill="currentColor" aria-hidden="true" style={style}>
    <path d="M880 112H144c-17.7 0-32 14.3-32 32v736c0 17.7 14.3 32 32 32h736c17.7 0 32-14.3 32-32V144c0-17.7-14.3-32-32-32zM368 744c0 4.4-3.6 8-8 8h-80c-4.4 0-8-3.6-8-8V280c0-4.4 3.6-8 8-8h80c4.4 0 8 3.6 8 8v464zm192 0c0 4.4-3.6 8-8 8h-80c-4.4 0-8-3.6-8-8V280c0-4.4 3.6-8 8-8h80c4.4 0 8 3.6 8 8v464zm192 0c0 4.4-3.6 8-8 8h-80c-4.4 0-8-3.6-8-8V280c0-4.4 3.6-8 8-8h80c4.4 0 8 3.6 8 8v464z" />
  </svg>
);

const FieldBinaryOutlined: React.FC<IconProps> = ({ style }) => (
  <svg viewBox="64 64 896 896" focusable="false" data-icon="field-binary" width="1em" height="1em" fill="currentColor" aria-hidden="true" style={style}>
    <path d="M880 112H144c-17.7 0-32 14.3-32 32v736c0 17.7 14.3 32 32 32h736c17.7 0 32-14.3 32-32V144c0-17.7-14.3-32-32-32zM320 744c0 4.4-3.6 8-8 8h-80c-4.4 0-8-3.6-8-8V280c0-4.4 3.6-8 8-8h80c4.4 0 8 3.6 8 8v464zm192 0c0 4.4-3.6 8-8 8h-80c-4.4 0-8-3.6-8-8V280c0-4.4 3.6-8 8-8h80c4.4 0 8 3.6 8 8v464zm192 0c0 4.4-3.6 8-8 8h-80c-4.4 0-8-3.6-8-8V280c0-4.4 3.6-8 8-8h80c4.4 0 8 3.6 8 8v464z" />
  </svg>
);

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

const WorkspaceTablesPage: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const { hasPermission } = usePermission();
  const [tables, setTables] = useState<WorkspaceTableRead[]>([]);
  const [databaseTables, setDatabaseTables] = useState<DatabaseTable[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [currentTable, setCurrentTable] = useState<WorkspaceTableRead | null>(null);
  const [editingTableData, setEditingTableData] = useState<DatabaseTable | null>(null);
  const validationRef = useRef<ValidationHandle>(null);
  const [collapsedTables, setCollapsedTables] = useState<Set<number>>(new Set());
  
  // 导入SQL相关状态
  const [sqlImportModalVisible, setSqlImportModalVisible] = useState<boolean>(false);
  const [sqlInput, setSqlInput] = useState<string>('');
  const [importLoading, setImportLoading] = useState<boolean>(false);
  
  // 添加批量编辑相关状态
  const [batchEditModalVisible, setBatchEditModalVisible] = useState<boolean>(false);
  
  // 搜索相关状态
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [searchInputValue, setSearchInputValue] = useState<string>('');
  
  // 分页相关状态
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  
  // 检查权限
  const hasTablesPermission = hasPermission(ROUTES.WORKSPACE_TABLES);

  // 如果没有权限，重定向到无权限页面
  if (!hasTablesPermission) {
    return <Navigate to="/no-permission" replace />;
  }
  
  // 加载工作区表
  const loadTables = async (
    page = pagination.current,
    pageSize = pagination.pageSize,
    search = searchKeyword
  ) => {
    if (!currentWorkspace) return;
    
    setLoading(true);
    try {
      const data = await getWorkspaceTablesPaginated(currentWorkspace.id, page, pageSize, search);
      setTables(data.items);
      
      // 将 WorkspaceTableRead[] 转换为 DatabaseTable[]
      const convertedTables = data.items.map(table => ({
        id: table.id, // 保存原始ID，用于编辑和删除操作
        name: table.name,
        schema_name: table.schema_name,
        description: table.description,
        columns: table.columns_json,
        // 添加额外的元数据
        meta: {
          creator: table.creator?.username || 'N/A',
          updated_at: new Date(table.updated_at).toLocaleString()
        }
      }));
      
      setDatabaseTables(convertedTables);
      
      // 更新分页信息
      setPagination({
        current: data.page,
        pageSize: data.page_size,
        total: data.total
      });
      
      // 设置所有表格为折叠状态
      const allTableIndexes = new Set(convertedTables.map((_, index) => index));
      setCollapsedTables(allTableIndexes);
    } catch (error) {
      console.error('加载工作区表失败:', error);
      message.error('加载工作区表失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理分页变化
  const handlePageChange = (page: number, pageSize?: number) => {
    setPagination(prev => ({
      ...prev,
      current: page,
      pageSize: pageSize || prev.pageSize
    }));
    loadTables(page, pageSize || pagination.pageSize);
  };

  // 初始加载
  useEffect(() => {
    if (currentWorkspace) {
      loadTables(1, pagination.pageSize, '');
    }
  }, [currentWorkspace]);

  // 使用useCallback和debounce创建去抖的搜索函数
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchKeyword(value.trim());
      // 搜索时重置到第一页
      setPagination(prev => ({ ...prev, current: 1 }));
      // 使用新的搜索条件加载数据
      loadTables(1, pagination.pageSize, value.trim());
    }, 500), // 500ms的去抖延迟
    [currentWorkspace, pagination.pageSize]
  );

  // 处理搜索框输入变化
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInputValue(value);
    debouncedSearch(value);
  };

  // 处理搜索按钮点击
  const handleSearch = (value: string) => {
    setSearchInputValue(value);
    setSearchKeyword(value.trim());
    // 搜索时重置到第一页
    setPagination(prev => ({ ...prev, current: 1 }));
    // 使用新的搜索条件加载数据
    loadTables(1, pagination.pageSize, value.trim());
  };

  // 打开创建表弹窗
  const handleAddTable = () => {
    setCurrentTable(null);
    setEditingTableData({
      name: '',
      columns: []
    });
    setEditModalVisible(true);
  };

  // 打开编辑表弹窗
  const handleEditTable = (table: WorkspaceTableRead) => {
    setCurrentTable(table);
    // 将WorkspaceTable转换为DatabaseTable格式
    setEditingTableData({
      name: table.name,
      schema_name: table.schema_name,
      description: table.description,
      columns: table.columns_json
    });
    setEditModalVisible(true);
  };

  // 处理表单提交
  const handleSubmit = async () => {
    if (!currentWorkspace || !editingTableData) return;
    
    // 调用子组件的验证
    if (validationRef.current && !validationRef.current.validate()) {
      return;
    }
    
    try {
      // 检查表名是否已存在
      const isEdit = !!currentTable;
      const existingTable = tables.find(t => 
        t.name.toLowerCase() === editingTableData.name.toLowerCase() && 
        (!isEdit || t.id !== currentTable?.id)
      );
      
      if (existingTable) {
        message.error(`工作区中已存在名为 '${editingTableData.name}' 的数据库表`);
        return;
      }
      
      if (currentTable) {
        // 更新表
        const updateData: WorkspaceTableUpdate = {
          name: editingTableData.name,
          schema_name: editingTableData.schema_name,
          description: editingTableData.description,
          columns_json: editingTableData.columns,
          relationships_json: editingTableData.relationships
        };
        
        await updateWorkspaceTable(currentWorkspace.id, currentTable.id, updateData);
        message.success('表更新成功');
      } else {
        // 创建表
        const createData: WorkspaceTableCreate = {
          workspace_id: currentWorkspace.id,
          name: editingTableData.name,
          schema_name: editingTableData.schema_name,
          description: editingTableData.description,
          columns_json: editingTableData.columns,
          relationships_json: editingTableData.relationships
        };
        
        await createWorkspaceTable(currentWorkspace.id, createData);
        message.success('表创建成功');
      }
      
      loadTables();
      setEditModalVisible(false);
    } catch (error) {
      console.error('保存表失败:', error);
      message.error('保存表失败');
    }
  };

  // 处理删除表
  const handleDeleteTable = async (table: WorkspaceTableRead) => {
    if (!currentWorkspace) return;
    
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除表 "${table.name}" 吗？此操作不可撤销。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteWorkspaceTable(currentWorkspace.id, table.id);
          message.success('表删除成功');
          loadTables();
        } catch (error) {
          console.error('删除表失败:', error);
          message.error('删除表失败');
        }
      }
    });
  };

  // 处理表格数据变更
  const handleTableDataChange = (tables: DatabaseTable[]) => {
    if (tables.length > 0) {
      setEditingTableData(tables[0]);
    }
  };
  
  // 处理卡片中的编辑按钮点击
  const handleEditButtonClick = (tableIndex: number) => {
    const originalTable = tables.find(t => t.id === (databaseTables[tableIndex] as any).id);
    if (originalTable) {
      handleEditTable(originalTable);
    }
  };
  
  // 处理卡片中的删除按钮点击
  const handleDeleteButtonClick = (tableIndex: number) => {
    const originalTable = tables.find(t => t.id === (databaseTables[tableIndex] as any).id);
    if (originalTable) {
      handleDeleteTable(originalTable);
    }
  };
  
  // 处理表操作（点击删除按钮时）
  const handleTableOperation = (tableIndex: number) => {
    handleDeleteButtonClick(tableIndex);
  };
  
  // 打开SQL导入弹窗
  const showSqlImportModal = () => {
    setSqlImportModalVisible(true);
  };

  // 打开批量编辑弹窗
  const handleBatchEdit = () => {
    setBatchEditModalVisible(true);
  };

  // 关闭SQL导入弹窗
  const closeSqlImportModal = () => {
    setSqlImportModalVisible(false);
    setSqlInput(''); // 清空输入
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

  // 处理SQL导入
  const handleSqlImport = async () => {
    if (!currentWorkspace) {
      message.warning('请先选择一个工作区');
      return;
    }
    
    if (!sqlInput.trim()) {
      message.warning('请输入SQL创建语句');
      return;
    }
    
    setImportLoading(true);
    
    try {
      const parsedTable = parseSql(sqlInput.trim());
      if (!parsedTable) {
        message.error('SQL解析失败，请检查SQL语句格式');
        setImportLoading(false);
        return;
      }
      
      // 检查表名是否已存在
      const existingTable = tables.find(t => t.name.toLowerCase() === parsedTable.name.toLowerCase());
      if (existingTable) {
        message.error(`工作区中已存在名为 '${parsedTable.name}' 的数据库表`);
        setImportLoading(false);
        return;
      }
      
      // 创建表
      const createData: WorkspaceTableCreate = {
        workspace_id: currentWorkspace.id,
        name: parsedTable.name,
        schema_name: parsedTable.schema_name || '',
        description: parsedTable.description || '',
        columns_json: parsedTable.columns,
        relationships_json: parsedTable.relationships
      };
      
      await createWorkspaceTable(currentWorkspace.id, createData);
      message.success(`成功导入表 ${parsedTable.name}`);
      
      // 重新加载表格
      loadTables();
      
      // 关闭弹窗并清空输入
      setSqlInput('');
      closeSqlImportModal();
    } catch (error) {
      console.error('导入SQL时发生错误:', error);
      message.error('导入失败，请检查SQL语句格式');
    } finally {
      setImportLoading(false);
    }
  };

  // 渲染页面内容
  const renderContent = () => {
    if (loading) {
      return <Spin tip="加载中..." />;
    }

    if (!currentWorkspace) {
      return <Empty description="请先选择一个工作区" />;
    }
    
    if (databaseTables.length === 0) {
      return (
        <Empty
          description={searchKeyword ? "没有匹配的数据库表" : "暂无数据库表"}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    return (
      <>
        <div className="database-tables-section">
          <DatabaseTablesSection
            tables={databaseTables}
            onChange={() => {}} // 只读模式，不需要处理变更
            collapsedTables={collapsedTables}
            setCollapsedTables={setCollapsedTables}
            isEditMode={true} // 设为编辑模式，以显示操作按钮
            showActionButtons={false} // 不显示默认的操作按钮，包括"添加表"按钮
            onDelete={handleTableOperation} // 使用onDelete属性处理操作
            onEdit={handleEditButtonClick} // 添加onEdit属性处理编辑操作
            enableWorkspaceTableSelection={false} // 禁用"从工作区选择表"按钮
            readOnlyInEditMode={true} // 在编辑模式下以只读方式显示表格内容
          />
        </div>
        
        {/* 添加分页组件 */}
        {pagination.total > 0 && (
          <div className="pagination-container">
            <Pagination
              current={pagination.current}
              pageSize={pagination.pageSize}
              total={pagination.total}
              onChange={handlePageChange}
              showSizeChanger
              showQuickJumper
              showTotal={(total) => `共 ${total} 条数据`}
              size="small"
              style={{ marginBottom: 8 }} // 添加底部边距，确保输入框下边线可见
            />
          </div>
        )}
      </>
    );
  };

  return (
    <div className="workspace-resources-page">
      <div className="resources-page-header">
        <Title level={5}><DatabaseOutlined /> 数据库表池</Title>
      </div>
      
      <div className="resources-content-container">
        {/* 搜索框和添加按钮 */}
        {currentWorkspace && (
          <div className="resources-actions">
            <Search
              placeholder="搜索表名或描述"
              allowClear
              onSearch={handleSearch}
              onChange={handleSearchInputChange}
              value={searchInputValue}
              style={{ width: '100%', maxWidth: '500px' }}
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              size="middle"
            />
            <div>
              <Button
                icon={<EditOutlined />}
                onClick={handleBatchEdit}
                disabled={!currentWorkspace}
                style={{ marginRight: 6 }}
                size="middle"
              >
                批量编辑
              </Button>
              <Button
                icon={<ImportOutlined />}
                onClick={showSqlImportModal}
                disabled={!currentWorkspace}
                style={{ marginRight: 6 }}
                size="middle"
              >
                导入SQL
              </Button>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={handleAddTable}
                disabled={!currentWorkspace}
                size="middle"
              >
                添加表
              </Button>
            </div>
          </div>
        )}
        
        {/* 显示搜索结果统计 */}
        {searchKeyword && !loading && currentWorkspace && (
          <div style={{ padding: '0 24px', marginBottom: 16, color: '#666' }}>
            搜索 "{searchKeyword}" 的结果: {pagination.total} 条记录
          </div>
        )}
        
        <div className="resources-list">
          {renderContent()}
        </div>
      </div>
      
      {/* 编辑表格弹窗 */}
      <Modal
        title={currentTable ? "编辑表" : "添加表"}
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setEditModalVisible(false)}>
            取消
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            onClick={handleSubmit}
          >
            保存
          </Button>
        ]}
        width={1200}
        destroyOnClose
      >
        <div style={{ minHeight: '450px', maxHeight: '65vh', overflowY: 'auto', padding: '24px' }}>
          {editingTableData && (
            <DatabaseTablesSection
              ref={validationRef}
              tables={[editingTableData]}
              onChange={handleTableDataChange}
              isEditMode={true}
              showActionButtons={false}
              enableRealtimeValidation={false}
              enableWorkspaceTableSelection={false} // 禁用"从工作区选择表"按钮
              hideTableHeader={true} // 隐藏表格顶部的统计信息和展开/折叠按钮
              hideToggleButton={true} // 隐藏表格的收起/展开按钮
              showClearButton={true} // 显示清空按钮（替代删除按钮）
            />
          )}
        </div>
      </Modal>
      
      {/* SQL导入弹窗 */}
      <Modal
        title="导入SQL"
        open={sqlImportModalVisible}
        onCancel={closeSqlImportModal}
        footer={[
          <Button key="cancel" onClick={closeSqlImportModal}>
            取消
          </Button>,
          <Button 
            key="example" 
            onClick={fillExampleSql}
          >
            填充示例
          </Button>,
          <Button 
            key="import" 
            type="primary" 
            onClick={handleSqlImport}
            loading={importLoading}
          >
            导入
          </Button>
        ]}
        width={1200}
      >
        <div style={{ minHeight: '450px', maxHeight: '65vh', overflowY: 'auto', padding: '24px' }}>
          <div style={{ marginBottom: 16 }}>
            <TextArea
              value={sqlInput}
              onChange={(e) => setSqlInput(e.target.value)}
              placeholder="请输入要导入的SQL语句"
              autoSize={{ minRows: 20, maxRows: 30 }}
              className="sql-import-textarea"
            />
          </div>
        </div>
      </Modal>
      
      {/* 批量编辑弹窗 */}
      <TableBatchEditModal
        visible={batchEditModalVisible}
        onCancel={() => setBatchEditModalVisible(false)}
        workspaceId={currentWorkspace?.id}
        onSuccess={() => {
          loadTables(); // 保持在当前页
        }}
      />
    </div>
  );
};

export default WorkspaceTablesPage; 