import React, { useState, useCallback, useMemo } from 'react';
import { Card, Typography, List, Button, Tooltip, Tag, Badge, Radio, Tabs, Input } from 'antd';
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
  ApiOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { DatabaseTable } from '../../../types/modules';
import { ApiInterfaceCard } from '../../../types/modules';
import { debounce } from '../../../utils/throttle';
import styles from './ResourcePanel.module.css';

const { Title, Paragraph } = Typography;
const { Search } = Input;

// 资源类型
type ResourceType = 'database' | 'interface';

// 属性定义
interface ResourcePanelProps {
  databaseTables: DatabaseTable[];
  apiInterfaces: ApiInterfaceCard[];
  onTableDragStart: (table: DatabaseTable, event: React.DragEvent<HTMLDivElement>) => void;
  onInterfaceDragStart: (api: ApiInterfaceCard, event: React.DragEvent<HTMLDivElement>) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  isEditable?: boolean;
  onRefresh?: () => void;
  onTableDetailClick?: (table: DatabaseTable) => void;
  onInterfaceDetailClick?: (api: ApiInterfaceCard) => void;
}

// 获取请求方法对应的颜色
const getMethodColor = (method?: string): string => {
  if (!method) return 'default';
  
  const METHOD_COLORS: Record<string, string> = {
    GET: 'green',
    POST: 'blue',
    PUT: 'orange',
    DELETE: 'red',
    PATCH: 'purple'
  };
  
  return METHOD_COLORS[method.toUpperCase()] || 'default';
};

