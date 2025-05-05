import React, { useState } from 'react';
import { Card, Space, Typography, Button } from 'antd';
import { EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Section } from '../../../types/document';

const { Title } = Typography;

interface FunctionDetailProps {
  section: Section;
  onSave: (content: string) => void;
  isEditable?: boolean;
}

/**
 * 功能详解组件
 * 用于编辑和展示模块的功能详解内容
 */
const FunctionDetail: React.FC<FunctionDetailProps> = ({
  section,
  onSave,
  isEditable = true,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(section.content || '');

  // 富文本编辑器模块配置
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'align': [] }],
      ['link', 'image', 'code-block'],
      ['clean'],
    ],
  };

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
          <span style={{ color: '#1890ff', marginRight: '8px' }}>3</span>
          <Title level={5} style={{ margin: 0 }}>功能详解</Title>
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
        <div style={{ height: '400px' }}>
          <ReactQuill
            theme="snow"
            value={content}
            onChange={setContent}
            modules={modules}
            style={{ height: '350px' }}
          />
        </div>
      ) : (
        <div 
          className="ql-editor" 
          dangerouslySetInnerHTML={{ __html: section.content || '<p>暂无功能详解内容</p>' }}
          style={{ padding: 0 }}
        />
      )}
    </Card>
  );
};

export default FunctionDetail; 