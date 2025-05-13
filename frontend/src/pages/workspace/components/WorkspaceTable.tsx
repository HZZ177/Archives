import React from 'react';
import { Table, Button, Tag, Space, Tooltip } from 'antd';
import { EditOutlined, DeleteOutlined, StarOutlined } from '@ant-design/icons';
import { Workspace } from '../../../types/workspace';

interface WorkspaceTableProps {
  workspaces: Workspace[];
  onEdit: (workspace: Workspace) => void;
  onDelete: (workspace: Workspace) => void;
  onSetDefault: (workspace: Workspace) => void;
}

/**
 * 工作区表格组件
 */
const WorkspaceTable: React.FC<WorkspaceTableProps> = ({
  workspaces,
  onEdit,
  onDelete,
  onSetDefault,
}) => {
  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Workspace) => (
        <Space>
          <span
            style={{
              display: 'inline-block',
              width: '12px',
              height: '12px',
              borderRadius: '6px',
              backgroundColor: record.color || '#1890ff',
              marginRight: '8px',
            }}
          />
          <span>{text}</span>
          {record.is_default && <Tag color="blue">默认</Tag>}
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => text || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => text ? new Date(text).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Workspace) => (
        <Space size="middle">
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => onEdit(record)}
            />
          </Tooltip>
          <Tooltip title={record.is_default ? '默认工作区不能删除' : '删除'}>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => onDelete(record)}
              disabled={record.is_default}
            />
          </Tooltip>
          <Tooltip title={record.is_default ? '已设为默认' : '设为默认'}>
            <Button
              type="text"
              icon={<StarOutlined />}
              onClick={() => onSetDefault(record)}
              disabled={record.is_default}
              style={{ color: record.is_default ? '#faad14' : undefined }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={workspaces}
      pagination={false}
    />
  );
};

export default WorkspaceTable; 