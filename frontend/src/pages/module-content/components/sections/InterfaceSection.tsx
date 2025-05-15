import React, { useState } from 'react';
import { Button, Input, Form, Select, Table } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { MdEditor } from 'md-editor-rt';
import 'md-editor-rt/lib/style.css';
import './SectionStyles.css';

const { Option } = Select;

interface InterfaceItem {
  id: string;
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface InterfaceSectionProps {
  interfaces: InterfaceItem[];
  onChange: (interfaces: InterfaceItem[]) => void;
}

const InterfaceSection: React.FC<InterfaceSectionProps> = ({ interfaces, onChange }) => {
  // 为每个编辑器创建唯一ID
  const [editorIdsMap] = useState<Record<string, string>>({});
  
  // 获取或创建编辑器ID
  const getEditorId = (id: string) => {
    if (!editorIdsMap[id]) {
      editorIdsMap[id] = `interface-${id}-${Date.now()}`;
    }
    return editorIdsMap[id];
  };

  // 添加一个新的接口
  const addInterface = () => {
    const newId = `interface_${Date.now()}`;
    onChange([
      ...interfaces,
      {
        id: newId,
        name: '',
        type: 'string',
        required: true,
        description: ''
      }
    ]);
  };

  // 删除接口
  const removeInterface = (id: string) => {
    onChange(interfaces.filter(item => item.id !== id));
  };

  // 更新接口属性
  const updateInterface = (id: string, field: keyof InterfaceItem, value: any) => {
    onChange(
      interfaces.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  // 表格列定义
  const columns: ColumnsType<InterfaceItem> = [
    {
      title: '接口名称',
      dataIndex: 'name',
      key: 'name',
      width: '20%',
      render: (text, record) => (
        <Input
          value={text}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateInterface(record.id, 'name', e.target.value)}
          placeholder="接口名称"
        />
      ),
    },
    {
      title: '数据类型',
      dataIndex: 'type',
      key: 'type',
      width: '15%',
      render: (text, record) => (
        <Select
          value={text}
          style={{ width: '100%' }}
          onChange={(value) => updateInterface(record.id, 'type', value)}
        >
          <Option value="string">字符串</Option>
          <Option value="number">数值</Option>
          <Option value="boolean">布尔值</Option>
          <Option value="object">对象</Option>
          <Option value="array">数组</Option>
          <Option value="function">函数</Option>
        </Select>
      ),
    },
    {
      title: '是否必需',
      dataIndex: 'required',
      key: 'required',
      width: '10%',
      render: (value, record) => (
        <Select
          value={value}
          style={{ width: '100%' }}
          onChange={(val) => updateInterface(record.id, 'required', val)}
        >
          <Option value={true}>是</Option>
          <Option value={false}>否</Option>
        </Select>
      ),
    },
    {
      title: (
        <div>
          说明 <span style={{ fontSize: '12px', color: '#888' }}>(支持Markdown)</span>
        </div>
      ),
      dataIndex: 'description',
      key: 'description',
      render: (text, record) => (
        <MdEditor
          modelValue={text}
          onChange={(value) => updateInterface(record.id, 'description', value)}
          id={getEditorId(record.id)}
          language="zh-CN"
          previewTheme="github"
          preview={true}
          style={{ height: '150px', boxShadow: '0 0 0 1px #f0f0f0' }}
          placeholder="接口说明（支持Markdown语法）"
          noMermaid
          noKatex
          tabWidth={2}
          toolbarsExclude={['github', 'save', 'fullscreen']}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: '10%',
      render: (_, record) => (
        <Button 
          type="text" 
          danger 
          icon={<MinusCircleOutlined />} 
          onClick={() => removeInterface(record.id)}
          size="small"
        >
          删除
        </Button>
      ),
    },
  ];

  return (
    <div className="section-content">
      <Table
        rowKey="id"
        columns={columns}
        dataSource={interfaces}
        pagination={false}
        bordered
      />
      <Button
        type="dashed"
        onClick={addInterface}
        style={{ marginTop: 16, width: '100%' }}
        icon={<PlusOutlined />}
      >
        添加接口
      </Button>
    </div>
  );
};

export default InterfaceSection; 