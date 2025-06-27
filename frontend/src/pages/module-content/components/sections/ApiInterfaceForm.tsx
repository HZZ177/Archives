import React, { useState } from 'react';
import { Form, Input, Select, Radio, Modal, Tabs, message } from 'antd';
import { ApiInterfaceCard, ApiParam, HTTP_METHODS, CONTENT_TYPES } from '../../../../types/modules';
import ApiParamTable from './ApiParamTable';
import { useWorkspace } from '../../../../contexts/WorkspaceContext';
import { checkInterfaceExists } from '../../../../apis/workspaceService';

const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input;

interface ApiInterfaceFormProps {
  visible: boolean;
  title?: string; // 设为可选，因为使用自定义Modal时不需要
  initialValues?: Partial<ApiInterfaceCard>;
  onOk: (values: ApiInterfaceCard) => void;
  onCancel: () => void;
  useCustomModal?: boolean; // 添加标记，表示是否使用自定义Modal
}

/**
 * API接口表单组件
 * 用于添加和编辑接口信息，支持嵌套参数结构
 */
const ApiInterfaceForm: React.FC<ApiInterfaceFormProps> = ({
  visible,
  title,
  initialValues,
  onOk,
  onCancel,
  useCustomModal = false
}) => {
  const [form] = Form.useForm();
  const { currentWorkspace } = useWorkspace();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 确认提交
  const handleOk = async () => {
    try {
      setIsSubmitting(true);
      const values = await form.validateFields();
      
      // 确保所有必要字段都被提交，防止数据丢失
      const completeValues = {
        ...values,
        path: values.path || '',
        method: values.method || 'GET',
        contentType: values.contentType || 'application/json',
        description: values.description || '',
        requestParams: values.requestParams || [],
        responseParams: values.responseParams || []
      };

      // 如果当前在工作区中，验证接口唯一性
      if (currentWorkspace) {
        try {
          // 检查接口是否已存在
          const exists = await checkInterfaceExists(
            currentWorkspace.id,
            completeValues.path,
            completeValues.method,
            initialValues?.workspace_interface_id // 编辑模式下排除当前接口
          );
          
          if (exists) {
            message.error(`工作区中已存在路径为 '${completeValues.path}' 且方法为 '${completeValues.method}' 的接口`);
            setIsSubmitting(false);
            return;
          }
        } catch (error) {
          console.error('验证接口唯一性失败:', error);
          // 继续提交，让后端验证处理
        }
      }
      
      onOk(completeValues as ApiInterfaceCard);
      setIsSubmitting(false);
    } catch (error) {
      console.error('表单验证失败:', error);
      setIsSubmitting(false);
    }
  };
  
  // 监听自定义提交事件
  React.useEffect(() => {
    const handleCustomSubmit = () => {
      handleOk();
    };
    
    // 添加事件监听
    if (useCustomModal) {
      document.addEventListener('api-interface-form-submit', handleCustomSubmit);
    }
    
    // 清理事件监听
    return () => {
      if (useCustomModal) {
        document.removeEventListener('api-interface-form-submit', handleCustomSubmit);
      }
    };
  }, [useCustomModal]);

  // 取消
  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  // 初始化表单值
  React.useEffect(() => {
    if (visible && initialValues) {
      // 确保设置所有必要字段，防止数据丢失
      const formValues = {
        path: initialValues.path || '',
        method: initialValues.method || 'GET',
        contentType: initialValues.contentType || 'application/json',
        description: initialValues.description || '',
        requestParams: initialValues.requestParams || [],
        responseParams: initialValues.responseParams || []
      };
      form.setFieldsValue(formValues);
      
    } else if (visible) {
      // 默认值
      form.setFieldsValue({
        method: 'GET',
        contentType: 'application/json',
        requestParams: [],
        responseParams: []
      });
    }
  }, [visible, initialValues, form]);

  // 表单内容组件
  const FormContent = () => (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        method: 'GET',
        contentType: 'application/json',
        requestParams: [],
        responseParams: []
      }}
    >
      {/* 基本信息 */}
      <Form.Item
        name="path"
        label="接口地址"
        rules={[{ required: true, message: '请输入接口地址' }]}
      >
        <Input placeholder="例如: /api/users" />
      </Form.Item>

      <Form.Item
        name="method"
        label="请求方法"
        rules={[{ required: true, message: '请选择请求方法' }]}
      >
        <Radio.Group>
          {HTTP_METHODS.map(method => (
            <Radio.Button key={method} value={method}>{method}</Radio.Button>
          ))}
        </Radio.Group>
      </Form.Item>

      <Form.Item
        name="contentType"
        label="请求数据类型"
      >
        <Select placeholder="请选择请求数据类型">
          {CONTENT_TYPES.map(type => (
            <Option key={type} value={type}>{type}</Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="description"
        label="接口描述"
      >
        <TextArea rows={3} placeholder="请输入接口描述" />
      </Form.Item>

      {/* 参数信息（使用标签页分隔请求和响应参数） */}
      <Tabs defaultActiveKey="request">
        <TabPane tab="请求参数" key="request">
          <Form.Item
            name="requestParams"
            initialValue={[]}
            extra="支持嵌套参数结构，可以添加object或array类型的参数，并为其添加子参数"
          >
            <ApiParamTable />
          </Form.Item>
        </TabPane>
        <TabPane tab="响应参数" key="response">
          <Form.Item
            name="responseParams"
            initialValue={[]}
            extra="支持嵌套参数结构，可以添加object或array类型的参数，并为其添加子参数"
          >
            <ApiParamTable isResponse={true} />
          </Form.Item>
        </TabPane>
      </Tabs>
    </Form>
  );

  // 如果使用自定义Modal，只返回表单内容
  if (useCustomModal) {
    return <FormContent />;
  }

  // 否则返回带有Modal的完整组件
  return (
    <Modal
      title={title}
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      width={800}
      destroyOnClose
      maskClosable={false}
      confirmLoading={isSubmitting}
    >
      <FormContent />
    </Modal>
  );
};

export default ApiInterfaceForm; 