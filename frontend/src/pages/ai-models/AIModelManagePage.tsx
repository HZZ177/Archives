import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  message,
  Space,
  Tag,
  Popconfirm,
  Row,
  Col,
  Statistic,
  Typography,
  Avatar,
  Tooltip,
  Spin,
  Empty,
  Divider
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  ApiOutlined,
  RobotOutlined,
  LinkOutlined
} from '@ant-design/icons';
import { aiModelService } from '../../services/aiModelService';
import { AIModelConfig, AIModelConfigFormData, PoolStatus } from '../../types/ai-models';

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text } = Typography;

// 支持的提供商配置
const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI', color: '#74aa9c' },
  { value: 'anthropic', label: 'Anthropic', color: '#d32f2f' },
  { value: 'google', label: 'Google', color: '#4285f4' },
  { value: 'metallama', label: 'Meta Llama', color: '#1877f2' },
  { value: 'openrouter', label: 'OpenRouter', color: '#1976d2' },
  { value: 'azureopenai', label: 'Azure OpenAI', color: '#0078d4' }
];

// 获取提供商对应的颜色
const getProviderColor = (provider: string): string => {
  const providerOption = PROVIDER_OPTIONS.find(option =>
    option.value.toLowerCase() === provider.toLowerCase()
  );
  return providerOption?.color || '#757575'; // 默认灰色
};

// 获取API地址的简短显示名称
const getApiShortName = (url: string): string => {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    return `${urlObj.hostname}${urlObj.pathname}`;
  } catch (e) {
    return url;
  }
};

