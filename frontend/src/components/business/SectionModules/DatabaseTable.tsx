import React, { useState, useEffect } from 'react';
import { Card, Space, Typography, Button, Table, Form, Input, Select, Modal } from 'antd';
import { EditOutlined, SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { Section } from '../../../types/document';

const { Title } = Typography;
const { Option } = Select;

interface DatabaseField {
  name: string;
  type: string;
  length?: string;
  required: boolean;
  description?: string;
  key?: string;
}

interface DatabaseTableProps {
  section: Section;
  onSave: (content: string) => void;
  isEditable?: boolean;
}

/**
 * 数据库表组件
 * 用于编辑和展示模块的数据库表
 */
const DatabaseTable: React.FC<DatabaseTableProps> = ({
  section,
  onSave,
  isEditable = true,
}) => {
  const [fields, setFields] = useState<DatabaseField[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingKey, setEditingKey] = useState('');

  // 解析section.content到fields
  useEffect(() => {
    if (section.content) {
      try {
        const parsedFields = JSON.parse(section.content);
        if (Array.isArray(parsedFields)) {
          setFields(parsedFields);
        }
      } catch (error) {
        console.error('Failed to parse database fields:', error);
        setFields([]);
      }
    }
  }, [section.content]);

  // 表格列定义
  const columns = [
    {
      title: '字段名',
      dataIndex: 'name',
      key: 'name',
      width: '15%',
    },
    {
      title: '字段类型',
      dataIndex: 'type',
      key: 'type',
      width: '15%',
      render: (text: string, record: DatabaseField) => (
        <>
          {text}{record.length ? `(${record.length})` : ''}
        </>
      ),
    },
    {
      title: '是否必填',
      dataIndex: 'required',
      key: 'required',
      width: '10%',
      render: (required: boolean) => (
        required ? '是' : '否'
      ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      width: '50%',
    },
    {
      title: '操作',
      key: 'action',
      width: '10%',
      render: (_: any, record: DatabaseField) => (
        isEditable && isEditing && (
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Space>
        )
      ),
    },
  ];

  // 切换编辑状态
  const toggleEdit = () => {
    setIsEditing(!isEditing);
  };

  // 保存内容
  const handleSave = () => {
    onSave(JSON.stringify(fields));
    setIsEditing(false);
  };

  // 添加字段
  const handleAdd = () => {
    form.resetFields();
    setEditingKey('');
    setIsModalOpen(true);
  };

  // 编辑字段
  const handleEdit = (record: DatabaseField) => {
    form.setFieldsValue({
      name: record.name,
      type: record.type,
      length: record.length || '',
      required: record.required,
      description: record.description || '',
    });
    setEditingKey(record.name);
    setIsModalOpen(true);
  };

  // 删除字段
  const handleDelete = (record: DatabaseField) => {
    setFields(fields.filter(item => item.name !== record.name));
  };

  // 提交表单
  const handleSubmit = () => {
    form.validateFields().then(values => {
      const newField: DatabaseField = {
        name: values.name,
        type: values.type,
        length: values.length || undefined,
        required: values.required,
        description: values.description || undefined,
      };

      if (editingKey) {
        // 更新现有字段
        setFields(fields.map(field => 
          field.name === editingKey ? newField : field
        ));
      } else {
        // 添加新字段
        setFields([...fields, newField]);
      }

      setIsModalOpen(false);
    });
  };

  return (
    <Card
      title={
        <Space>
          <span style={{ color: '#1890ff', marginRight: '8px' }}>4</span>
          <Title level={5} style={{ margin: 0 }}>数据库表</Title>
        </Space>
      }
      extra={
        isEditable && (
          isEditing ? (
            <Space>
              <Button
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                添加字段
              </Button>
              <Button 
                type="primary" 
                icon={<SaveOutlined />} 
                onClick={handleSave}
              >
                保存
              </Button>
              <Button 
                onClick={toggleEdit}
              >
                取消
              </Button>
            </Space>
          ) : (
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={toggleEdit}
            >
              编辑
            </Button>
          )
        )
      }
    >
      <Table
        columns={isEditing ? columns : columns.slice(0, -1)}
        dataSource={fields.map((field, index) => ({ ...field, key: index.toString() }))}
        pagination={false}
        size="middle"
        bordered
      />

      <Modal
        title={editingKey ? '编辑字段' : '添加字段'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => setIsModalOpen(false)}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="字段名"
            rules={[{ required: true, message: '请输入字段名' }]}
          >
            <Input placeholder="请输入字段名" />
          </Form.Item>
          <Form.Item
            name="type"
            label="字段类型"
            rules={[{ required: true, message: '请选择字段类型' }]}
          >
            <Select placeholder="请选择字段类型">
              <Option value="int">int</Option>
              <Option value="varchar">varchar</Option>
              <Option value="text">text</Option>
              <Option value="datetime">datetime</Option>
              <Option value="boolean">boolean</Option>
              <Option value="decimal">decimal</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="length"
            label="长度/精度"
          >
            <Input placeholder="例如: 255" />
          </Form.Item>
          <Form.Item
            name="required"
            label="是否必填"
            initialValue={false}
          >
            <Select>
              <Option value={true}>是</Option>
              <Option value={false}>否</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="description"
            label="说明"
          >
            <Input.TextArea placeholder="请输入字段说明" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default DatabaseTable; 