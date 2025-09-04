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
  Divider
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
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CodingConfigModal: React.FC<CodingConfigModalProps> = ({
  visible,
  onClose,
  onSuccess
}) => {
  const { currentWorkspace } = useWorkspace();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [conditions, setConditions] = useState<Array<{key: string; value: string}>>([]);

  // 迭代选择相关状态
  const [iterations, setIterations] = useState<Array<{id: string; name: string}>>([]);
  const [selectedIteration, setSelectedIteration] = useState<string | undefined>(undefined);
  const [iterationLoading, setIterationLoading] = useState(false);

  // 获取迭代列表
  const fetchIterations = async () => {
    const projectName = form.getFieldValue('project_name');
    if (!projectName) {
      message.warning('请先填写项目名称');
      return;
    }

    setIterationLoading(true);
    try {
      const response = await request.post('/coding-bugs/get-iterations', {
        project_name: projectName
      });

      if (response.data.success) {
        const iterationList = unwrapResponse(response.data) as any[];
        setIterations(iterationList.map(item => ({
          id: item.id,
          name: item.name
        })));
        message.success(`获取到 ${iterationList.length} 个迭代`);
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
        form.setFieldsValue({
          api_token: configData.api_token,
          project_name: configData.project_name,
          api_base_url: configData.api_base_url || 'https://e.coding.net/open-api'
        });
        // 设置conditions
        const syncConditions = configData.sync_conditions || [];
        console.log('加载的同步条件:', syncConditions);

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

  // 保存配置
  const handleSave = async (values: any) => {
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

      const configData = {
        workspace_id: currentWorkspace.id,
        api_token: values.api_token,
        project_name: values.project_name,
        api_base_url: values.api_base_url || 'https://e.coding.net/open-api',
        is_enabled: true, // 固定为启用
        sync_conditions: allConditions,
        selected_iteration: selectedIteration // 保存选中的迭代用于下次加载
      };
      
      let response;
      if (config) {
        // 更新配置
        response = await request.put(`/coding-bugs/config/${currentWorkspace.id}`, configData);
      } else {
        // 创建配置
        response = await request.post('/coding-bugs/config', configData);
      }
      
      if (response.data.success) {
        message.success('配置保存成功');
        onSuccess?.();
        onClose();
      } else {
        message.error(response.data.message || '配置保存失败');
      }
    } catch (error) {
      message.error('配置保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 测试连接
  const handleTest = async () => {
    if (!currentWorkspace?.id) return;
    
    setTestLoading(true);
    try {
      const response = await request.post(`/coding-bugs/config/${currentWorkspace.id}/test`);
      if (response.data.success) {
        message.success('连接测试成功');
      } else {
        message.error(response.data.message || '连接测试失败');
      }
    } catch (error) {
      message.error('连接测试失败');
    } finally {
      setTestLoading(false);
    }
  };

  // 删除配置
  const handleDelete = async () => {
    if (!currentWorkspace?.id || !config) return;
    
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除Coding配置吗？删除后将无法同步缺陷数据。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await request.delete(`/coding-bugs/config/${currentWorkspace.id}`);
          if (response.data.success) {
            message.success('配置删除成功');
            setConfig(null);
            form.resetFields();
            onSuccess?.();
            onClose();
          } else {
            message.error(response.data.message || '配置删除失败');
          }
        } catch (error) {
          message.error('配置删除失败');
        }
      }
    });
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
    if (visible) {
      fetchConfig();
    } else {
      // 关闭时重置状态
      setConditions([]);
      setIterations([]);
      setSelectedIteration(undefined);
    }
  }, [visible, currentWorkspace?.id]);

  // 当配置加载完成且有API Token和项目名称时，自动获取迭代列表
  useEffect(() => {
    if (visible && config && config.api_token && config.project_name) {
      // 延迟一下确保表单已经设置好值
      setTimeout(() => {
        fetchIterations();
      }, 100);
    }
  }, [visible, config]);

  // 当Modal打开且没有conditions时，添加一个空条件
  useEffect(() => {
    if (visible && conditions.length === 0) {
      setConditions([{ key: '', value: '' }]);
    }
  }, [visible, conditions.length]);

  const handleClose = () => {
    form.resetFields();
    setConfig(null);
    setConditions([]);
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
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={700}
      destroyOnClose
    >


      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={{
          api_base_url: 'https://e.coding.net/open-api'
        }}
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

        <Form.Item
          label="API地址"
          name="api_base_url"
          extra="通常使用默认地址即可"
        >
          <Input placeholder="API基础地址" />
        </Form.Item>

        <Divider orientation="left">同步条件配置</Divider>
        <div style={{ marginBottom: 16 }}>
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

          {/* 自定义筛选条件分割提示 */}
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
            style={{ width: '100%' }}
          >
            添加同步条件
          </Button>
        </div>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              保存配置
            </Button>
            {config && (
              <Button onClick={handleTest} loading={testLoading}>
                测试连接
              </Button>
            )}
            {config && (
              <Button danger onClick={handleDelete}>
                删除配置
              </Button>
            )}
            <Button onClick={handleClose}>
              取消
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CodingConfigModal;
