import React, { useState } from 'react';
import { Typography, Input, Button, Card, Space } from 'antd';
import { EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { Section } from '../../../types/document';

const { TextArea } = Input;
const { Title } = Typography;

interface FunctionOverviewProps {
  section: Section;
  onSave: (content: string) => void;
  isEditable?: boolean;
}

/**
 * 功能概述组件
 * 用于编辑和展示模块的功能概述
 */
const FunctionOverview: React.FC<FunctionOverviewProps> = ({
  section,
  onSave,
  isEditable = true,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(section.content || '');

  // 切换编辑状态
  const toggleEdit = () => {
    setIsEditing(!isEditing);
    if (!isEditing) {
      setContent(section.content || '');
    }
  };

  // 保存内容
  const handleSave = () => {
    onSave(content);
    setIsEditing(false);
  };

  // 取消编辑
  const handleCancel = () => {
    setIsEditing(false);
    setContent(section.content || '');
  };

  return (
    <Card 
      title={
        <Space>
          <span style={{ color: '#1890ff', marginRight: '8px' }}>1</span>
          <Title level={5} style={{ margin: 0 }}>模块功能概述</Title>
        </Space>
      }
      extra={
        isEditable && (
          isEditing ? (
            <Space>
              <Button 
                type="primary" 
                icon={<SaveOutlined />} 
                onClick={handleSave}
              >
                保存
              </Button>
              <Button 
                icon={<CloseOutlined />} 
                onClick={handleCancel}
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
      {isEditing ? (
        <TextArea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          autoSize={{ minRows: 4, maxRows: 8 }}
          placeholder="请输入模块功能概述..."
        />
      ) : (
        <div style={{ whiteSpace: 'pre-wrap' }}>
          {section.content || '暂无功能概述内容'}
        </div>
      )}
    </Card>
  );
};

export default FunctionOverview; 