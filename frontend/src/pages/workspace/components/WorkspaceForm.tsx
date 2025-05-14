import React, { useEffect } from 'react';
import { Form, Input, Button, ColorPicker, Space } from 'antd';
import { Workspace, CreateWorkspaceParams, UpdateWorkspaceParams } from '../../../types/workspace';

const { TextArea } = Input;

interface WorkspaceFormProps {
  initialValues?: Workspace | null;
  loading?: boolean;
  onFinish: (values: CreateWorkspaceParams | UpdateWorkspaceParams) => void;
  onCancel: () => void;
}

/**
 * 工作区表单组件
 */
const WorkspaceForm: React.FC<WorkspaceFormProps> = ({
  initialValues,
  loading = false,
  onFinish,
  onCancel,
}) => {
  const [form] = Form.useForm();

  // 表单初始化
  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue({
        name: initialValues.name,
        description: initialValues.description || '',
        color: initialValues.color || '#1890ff',
      });
    }
  }, [initialValues, form]);

  // 处理表单提交
  const handleSubmit = (values: any) => {
    // 确保颜色数据正确格式化
    const formattedValues = {
      ...values,
      color: typeof values.color === 'object' ? values.color.toHexString() : values.color,
    };
    onFinish(formattedValues);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        name: '',
        description: '',
        color: '#1890ff',
      }}
    >
      <Form.Item
        label="工作区名称"
        name="name"
        rules={[{ required: true, message: '请输入工作区名称' }]}
      >
        <Input placeholder="输入工作区名称" maxLength={100} />
      </Form.Item>

      <Form.Item
        label="描述"
        name="description"
      >
        <TextArea placeholder="输入工作区描述（可选）" rows={4} maxLength={500} />
      </Form.Item>

      <Form.Item
        label="主题色"
        name="color"
      >
        <ColorPicker />
      </Form.Item>

      <Form.Item>
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            {initialValues ? '保存' : '创建'}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default WorkspaceForm; 