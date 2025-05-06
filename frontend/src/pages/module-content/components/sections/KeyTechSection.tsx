import React from 'react';
import { Button, Input, Form, Space } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';

interface KeyTechItem {
  key: string;
  value: string;
}

interface KeyTechSectionProps {
  items: KeyTechItem[];
  onChange: (items: KeyTechItem[]) => void;
}

const KeyTechSection: React.FC<KeyTechSectionProps> = ({ items, onChange }) => {
  // 添加新的关键技术项
  const addItem = () => {
    const newItems = [...items, { key: '', value: '' }];
    onChange(newItems);
  };

  // 删除关键技术项
  const removeItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
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

  return (
    <div className="section-content">
      <Form layout="vertical">
        {items.map((item, index) => (
          <div key={index} style={{ marginBottom: '16px' }}>
            <Space 
              style={{ display: 'flex', alignItems: 'baseline' }}
              size="middle"
            >
              <Form.Item 
                label="参数名称" 
                style={{ marginBottom: '8px', flex: 1 }}
              >
                <Input
                  value={item.key}
                  placeholder="输入参数名称"
                  onChange={(e) => updateItemKey(index, e.target.value)}
                />
              </Form.Item>
              <Form.Item 
                label="参数值" 
                style={{ marginBottom: '8px', flex: 2 }}
              >
                <Input
                  value={item.value}
                  placeholder="输入参数值"
                  onChange={(e) => updateItemValue(index, e.target.value)}
                />
              </Form.Item>
              <MinusCircleOutlined
                style={{ color: '#ff4d4f', marginTop: '30px' }}
                onClick={() => removeItem(index)}
              />
            </Space>
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