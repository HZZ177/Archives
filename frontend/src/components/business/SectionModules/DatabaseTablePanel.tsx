import React, { useState, useCallback, useMemo } from 'react';
import { Card, Typography, List, Button, Tooltip, Tag, Badge, Input } from 'antd';
import { 
  MenuFoldOutlined, 
  MenuUnfoldOutlined, 
  DatabaseOutlined, 
  LockOutlined,
  FieldNumberOutlined,
  InboxOutlined,
  TableOutlined,
  DragOutlined,
  ReloadOutlined,
  EyeOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { DatabaseTable } from '../../../types/modules';
import { WorkspaceTableRead } from '../../../types/workspace';
import { debounce } from '../../../utils/throttle';
import styles from './DatabaseTablePanel.module.css';

const { Title, Paragraph } = Typography;
const { Search } = Input;

interface DatabaseTablePanelProps {
  databaseTables: DatabaseTable[];
  onDragStart: (table: DatabaseTable, event: React.DragEvent<HTMLDivElement>) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  isEditable?: boolean;
  onRefresh?: () => void;
  onTableDetailClick?: (table: DatabaseTable) => void;
}

const DatabaseTablePanel: React.FC<DatabaseTablePanelProps> = ({
  databaseTables,
  onDragStart,
  collapsed,
  onCollapsedChange,
  isEditable = true,
  onRefresh,
  onTableDetailClick
}) => {
  // 添加搜索状态
  const [searchText, setSearchText] = useState<string>('');
  // 添加本地输入状态，用于实时更新输入框的值
  const [inputValue, setInputValue] = useState<string>('');

  const handleCollapsedPanelClick = () => {
    if (collapsed) {
      onCollapsedChange(false);
    }
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRefresh) {
      onRefresh();
    }
  };

  // 使用debounce优化搜索，延迟300ms执行搜索
  const debouncedSetSearchText = useMemo(
    () => debounce((value: string) => {
      setSearchText(value);
    }, 300),
    []
  );

  // 处理搜索输入变化
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value); // 立即更新输入框的值
    debouncedSetSearchText(value); // 延迟更新搜索结果
  }, [debouncedSetSearchText]);

  // 处理搜索框清除
  const handleSearchClear = useCallback(() => {
    setInputValue('');
    setSearchText('');
  }, []);

  // 渲染数据库表列表
  const renderDatabaseTables = () => {
    // 根据搜索文本过滤数据库表
    const filteredTables = databaseTables.filter(table => {
      if (!searchText) return true;
      const searchLower = searchText.toLowerCase();
      return (
        table.name.toLowerCase().includes(searchLower) || 
        (table.description && table.description.toLowerCase().includes(searchLower))
      );
    });

    if (filteredTables.length === 0) {
      // 如果有搜索文本但没有结果，显示搜索无结果提示
      if (searchText) {
        return (
          <div className={styles.emptyState}>
            <SearchOutlined className={styles.emptyIcon} />
            <p>未找到匹配的数据库表</p>
            <p style={{ fontSize: '12px' }}>请尝试其他搜索关键词</p>
          </div>
        );
      }
      
      // 如果没有搜索文本且没有表，显示原始的空状态
      return (
        <div className={styles.emptyState}>
          <InboxOutlined className={styles.emptyIcon} />
          <p>暂无数据库表</p>
          {isEditable && <p style={{ fontSize: '12px' }}>请先在数据库表模块中添加表结构</p>}
        </div>
      );
    }

    return (
      <List
        dataSource={filteredTables}
        renderItem={(table) => (
          <Card
            className={`${styles.tableCard} ${!isEditable ? styles.readOnly : ''}`}
            draggable={isEditable}
            onDragStart={(e) => onDragStart(table, e)}
            bodyStyle={{ padding: '12px' }}
            bordered={false}
          >
            <Title level={5} className={styles.tableName}>
              {table.name}
              <div style={{ display: 'flex', marginLeft: 'auto' }}>
                <Tooltip title="查看表详情" placement="top" color="white" overlayInnerStyle={{ color: 'black' }}>
                  <Button
                    type="text"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onTableDetailClick) {
                        // 确保表数据格式正确
                        const processedTable = {
                          ...table,
                          // 确保 columns 属性存在
                          columns: table.columns || (table as any).columns_json || []
                        };

                        onTableDetailClick(processedTable);
                      }
                    }}
                    style={{ marginRight: '4px' }}
                  />
                </Tooltip>
                {isEditable && (
                  <Tooltip title="可拖拽到画布" placement="top" color="white" overlayInnerStyle={{ color: 'black' }}>
                    <DragOutlined style={{ fontSize: '14px', color: '#8e7cc3' }} />
                  </Tooltip>
                )}
              </div>
            </Title>
            {table.description && (
              <Paragraph ellipsis={{ rows: 2 }} className={styles.tableDescription}>
                {table.description}
              </Paragraph>
            )}
            <div className={styles.tableInfo}>
              <span className={styles.fieldCount}>
                <FieldNumberOutlined /> {table.columns?.length || 0} 个字段
              </span>
              {!isEditable && (
                <Tag color="default"><LockOutlined /> 只读</Tag>
              )}
            </div>
          </Card>
        )}
      />
    );
  };

  return (
    <div 
      className={`${styles.databaseTablePanel} ${collapsed ? styles.collapsed : ''}`}
      onClick={collapsed ? handleCollapsedPanelClick : undefined}
    >
      <div className={styles.header}>
        <Title level={5} className={styles.title}>
          {!collapsed && (
            <>
              <DatabaseOutlined /> 数据库表 
              <Badge 
                count={databaseTables.length} 
                style={{ 
                  backgroundColor: isEditable ? '#8e7cc3' : '#d9d9d9',
                  boxShadow: 'none'
                }}
              />
              {!isEditable && <Tag color="default" style={{ marginLeft: 4 }}><LockOutlined /> 阅读模式</Tag>}
            </>
          )}
        </Title>
        {collapsed && (
          <div className={styles.collapsedContentContainer}>
            <div className={styles.verticalIcon}>
              <DatabaseOutlined />
            </div>
            <div className={styles.verticalText}>数据库表</div>
            {databaseTables.length > 0 && (
              <div className={styles.verticalBadge}>
                {databaseTables.length}
              </div>
            )}
            {!isEditable && (
              <div className={styles.readOnlyIndicator}>
                <LockOutlined />
              </div>
            )}
          </div>
        )}
        {!collapsed && (
          <>
            {isEditable && onRefresh && (
              <Tooltip title="刷新数据库表" placement="top" color="white" overlayInnerStyle={{ color: 'black' }}>
                <Button
                  type="text"
                  icon={<ReloadOutlined />}
                  onClick={handleRefresh}
                  className={styles.refreshButton}
                />
              </Tooltip>
            )}
            <Tooltip title="收起面板" placement="top" color="white" overlayInnerStyle={{ color: 'black' }}>
              <Button
                type="text"
                icon={<MenuFoldOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onCollapsedChange(true);
                }}
                className={styles.collapseButton}
              />
            </Tooltip>
          </>
        )}
      </div>
      
      {!collapsed && (
        <>
          {/* 添加搜索框 */}
          <div className={styles.searchContainer}>
            <Search
              placeholder="搜索数据库表..."
              allowClear
              onChange={handleSearchChange}
              onSearch={(value) => {
                setInputValue(value);
                setSearchText(value);
              }}
              value={inputValue}
              size="small"
            />
          </div>
          
          <div className={styles.content}>
            {renderDatabaseTables()}
          </div>
        </>
      )}
    </div>
  );
};

export default DatabaseTablePanel; 