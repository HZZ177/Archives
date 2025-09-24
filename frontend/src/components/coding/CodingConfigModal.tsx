import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Space,
  message,
  Alert,
  Select,
  Row,
  Col,
  Divider,
  Steps,
  Spin,
  Typography
} from 'antd';
import {
  ApiOutlined,
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { unwrapResponse } from '../../utils/request';
import request from '../../utils/request';



interface CodingConfigModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CodingConfigModal: React.FC<CodingConfigModalProps> = ({
  open,
  onClose,
  onSuccess
}) => {
  const { currentWorkspace } = useWorkspace();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [conditions, setConditions] = useState<Array<{key: string; value: string}>>([]);

  // 步骤相关状态
  const [currentStep, setCurrentStep] = useState(0);
  const [step1Loading, setStep1Loading] = useState(false);

  // 迭代选择相关状态
  const [iterations, setIterations] = useState<Array<{id: string; name: string}>>([]);
  const [selectedIteration, setSelectedIteration] = useState<string | undefined>(undefined);
  const [iterationLoading, setIterationLoading] = useState(false);

  // 第一步：保存基础配置
  const handleStep1Next = async () => {
    try {
      const values = await form.validateFields(['api_token', 'project_name']);
      setStep1Loading(true);

      const configData = {
        workspace_id: currentWorkspace!.id,
        api_token: values.api_token,
        project_name: values.project_name,
        is_enabled: true
      };

      const response = await request.post('/coding-bugs/config', configData);
      if (response.data.success) {
        message.success('基础配置保存成功');
        setCurrentStep(1);
        // 进入第二步后自动获取迭代数据
        await fetchIterations();
      } else {
        message.error(response.data.message || '保存配置失败');
      }
    } catch (error: any) {
      if (error.errorFields) {
        message.error('请填写完整的配置信息');
      } else {
        console.error('保存配置失败:', error);
        // 显示详细的错误信息
        const errorMessage = error.response?.data?.message || error.message || '保存配置失败';
        message.error(errorMessage);
      }
    } finally {
      setStep1Loading(false);
    }
  };

  // 获取迭代列表（基于已保存的配置）
  const fetchIterations = async () => {
    if (!currentWorkspace?.id) return;

    setIterationLoading(true);
    try {
      const response = await request.get(`/coding-bugs/iterations/${currentWorkspace.id}`);

      if (response.data.success) {
        const iterationList = unwrapResponse(response.data) as any[];
        setIterations(iterationList.map(item => ({
          id: item.id,
          name: item.name
        })));
        // 后端已经返回成功消息，这里不再重复显示
      } else {
        message.error(response.data.message || '获取迭代列表失败');
      }
    } catch (error) {
      message.error('获取迭代列表失败');
      console.error('获取迭代列表失败:', error);
    } finally {
      setIterationLoading(false);
    }
  };

  // 获取现有配置
  const fetchConfig = async () => {
    if (!currentWorkspace?.id) return;

    try {
      const response = await request.get(`/coding-bugs/config/${currentWorkspace.id}`);
      if (response.data.success) {
        const configData = unwrapResponse(response.data) as any;
        setConfig(configData);

        // 始终从第一步开始，但填充已有的配置数据
        form.setFieldsValue({
          api_token: configData.api_token,
          project_name: configData.project_name
        });
        // 设置conditions
        const syncConditions = configData.sync_conditions || [];

        // 过滤掉ITERATION条件，因为它由迭代选择器管理
        const filteredConditions = syncConditions.filter((c: any) => c.key !== 'ITERATION');
        setConditions(filteredConditions);

        // 恢复迭代选择
        const iterationCondition = syncConditions.find((c: any) => c.key === 'ITERATION');
        if (iterationCondition) {
          setSelectedIteration(iterationCondition.value);
        }

        // 恢复保存的迭代选择
        if (configData.selected_iteration) {
          setSelectedIteration(configData.selected_iteration);
        }
      }
    } catch (error) {
      console.error('获取Coding配置失败:', error);
    }
  };

  // 第二步：保存同步条件配置
  const handleStep2Save = async () => {
    if (!currentWorkspace?.id) return;

    setLoading(true);
    try {
      // 构建同步条件，包含迭代选择
      const allConditions = [...conditions.filter(c => c.key && c.value)];

      // 如果选择了迭代，添加到条件中
      if (selectedIteration) {
        // 移除已存在的ITERATION条件
        const filteredConditions = allConditions.filter(c => c.key !== 'ITERATION');
        filteredConditions.push({
          key: 'ITERATION',
          value: selectedIteration
        });
        allConditions.splice(0, allConditions.length, ...filteredConditions);
      }

      // 更新配置（只更新同步条件部分）
      const updateData = {
        sync_conditions: allConditions,
        selected_iteration: selectedIteration
      };

      const response = await request.put(`/coding-bugs/config/${currentWorkspace.id}`, updateData);
      if (response.data.success) {
        message.success('同步条件配置保存成功');
        onSuccess?.();
        onClose();
      } else {
        message.error(response.data.message || '保存配置失败');
      }
    } catch (error: any) {
      console.error('保存配置失败:', error);
      // 显示详细的错误信息
      const errorMessage = error.response?.data?.message || error.message || '保存配置失败';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 返回上一步
  const handlePrevStep = () => {
    setCurrentStep(0);
  };



  // 添加条件
  const addCondition = () => {
    setConditions([...conditions, { key: '', value: '' }]);
  };

  // 删除条件
  const removeCondition = (index: number) => {
    const newConditions = conditions.filter((_, i) => i !== index);
    setConditions(newConditions);
  };

  // 更新条件
  const updateCondition = (index: number, field: 'key' | 'value', value: string) => {
    const newConditions = [...conditions];
    newConditions[index][field] = value;
    setConditions(newConditions);
  };

  useEffect(() => {
    if (open) {
      fetchConfig();
    } else {
      // 关闭时重置状态
      setConditions([]);
      setIterations([]);
      setSelectedIteration(undefined);
    }
  }, [open, currentWorkspace?.id]);

  // 当配置加载完成且有API Token和项目名称时，自动获取迭代列表
  useEffect(() => {
    if (open && config && config.api_token && config.project_name) {
      // 延迟一下确保表单已经设置好值
      setTimeout(() => {
        fetchIterations();
      }, 100);
    }
  }, [open, config]);

  // 当Modal打开且没有conditions时，添加一个空条件
  useEffect(() => {
    if (open && conditions.length === 0) {
      setConditions([{ key: '', value: '' }]);
    }
  }, [open, conditions.length]);

  const handleClose = () => {
    setCurrentStep(0);
    setConfig(null);
    setConditions([]);
    setSelectedIteration(undefined);
    setIterations([]);
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={
        <Space>
          <ApiOutlined />
          <span>Coding同步配置</span>
        </Space>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width={800}
      destroyOnClose
    >
      {/* 步骤指示器 */}
      <div style={{ maxWidth: 600, margin: '0 auto', marginBottom: 24 }}>
        <style>
          {`
            .custom-steps .ant-steps-item-description {
              max-width: 180px !important;
              white-space: nowrap !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
            }
          `}
        </style>
        <Steps
          current={currentStep}
          className="custom-steps"
          items={[
            {
              title: '基础配置',
              description: '配置API Token和项目名称'
            },
            {
              title: '同步条件',
              description: '配置迭代选择和同步规则'
            }
          ]}
        />
      </div>

      {/* 第一步：基础配置 */}
      {currentStep === 0 && (
        <div>
          <Typography.Title level={5} style={{ marginBottom: 16 }}>
            配置Coding API连接信息
          </Typography.Title>
          <Form
            form={form}
            layout="vertical"
          >
            <Form.Item
              label="API Token"
              name="api_token"
              rules={[{ required: true, message: '请输入Coding API Token' }]}
              extra="在Coding平台的个人设置 > 访问令牌中生成"
            >
              <Input.Password placeholder="请输入Coding API Token" />
            </Form.Item>

            <Form.Item
              label="项目名称"
              name="project_name"
              rules={[{ required: true, message: '请输入Coding项目名称' }]}
              extra="Coding平台中的项目名称，用于获取该项目的缺陷数据"
            >
              <Input placeholder="请输入Coding项目名称" />
            </Form.Item>

            <div style={{ textAlign: 'right', marginTop: 24 }}>
              <Space>
                <Button onClick={handleClose}>
                  取消
                </Button>
                <Button type="primary" loading={step1Loading} onClick={handleStep1Next}>
                  下一步
                </Button>
              </Space>
            </div>
          </Form>
        </div>
      )}

      {/* 第二步：同步条件配置 */}
      {currentStep === 1 && (
        <div>
          <Typography.Title level={5} style={{ marginBottom: 16 }}>
            配置同步条件和规则
          </Typography.Title>
          <Alert
            description={
              <span>
                配置查询条件筛选缺陷。可以选择迭代或手动配置其他条件如LABEL（标签）、STATUS（状态）。
                <a href="https://coding.net/help/openapi#/operations/DescribeIssueList" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8 }}>
                  查看API文档
                </a>
                （请求体里的Conditions里的key都可选）
              </span>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          {/* 迭代选择 */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              迭代选择：
            </label>
            <Row gutter={8}>
              <Col span={20}>
                <Select
                  placeholder="选择迭代（可选）"
                  value={selectedIteration}
                  onChange={setSelectedIteration}
                  allowClear
                  showSearch
                  filterOption={(input, option) => {
                    if (!option?.label) return false;
                    return String(option.label).toLowerCase().includes(input.toLowerCase());
                  }}
                  style={{ width: '100%' }}
                  loading={iterationLoading}
                  notFoundContent={iterationLoading ? '加载中...' : '暂无迭代数据'}
                >
                  {iterations.map(iteration => (
                    <Select.Option key={iteration.id} value={iteration.id} label={iteration.name}>
                      {iteration.name}
                    </Select.Option>
                  ))}
                </Select>
              </Col>
              <Col span={4}>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={fetchIterations}
                  loading={iterationLoading}
                  title="刷新迭代列表"
                />
              </Col>
            </Row>
          </div>

          {/* 自定义筛选条件 */}
          <div style={{ marginBottom: 16, marginTop: 8 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              自定义筛选条件：
            </label>
          </div>

          {conditions.map((condition, index) => (
            <Row key={index} gutter={8} style={{ marginBottom: 8 }}>
              <Col span={8}>
                <Input
                  placeholder="条件名称 (如: LABEL, STATUS)"
                  value={condition.key}
                  onChange={(e) => updateCondition(index, 'key', e.target.value)}
                />
              </Col>
              <Col span={12}>
                <Input
                  placeholder="条件值 (如: 标签名称或状态值)"
                  value={condition.value}
                  onChange={(e) => updateCondition(index, 'value', e.target.value)}
                />
              </Col>
              <Col span={4}>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeCondition(index)}
                />
              </Col>
            </Row>
          ))}

          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={addCondition}
            style={{ width: '100%', marginBottom: 24 }}
          >
            添加同步条件
          </Button>

          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={handlePrevStep}>
                上一步
              </Button>
              <Button onClick={handleClose}>
                取消
              </Button>
              <Button type="primary" loading={loading} onClick={handleStep2Save}>
                完成配置
              </Button>
            </Space>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default CodingConfigModal;
