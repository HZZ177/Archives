import React, { useState, useMemo } from 'react';
import { Button, Input, Form, Modal, Space, Empty, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, BookOutlined } from '@ant-design/icons';
import { MdEditor, MdPreview } from 'md-editor-rt';
import 'md-editor-rt/lib/style.css';
import axios from 'axios';
import { API_BASE_URL } from '../../../../config/constants';
import './GlossarySection.css';

// 为 MdEditor 创建一个适配 Antd Form 的包装器
const MdEditorWrapper = ({ value, onChange, ...rest }: any) => {
  return <MdEditor modelValue={value} onChange={onChange} {...rest} />;
};

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

interface GlossaryItemCardProps {
  item: GlossaryItem;
  isEditable: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

const GlossaryItemCard: React.FC<GlossaryItemCardProps> = ({ item, isEditable, onEdit, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCardClick = () => {
    setIsExpanded(!isExpanded);
  };

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className={`glossary-card ${isExpanded ? 'expanded' : ''}`} onClick={handleCardClick}>
      <div className="glossary-card-header">
        <div className="glossary-term-container">
          <BookOutlined />
          <span className="glossary-term">{item.term}</span>
        </div>
        {isEditable && (
          <Space className="glossary-card-actions" onClick={handleActionClick}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={onEdit}
            />
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={onDelete}
            />
          </Space>
        )}
      </div>
      {isExpanded && (
        <div className="glossary-card-body" onClick={handleActionClick}>
          <MdPreview
            editorId={`preview-${item.id}`}
            modelValue={item.explanation}
            previewTheme="github"
          />
        </div>
      )}
    </div>
  );
};

const GlossarySection: React.FC<GlossarySectionProps> = ({ 
  content = [], 
  onChange, 
  isEditable = true 
}) => {
  const [searchValue, setSearchValue] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<GlossaryItem | null>(null);
  const [form] = Form.useForm();
  const [editorId] = useState('glossary-editor-' + Date.now());

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
        onChange(newContent);
      } else {
        // Add
        const newItem = { id: `glossary_${Date.now()}`, ...values };
        const newContent = [...content, newItem];
        onChange(newContent);
      }
      handleCancel();
    });
  };

  const handleDelete = (id: string) => {
    const newContent = content.filter(item => item.id !== id);
    onChange(newContent);
  };
  
  // 处理图片上传
  const handleUploadImage = async (files: File[], callback: (urls: string[]) => void) => {
    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        const token = localStorage.getItem('token');
        
        const response = await axios.post(
          `${API_BASE_URL}/images/upload`, 
          formData, 
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );
        
        if (response.data && response.data.success && response.data.data) {
          return response.data.data.url;
        } else {
          throw new Error(response.data?.message || '图片上传失败');
        }
      });
      
      const urls = await Promise.all(uploadPromises);
      
      callback(urls);
      message.success('图片上传成功');
    } catch (error) {
      console.error('图片上传失败:', error);
      message.error('图片上传失败: ' + (error instanceof Error ? error.message : String(error)));
      callback([]);
    }
  };

  return (
    <div className={`glossary-section ${!isEditable ? 'readonly-mode' : ''}`}>
      <div className="glossary-header">
        <Input
          placeholder="请输入要搜索的名称或内容"
          prefix={<SearchOutlined />}
          onChange={e => setSearchValue(e.target.value)}
          className="glossary-search"
        />
        {isEditable && (
          <Button icon={<PlusOutlined />} onClick={() => showModal()}>添加术语</Button>
        )}
      </div>
      
      {filteredContent.length > 0 ? (
        <div className="glossary-list">
          {filteredContent.map(item => (
            <GlossaryItemCard
              key={item.id}
              item={item}
              isEditable={isEditable}
              onEdit={() => showModal(item)}
              onDelete={() => handleDelete(item.id)}
            />
          ))}
        </div>
      ) : (
        <Empty description={searchValue ? "未找到匹配的术语" : "暂无术语，请添加"} />
      )}

      <Modal
        title={editingItem ? '编辑术语' : '添加术语'}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
        destroyOnClose
        width={1200} // 进一步增大宽度以优化分栏编辑体验
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
            <MdEditorWrapper
              editorId={editorId}
              language="zh-CN"
              previewTheme="github"
              codeTheme="atom"
              style={{ height: '500px' }}
              placeholder="请输入术语解释（支持Markdown）"
              onUploadImg={handleUploadImage}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GlossarySection; 