import React, { useState } from 'react';
import { Button, Card, Input, Collapse, Space, Divider } from 'antd';
import { PlusOutlined, MinusCircleOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
import { nanoid } from 'nanoid';
import CodeEditor from './CodeEditor';

const { TextArea } = Input;
const { Panel } = Collapse;

interface ExampleItem {
  id: string;
  title: string;
  description: string;
  code: string;
}

interface ExampleSectionProps {
  examples: ExampleItem[];
  onChange: (examples: ExampleItem[]) => void;
}

const ExampleSection: React.FC<ExampleSectionProps> = ({ examples, onChange }) => {
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  // 添加示例
  const addExample = () => {
    const newId = nanoid();
    const newExamples = [...examples, {
      id: newId,
      title: '新示例',
      description: '',
      code: '// 在此处添加示例代码'
    }];
    onChange(newExamples);
    setActiveKeys([...activeKeys, newId]);
  };

  // 删除示例
  const removeExample = (id: string) => {
    onChange(examples.filter(item => item.id !== id));
    setActiveKeys(activeKeys.filter(key => key !== id));
  };

  // 更新示例属性
  const updateExample = (id: string, field: keyof ExampleItem, value: string) => {
    onChange(
      examples.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  // 折叠面板变化处理
  const handleCollapseChange = (keys: string | string[]) => {
    setActiveKeys(typeof keys === 'string' ? [keys] : keys);
  };

  return (
    <div className="section-content">
      <Space direction="vertical" style={{ width: '100%' }}>
        {examples.map((example) => (
          <Card 
            key={example.id}
            bordered={true}
            style={{ marginBottom: 16 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <Input
                value={example.title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateExample(example.id, 'title', e.target.value)}
                placeholder="示例标题"
                style={{ width: '60%' }}
              />
              <Button 
                type="text" 
                danger
                icon={<MinusCircleOutlined />}
                onClick={() => removeExample(example.id)}
              >
                删除示例
              </Button>
            </div>
            
            <TextArea
              value={example.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateExample(example.id, 'description', e.target.value)}
              placeholder="示例说明"
              autoSize={{ minRows: 2, maxRows: 4 }}
              style={{ marginBottom: 16 }}
            />
            
            <Collapse 
              activeKey={activeKeys} 
              onChange={handleCollapseChange}
              expandIcon={({ isActive }) => isActive ? <UpOutlined /> : <DownOutlined />}
            >
              <Panel header="示例代码" key={example.id}>
                <CodeEditor
                  value={example.code}
                  onChange={(value: string) => updateExample(example.id, 'code', value)}
                  language="typescript"
                  height="200px"
                />
              </Panel>
            </Collapse>
          </Card>
        ))}
        
        <Button 
          type="dashed" 
          onClick={addExample} 
          block 
          icon={<PlusOutlined />}
        >
          添加示例
        </Button>
      </Space>
    </div>
  );
};

export default ExampleSection; 