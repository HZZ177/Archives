import React from 'react';
import {
  Card,
  Steps,
  Typography,
  Space,
  Alert,
  Button
} from 'antd';
import {
  DatabaseOutlined,
  BarChartOutlined,
  LineChartOutlined,
  BulbOutlined,
  FileTextOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { GenerationProgress } from '../../../services/monthlyReportService';

const { Step } = Steps;
const { Title, Text } = Typography;

interface GenerationProgressInlineProps {
  year: number;
  month: number;
  progress?: GenerationProgress;
  error?: string;
  isCompleted?: boolean;
  onViewReport?: () => void;
}

const GenerationProgressInline: React.FC<GenerationProgressInlineProps> = ({
  year,
  month,
  progress,
  error,
  isCompleted = false,
  onViewReport
}) => {

  // 定义生成步骤
  const steps = [
    {
      title: '获取缺陷数据',
      description: '正在从数据库获取现网问题数据...',
      icon: <DatabaseOutlined />
    },
    {
      title: '分析问题分类',
      description: '正在分析问题的类型和优先级...',
      icon: <BarChartOutlined />
    },
    {
      title: '统计趋势分布',
      description: '正在统计趋势和模块分布...',
      icon: <LineChartOutlined />
    },
    {
      title: 'AI智能分析',
      description: '正在进行AI智能分析和洞察...',
      icon: <BulbOutlined />
    },
    {
      title: '生成报告',
      description: '正在生成最终报告...',
      icon: <FileTextOutlined />
    }
  ];

  // 获取步骤状态
  const getStepStatus = (index: number) => {
    console.log(`=== 步骤${index} 状态判断 ===`);
    console.log(`isCompleted: ${isCompleted}`);
    console.log(`error: ${error}`);
    console.log(`progress:`, progress);

    // 如果已完成，所有步骤都显示为完成
    if (isCompleted) {
      console.log(`步骤${index}: finish (全部完成)`);
      return 'finish';
    }

    // 如果有错误信息
    if (error) {
      let failedStepIndex = 3; // 默认AI智能分析失败

      // 情况1: 有进度信息且是失败状态
      if (progress?.step_name === '失败') {
        failedStepIndex = progress.current_step - 1; // 转换为0基索引
        console.log(`后端返回失败状态: failedStepIndex=${failedStepIndex}, current_step=${progress.current_step}`);
      }
      // 情况2: 从错误信息推断失败步骤（无论是否有进度信息）
      else {
        if (error.includes('获取缺陷数据')) {
          failedStepIndex = 0;
        } else if (error.includes('准备分析模板')) {
          failedStepIndex = 1;
        } else if (error.includes('构建分析数据')) {
          failedStepIndex = 2;
        } else if (error.includes('AI智能分析')) {
          failedStepIndex = 3;
        } else if (error.includes('生成报告')) {
          failedStepIndex = 4;
        }
        console.log(`从错误信息推断失败步骤: failedStepIndex=${failedStepIndex}, error=${error}`);
      }

      // 根据失败步骤返回状态
      if (index < failedStepIndex) {
        console.log(`步骤${index}: finish (失败前已完成)`);
        return 'finish';
      } else if (index === failedStepIndex) {
        console.log(`步骤${index}: error (失败步骤)`);
        return 'error';
      } else {
        console.log(`步骤${index}: error (失败后未执行)`);
        return 'error'; // 失败后的步骤也显示为error状态，但用灰色图标
      }
    }

    // 正常进行中的状态处理
    if (!progress) {
      console.log(`步骤${index}: wait (无进度信息)`);
      return 'wait';
    }

    const currentStepIndex = progress.current_step - 1; // 转换为0基索引

    if (index < currentStepIndex) {
      console.log(`步骤${index}: finish (已完成)`);
      return 'finish';
    } else if (index === currentStepIndex) {
      const status = progress.progress_percentage >= 100 ? 'finish' : 'process';
      console.log(`步骤${index}: ${status} (当前步骤)`);
      return status;
    } else {
      console.log(`步骤${index}: wait (等待中)`);
      return 'wait';
    }
  };

  // 获取步骤图标 - 简化版本，让Antd处理对齐
  const getStepIcon = (index: number) => {
    const status = getStepStatus(index);

    console.log(`步骤${index}图标: status=${status}`);

    if (status === 'finish') {
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    } else if (status === 'error') {
      // 如果有错误信息，需要区分是失败步骤还是未执行步骤
      if (error) {
        let failedStepIndex = 3; // 默认AI智能分析失败

        // 确定失败步骤
        if (progress?.step_name === '失败') {
          failedStepIndex = progress.current_step - 1;
        } else {
          if (error.includes('获取缺陷数据')) {
            failedStepIndex = 0;
          } else if (error.includes('准备分析模板')) {
            failedStepIndex = 1;
          } else if (error.includes('构建分析数据')) {
            failedStepIndex = 2;
          } else if (error.includes('AI智能分析')) {
            failedStepIndex = 3;
          } else if (error.includes('生成报告')) {
            failedStepIndex = 4;
          }
        }

        if (index === failedStepIndex) {
          // 失败的步骤：红色x
          return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
        } else {
          // 失败后未执行的步骤：灰色x
          return <CloseCircleOutlined style={{ color: '#d9d9d9' }} />;
        }
      } else {
        // 没有错误信息的error状态，显示红色x
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      }
    } else if (status === 'process') {
      return <LoadingOutlined style={{ color: '#1890ff' }} />;
    } else {
      // 等待状态显示灰色的loading圆圈
      return <LoadingOutlined style={{ color: '#d9d9d9' }} />;
    }
  };

  // 格式化剩余时间
  const formatRemainingTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}秒`;
    } else if (seconds < 3600) {
      return `${Math.round(seconds / 60)}分钟`;
    } else {
      return `${Math.round(seconds / 3600)}小时`;
    }
  };

  return (
    <Card>
      <style>
        {`
          .custom-steps .ant-steps-item-tail::after {
            background-color: #d9d9d9 !important;
          }
          .custom-steps .ant-steps-item-wait .ant-steps-item-tail::after {
            background-color: #d9d9d9 !important;
          }
          .custom-steps .ant-steps-item-process .ant-steps-item-tail::after {
            background-color: #d9d9d9 !important;
          }
          .custom-steps .ant-steps-item-finish .ant-steps-item-tail::after {
            background-color: #d9d9d9 !important;
          }
        `}
      </style>
      <div style={{ padding: '24px' }}>
        {/* 详细步骤时间线 - 放在最上面 */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
          <div style={{ maxWidth: '600px', width: '100%' }}>
            <Title level={4} style={{ marginBottom: 24, textAlign: 'center' }}>
              {isCompleted
                ? `${year}年${month}月分析报告生成完成`
                : `${year}年${month}月分析报告生成中`
              }
            </Title>
            <Steps
              direction="vertical"
              current={-1}  // 不使用Steps的内置current逻辑，完全自定义状态
              size="small"
              className="custom-steps"
            >
              {steps.map((step, index) => {
                const stepStatus = getStepStatus(index);
                console.log(`渲染步骤${index}: status=${stepStatus}, title=${step.title}`);

                // 判断是否是失败后的未执行步骤
                const isSkippedStep = error && stepStatus === 'error' && (() => {
                  let failedStepIndex = 3;
                  if (progress?.step_name === '失败') {
                    failedStepIndex = progress.current_step - 1;
                  } else {
                    if (error.includes('获取缺陷数据')) {
                      failedStepIndex = 0;
                    } else if (error.includes('准备分析模板')) {
                      failedStepIndex = 1;
                    } else if (error.includes('构建分析数据')) {
                      failedStepIndex = 2;
                    } else if (error.includes('AI智能分析')) {
                      failedStepIndex = 3;
                    } else if (error.includes('生成报告')) {
                      failedStepIndex = 4;
                    }
                  }
                  return index > failedStepIndex;
                })();

                return (
                  <Step
                    key={index}
                    title={
                      <span style={{
                        color: isSkippedStep ? '#d9d9d9' : undefined
                      }}>
                        {step.title}
                      </span>
                    }
                    description={
                      <span style={{
                        color: isSkippedStep ? '#d9d9d9' : undefined
                      }}>
                        {stepStatus === 'process' && progress && !isCompleted
                          ? progress.step_description
                          : stepStatus === 'error' && error && !isSkippedStep
                            ? (() => {
                                // 根据失败步骤显示具体的失败原因
                                let failedStepIndex = 3;
                                if (progress?.step_name === '失败') {
                                  failedStepIndex = progress.current_step - 1;
                                } else {
                                  if (error.includes('获取缺陷数据')) {
                                    failedStepIndex = 0;
                                  } else if (error.includes('准备分析模板')) {
                                    failedStepIndex = 1;
                                  } else if (error.includes('构建分析数据')) {
                                    failedStepIndex = 2;
                                  } else if (error.includes('AI智能分析')) {
                                    failedStepIndex = 3;
                                  } else if (error.includes('生成报告')) {
                                    failedStepIndex = 4;
                                  }
                                }

                                if (index === failedStepIndex) {
                                  // 直接使用原始错误信息，去掉"生成失败: "前缀
                                  const cleanError = error.replace('生成失败: ', '');
                                  // 如果错误信息太长，截取前60个字符
                                  return cleanError.length > 60 ? cleanError.substring(0, 60) + '...' : cleanError;
                                }
                                return step.description;
                              })()
                            : isSkippedStep
                              ? '因前面步骤失败而跳过'
                              : step.description
                        }
                      </span>
                    }
                    status={stepStatus}
                    icon={getStepIcon(index)}
                  />
                );
              })}
            </Steps>
          </div>
        </div>

        {/* 完成状态的操作区域 */}
        {isCompleted && (
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <Space direction="vertical" size="middle">
              <Text type="secondary" style={{ fontSize: '16px' }}>
                AI已完成智能分析，点击下方按钮查看详细报告
              </Text>
              {onViewReport && (
                <Button
                  type="primary"
                  size="large"
                  icon={<EyeOutlined />}
                  onClick={onViewReport}
                >
                  查看报告
                </Button>
              )}
            </Space>
          </div>
        )}

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

        {/* 进度信息 - 仅在生成中且有进度数据时显示 */}
        {progress && !isCompleted && !error && (
          <div style={{ textAlign: 'center', marginTop: '24px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <Space direction="vertical" size="small">
              <Text type="secondary" style={{ fontSize: '14px' }}>
                当前步骤: {progress.step_name}
              </Text>
              {progress.data_count && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  已处理 {progress.data_count} 条数据
                </Text>
              )}
              {progress.estimated_remaining && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  预计剩余时间: {formatRemainingTime(progress.estimated_remaining)}
                </Text>
              )}
            </Space>
          </div>
        )}
      </div>
    </Card>
  );
};

export default GenerationProgressInline;
