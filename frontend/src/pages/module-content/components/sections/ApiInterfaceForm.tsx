import React from 'react';
import { Form, Input, Select, Radio, Modal, Tabs } from 'antd';
import { ApiInterfaceCard, ApiParam, HTTP_METHODS, CONTENT_TYPES } from '../../../../types/modules';
import ApiParamTable from './ApiParamTable';

const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input;

interface ApiInterfaceFormProps {
  visible: boolean;
  title: string;
  initialValues?: Partial<ApiInterfaceCard>;
  onOk: (values: ApiInterfaceCard) => void;
  onCancel: () => void;
}

/**
 * API接口表单组件
 * 用于添加和编辑接口信息
 */
const ApiInterfaceForm: React.FC<ApiInterfaceFormProps> = ({
  visible,
  title,
  initialValues,
  onOk,
  onCancel
}) => {
  const [form] = Form.useForm();

  // 确认提交
  const handleOk = async () => {
    try {
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
      
      // 提交前日志记录
      console.log('表单提交数据:', completeValues);
      
      onOk(completeValues as ApiInterfaceCard);
      form.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

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
      
      // 调试日志
      console.log('初始化表单值:', formValues);
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

  return (
    <Modal
      title={title}
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      width={800}
      destroyOnClose
      maskClosable={false}
    >
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
            >
              <ApiParamTable />
            </Form.Item>
          </TabPane>
          <TabPane tab="响应参数" key="response">
            <Form.Item
              name="responseParams"
              initialValue={[]}
            >
              <ApiParamTable />
            </Form.Item>
          </TabPane>
        </Tabs>
      </Form>
    </Modal>
  );
};

export default ApiInterfaceForm; 