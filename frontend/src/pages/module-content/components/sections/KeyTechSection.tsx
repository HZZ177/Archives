import React, { ChangeEvent, useState } from 'react';
import { Button, Input, Form } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { MdEditor } from 'md-editor-rt';
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