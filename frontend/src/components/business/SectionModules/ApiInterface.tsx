import React, { useState, useEffect } from 'react';
import { Card, Space, Typography, Button, Table, Collapse, Tag, Divider, Modal, Form, Input, Select, Radio } from 'antd';
import { EditOutlined, SaveOutlined, PlusOutlined, DeleteOutlined, CodeOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../../config/constants';

const { Title, Text } = Typography;
const { Panel } = Collapse;
const { Option } = Select;
const { TextArea } = Input;

interface ApiEndpoint {
  id?: string;
  path: string;
  method: string;
  description: string;
  request: Record<string, any>;
  response: Record<string, any>;
}

interface ApiInterfaceProps {
  section: any;
  onSave: (content: string) => void;
  isEditable?: boolean;
}

/**
 * 涉及接口组件
 * 用于编辑和展示模块涉及的接口信息
 */
const ApiInterface: React.FC<ApiInterfaceProps> = ({
  section,
  onSave,
  isEditable = true,
}) => {
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<ApiEndpoint | null>(null);
  const [form] = Form.useForm();

  // 解析section.content到endpoints
  useEffect(() => {
    if (section.content) {
      try {
        const parsed = JSON.parse(section.content);
        if (parsed && Array.isArray(parsed.endpoints)) {
          setEndpoints(parsed.endpoints.map((ep: ApiEndpoint, idx: number) => ({
            ...ep,
            id: ep.id || `ep-${idx}`
          })));
        }
      } catch (error) {
        console.error('Failed to parse API endpoints:', error);
        setEndpoints([]);
      }
    }
  }, [section.content]);

  // 切换编辑状态
  const toggleEdit = () => {
    setIsEditing(!isEditing);
  };

  // 保存内容
  const handleSave = () => {
    const content = JSON.stringify({ endpoints });
    onSave(content);
    setIsEditing(false);
  };

  // 添加接口
  const handleAdd = () => {
    setEditingEndpoint(null);
    form.resetFields();
    form.setFieldsValue({
      method: 'GET',
      request: '{\n  \n}',
      response: '{\n  \n}'
    });
    setIsModalOpen(true);
  };

  // 编辑接口
  const handleEdit = (endpoint: ApiEndpoint) => {
    setEditingEndpoint(endpoint);
    form.setFieldsValue({
      path: endpoint.path,
      method: endpoint.method,
      description: endpoint.description,
      request: JSON.stringify(endpoint.request, null, 2),
      response: JSON.stringify(endpoint.response, null, 2)
    });
    setIsModalOpen(true);
  };

  // 删除接口
  const handleDelete = (id: string) => {
    setEndpoints(endpoints.filter(ep => ep.id !== id));
  };

  // 提交表单
  const handleSubmit = () => {
    form.validateFields().then(values => {
      try {
        // 解析JSON字符串
        let request = {};
        let response = {};
        
        try {
          request = JSON.parse(values.request);
        } catch {
          request = values.request;
        }
        
        try {
          response = JSON.parse(values.response);
        } catch {
          response = values.response;
        }
        
        const endpoint: ApiEndpoint = {
          id: editingEndpoint?.id || `ep-${Date.now()}`,
          path: values.path,
          method: values.method,
          description: values.description,
          request,
          response
        };
        
        if (editingEndpoint) {
          // 更新现有接口
          setEndpoints(endpoints.map(ep => 
            ep.id === editingEndpoint.id ? endpoint : ep
          ));
        } else {
          // 添加新接口
          setEndpoints([...endpoints, endpoint]);
        }
        
        setIsModalOpen(false);
      } catch (error) {
        console.error('Error processing form:', error);
      }
    });
  };

  // 获取方法对应的颜色
  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'green',
      POST: 'blue',
      PUT: 'orange',
      DELETE: 'red',
      PATCH: 'purple'
    };
    return colors[method] || 'default';
  };

  // 渲染JSON对象
  const renderJsonObject = (obj: Record<string, any>) => {
    if (!obj || Object.keys(obj).length === 0) {
      return <Text type="secondary">无</Text>;
    }
    
    return (
      <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
        {Object.entries(obj).map(([key, value]) => (
          <li key={key}>
            <Text strong>{key}: </Text>
            <Text type="secondary">
              {typeof value === 'object' 
                ? JSON.stringify(value) 
                : String(value)}
            </Text>
          </li>
        ))}
      </ul>
    );
  };

  // 渲染接口详情面板
  const renderEndpointPanel = (endpoint: ApiEndpoint) => {
    // 确保endpoint.id存在
    const panelKey = endpoint.id || `panel-${Math.random().toString(36).substr(2, 9)}`;
    
    return (
      <Panel
        key={panelKey}
        header={
          <Space>
            <Tag color={getMethodColor(endpoint.method)}>{endpoint.method}</Tag>
            <Text strong>{endpoint.path}</Text>
            <Text type="secondary">{endpoint.description}</Text>
            {isEditing && endpoint.id && (
              <Space style={{ float: 'right' }}>
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(endpoint);
                  }}
                />
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (endpoint.id) {
                      handleDelete(endpoint.id);
                    }
                  }}
                />
              </Space>
            )}
          </Space>
        }
      >
        <div>
          <Title level={5}>请求参数</Title>
          {renderJsonObject(endpoint.request)}
          
          <Divider />
          
          <Title level={5}>返回结果</Title>
          {renderJsonObject(endpoint.response)}
        </div>
      </Panel>
    );
  };

  return (
    <Card
      title={
        <Space>
          <span style={{ color: '#1890ff', marginRight: '8px' }}>6</span>
          <Title level={5} style={{ margin: 0 }}>涉及接口</Title>
        </Space>
      }
      extra={
        isEditable && (
          isEditing ? (
            <Space>
              <Button
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                添加接口
              </Button>
              <Button 
                type="primary" 
                icon={<SaveOutlined />} 
                onClick={handleSave}
              >
                保存
              </Button>
              <Button 
                onClick={toggleEdit}
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
      {endpoints.length > 0 ? (
        <Collapse>
          {endpoints.map(endpoint => renderEndpointPanel(endpoint))}
        </Collapse>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          暂无接口信息
        </div>
      )}

      <Modal
        title={`${editingEndpoint ? '编辑' : '添加'}接口`}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => setIsModalOpen(false)}
        width={700}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="path"
            label="接口路径"
            rules={[{ required: true, message: '请输入接口路径' }]}
          >
            <Input addonBefore={API_BASE_URL} placeholder="/path/to/resource" />
          </Form.Item>
          
          <Form.Item
            name="method"
            label="请求方法"
            rules={[{ required: true, message: '请选择请求方法' }]}
          >
            <Radio.Group>
              <Radio.Button value="GET">GET</Radio.Button>
              <Radio.Button value="POST">POST</Radio.Button>
              <Radio.Button value="PUT">PUT</Radio.Button>
              <Radio.Button value="DELETE">DELETE</Radio.Button>
              <Radio.Button value="PATCH">PATCH</Radio.Button>
            </Radio.Group>
          </Form.Item>
          
          <Form.Item
            name="description"
            label="接口描述"
            rules={[{ required: true, message: '请输入接口描述' }]}
          >
            <Input placeholder="请输入接口描述" />
          </Form.Item>
          
          <Form.Item
            name="request"
            label="请求参数 (JSON格式)"
          >
            <TextArea
              rows={6}
              placeholder={"{\n  \"param1\": \"string\",\n  \"param2\": \"number\"\n}"}
            />
          </Form.Item>
          
          <Form.Item
            name="response"
            label="返回结果 (JSON格式)"
          >
            <TextArea
              rows={6}
              placeholder={"{\n  \"data\": \"object\",\n  \"message\": \"string\"\n}"}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default ApiInterface; 