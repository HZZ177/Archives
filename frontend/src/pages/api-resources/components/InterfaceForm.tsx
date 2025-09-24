import React, { useState, useEffect } from 'react';
import { 
  Form, 
  Input, 
  Button, 
  Space, 
  message, 
  Spin, 
  Tabs, 
  Select, 
  Divider 
} from 'antd';
import { 
  PlusOutlined, 
  MinusCircleOutlined 
} from '@ant-design/icons';
import { WorkspaceInterface, WorkspaceInterfaceDetail } from '../../../types/workspace';
import { createInterface, updateInterface, getInterfaceDetail } from '../../../services/workspaceInterfaceService';

const { TextArea } = Input;
const { Option } = Select;

interface InterfaceFormProps {
  workspaceId?: number;
  initialValues: WorkspaceInterface | null;
  onSuccess: () => void;
  onCancel: () => void;
}

// HTTP方法选项
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

// 内容类型选项
const CONTENT_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain'
];

// 参数类型选项
const PARAM_TYPES = ['string', 'number', 'boolean', 'object', 'array', 'null'];

const InterfaceForm: React.FC<InterfaceFormProps> = ({ 
  workspaceId, 
  initialValues, 
  onSuccess, 
  onCancel 
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [interfaceDetail, setInterfaceDetail] = useState<WorkspaceInterfaceDetail | null>(null);
  
  // 如果是编辑模式，加载接口详情
  useEffect(() => {
    const fetchInterfaceDetail = async () => {
      if (initialValues?.id) {
        try {
          setDetailLoading(true);
          const detail = await getInterfaceDetail(initialValues.id);
          setInterfaceDetail(detail);
          
          // 设置表单初始值
          form.setFieldsValue({
            path: detail.path,
            method: detail.method,
            description: detail.description,
            content_type: detail.content_type || 'application/json',
            request_params: detail.request_params || [],
            response_params: detail.response_params || []
          });
        } catch (error) {
          console.error('获取接口详情失败:', error);
          message.error('获取接口详情失败，请稍后重试');
        } finally {
          setDetailLoading(false);
        }
      } else {
        // 新建接口，设置默认值
        form.setFieldsValue({
          method: 'GET',
          content_type: 'application/json',
          request_params: [],
          response_params: []
        });
      }
    };
    
    fetchInterfaceDetail();
  }, [initialValues, form]);
  
  // 表单提交
  const handleSubmit = async (values: any) => {
    if (!workspaceId) {
      message.error('未选择工作区');
      return;
    }
    
    try {
      setLoading(true);
      
      // 准备提交数据
      const interfaceData = {
        path: values.path,
        method: values.method,
        description: values.description,
        content_type: values.content_type,
        request_params_json: values.request_params.map((param: any) => ({
          param_name: param.param_name,
          param_type: param.param_type,
          required: param.required,
          description: param.description,
          example: param.example
        })),
        response_params_json: values.response_params.map((param: any) => ({
          param_name: param.param_name,
          param_type: param.param_type,
          description: param.description,
          example: param.example
        }))
      };
      
      if (initialValues?.id) {
        // 更新接口
        await updateInterface(initialValues.id, interfaceData);
        message.success('接口更新成功');
      } else {
        // 创建接口
        await createInterface(workspaceId, {
          ...interfaceData,
          workspace_id: workspaceId
        });
        message.success('接口创建成功');
      }
      
      onSuccess();
    } catch (error) {
      console.error('保存接口失败:', error);
      message.error('保存失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  
  // 渲染请求参数表单
  const renderRequestParamsFields = () => {
    return (
      <Form.List name="request_params">
        {(fields, { add, remove }) => (
          <>
            {fields.length === 0 && (
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <p>暂无请求参数</p>
              </div>
            )}
            
            {fields.map(({ key, name, ...restField }) => (
              <div key={key} style={{ marginBottom: 16, padding: 16, border: '1px dashed #d9d9d9', borderRadius: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <h4>参数 #{name + 1}</h4>
                  <Button 
                    type="text" 
                    danger 
                    icon={<MinusCircleOutlined />} 
                    onClick={() => remove(name)}
                  >
                    删除
                  </Button>
                </div>
                
                <Form.Item
                  {...restField}
                  name={[name, 'param_name']}
                  label="参数名"
                  rules={[{ required: true, message: '请输入参数名' }]}
                >
                  <Input placeholder="参数名" />
                </Form.Item>
                
                <div style={{ display: 'flex', gap: 8 }}>
                  <Form.Item
                    {...restField}
                    name={[name, 'param_type']}
                    label="参数类型"
                    rules={[{ required: true, message: '请选择参数类型' }]}
                    style={{ flex: 1 }}
                  >
                    <Select placeholder="选择参数类型">
                      {PARAM_TYPES.map(type => (
                        <Option key={type} value={type}>
                          {type}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                  
                  <Form.Item
                    {...restField}
                    name={[name, 'required']}
                    label="是否必需"
                    valuePropName="checked"
                    style={{ flex: 1 }}
                  >
                    <Select placeholder="是否必需">
                      <Option value={true}>是</Option>
                      <Option value={false}>否</Option>
                    </Select>
                  </Form.Item>
                </div>
                
                <Form.Item
                  {...restField}
                  name={[name, 'description']}
                  label="描述"
                >
                  <Input placeholder="参数描述" />
                </Form.Item>
                
                <Form.Item
                  {...restField}
                  name={[name, 'example']}
                  label="示例值"
                >
                  <Input placeholder="示例值" />
                </Form.Item>
              </div>
            ))}
            
            <Form.Item>
              <Button 
                type="dashed" 
                onClick={() => add({ 
                  param_name: '', 
                  param_type: 'string', 
                  required: false 
                })} 
                block 
                icon={<PlusOutlined />}
              >
                添加请求参数
              </Button>
            </Form.Item>
          </>
        )}
      </Form.List>
    );
  };
  
  // 渲染响应参数表单
  const renderResponseParamsFields = () => {
    return (
      <Form.List name="response_params">
        {(fields, { add, remove }) => (
          <>
            {fields.length === 0 && (
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <p>暂无响应参数</p>
              </div>
            )}
            
            {fields.map(({ key, name, ...restField }) => (
              <div key={key} style={{ marginBottom: 16, padding: 16, border: '1px dashed #d9d9d9', borderRadius: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <h4>参数 #{name + 1}</h4>
                  <Button 
                    type="text" 
                    danger 
                    icon={<MinusCircleOutlined />} 
                    onClick={() => remove(name)}
                  >
                    删除
                  </Button>
                </div>
                
                <Form.Item
                  {...restField}
                  name={[name, 'param_name']}
                  label="参数名"
                  rules={[{ required: true, message: '请输入参数名' }]}
                >
                  <Input placeholder="参数名" />
                </Form.Item>
                
                <Form.Item
                  {...restField}
                  name={[name, 'param_type']}
                  label="参数类型"
                  rules={[{ required: true, message: '请选择参数类型' }]}
                >
                  <Select placeholder="选择参数类型">
                    {PARAM_TYPES.map(type => (
                      <Option key={type} value={type}>
                        {type}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                
                <Form.Item
                  {...restField}
                  name={[name, 'description']}
                  label="描述"
                >
                  <Input placeholder="参数描述" />
                </Form.Item>
                
                <Form.Item
                  {...restField}
                  name={[name, 'example']}
                  label="示例值"
                >
                  <Input placeholder="示例值" />
                </Form.Item>
              </div>
            ))}
            
            <Form.Item>
              <Button 
                type="dashed" 
                onClick={() => add({ 
                  param_name: '', 
                  param_type: 'string' 
                })} 
                block 
                icon={<PlusOutlined />}
              >
                添加响应参数
              </Button>
            </Form.Item>
          </>
        )}
      </Form.List>
    );
  };
  
  // 渲染加载状态
  if (initialValues?.id && detailLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '30px 0' }}>
        <Spin tip="加载接口详情...">
          <div style={{ minHeight: '100px' }} />
        </Spin>
      </div>
    );
  }
  
  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        path: initialValues?.path || '',
        method: initialValues?.method || 'GET',
        description: initialValues?.description || '',
        content_type: initialValues?.content_type || 'application/json',
      }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'basic',
            label: '基本信息',
            children: (
              <>
                <Form.Item
                  name="path"
                  label="接口路径"
                  rules={[{ required: true, message: '请输入接口路径' }]}
                >
                  <Input placeholder="/api/example" />
                </Form.Item>

                <Form.Item
                  name="method"
                  label="HTTP方法"
                  rules={[{ required: true, message: '请选择HTTP方法' }]}
                >
                  <Select placeholder="选择HTTP方法">
                    {HTTP_METHODS.map(method => (
                      <Option key={method} value={method}>
                        {method}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="content_type"
                  label="内容类型"
                >
                  <Select placeholder="选择内容类型">
                    {CONTENT_TYPES.map(type => (
                      <Option key={type} value={type}>
                        {type}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="description"
                  label="接口描述"
                >
                  <TextArea rows={4} placeholder="接口描述（可选）" />
                </Form.Item>
              </>
            )
          },
          {
            key: 'request_params',
            label: '请求参数',
            children: renderRequestParamsFields()
          },
          {
            key: 'response_params',
            label: '响应参数',
            children: renderResponseParamsFields()
          }
        ]}
      />
      
      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            {initialValues ? '更新' : '创建'}
          </Button>
        </Space>
      </div>
    </Form>
  );
};

export default InterfaceForm; 