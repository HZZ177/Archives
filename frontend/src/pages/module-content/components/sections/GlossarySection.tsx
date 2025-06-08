import React, { useState, useMemo } from 'react';
import { Card, Button, Input, Collapse, Form, Modal, Space, Empty } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import './GlossarySection.css';

const { Panel } = Collapse;
const { Search } = Input;

interface GlossaryItem {
  id: string;
  term: string;
  explanation: string;
}

interface GlossarySectionProps {
  content: GlossaryItem[];
  onChange: (content: GlossaryItem[]) => void;
  isEditable?: boolean;
}

const GlossarySection: React.FC<GlossarySectionProps> = ({ 
  content = [], 
  onChange, 
  isEditable = true 
}) => {
  const [searchValue, setSearchValue] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<GlossaryItem | null>(null);
  const [form] = Form.useForm();

  console.log('GlossarySection接收到的content数据:', content);

  const filteredContent = useMemo(() => {
    if (!searchValue) {
      return content;
    }
    return content.filter(item => 
      item.term.toLowerCase().includes(searchValue.toLowerCase()) ||
      item.explanation.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [content, searchValue]);

  const showModal = (item?: GlossaryItem) => {
    setEditingItem(item || null);
    form.setFieldsValue(item || { term: '', explanation: '' });
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    setEditingItem(null);
    form.resetFields();
  };

  const handleOk = () => {
    form.validateFields().then(values => {
      if (editingItem) {
        // Edit
        const newContent = content.map(item =>
          item.id === editingItem.id ? { ...item, ...values } : item
        );
        console.log('编辑术语项，更新后的数据:', newContent);
        onChange(newContent);
      } else {
        // Add
        const newItem = { id: `glossary_${Date.now()}`, ...values };
        const newContent = [...content, newItem];
        console.log('添加术语项，更新后的数据:', newContent);
        onChange(newContent);
      }
      handleCancel();
    });
  };

  const handleDelete = (id: string) => {
    const newContent = content.filter(item => item.id !== id);
    console.log('删除术语项，更新后的数据:', newContent);
    onChange(newContent);
  };
  
  const renderPanelHeader = (item: GlossaryItem) => (
    <div className="panel-header">
      <span className="panel-term">{item.term}</span>
      {isEditable && (
        <Space className="panel-actions">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              showModal(item);
            }}
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(item.id);
            }}
          />
        </Space>
      )}
    </div>
  );

  return (
    <Card 
      className="glossary-section"
      extra={isEditable && <Button icon={<PlusOutlined />} onClick={() => showModal()}>添加术语</Button>}
    >
      <Search
        placeholder="搜索术语或解释..."
        onChange={e => setSearchValue(e.target.value)}
        style={{ marginBottom: 16 }}
      />
      {filteredContent.length > 0 ? (
        <Collapse accordion>
          {filteredContent.map(item => (
            <Panel header={renderPanelHeader(item)} key={item.id}>
              <div dangerouslySetInnerHTML={{ __html: item.explanation.replace(/\n/g, '<br />') }} />
            </Panel>
          ))}
        </Collapse>
      ) : (
        <Empty description={searchValue ? "未找到匹配的术语" : "暂无术语，请添加"} />
      )}

      <Modal
        title={editingItem ? '编辑术语' : '添加术语'}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
        destroyOnClose
      >
        <Form form={form} layout="vertical" name="glossary_form">
          <Form.Item
            name="term"
            label="术语"
            rules={[{ required: true, message: '请输入术语名称!' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="explanation"
            label="解释"
            rules={[{ required: true, message: '请输入术语解释!' }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default GlossarySection; 