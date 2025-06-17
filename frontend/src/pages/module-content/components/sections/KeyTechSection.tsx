import React, { ChangeEvent, useState } from 'react';
import { Button, Input, Form, message } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { MdEditor } from 'md-editor-rt';
import axios from 'axios';
import { API_BASE_URL } from '../../../../config/constants';
import 'md-editor-rt/lib/style.css';
import './SectionStyles.css';

interface KeyTechItem {
  key: string;
  value: string;
}

interface KeyTechSectionProps {
  items: KeyTechItem[];
  onChange: (items: KeyTechItem[]) => void;
}

const KeyTechSection: React.FC<KeyTechSectionProps> = ({ items, onChange }) => {
  // 为每个编辑器创建唯一ID
  const [editorIds] = useState(() => 
    items.map((_, index) => `key-tech-editor-${index}-${Date.now()}`)
  );
  
  // 处理图片上传
  const handleUploadImage = async (files: File[], callback: (urls: string[]) => void) => {
    try {
      // 准备上传多个文件的promises
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        // 获取token
        const token = localStorage.getItem('token');
        
        // 发送上传请求
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
        
        // 如果上传成功，返回图片URL
        if (response.data && response.data.success && response.data.data) {
          return response.data.data.url; // 返回完整的图片URL
        } else {
          throw new Error(response.data?.message || '图片上传失败');
        }
      });
      
      // 等待所有上传完成
      const urls = await Promise.all(uploadPromises);
      
      // 调用回调函数，将URL插入编辑器
      callback(urls);
      message.success('图片上传成功');
    } catch (error) {
      console.error('图片上传失败:', error);
      message.error('图片上传失败: ' + (error instanceof Error ? error.message : String(error)));
      // 即使失败也调用回调，避免编辑器卡住
      callback([]);
    }
  };
  
  // 添加新的关键技术项
  const addItem = () => {
    const newItems = [...items, { key: '', value: '' }];
    // 编辑器IDs也需要更新
    editorIds.push(`key-tech-editor-${items.length}-${Date.now()}`);
    onChange(newItems);
  };

  // 删除关键技术项
  const removeItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    // 不需要改变editorIds，因为React会根据key来匹配组件
    onChange(newItems);
  };

  // 更新关键技术项的键
  const updateItemKey = (index: number, newKey: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], key: newKey };
    onChange(newItems);
  };

  // 更新关键技术项的值
  const updateItemValue = (index: number, newValue: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], value: newValue };
    onChange(newItems);
  };

  // 确保editorIds数组长度与items匹配
  while (editorIds.length < items.length) {
    editorIds.push(`key-tech-editor-${editorIds.length}-${Date.now()}`);
  }

  return (
    <div className="section-content">
      <div className="markdown-hint" style={{ marginBottom: '16px', color: '#888' }}>
        参数值支持使用Markdown语法，例如: **加粗文本**, *斜体文本*, `代码`, # 标题, 等。
        <br />
        <span style={{ color: '#1890ff' }}>支持粘贴图片</span>
      </div>
      <Form layout="vertical">
        {items.map((item, index) => (
          <div key={index} className="split-item-editor">
            <Form.Item 
              label="参数名称" 
              style={{ margin: '16px 16px 0', marginBottom: '16px' }}
            >
              <Input
                value={item.key}
                placeholder="输入参数名称"
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateItemKey(index, e.target.value)}
              />
            </Form.Item>
            
            <Form.Item 
              label="参数值" 
              style={{ margin: '0 16px 16px' }}
            >
              <MdEditor
                modelValue={item.value}
                onChange={(value) => updateItemValue(index, value)}
                id={editorIds[index]}
                language="zh-CN"
                previewTheme="github"
                codeTheme="atom"
                preview={true}
                style={{ height: '300px', boxShadow: '0 0 0 1px #f0f0f0' }}
                placeholder="输入参数值（支持Markdown语法）"
                onUploadImg={handleUploadImage}
              />
            </Form.Item>
            
            <div style={{ textAlign: 'right', padding: '0 16px 16px' }}>
              <Button 
                type="text"
                danger
                icon={<MinusCircleOutlined />}
                onClick={() => removeItem(index)}
              >
                删除此参数
              </Button>
            </div>
          </div>
        ))}
        <Form.Item>
          <Button 
            type="dashed" 
            onClick={addItem} 
            block 
            icon={<PlusOutlined />}
          >
            添加关键参数
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default KeyTechSection; 