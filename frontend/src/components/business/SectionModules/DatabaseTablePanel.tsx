import React, { useState } from 'react';
import { Card, Typography, List, Button, Tooltip, Tag } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined, DatabaseOutlined, LockOutlined } from '@ant-design/icons';
import { DatabaseTable } from '../../../types/modules';
import styles from './DatabaseTablePanel.module.css';

const { Title, Paragraph } = Typography;

interface DatabaseTablePanelProps {
  databaseTables: DatabaseTable[];
  onDragStart: (table: DatabaseTable, event: React.DragEvent<HTMLDivElement>) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  isEditable?: boolean;
}

const DatabaseTablePanel: React.FC<DatabaseTablePanelProps> = ({
  databaseTables,
  onDragStart,
  collapsed,
  onCollapsedChange,
  isEditable = true,
}) => {
  console.log('DatabaseTablePanel 渲染:', {
    tablesCount: databaseTables.length,
    tables: databaseTables,
    collapsed,
    isEditable
  });

  return (
    <div className={`${styles.databaseTablePanel} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.header}>
        <Title level={5} className={styles.title}>
          {!collapsed && (
            <>
              <DatabaseOutlined /> 数据库表 ({databaseTables.length})
              {!isEditable && <Tag color="default" style={{ marginLeft: 8 }}><LockOutlined /> 阅读模式</Tag>}
            </>
          )}
        </Title>
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => onCollapsedChange(!collapsed)}
          className={styles.collapseButton}
        />
      </div>
      
      {!collapsed && (
        <div className={styles.content}>
          {databaseTables.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
              暂无数据库表
            </div>
          ) : (
            <List
              dataSource={databaseTables}
              renderItem={(table) => (
                <Card
                  className={`${styles.tableCard} ${!isEditable ? styles.readOnly : ''}`}
                  draggable={isEditable}
                  onDragStart={(e) => onDragStart(table, e)}
                >
                  <Title level={5} className={styles.tableName}>{table.table_name}</Title>
                  {table.description && (
                    <Paragraph ellipsis={{ rows: 2 }} className={styles.tableDescription}>
                      {table.description}
                    </Paragraph>
                  )}
                  <div className={styles.tableInfo}>
                    <span>{table.columns?.length || 0} 个字段</span>
                    {!isEditable && <LockOutlined style={{ marginLeft: 8, fontSize: 12 }} />}
                  </div>
                </Card>
              )}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default DatabaseTablePanel; 