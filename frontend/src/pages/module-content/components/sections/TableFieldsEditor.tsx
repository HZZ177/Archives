import React, { useState } from 'react';
import { Form, Input, Select, Checkbox, Button, Space, Table, Typography } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { DatabaseTableColumn } from '../../../../types/modules';

const { TextArea } = Input;
const { Option } = Select;

interface TableFieldsEditorProps {
  fields: DatabaseTableColumn[];
  onFieldsChange: (fields: DatabaseTableColumn[]) => void;
  onValidationChange: (errors: string[]) => void;
}

const TableFieldsEditor: React.FC<TableFieldsEditorProps> = ({
  fields,
  onFieldsChange,
  onValidationChange,
}) => {
  const [activeTab, setActiveTab] = useState<string>('fields');

  const handleFieldChange = (index: number, field: keyof DatabaseTableColumn, value: any) => {
    const newFields = [...fields];
    
    // 处理特殊情况：如果是主键，设置非空和唯一
    if (field === 'is_primary_key' && value === true) {
      // 确保其他字段不是主键
      newFields.forEach((f, idx) => {
        if (idx !== index && f.is_primary_key) {
          f.is_primary_key = false;
        }
      });
      
      newFields[index] = {
        ...newFields[index],
        nullable: false,
        is_unique: true,
        [field]: value
      };
    } else {
      newFields[index] = {
        ...newFields[index],
        [field]: value
      };
    }
    
    onFieldsChange(newFields);
    validateFields(newFields);
  };

  const addField = () => {
    const newField: DatabaseTableColumn = {
      field_name: '',
      field_type: 'varchar',
      length: 255,
      nullable: true,
      is_primary_key: false,
      is_unique: false,
      is_index: false,
      description: ''
    };
    
    onFieldsChange([...fields, newField]);
  };

  const removeField = (index: number) => {
    const newFields = [...fields];
    newFields.splice(index, 1);
    onFieldsChange(newFields);
    validateFields(newFields);
  };

  const validateFields = (fieldsToValidate: DatabaseTableColumn[]) => {
    const errors: string[] = [];
    
    // 验证字段名
    fieldsToValidate.forEach((field, index) => {
      if (!field.field_name.trim()) {
        errors.push(`字段 ${index + 1} 的名称不能为空`);
      }
    });
    
    // 验证字段类型
    fieldsToValidate.forEach((field, index) => {
      if (!field.field_type) {
        errors.push(`字段 ${index + 1} 的类型不能为空`);
      }
    });
    
    // 验证主键
    const primaryKeyCount = fieldsToValidate.filter(f => f.is_primary_key).length;
    if (primaryKeyCount > 1) {
      errors.push('一个表只能有一个主键');
    }
    
    onValidationChange(errors);
  };

  const columns = [
    {
      title: '字段名',
      dataIndex: 'field_name',
      key: 'field_name',
      render: (text: string, record: DatabaseTableColumn, index: number) => (
        <Input
          value={text}
          onChange={e => handleFieldChange(index, 'field_name', e.target.value)}
          placeholder="输入字段名"
        />
      ),
    },
    {
      title: '类型',
      dataIndex: 'field_type',
      key: 'field_type',
      render: (text: string, record: DatabaseTableColumn, index: number) => (
        <Select
          value={text}
          onChange={value => handleFieldChange(index, 'field_type', value)}
          style={{ width: '100%' }}
        >
          <Option value="varchar">VARCHAR</Option>
          <Option value="char">CHAR</Option>
          <Option value="text">TEXT</Option>
          <Option value="int">INT</Option>
          <Option value="bigint">BIGINT</Option>
          <Option value="float">FLOAT</Option>
          <Option value="double">DOUBLE</Option>
          <Option value="decimal">DECIMAL</Option>
          <Option value="date">DATE</Option>
          <Option value="datetime">DATETIME</Option>
          <Option value="timestamp">TIMESTAMP</Option>
          <Option value="boolean">BOOLEAN</Option>
        </Select>
      ),
    },
    {
      title: '长度',
      dataIndex: 'length',
      key: 'length',
      render: (text: number, record: DatabaseTableColumn, index: number) => (
        <Input
          value={text}
          onChange={e => handleFieldChange(index, 'length', e.target.value ? parseInt(e.target.value) : undefined)}
          placeholder="长度"
          disabled={!['varchar', 'char', 'decimal'].includes(record.field_type)}
        />
      ),
    },
    {
      title: '允许空',
      dataIndex: 'nullable',
      key: 'nullable',
      render: (text: boolean, record: DatabaseTableColumn, index: number) => (
        <Checkbox
          checked={text}
          onChange={e => handleFieldChange(index, 'nullable', e.target.checked)}
          disabled={record.is_primary_key} // 主键不能为空
        />
      ),
    },
    {
      title: '主键',
      dataIndex: 'is_primary_key',
      key: 'is_primary_key',
      render: (text: boolean, record: DatabaseTableColumn, index: number) => (
        <Checkbox
          checked={text}
          onChange={e => handleFieldChange(index, 'is_primary_key', e.target.checked)}
        />
      ),
    },
    {
      title: '唯一',
      dataIndex: 'is_unique',
      key: 'is_unique',
      render: (text: boolean, record: DatabaseTableColumn, index: number) => (
        <Checkbox
          checked={text}
          onChange={e => handleFieldChange(index, 'is_unique', e.target.checked)}
          disabled={record.is_primary_key} // 主键已经是唯一的
        />
      ),
    },
    {
      title: '索引',
      dataIndex: 'is_index',
      key: 'is_index',
      render: (text: boolean, record: DatabaseTableColumn, index: number) => (
        <Checkbox
          checked={text}
          onChange={e => handleFieldChange(index, 'is_index', e.target.checked)}
        />
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string, record: DatabaseTableColumn, index: number) => (
        <TextArea
          value={text}
          onChange={e => handleFieldChange(index, 'description', e.target.value)}
          placeholder="输入字段描述"
          autoSize={{ minRows: 1, maxRows: 3 }}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: DatabaseTableColumn, index: number) => (
        <Button
          type="text"
          danger
          icon={<MinusCircleOutlined />}
          onClick={() => removeField(index)}
        />
      ),
    },
  ];

  return (
    <div className="table-fields-editor">
      <Table
        columns={columns}
        dataSource={fields}
        rowKey={(record, index) => index?.toString() || ''}
        pagination={false}
        size="middle"
      />
      <Button
        type="dashed"
        onClick={addField}
        block
        icon={<PlusOutlined />}
        style={{ marginTop: 16 }}
      >
        添加字段
      </Button>
    </div>
  );
};

export default TableFieldsEditor; 