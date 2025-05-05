import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Space, 
  message, 
  Upload, 
  Collapse, 
  Divider,
  Row,
  Col,
  Tabs
} from 'antd';
import { 
  SaveOutlined, 
  PlusOutlined, 
  DeleteOutlined,
  InboxOutlined
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import { ALLOWED_IMAGE_TYPES, UPLOAD_MAX_SIZE } from '../../../config/constants';
import TextEditor from './TextEditor';

const { Panel } = Collapse;
const { TabPane } = Tabs;
const { Dragger } = Upload;

interface DocumentEditorProps {
  documentId?: string; // 文档ID，如果为新文档则为undefined
  templateId?: string; // 模板ID，如果从模板创建则提供
  onSave?: (data: any) => void; // 保存回调
}

interface Section {
  id: string;
  title: string;
  content: string;
  images: UploadFile[];
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({
  documentId,
  templateId,
  onSave
}) => {
  const [form] = Form.useForm();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeKey, setActiveKey] = useState<string | string[]>([]);

  // 如果是编辑模式，加载文档数据
  useEffect(() => {
    if (documentId) {
      setLoading(true);
      // 这里应该从API加载文档数据
      // 示例数据
      const mockDocument = {
        title: '示例文档',
        description: '这是一个示例文档描述',
        sections: [
          {
            id: '1',
            title: '第一部分',
            content: '<p>这是第一部分的内容</p>',
            images: []
          },
          {
            id: '2',
            title: '第二部分',
            content: '<p>这是第二部分的内容</p>',
            images: []
          }
        ]
      };
      
      form.setFieldsValue({
        title: mockDocument.title,
        description: mockDocument.description
      });
      
      setSections(mockDocument.sections);
      setActiveKey(['1']); // 默认展开第一个部分
      setLoading(false);
    } else if (templateId) {
      // 如果是从模板创建，则从模板加载初始结构
      setLoading(true);
      // 这里应该从API加载模板数据
      // 示例数据
      const mockTemplate = {
        sections: [
          {
            id: '1',
            title: '基本信息',
            content: '',
            images: []
          },
          {
            id: '2',
            title: '详细描述',
            content: '',
            images: []
          },
          {
            id: '3',
            title: '相关资料',
            content: '',
            images: []
          }
        ]
      };
      
      setSections(mockTemplate.sections);
      setActiveKey(['1']); // 默认展开第一个部分
      setLoading(false);
    } else {
      // 新建文档，创建一个空白部分
      setSections([
        {
          id: '1',
          title: '新建部分',
          content: '',
          images: []
        }
      ]);
      setActiveKey(['1']);
    }
  }, [documentId, templateId, form]);

  // 添加新部分
  const handleAddSection = () => {
    const newId = Date.now().toString();
    const newSection = {
      id: newId,
      title: `新建部分 ${sections.length + 1}`,
      content: '',
      images: []
    };
    
    setSections([...sections, newSection]);
    setActiveKey([...activeKey as string[], newId]);
  };

  // 删除部分
  const handleDeleteSection = (sectionId: string) => {
    if (sections.length <= 1) {
      message.warning('至少保留一个部分');
      return;
    }
    
    setSections(sections.filter(section => section.id !== sectionId));
    // 更新activeKey，移除被删除的部分
    if (Array.isArray(activeKey)) {
      setActiveKey(activeKey.filter(key => key !== sectionId));
    }
  };

  // 更新部分标题
  const handleSectionTitleChange = (sectionId: string, title: string) => {
    setSections(
      sections.map(section => 
        section.id === sectionId ? { ...section, title } : section
      )
    );
  };

  // 更新部分内容
  const handleSectionContentChange = (sectionId: string, content: string) => {
    setSections(
      sections.map(section => 
        section.id === sectionId ? { ...section, content } : section
      )
    );
  };

  // 处理图片上传
  const handleImageUpload = (sectionId: string, info: any) => {
    const { fileList } = info;
    
    setSections(
      sections.map(section => 
        section.id === sectionId ? { ...section, images: fileList } : section
      )
    );
  };

  // 处理保存文档
  const handleSaveDocument = async () => {
    try {
      const values = await form.validateFields();
      
      const documentData = {
        ...values,
        sections: sections.map(section => ({
          title: section.title,
          content: section.content,
          images: section.images.map(file => {
            if (file.response) {
              return file.response.url;
            }
            return file.url || file.thumbUrl;
          }).filter(Boolean)
        }))
      };
      
      setLoading(true);
      // 这里应该调用API保存文档
      console.log('保存文档数据:', documentData);
      
      if (onSave) {
        onSave(documentData);
      }
      
      message.success('文档保存成功');
      setLoading(false);
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败，请检查表单');
    }
  };

  // 文件上传前检查
  const beforeUpload = (file: File) => {
    const isValidType = ALLOWED_IMAGE_TYPES.includes(file.type);
    if (!isValidType) {
      message.error('只能上传JPG/PNG/GIF格式的图片!');
      return false;
    }
    
    const isLessThan5M = file.size < UPLOAD_MAX_SIZE;
    if (!isLessThan5M) {
      message.error('图片必须小于5MB!');
      return false;
    }
    
    return isValidType && isLessThan5M;
  };

  // 上传组件属性
  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    action: '/api/v1/upload',
    beforeUpload,
    listType: 'picture-card',
    maxCount: 5, // 每个部分最多5张图片
  };

  // 渲染折叠面板的额外操作
  const panelExtra = (sectionId: string) => (
    <Space>
      <Button 
        type="text" 
        danger 
        icon={<DeleteOutlined />} 
        onClick={(e) => {
          e.stopPropagation();
          handleDeleteSection(sectionId);
        }}
      />
    </Space>
  );

  return (
    <div className="document-editor">
      <Card title="文档编辑" loading={loading}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={18}>
              <Form.Item
                name="title"
                label="文档标题"
                rules={[{ required: true, message: '请输入文档标题' }]}
              >
                <Input placeholder="请输入文档标题" />
              </Form.Item>
            </Col>
            <Col span={6} style={{ textAlign: 'right' }}>
              <Button 
                type="primary" 
                icon={<SaveOutlined />} 
                onClick={handleSaveDocument}
                loading={loading}
              >
                保存文档
              </Button>
            </Col>
          </Row>
          
          <Form.Item
            name="description"
            label="文档描述"
          >
            <Input.TextArea rows={2} placeholder="请输入文档描述" />
          </Form.Item>
          
          <Divider orientation="left">文档内容</Divider>
          
          <Collapse 
            activeKey={activeKey} 
            onChange={setActiveKey}
            className="document-sections"
          >
            {sections.map(section => (
              <Panel 
                header={
                  <Input 
                    value={section.title}
                    onChange={(e) => handleSectionTitleChange(section.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="部分标题"
                  />
                }
                key={section.id}
                extra={panelExtra(section.id)}
                style={{ marginBottom: '10px' }}
              >
                <Tabs defaultActiveKey="content">
                  <TabPane tab="内容编辑" key="content">
                    <TextEditor 
                      value={section.content}
                      onChange={(content) => handleSectionContentChange(section.id, content)}
                    />
                  </TabPane>
                  <TabPane tab="图片上传" key="images">
                    <Dragger 
                      {...uploadProps}
                      fileList={section.images}
                      onChange={(info) => handleImageUpload(section.id, info)}
                    >
                      <p className="ant-upload-drag-icon">
                        <InboxOutlined />
                      </p>
                      <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                      <p className="ant-upload-hint">
                        支持单个或批量上传，仅限JPG/PNG/GIF格式，单文件大小不超过5MB
                      </p>
                    </Dragger>
                  </TabPane>
                </Tabs>
              </Panel>
            ))}
          </Collapse>
          
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <Button 
              type="dashed" 
              onClick={handleAddSection} 
              icon={<PlusOutlined />}
            >
              添加新部分
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default DocumentEditor; 