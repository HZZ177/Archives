import React, { useState, useMemo } from 'react';
import { Button, Input, Collapse, Form, Modal, Space, Empty, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, RightOutlined, DownOutlined } from '@ant-design/icons';
import { MdEditor, MdPreview } from 'md-editor-rt';
import 'md-editor-rt/lib/style.css';
import axios from 'axios';
import { API_BASE_URL } from '../../../../config/constants';
import './GlossarySection.css';

const { Panel } = Collapse;

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

const GlossarySection: React.FC<GlossarySectionProps> = ({ 
  content = [], 
  onChange, 
  isEditable = true 
}) => {
  const [searchValue, setSearchValue] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<GlossaryItem | null>(null);
  const [activeKey, setActiveKey] = useState<string[]>([]);
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
  
  // 格式化术语ID（如123321）为适当的显示格式
  const formatTerm = (term: string) => {
    return <span>{term}</span>;
  };
  
  const renderPanelHeader = (item: GlossaryItem) => {
    const isActive = activeKey.includes(item.id);
    
    return (
      <div className="panel-header">
        <div className="panel-term-container">
          <span className="panel-icon">{isActive ? <DownOutlined /> : <RightOutlined />}</span>
          <span className="panel-term">{formatTerm(item.term)}</span>
        </div>
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
  };

  const handleCollapseChange = (keys: string | string[]) => {
    setActiveKey(Array.isArray(keys) ? keys : [keys]);
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
        <Collapse 
          activeKey={activeKey}
          onChange={handleCollapseChange}
          className="glossary-collapse"
          expandIcon={() => null} // 我们自定义展开图标
        >
          {filteredContent.map(item => (
            <Panel 
              header={renderPanelHeader(item)} 
              key={item.id} 
              className="glossary-panel"
              showArrow={false}
            >
              <div className="glossary-explanation">
                <MdPreview
                  editorId={`preview-${item.id}`}
                  modelValue={item.explanation}
                  previewTheme="github"
                />
              </div>
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