const AIModelManagePage: React.FC = () => {
  const [configs, setConfigs] = useState<AIModelConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AIModelConfig | null>(null);
  const [poolStatus, setPoolStatus] = useState<PoolStatus | null>(null);
  const [activeConfigId, setActiveConfigId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [form] = Form.useForm();

  // 加载配置列表
  const loadConfigs = async () => {
    setLoading(true);
    try {
      const response = await aiModelService.listConfigs();

      if (response.success) {
        setConfigs(response.data.items);

        // 找到当前活跃的配置
        const activeConfig = response.data.items.find((config: AIModelConfig) => config.is_active);
        if (activeConfig) {
          setActiveConfigId(activeConfig.id);
        }
      }
    } catch (error) {
      message.error('加载配置列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载连接池状态
  const loadPoolStatus = async () => {
    try {
      const response = await aiModelService.getPoolStatus();
      if (response.success) {
        setPoolStatus(response.data);
      }
    } catch (error) {
      console.error('加载连接池状态失败:', error);
    }
  };

  useEffect(() => {
    loadConfigs();
    loadPoolStatus();
  }, []);

  // 打开创建/编辑模态框
  const openModal = (config?: AIModelConfig) => {
    setEditingConfig(config || null);
    setModalVisible(true);
    
    if (config) {
      form.setFieldsValue(config);
    } else {
      form.resetFields();
    }
  };

  // 关闭模态框
  const closeModal = () => {
    setModalVisible(false);
    setEditingConfig(null);
    form.resetFields();
  };

  // 提交表单
  const handleSubmit = async (values: AIModelConfigFormData) => {
    try {
      if (editingConfig) {
        // 更新配置
        const response = await aiModelService.updateConfig(editingConfig.id, values);
        if (response.success) {
          message.success('配置更新成功');
          loadConfigs();
          closeModal();
        }
      } else {
        // 创建配置
        const response = await aiModelService.createConfig(values);
        if (response.success) {
          message.success('配置创建成功');
          loadConfigs();
          closeModal();
        }
      }
    } catch (error) {
      message.error(editingConfig ? '更新配置失败' : '创建配置失败');
    }
  };

  // 删除配置
  const handleDelete = async (id: number) => {
    try {
      const response = await aiModelService.deleteConfig(id);
      if (response.success) {
        // 检查是否删除了活跃配置
        if (response.data.was_active) {
          message.success(`配置 '${response.data.config_name}' 删除成功，连接池已清空`);
          // 清空活跃配置ID
          setActiveConfigId(null);
        } else {
          message.success(`配置 '${response.data.config_name}' 删除成功`);
        }
        loadConfigs();
        loadPoolStatus(); // 重新加载连接池状态
      }
    } catch (error: any) {
      console.error('删除配置失败:', error);
      const errorMessage = error.response?.data?.detail || '删除配置失败';
      message.error(errorMessage);
    }
  };

  // 测试连接
  const handleTestConnection = async (id: number, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }

    try {
      setTestingId(id);
      const response = await aiModelService.testConnection(id);
      if (response.success && response.data.success) {
        message.success(`连接测试成功 (${response.data.response_time_ms}ms)`);
      } else {
        message.error(`连接测试失败: ${response.data.message}`);
      }
    } catch (error) {
      message.error('连接测试失败');
    } finally {
      setTestingId(null);
    }
  };

  // 激活配置
  const handleActivate = async (id: number) => {
    try {
      const response = await aiModelService.activateConfig(id);
      if (response.success) {
        message.success('配置激活成功');
        setActiveConfigId(id);
        loadConfigs();
        loadPoolStatus();
      }
    } catch (error) {
      message.error('激活配置失败');
    }
  };

  // 处理模型选择变化
  const handleModelChange = async (value: number | null | undefined) => {
    if (value === null || value === undefined) {
      // 清除选择
      await handleClearActive();
    } else {
      // 激活选择的配置
      await handleActivate(value);
    }
  };

  // 清除活跃配置
  const handleClearActive = async () => {
    try {
      const response = await aiModelService.clearActiveConfig();
      if (response.success) {
        message.success('已清除当前使用的模型，连接池已清空');
        setActiveConfigId(null);
        loadConfigs();
        loadPoolStatus();
      }
    } catch (error: any) {
      console.error('清除活跃配置失败:', error);
      const errorMessage = error.response?.data?.detail || '清除活跃配置失败';
      message.error(errorMessage);
    }
  };



  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        borderBottom: '1px solid #f0f0f0',
        paddingBottom: '16px'
      }}>
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 500 }}>
            AI模型管理
          </Title>
          <Text type="secondary" style={{ marginTop: '4px', display: 'block' }}>
            管理您的大语言模型配置，配置需要使用的模型
          </Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadConfigs();
              loadPoolStatus();
            }}
            style={{ borderRadius: '6px' }}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openModal()}
            style={{ borderRadius: '6px' }}
          >
            添加模型
          </Button>
        </Space>
      </div>

      {/* 当前使用模型选择器 */}
      <Card style={{
        marginBottom: '24px',
        borderRadius: '8px',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Text strong style={{ fontSize: '14px' }}>
            当前使用的模型:
          </Text>
          <Select
            value={activeConfigId}
            onChange={handleModelChange}
            placeholder="选择模型"
            style={{ minWidth: '250px' }}
            loading={loading}
            disabled={loading || configs.length === 0}
            allowClear
          >
            {configs.map((config) => (
              <Option key={config.id} value={config.id}>
                {config.name} ({config.model_name})
              </Option>
            ))}
          </Select>
          {loading && <Spin size="small" />}
        </div>
      </Card>

      {/* 连接池状态 */}
      {poolStatus && (
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col span={6}>
            <Card style={{ borderRadius: '8px' }}>
              <Statistic
                title="连接池大小"
                value={poolStatus.total_size}
                prefix={<ApiOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card style={{ borderRadius: '8px' }}>
              <Statistic
                title="可用连接"
                value={poolStatus.available_count}
                valueStyle={{ color: '#3f8600' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card style={{ borderRadius: '8px' }}>
              <Statistic
                title="活跃连接"
                value={poolStatus.active_count}
                valueStyle={{ color: '#cf1322' }}
                prefix={<ExclamationCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card style={{ borderRadius: '8px' }}>
              <Statistic
                title="当前配置"
                value={poolStatus.current_config?.name || '无'}
                prefix={<RobotOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 模型列表 */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <Spin size="large" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {configs.length === 0 ? (
            <Card style={{
              padding: '40px',
              textAlign: 'center',
              borderRadius: '8px',
              border: '1px dashed #d9d9d9'
            }}>
              <Empty
                image={<RobotOutlined style={{ fontSize: '48px', color: '#d9d9d9' }} />}
                description={
                  <span>
                    暂无 AI 模型配置<br />
                    <Text type="secondary">点击"添加模型"按钮创建新配置</Text>
                  </span>
                }
              />
            </Card>
          ) : (
            configs.map((config) => (
              <Card
                key={config.id}
                style={{
                  borderRadius: '8px',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.2s',
                  cursor: 'pointer'
                }}
                hoverable
                styles={{ body: { padding: '16px' } }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px'
                }}>
                  <Avatar
                    style={{
                      backgroundColor: getProviderColor(config.model_provider),
                      width: '40px',
                      height: '40px',
                    }}
                    icon={<RobotOutlined />}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <Text strong style={{ fontSize: '16px' }}>
                        {config.name}
                      </Text>
                      {config.id === activeConfigId && (
                        <Tag color="success" style={{ margin: 0 }}>
                          当前使用
                        </Tag>
                      )}
                      {config.is_enabled ? (
                        <Tag color="blue" style={{ margin: 0 }}>启用</Tag>
                      ) : (
                        <Tag color="red" style={{ margin: 0 }}>禁用</Tag>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Tag style={{ margin: 0, borderRadius: '4px' }}>
                        {config.model_provider.toUpperCase()}
                      </Tag>
                      <Tag style={{ margin: 0, borderRadius: '4px' }}>
                        {config.model_name}
                      </Tag>
                      <Tag style={{ margin: 0, borderRadius: '4px' }}>
                        {getApiShortName(config.base_url)}
                      </Tag>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Tooltip title="测试连接">
                      <Button
                        type="text"
                        icon={testingId === config.id ? <Spin size="small" /> : <LinkOutlined />}
                        onClick={(e) => handleTestConnection(config.id, e)}
                        disabled={testingId === config.id}
                        style={{ color: '#1890ff' }}
                      />
                    </Tooltip>
                    <Tooltip title="编辑">
                      <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          openModal(config);
                        }}
                      />
                    </Tooltip>
                    {config.id !== activeConfigId && (
                      <Tooltip title="激活">
                        <Button
                          type="text"
                          icon={<CheckCircleOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleActivate(config.id);
                          }}
                          style={{ color: '#52c41a' }}
                        />
                      </Tooltip>
                    )}
                    <Popconfirm
                      title={config.is_active ? "确定要删除当前使用的配置吗？" : "确定要删除这个配置吗？"}
                      description={config.is_active ? "删除后将清空连接池，此操作无法撤销" : "此操作无法撤销"}
                      onConfirm={(e) => {
                        e?.stopPropagation();
                        handleDelete(config.id);
                      }}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Tooltip title={config.is_active ? "删除当前使用的配置" : "删除"}>
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Tooltip>
                    </Popconfirm>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* 配置表单模态框 */}
      <Modal
        title={editingConfig ? '编辑AI模型配置' : '新增AI模型配置'}
        open={modalVisible}
        onCancel={closeModal}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="配置名称"
            rules={[{ required: true, message: '请输入配置名称' }]}
          >
            <Input placeholder="请输入配置名称" />
          </Form.Item>

          <Form.Item
            name="model_provider"
            label="模型提供商"
            rules={[{ required: true, message: '请选择模型提供商' }]}
          >
            <Select placeholder="请选择模型提供商">
              {PROVIDER_OPTIONS.map(provider => (
                <Option key={provider.value} value={provider.value}>
                  {provider.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="model_name"
            label="模型名称"
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input placeholder="例如: gpt-3.5-turbo" />
          </Form.Item>

          <Form.Item
            name="api_key"
            label="API密钥"
            rules={[{ required: true, message: '请输入API密钥' }]}
          >
            <Input.Password placeholder="请输入API密钥" />
          </Form.Item>

          <Form.Item
            name="base_url"
            label="API基础URL"
            rules={[{ required: true, message: '请输入API基础URL' }]}
          >
            <Input placeholder="请输入完整的API基础URL，如：https://api.openai.com/v1" />
          </Form.Item>



          <div style={{
            marginTop: '16px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            <Button
              type="default"
              icon={testingId === -1 ? <Spin size="small" /> : <LinkOutlined />}
              onClick={async () => {
                const values = form.getFieldsValue();
                if (!values.model_provider || !values.model_name || !values.api_key) {
                  message.error('请先填写模型提供商、模型名称和API密钥');
                  return;
                }

                try {
                  setTestingId(-1);
                  const response = await aiModelService.testConnectionWithConfig(values);
                  if (response.success && response.data.success) {
                    message.success(`连接测试成功 (${response.data.response_time_ms}ms)`);
                  } else {
                    message.error(`连接测试失败: ${response.data.message}`);
                  }
                } catch (error: any) {
                  console.error('测试连接失败:', error);
                  const errorMessage = error.response?.data?.detail || '连接测试失败';
                  message.error(errorMessage);
                } finally {
                  setTestingId(null);
                }
              }}
              disabled={testingId === -1}
              style={{ marginBottom: '16px' }}
            >
              测试连接
            </Button>
          </div>

          <Form.Item
            name="description"
            label="配置描述"
          >
            <TextArea rows={3} placeholder="可选，配置描述信息" />
          </Form.Item>

          {editingConfig && (
            <Form.Item
              name="is_enabled"
              label="启用状态"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          )}

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={closeModal}>取消</Button>
              <Button type="primary" htmlType="submit">
                {editingConfig ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AIModelManagePage;
