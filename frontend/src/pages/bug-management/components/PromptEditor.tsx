import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  message,
  Typography,
  Divider,
  Card
} from 'antd';
import {
  EditOutlined,
  SaveOutlined,
  EyeOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { monthlyReportService, PromptTemplate, PromptTemplateCreate } from '../../../services/monthlyReportService';

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text } = Typography;

interface PromptEditorProps {
  visible: boolean;
  onClose: () => void;
  workspaceId: number;
  onTemplateSelect: (template: string) => void;
  currentTemplate?: string;
}

const PromptEditor: React.FC<PromptEditorProps> = ({
  visible,
  onClose,
  workspaceId,
  onTemplateSelect,
  currentTemplate
}) => {
  const [form] = Form.useForm();
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // 默认提示词模板
  const defaultTemplate = `你是一个专业的软件质量分析师，请基于以下缺陷数据生成月度分析报告。

分析要点：
1. 缺陷趋势和分布情况
2. 高频问题和根因分析  
3. 质量改进建议
4. 风险预警和预测

请以专业、客观的语调生成报告，包含具体的数据支撑和可执行的建议。

数据范围：{year}年{month}月
工作区：{workspace_name}
缺陷总数：{total_bugs}

请生成结构化的分析报告，包含以下部分：
- 执行摘要
- 关键指标分析
- 趋势分析
- 问题热点分析
- AI洞察与建议
- 改进措施建议`;

  // 加载提示词模板
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await monthlyReportService.getPromptTemplates(workspaceId);
      if (response.success) {
        setTemplates(response.data);
        
        // 如果有默认模板，自动选择
        const defaultTemplate = response.data.find(t => t.is_default);
        if (defaultTemplate) {
          setSelectedTemplateId(defaultTemplate.id);
          form.setFieldsValue({
            template_name: defaultTemplate.template_name,
            template_content: defaultTemplate.template_content
          });
        } else if (currentTemplate) {
          // 使用当前模板
          form.setFieldsValue({
            template_content: currentTemplate
          });
        } else {
          // 使用内置默认模板
          form.setFieldsValue({
            template_content: defaultTemplate
          });
        }
      }
    } catch (error) {
      message.error('加载提示词模板失败');
    } finally {
      setLoading(false);
    }
  };

  // 选择模板
  const handleTemplateSelect = (templateId: number) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplateId(templateId);
      form.setFieldsValue({
        template_name: template.template_name,
        template_content: template.template_content
      });
    }
  };

  // 保存为新模板
  const handleSaveAsTemplate = async () => {
    try {
      const values = await form.validateFields(['template_name', 'template_content']);
      setSaveLoading(true);

      const templateData: PromptTemplateCreate = {
        workspace_id: workspaceId,
        template_name: values.template_name,
        template_content: values.template_content,
        is_active: true,
        is_default: false
      };

      const response = await monthlyReportService.createPromptTemplate(templateData);
      if (response.success) {
        message.success('保存模板成功');
        await loadTemplates();
        setSelectedTemplateId(response.data.id);
      }
    } catch (error: any) {
      message.error(error.message || '保存模板失败');
    } finally {
      setSaveLoading(false);
    }
  };

  // 应用模板
  const handleApply = () => {
    const templateContent = form.getFieldValue('template_content');
    if (templateContent) {
      onTemplateSelect(templateContent);
      message.success('提示词已应用');
      onClose();
    } else {
      message.warning('请输入提示词内容');
    }
  };

  // 预览模式切换
  const togglePreviewMode = () => {
    setIsPreviewMode(!isPreviewMode);
  };

  useEffect(() => {
    if (visible) {
      loadTemplates();
    }
  }, [visible, workspaceId]);

  return (
    <Modal
      title={
        <Space>
          <EditOutlined />
          <span>编辑AI分析提示词</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="preview"
          icon={<EyeOutlined />}
          onClick={togglePreviewMode}
        >
          {isPreviewMode ? '编辑' : '预览'}
        </Button>,
        <Button
          key="save"
          icon={<SaveOutlined />}
          onClick={handleSaveAsTemplate}
          loading={saveLoading}
        >
          保存为模板
        </Button>,
        <Button
          key="apply"
          type="primary"
          onClick={handleApply}
        >
          应用
        </Button>
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          工作区: <Text strong>工作区 {workspaceId}</Text>
        </Text>
      </div>

      <Form form={form} layout="vertical">
        {/* 模板选择 */}
        <Form.Item label="选择模板">
          <Space.Compact style={{ width: '100%' }}>
            <Select
              placeholder="选择已有模板"
              value={selectedTemplateId}
              onChange={handleTemplateSelect}
              loading={loading}
              style={{ flex: 1 }}
              allowClear
            >
              {templates.map(template => (
                <Option key={template.id} value={template.id}>
                  {template.template_name}
                  {template.is_default && <Text type="secondary"> (默认)</Text>}
                </Option>
              ))}
            </Select>
            <Button
              icon={<PlusOutlined />}
              onClick={() => {
                form.setFieldsValue({
                  template_name: '',
                  template_content: defaultTemplate
                });
                setSelectedTemplateId(null);
              }}
            >
              新建
            </Button>
          </Space.Compact>
        </Form.Item>

        {/* 模板名称 */}
        <Form.Item
          name="template_name"
          label="模板名称"
          rules={[{ required: true, message: '请输入模板名称' }]}
        >
          <Input placeholder="请输入模板名称" />
        </Form.Item>

        {/* 提示词内容 */}
        <Form.Item
          name="template_content"
          label="提示词内容"
          rules={[{ required: true, message: '请输入提示词内容' }]}
        >
          {isPreviewMode ? (
            <Card>
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {form.getFieldValue('template_content')}
              </pre>
            </Card>
          ) : (
            <TextArea
              rows={12}
              placeholder="请输入AI分析提示词..."
              showCount
            />
          )}
        </Form.Item>
      </Form>

      <Divider />

      <div>
        <Title level={5}>提示词变量说明：</Title>
        <Text type="secondary">
          <div>• {'{year}'} - 分析年份</div>
          <div>• {'{month}'} - 分析月份</div>
          <div>• {'{workspace_name}'} - 工作区名称</div>
          <div>• {'{total_bugs}'} - 缺陷总数</div>
          <div>• {'{data_summary}'} - 数据摘要</div>
        </Text>
      </div>
    </Modal>
  );
};

export default PromptEditor;