const ResourcePanel: React.FC<ResourcePanelProps> = ({
  databaseTables,
  apiInterfaces,
  onTableDragStart,
  onInterfaceDragStart,
  collapsed,
  onCollapsedChange,
  isEditable = true,
  onRefresh,
  onTableDetailClick,
  onInterfaceDetailClick
}) => {
  // 当前选择的资源类型
  const [resourceType, setResourceType] = useState<ResourceType>('database');
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

  // 切换资源类型
  const handleResourceTypeChange = (type: string) => {
    setResourceType(type as ResourceType);
    // 切换资源类型时清除搜索
    setInputValue('');
    setSearchText('');
  };

  // 获取当前资源类型对应的资源数量
  const getResourceCount = () => {
    return resourceType === 'database' ? databaseTables.length : apiInterfaces.length;
  };

  // 渲染面板标题
  const renderPanelTitle = () => {
    return resourceType === 'database' ? (
      <>
        <DatabaseOutlined /> 数据库表
        <Badge 
          count={databaseTables.length} 
          style={{ 
            backgroundColor: isEditable ? '#8e7cc3' : '#d9d9d9',
            boxShadow: 'none'
          }}
        />
      </>
    ) : (
      <>
        <ApiOutlined /> 接口资源
        <Badge 
          count={apiInterfaces.length} 
          style={{ 
            backgroundColor: isEditable ? '#1890ff' : '#d9d9d9',
            boxShadow: 'none'
          }}
        />
      </>
    );
  };

  // 渲染折叠状态下的图标和文字
  const renderCollapsedContent = () => {
    return (
      <div className={styles.collapsedContentContainer}>
        <div className={styles.verticalIcon}>
          {resourceType === 'database' ? <DatabaseOutlined /> : <ApiOutlined />}
        </div>
        <div className={styles.verticalText}>
          {resourceType === 'database' ? '数据库表' : '接口资源'}
        </div>
        {getResourceCount() > 0 && (
          <div className={styles.verticalBadge}
            style={{ 
              backgroundColor: resourceType === 'database' ? '#8e7cc3' : '#1890ff' 
            }}
          >
            {getResourceCount()}
          </div>
        )}
        {!isEditable && (
          <div className={styles.readOnlyIndicator}>
            <LockOutlined />
          </div>
        )}
      </div>
    );
  };

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
            className={`${styles.resourceCard} ${styles.tableCard} ${!isEditable ? styles.readOnly : ''}`}
            draggable={isEditable}
            onDragStart={(e) => onTableDragStart(table, e)}
            styles={{ body: { padding: '12px' } }}
            variant="borderless"
          >
            <Title level={5} className={styles.resourceName}>
              {table.name}
              <div style={{ display: 'flex', marginLeft: 'auto' }}>
                <Tooltip title="查看表详情" placement="top" color="white" styles={{ body: { color: 'black' } }}>
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
                  <Tooltip title="可拖拽到画布" placement="top" color="white" styles={{ body: { color: 'black' } }}>
                    <DragOutlined style={{ fontSize: '14px', color: '#8e7cc3' }} />
                  </Tooltip>
                )}
              </div>
            </Title>
            {table.description && (
              <Paragraph ellipsis={{ rows: 2 }} className={styles.resourceDescription}>
                {table.description}
              </Paragraph>
            )}
            <div className={styles.resourceInfo}>
              <span className={styles.resourceDetail}>
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

  // 渲染接口资源列表
  const renderApiInterfaces = () => {
    // 根据搜索文本过滤接口资源
    const filteredInterfaces = apiInterfaces.filter(api => {
      if (!searchText) return true;
      const searchLower = searchText.toLowerCase();
      return (
        api.path.toLowerCase().includes(searchLower) || 
        api.method.toLowerCase().includes(searchLower) || 
        (api.description && api.description.toLowerCase().includes(searchLower))
      );
    });

    if (filteredInterfaces.length === 0) {
      // 如果有搜索文本但没有结果，显示搜索无结果提示
      if (searchText) {
        return (
          <div className={styles.emptyState}>
            <SearchOutlined className={styles.emptyIcon} />
            <p>未找到匹配的接口资源</p>
            <p style={{ fontSize: '12px' }}>请尝试其他搜索关键词</p>
          </div>
        );
      }
      
      // 如果没有搜索文本且没有接口，显示原始的空状态
      return (
        <div className={styles.emptyState}>
          <InboxOutlined className={styles.emptyIcon} />
          <p>暂无接口资源</p>
          {isEditable && <p style={{ fontSize: '12px' }}>请先在接口模块中添加接口资源</p>}
        </div>
      );
    }

    return (
      <List
        dataSource={filteredInterfaces}
        renderItem={(api) => (
          <Card
            className={`${styles.resourceCard} ${styles.interfaceCard} ${!isEditable ? styles.readOnly : ''}`}
            draggable={isEditable}
            onDragStart={(e) => onInterfaceDragStart(api, e)}
            styles={{ body: { padding: '12px' } }}
            variant="borderless"
          >
            <Title level={5} className={styles.resourceName}>
              <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                <Tag color={getMethodColor(api.method)} style={{ margin: 0, marginRight: '4px' }}>{api.method}</Tag>
                <Tooltip 
                  title={api.path} 
                  placement="top" 
                  color="white" 
                  styles={{ body: { color: 'black' } }}
                >
                  <span className={styles.interfacePath}>{api.path}</span>
                </Tooltip>
              </div>
              <div style={{ display: 'flex', marginLeft: 'auto', flexShrink: 0 }}>
                <Tooltip title="查看接口详情" placement="top" color="white" styles={{ body: { color: 'black' } }}>
                  <Button
                    type="text"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onInterfaceDetailClick) {
                        onInterfaceDetailClick(api);
                      }
                    }}
                    style={{ marginRight: '4px' }}
                  />
                </Tooltip>
                {isEditable && (
                  <Tooltip title="可拖拽到画布" placement="top" color="white" styles={{ body: { color: 'black' } }}>
                    <DragOutlined style={{ fontSize: '14px', color: '#1890ff' }} />
                  </Tooltip>
                )}
              </div>
            </Title>
            {api.description && (
              <Paragraph ellipsis={{ rows: 2 }} className={styles.resourceDescription}>
                {api.description}
              </Paragraph>
            )}
            <div className={styles.resourceInfo}>
              <span className={styles.resourceDetail}>
                <span className={styles.contentType}>{api.contentType || 'application/json'}</span>
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

  return (
    <div 
      className={`${styles.resourcePanel} ${collapsed ? styles.collapsed : ''}`}
      onClick={collapsed ? handleCollapsedPanelClick : undefined}
    >
      <div className={styles.header}>
        {!collapsed ? (
          <div className={styles.headerContent}>
            <Title level={5} className={styles.title}>
              {renderPanelTitle()}
              {!isEditable && <Tag color="default" style={{ marginLeft: 4 }}><LockOutlined /> 阅读模式</Tag>}
            </Title>
            <div className={styles.headerActions}>
              {isEditable && onRefresh && (
                <Tooltip title="刷新资源" placement="top" color="white" styles={{ body: { color: 'black' } }}>
                  <Button
                    type="text"
                    icon={<ReloadOutlined />}
                    onClick={handleRefresh}
                    className={styles.refreshButton}
                  />
                </Tooltip>
              )}
              <Tooltip title="收起面板" placement="top" color="white" styles={{ body: { color: 'black' } }}>
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
            </div>
          </div>
        ) : (
          renderCollapsedContent()
        )}
      </div>
      
      {!collapsed && (
        <>
          <div className={styles.resourceTypeSelector}>
            <Tabs
              activeKey={resourceType}
              onChange={handleResourceTypeChange}
              size="small"
              className={styles.resourceTypeTabs}
              centered
              type="card"
              items={[
                {
                  key: 'database',
                  label: (
                    <span>
                      <DatabaseOutlined /> 数据库表
                    </span>
                  )
                },
                {
                  key: 'interface',
                  label: (
                    <span>
                      <ApiOutlined /> 接口资源
                    </span>
                  )
                }
              ]}
            />
          </div>
          
          {/* 添加搜索框 */}
          <div className={styles.searchContainer}>
            <Search
              placeholder={resourceType === 'database' ? "搜索数据库表..." : "搜索接口资源..."}
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
            {resourceType === 'database' ? renderDatabaseTables() : renderApiInterfaces()}
          </div>
        </>
      )}
    </div>
  );
};

export default ResourcePanel; 