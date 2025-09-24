import React from 'react';
import {
  Modal,
  Progress,
  Steps,
  Card,
  Typography,
  Space,
  Spin,
  Button,
  Alert
} from 'antd';
import {
  LoadingOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { GenerationProgress as ProgressData } from '../../../services/monthlyReportService';

const { Step } = Steps;
const { Title, Text } = Typography;

interface GenerationProgressProps {
  open: boolean;
  onCancel: () => void;
  progress?: ProgressData;
  error?: string;
  onRetry?: () => void;
}

const GenerationProgress: React.FC<GenerationProgressProps> = ({
  open,
  onCancel,
  progress,
  error,
  onRetry
}) => {
  // 步骤配置
  const steps = [
    {
      title: '获取缺陷数据',
      description: '从数据库获取现网问题数据'
    },
    {
      title: '分析问题分类',
      description: '分析问题类型和优先级'
    },
    {
      title: '统计趋势分布',
      description: '统计趋势和模块分布'
    },
    {
      title: 'AI智能分析',
      description: '进行AI智能分析和洞察'
    },
    {
      title: '生成报告',
      description: '整合数据生成最终报告'
    }
  ];

  // 获取步骤状态
  const getStepStatus = (stepIndex: number) => {
    if (!progress) return 'wait';
    
    if (error) {
      return stepIndex < progress.current_step ? 'finish' : 
             stepIndex === progress.current_step ? 'error' : 'wait';
    }
    
    if (stepIndex < progress.current_step) return 'finish';
    if (stepIndex === progress.current_step) return 'process';
    return 'wait';
  };

  // 获取步骤图标
  const getStepIcon = (stepIndex: number) => {
    const status = getStepStatus(stepIndex);
    
    switch (status) {
      case 'finish':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'process':
        return <LoadingOutlined style={{ color: '#1890ff' }} />;
      case 'error':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />;
    }
  };

  // 格式化剩余时间
  const formatRemainingTime = (seconds?: number) => {
    if (!seconds) return '';
    
    if (seconds < 60) {
      return `约 ${seconds} 秒`;
    } else if (seconds < 3600) {
      return `约 ${Math.ceil(seconds / 60)} 分钟`;
    } else {
      return `约 ${Math.ceil(seconds / 3600)} 小时`;
    }
  };

  return (
    <Modal
      title={
        <Space>
          <Spin spinning={!error && progress && progress.progress_percentage < 100} />
          <span>AI月度报告生成中</span>
        </Space>
      }
      open={open}
      onCancel={onCancel}
      width={700}
      footer={[
        error && onRetry && (
          <Button key="retry" type="primary" onClick={onRetry}>
            重试
          </Button>
        ),
        <Button key="cancel" onClick={onCancel}>
          {error || (progress && progress.progress_percentage >= 100) ? '关闭' : '取消'}
        </Button>
      ].filter(Boolean)}
      closable={false}
      maskClosable={false}
    >
      <div style={{ padding: '20px 0' }}>
        {/* 错误提示 */}
        {error && (
          <Alert
            message="生成失败"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        {/* 总体进度 */}
        {progress && !error && (
          <Card style={{ marginBottom: 24 }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Title level={4} style={{ margin: 0 }}>
                {progress.step_name}
              </Title>
              <Text type="secondary">{progress.step_description}</Text>
            </div>
            
            <Progress
              percent={Math.round(progress.progress_percentage)}
              status={progress.progress_percentage >= 100 ? 'success' : 'active'}
              strokeWidth={8}
              style={{ marginBottom: 16 }}
            />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary">
                步骤 {progress.current_step} / {progress.total_steps}
              </Text>
              
              <Space>
                {progress.data_count && (
                  <Text type="secondary">
                    已处理 {progress.data_count} 条数据
                  </Text>
                )}
                
                {progress.estimated_remaining && (
                  <Text type="secondary">
                    剩余时间: {formatRemainingTime(progress.estimated_remaining)}
                  </Text>
                )}
              </Space>
            </div>
          </Card>
        )}

        {/* 详细步骤 */}
        <Card title="生成步骤" size="small">
          <Steps direction="vertical" size="small" current={progress?.current_step || 0}>
            {steps.map((step, index) => (
              <Step
                key={index}
                title={step.title}
                description={step.description}
                status={getStepStatus(index)}
                icon={getStepIcon(index)}
              />
            ))}
          </Steps>
        </Card>

        {/* 完成提示 */}
        {progress && progress.progress_percentage >= 100 && !error && (
          <Alert
            message="报告生成完成"
            description="AI月度分析报告已成功生成，您可以查看详细内容。"
            type="success"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </div>
    </Modal>
  );
};

export default GenerationProgress;
