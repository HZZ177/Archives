import React from 'react';
import { Button, Input, Form, Select, Space, Table } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Option } = Select;
const { TextArea } = Input;

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
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      render: (text, record) => (
        <TextArea
          value={text}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateInterface(record.id, 'description', e.target.value)}
          placeholder="接口说明"
          autoSize={{ minRows: 2, maxRows: 4 }}
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