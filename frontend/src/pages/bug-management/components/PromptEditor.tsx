import React, { useState, useEffect, useMemo } from 'react';
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
  Card,
  Descriptions,
  Empty,
  Row,
  Col,
  Popconfirm
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
  open: boolean;
  onClose: () => void;
  workspaceId: number;
  onTemplateSelect: (template: string) => void;
  currentTemplate?: string;
}

const PromptEditor: React.FC<PromptEditorProps> = ({
  open,
  onClose,
  workspaceId,
  onTemplateSelect,
  currentTemplate
}) => {
  const [form] = Form.useForm();
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState<'view' | 'edit' | 'create'>('view');
  const [saveLoading, setSaveLoading] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<{agent: any, task: any} | null>(null);


  // 默认配置
  const defaultAgentConfig = {
    role: "缺陷分析专家",
    goal: "分析现网缺陷数据，识别问题模式和根本原因，生成专业的分析报告",
    backstory: "你是一位资深的软件质量分析专家，拥有超过10年的软件缺陷分析经验。你擅长从大量的缺陷数据中识别问题模式，分析根本原因，并提供切实可行的改进建议。你的分析总是基于数据驱动，逻辑清晰，结论准确。"
  };

  const defaultTaskConfig = {
    description: `# 缺陷数据分析任务

## 任务目标
对提供的月度缺陷数据进行全面分析，识别问题模式、根本原因，并提供改进建议。

## 分析维度
请从以下维度进行深入分析：

### 1. 时间维度分析
- 分析缺陷在时间上的分布规律
- 识别缺陷高发时期和原因

### 2. 模块维度分析
- 识别缺陷集中的模块和业务域
- 分析各模块的缺陷密度和严重程度

### 3. 缺陷类型分析
- 按优先级、状态等维度分类统计
- 识别主要的缺陷类型和模式

### 4. 根本原因分析
- 深入分析缺陷产生的根本原因
- 识别系统性问题和流程问题

## 缺陷数据
{formatted_data}

## 注意事项
- 分析要基于实际数据，避免主观臆断
- 结论要有数据支撑，提供具体数字
- 建议要具体可行，有明确的执行路径`,
    expected_output: "结构化的缺陷分析报告，包含：1. 执行摘要 2. 时间维度分析 3. 模块维度分析 4. 缺陷类型分析 5. 根本原因分析 6. 改进建议"
  };

  // 将结构化配置转换为JSON字符串，过滤掉空字符串字段
  const configToJson = (agentConfig: any, taskConfig: any) => {
    // 过滤掉空字符串和null值，只保留有效配置
    const filterEmptyFields = (obj: any) => {
      const filtered: any = {};
      Object.keys(obj).forEach(key => {
        if (obj[key] && obj[key].trim && obj[key].trim() !== '') {
          filtered[key] = obj[key];
        }
      });
      return Object.keys(filtered).length > 0 ? filtered : undefined;
    };

    const filteredAgent = filterEmptyFields(agentConfig);
    const filteredTask = filterEmptyFields(taskConfig);

    // 如果两个配置都为空，返回空字符串
    if (!filteredAgent && !filteredTask) {
      return '';
    }

    const config: any = {};
    if (filteredAgent) config.agent = filteredAgent;
    if (filteredTask) config.task = filteredTask;

    return JSON.stringify(config, null, 2);
  };

  // 从JSON字符串解析配置
  const parseJsonConfig = (jsonString: string) => {
    // 如果是空字符串或null，返回空配置
    if (!jsonString || jsonString.trim() === '') {
      return {
        agent: { role: '', goal: '', backstory: '' },
        task: { description: '', expected_output: '' }
      };
    }

    try {
      const parsed = JSON.parse(jsonString);
      return {
        agent: {
          role: parsed.agent?.role || '',
          goal: parsed.agent?.goal || '',
          backstory: parsed.agent?.backstory || ''
        },
        task: {
          description: parsed.task?.description || '',
          expected_output: parsed.task?.expected_output || ''
        }
      };
    } catch (e) {
      // JSON解析失败时返回空配置，而不是默认配置
      return {
        agent: { role: '', goal: '', backstory: '' },
        task: { description: '', expected_output: '' }
      };
    }
  };

  // 加载提示词模板
  const loadTemplates = async () => {
    setLoading(true);
    try {
      // 并行加载模板列表和默认配置
      const [templatesResponse, defaultTemplateResponse] = await Promise.all([
        monthlyReportService.getPromptTemplates(workspaceId),
        monthlyReportService.getWorkspaceDefaultTemplate(workspaceId)
      ]);

      if (templatesResponse.success && templatesResponse.data) {
        setTemplates(templatesResponse.data);

        // 如果有工作区默认模板，自动选择
        if (defaultTemplateResponse.success && defaultTemplateResponse.data) {
          const defaultTemplateId = defaultTemplateResponse.data;
          const defaultTemplate = templatesResponse.data.find(t => t.id === defaultTemplateId);
          if (defaultTemplate) {
            setSelectedTemplateId(defaultTemplateId);
            // 如果父组件当前没有配置，自动应用默认模板
            if (!currentTemplate) {
              onTemplateSelect(defaultTemplate.template_content);
            }
          }
        }
      }
    } catch (error) {
      message.error('加载智能体配置失败');
    } finally {
      setLoading(false);
    }
  };

  // 选择模板
  const handleTemplateSelect = (templateId: number | undefined) => {
    console.log('handleTemplateSelect called with:', templateId);
    if (templateId) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        console.log('Setting template:', template.template_name);
        setSelectedTemplateId(templateId);

        // 解析JSON配置并填充表单
        const config = parseJsonConfig(template.template_content);
        form.setFieldsValue({
          template_name: template.template_name,
          agent_role: config.agent.role,
          agent_goal: config.agent.goal,
          agent_backstory: config.agent.backstory,
          task_description: config.task.description,
          task_expected_output: config.task.expected_output
        });
      }
    } else {
      // 清除选择，回到默认配置
      setSelectedTemplateId(null);
    }
  };

  // 保存为新模板
  const handleSaveAsTemplate = async () => {
    try {
      // 从表单字段构建JSON - 只验证模板名称
      const values = await form.validateFields(['template_name']);
      const allValues = form.getFieldsValue();

      const templateContent = configToJson({
        role: allValues.agent_role || '',
        goal: allValues.agent_goal || '',
        backstory: allValues.agent_backstory || ''
      }, {
        description: allValues.task_description || '',
        expected_output: allValues.task_expected_output || ''
      });

      setSaveLoading(true);

      const templateData: PromptTemplateCreate = {
        workspace_id: workspaceId,
        template_name: values.template_name,
        template_content: templateContent,
        is_active: true,
        is_default: false
      };

      const response = await monthlyReportService.createPromptTemplate(templateData);
      if (response.success && response.data) {
        message.success('保存模板成功');
        await loadTemplates();
        setSelectedTemplateId(response.data.id);
        // 回到查看模式
        setEditMode('view');
      }
    } catch (error: any) {
      message.error(error.message || '保存模板失败');
    } finally {
      setSaveLoading(false);
    }
  };

  // 应用模板
  const handleApply = async () => {
    try {
      if (selectedTemplateId) {
        // 如果选择了模板，使用模板内容
        const template = templates.find(t => t.id === selectedTemplateId);
        if (template) {
          // 保存为工作区默认配置
          await monthlyReportService.setWorkspaceDefaultTemplate(workspaceId, selectedTemplateId);
          onTemplateSelect(template.template_content);
          message.success('智能体配置已应用并保存为默认配置');
          onClose();
          return;
        }
      }

      // 如果没有选择模板，但是在编辑模式下有表单数据，使用表单数据
      if (editMode !== 'view') {
        const allValues = form.getFieldsValue();
        const templateContent = configToJson({
          role: allValues.agent_role || '',
          goal: allValues.agent_goal || '',
          backstory: allValues.agent_backstory || ''
        }, {
          description: allValues.task_description || '',
          expected_output: allValues.task_expected_output || ''
        });

        if (templateContent) {
          onTemplateSelect(templateContent);
          message.success('智能体配置已应用');
          onClose();
          return;
        }
      }

      // 如果没有选择模板且没有表单数据，传递空字符串让后端使用默认配置
      onTemplateSelect('');
      message.success('已应用默认智能体配置');
      onClose();
    } catch (error) {
      message.error('应用配置失败');
    }
  };

  // 进入编辑模式
  const handleEditTemplate = () => {
    if (selectedTemplateId) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        const config = parseJsonConfig(template.template_content);
        form.setFieldsValue({
          template_name: template.template_name,
          agent_role: config.agent.role,
          agent_goal: config.agent.goal,
          agent_backstory: config.agent.backstory,
          task_description: config.task.description,
          task_expected_output: config.task.expected_output
        });
      }
    } else {
      // 编辑默认配置
      form.setFieldsValue({
        template_name: '默认模板',
        agent_role: defaultAgentConfig.role,
        agent_goal: defaultAgentConfig.goal,
        agent_backstory: defaultAgentConfig.backstory,
        task_description: defaultTaskConfig.description,
        task_expected_output: defaultTaskConfig.expected_output
      });
    }
    setEditMode('edit');
  };

  // 进入新增模式
  const handleCreateTemplate = () => {
    form.setFieldsValue({
      template_name: '',
      agent_role: '',
      agent_goal: '',
      agent_backstory: '',
      task_description: '',
      task_expected_output: ''
    });
    setEditMode('create');
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditMode('view');
    form.resetFields();
  };

  // 删除模板
  const handleDeleteTemplate = async () => {
    if (!selectedTemplateId) return;

    try {
      const response = await monthlyReportService.deletePromptTemplate(selectedTemplateId);
      if (response.success) {
        message.success('模板删除成功');
        await loadTemplates(); // 重新加载模板列表
        setSelectedTemplateId(null); // 清除选择
      } else {
        message.error(response.message || '删除模板失败');
      }
    } catch (error: any) {
      message.error(error.message || '删除模板失败');
    }
  };

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open, workspaceId]);

  // 获取当前显示的配置 - 使用 useMemo 确保响应状态变化
  const currentDisplayConfig = useMemo(() => {
    console.log('currentDisplayConfig recalculating, selectedTemplateId:', selectedTemplateId);
    if (selectedTemplateId) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        console.log('Using template config:', template.template_name);
        const parsedConfig = parseJsonConfig(template.template_content);

        // 在查看模式下，对于空字段显示提示文本
        if (editMode === 'view') {
          return {
            agent: {
              role: parsedConfig.agent.role || '未设置，将使用默认配置',
              goal: parsedConfig.agent.goal || '未设置，将使用默认配置',
              backstory: parsedConfig.agent.backstory || '未设置，将使用默认配置'
            },
            task: {
              description: parsedConfig.task.description || '未设置，将使用默认配置',
              expected_output: parsedConfig.task.expected_output || '未设置，将使用默认配置'
            }
          };
        }

        return parsedConfig;
      }
    }
    console.log('Using default config');
    return { agent: defaultAgentConfig, task: defaultTaskConfig };
  }, [selectedTemplateId, templates, editMode]);

  return (
    <Modal
      title={
        <Space>
          <EditOutlined />
          <span>智能体管理</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={1200}
      style={{ maxHeight: '90vh' }}
      styles={{ body: { maxHeight: '75vh', overflowY: 'auto' } }}
      footer={
        editMode === 'view' ? [
          <Button key="cancel" onClick={onClose}>
            关闭
          </Button>,
          <Button key="apply" type="primary" onClick={handleApply}>
            确定使用
          </Button>
        ] : [
          <Button key="cancel" onClick={handleCancelEdit}>
            取消
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={saveLoading}
            onClick={handleSaveAsTemplate}
          >
            {editMode === 'edit' ? '保存修改' : '保存为新模板'}
          </Button>
        ]
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          工作区: <Text strong>工作区 {workspaceId}</Text>
        </Text>
      </div>

      {/* 模板选择区域 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <Text strong>当前模板: </Text>
          <Space.Compact style={{ marginLeft: 8 }}>
            <Select
              placeholder="选择模板"
              value={selectedTemplateId}
              onChange={handleTemplateSelect}
              loading={loading}
              style={{ width: 300 }}
              allowClear
              onClear={() => handleTemplateSelect(undefined)}
            >
              {templates.map(template => (
                <Option key={template.id} value={template.id}>
                  {template.template_name}
                  {template.is_default && <Text type="secondary"> (默认)</Text>}
                </Option>
              ))}
            </Select>
            <Button onClick={handleCreateTemplate}>
              新增模板
            </Button>
          </Space.Compact>
          <Text type="secondary" style={{ marginLeft: 8 }}>
            {selectedTemplateId ? '已选择自定义模板' : '使用默认配置'}
          </Text>
        </div>
      </div>

      {editMode === 'view' ? (
        /* 查看模式 - 只读显示 */
        <div>
          {selectedTemplateId ? (
            /* 选择了模板 - 显示具体配置 */
            <div style={{ marginBottom: 16 }}>
              <Row gutter={[16, 16]} style={{ margin: 0 }}>
                <Col span={12} style={{ paddingLeft: 8, paddingRight: 8 }}>
                  <Card title="AI Agent 配置" size="small" style={{ minHeight: '300px', width: '100%', boxSizing: 'border-box' }}>
                    <Descriptions column={1} bordered size="small">
                      <Descriptions.Item label="AI 角色">
                        <Text style={{ wordBreak: 'break-word' }}>
                          {currentDisplayConfig.agent.role || <Text type="secondary" italic>未设置，将使用默认配置</Text>}
                        </Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="AI 目标">
                        <Text style={{ wordBreak: 'break-word' }}>
                          {currentDisplayConfig.agent.goal || <Text type="secondary" italic>未设置，将使用默认配置</Text>}
                        </Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="AI 背景故事">
                        <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {currentDisplayConfig.agent.backstory || <Text type="secondary" italic>未设置，将使用默认配置</Text>}
                        </Text>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
                <Col span={12} style={{ paddingLeft: 8, paddingRight: 8 }}>
                  <Card title="分析任务配置" size="small" style={{ minHeight: '300px', width: '100%', boxSizing: 'border-box' }}>
                    <Descriptions column={1} bordered size="small">
                      <Descriptions.Item label="任务描述">
                        <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {currentDisplayConfig.task.description || <Text type="secondary" italic>未设置，将使用默认配置</Text>}
                        </Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="期望输出">
                        <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {currentDisplayConfig.task.expected_output || <Text type="secondary" italic>未设置，将使用默认配置</Text>}
                        </Text>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
              </Row>
            </div>
          ) : (
            /* 没有选择模板 - 显示提示文字 */
            <Card title="当前智能体配置" style={{ marginBottom: 16 }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <Text type="secondary">当前没有选择的自定义智能体配置</Text>
                    <br />
                    <Text type="secondary">使用默认提示词</Text>
                  </div>
                }
              />
            </Card>
          )}

          {/* 操作按钮 */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Space>
              <Button onClick={handleEditTemplate} disabled={!selectedTemplateId}>
                编辑模板
              </Button>
              <Popconfirm
                title="确认删除模板"
                description="确定要删除这个智能体模板吗？删除后无法恢复。"
                onConfirm={handleDeleteTemplate}
                okText="确定删除"
                cancelText="取消"
                disabled={!selectedTemplateId}
              >
                <Button
                  danger
                  disabled={!selectedTemplateId}
                >
                  删除模板
                </Button>
              </Popconfirm>
            </Space>
          </div>
        </div>
      ) : (
        /* 编辑/新增模式 - 表单编辑 */
        <Form form={form} layout="vertical">

        {/* 模板名称 */}
        <Form.Item
          name="template_name"
          label="模板名称"
          rules={[{ required: true, message: '请输入模板名称' }]}
        >
          <Input placeholder="请输入模板名称" />
        </Form.Item>

        {/* 左右两栏布局 */}
        <Row gutter={[16, 16]} style={{ margin: 0 }}>
          <Col span={12} style={{ paddingLeft: 8, paddingRight: 8 }}>
            <Card title="AI Agent 配置" size="small" style={{ width: '100%', boxSizing: 'border-box' }}>
              <Form.Item
                name="agent_role"
                label="AI 角色"
              >
                <Input placeholder="例如：缺陷分析专家（可选，留空使用默认配置）" />
              </Form.Item>

              <Form.Item
                name="agent_goal"
                label="AI 目标"
              >
                <TextArea
                  rows={3}
                  placeholder="例如：分析现网缺陷数据，识别问题模式和根本原因，生成专业的分析报告（可选，留空使用默认配置）"
                  style={{ resize: 'vertical', minHeight: '72px', maxHeight: '120px' }}
                />
              </Form.Item>

              <Form.Item
                name="agent_backstory"
                label="AI 背景故事"
              >
                <TextArea
                  rows={6}
                  placeholder="例如：你是一位资深的软件质量分析专家，拥有超过10年的软件缺陷分析经验...（可选，留空使用默认配置）"
                  style={{ resize: 'vertical', minHeight: '144px', maxHeight: '200px' }}
                />
              </Form.Item>
            </Card>
          </Col>

          <Col span={12} style={{ paddingLeft: 8, paddingRight: 8 }}>
            <Card title="分析任务配置" size="small" style={{ width: '100%', boxSizing: 'border-box' }}>
              <Form.Item
                name="task_description"
                label="任务描述"
              >
                <TextArea
                  rows={8}
                  placeholder="请描述具体的分析任务，可以使用 {formatted_data} 作为数据占位符（可选，留空使用默认配置）"
                  style={{ resize: 'vertical', minHeight: '192px', maxHeight: '300px' }}
                />
              </Form.Item>

              <Form.Item
                name="task_expected_output"
                label="期望输出"
              >
                <TextArea
                  rows={4}
                  placeholder="例如：结构化的缺陷分析报告，包含：1. 执行摘要 2. 时间维度分析...（可选，留空使用默认配置）"
                  style={{ resize: 'vertical', minHeight: '96px', maxHeight: '150px' }}
                />
              </Form.Item>
            </Card>
          </Col>
        </Row>

        <Card size="small" style={{ marginTop: 16, marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            <strong>提示：</strong><br/>
            • 在任务描述中使用 <code>{`{formatted_data}`}</code> 作为缺陷数据的占位符<br/>
            • AI角色和背景故事会影响分析的风格和深度<br/>
            • 期望输出会指导AI生成特定格式的报告
          </Text>
        </Card>
        </Form>
      )}
    </Modal>
  );
};

export default PromptEditor;
