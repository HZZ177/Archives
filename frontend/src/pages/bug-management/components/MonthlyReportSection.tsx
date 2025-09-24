import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Button,
  DatePicker,
  Space,
  message,
  Spin,
  Empty,
  List,
  Tag,
  Typography,
  Row,
  Col,
  Tooltip,
  Modal,
  Popconfirm
} from 'antd';
import {
  RobotOutlined,
  EditOutlined,
  CalendarOutlined,
  ReloadOutlined,
  DownloadOutlined,
  HistoryOutlined,
  DeleteOutlined,
  EyeOutlined
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { monthlyReportService, MonthlyReport, GenerationProgress as ProgressData } from '../../../services/monthlyReportService';
import PromptEditor from './PromptEditor';
import GenerationProgressInline from './GenerationProgressInline';
import ReportViewer from './ReportViewer';

const { Title, Text } = Typography;

const MonthlyReportSection: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs().subtract(1, 'month'));
  const [currentReport, setCurrentReport] = useState<MonthlyReport | null>(null);
  const [reportHistory, setReportHistory] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [promptEditorVisible, setPromptEditorVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [generationProgress, setGenerationProgress] = useState<ProgressData | undefined>();
  const [generationError, setGenerationError] = useState<string>('');
  const [showReportContent, setShowReportContent] = useState(false); // 控制是否显示报告内容
  const cancelPollingRef = useRef<(() => void) | null>(null); // 使用ref存储轮询取消函数

  // 加载指定月份的报告
  const loadReport = async (year: number, month: number) => {
    if (!currentWorkspace) return;

    setLoading(true);
    try {
      const response = await monthlyReportService.getReportByMonth(
        currentWorkspace.id, year, month
      );
      if (response.success) {
        // response.data 可能为 null，这是正常情况
        setCurrentReport(response.data);

        // 如果是已完成的报告，直接显示内容
        if (response.data && response.data.status === 'completed') {
          setShowReportContent(true);
        }

        // 如果报告正在生成中，需要恢复进度状态并重新启动轮询
        if (response.data && response.data.status === 'generating') {
          await restoreGenerationProgress(response.data.id);
        }
      } else {
        setCurrentReport(null);
      }
    } catch (error) {
      // 网络错误或其他异常
      console.error('加载报告失败:', error);
      setCurrentReport(null);
    } finally {
      setLoading(false);
    }
  };

  // 恢复生成进度状态
  const restoreGenerationProgress = async (reportId: number) => {
    try {
      // 获取当前进度
      const progressResponse = await monthlyReportService.getGenerationProgress(reportId);
      if (progressResponse.success && progressResponse.data) {
        setGenerationProgress(progressResponse.data);
        setGenerating(true);

        // 重新启动轮询，传入当前进度作为初始步骤
        const cancelFn = await monthlyReportService.pollGenerationProgress(
          reportId,
          (progress) => {
            setGenerationProgress(progress);
          },
          (report) => {
            // 生成完成
            setGenerationProgress(undefined);
            setCurrentReport({
              ...report,
              status: 'completed_waiting'
            });
            setGenerating(false);
            cancelPollingRef.current = null;
            message.success('报告生成完成');
            loadReportHistory();
          },
          (error) => {
            setGenerationError(error);
            setGenerating(false);
            cancelPollingRef.current = null;

            // 更新报告状态为失败
            if (currentReport) {
              setCurrentReport({
                ...currentReport,
                status: 'failed',
                error_message: error
              });
            }
            message.error(`报告生成失败: ${error}`);
          },
          1500, // interval
          progressResponse.data.current_step // 传入当前步骤作为初始步骤
        );
        cancelPollingRef.current = cancelFn;
      }
    } catch (error) {
      console.error('恢复生成进度失败:', error);
    }
  };

  // 加载报告历史
  const loadReportHistory = async () => {
    if (!currentWorkspace) return;

    try {
      const response = await monthlyReportService.getReportHistory(currentWorkspace.id);
      if (response.success && response.data) {
        setReportHistory(response.data);
      } else {
        setReportHistory([]);
      }
    } catch (error) {
      message.error('加载报告历史失败');
      setReportHistory([]);
    }
  };

  // 生成报告
  const handleGenerateReport = async () => {
    if (!currentWorkspace) return;

    const year = selectedDate.year();
    const month = selectedDate.month() + 1;

    // 如果已有正在生成的报告，提示用户
    if (currentReport && currentReport.status === 'generating') {
      message.warning('该月份报告正在生成中，请稍后再试');
      return;
    }

    // 如果已有完成的报告，询问是否生成新的
    if (currentReport && currentReport.status === 'completed') {
      Modal.confirm({
        title: '生成新报告',
        content: `${year}年${month}月已有报告，是否生成新的报告？新报告不会覆盖现有报告。`,
        okText: '生成新报告',
        cancelText: '取消',
        onOk: () => performGeneration()
      });
      return;
    }

    performGeneration();

    async function performGeneration() {
      try {
        setGenerating(true);
        setGenerationError('');

        const response = await monthlyReportService.generateReport({
          workspace_id: currentWorkspace!.id,
          year,
          month,
          prompt_template: currentPrompt || undefined
        });

        if (response.success && response.data) {
          message.success('报告生成已启动');
          // 设置当前报告为生成中状态，这样主区域会显示进度
          setCurrentReport({
            ...response.data,
            status: 'generating'
          });

          // 开始轮询进度
          const cancelFn = await monthlyReportService.pollGenerationProgress(
            response.data.id,
            (progress) => {
              setGenerationProgress(progress);
            },
            (report) => {
              // 生成完成，但不自动切换到报告展示
              setGenerationProgress(undefined);
              setCurrentReport({
                ...report,
                status: 'completed_waiting' // 自定义状态：完成但等待用户查看
              });
              setGenerating(false);
              cancelPollingRef.current = null;
              message.success('报告生成完成');
              loadReportHistory();
            },
            (error) => {
              setGenerationError(error);
              setGenerating(false);
              cancelPollingRef.current = null;
              // 不要清空进度，保持最后的进度状态用于显示失败位置
              // setGenerationProgress(undefined);

              // 更新报告状态为失败
              if (currentReport) {
                setCurrentReport({
                  ...currentReport,
                  status: 'failed',
                  error_message: error
                });
              }
              message.error(`报告生成失败: ${error}`);
            }
          );
          cancelPollingRef.current = cancelFn;
        } else {
          message.error('启动报告生成失败');
          setGenerating(false);
        }
      } catch (error: any) {
        setGenerating(false);
        message.error(error.response?.data?.detail || '启动报告生成失败');
      }
    }
  };



  // 查看当前报告内容
  const handleViewCurrentReport = () => {
    if (currentReport && currentReport.report_data) {
      setShowReportContent(true);
      // 将状态改为正常的completed
      setCurrentReport({
        ...currentReport,
        status: 'completed'
      });
    }
  };

  // 查看报告（用于历史报告列表）
  const handleViewReport = (report: MonthlyReport) => {
    if (report && report.report_data) {
      // 切换到对应的月份并设置为当前报告
      setSelectedDate(dayjs().year(report.year).month(report.month - 1));
      setCurrentReport(report);
      setShowReportContent(true); // 直接显示报告内容
      setHistoryVisible(false);
    } else {
      message.warning('报告数据不完整');
    }
  };

  // 删除报告
  const handleDeleteReport = async (reportId: number) => {
    try {
      const response = await monthlyReportService.deleteReport(reportId);
      if (response.success) {
        message.success('删除报告成功');
        if (currentReport && currentReport.id === reportId) {
          setCurrentReport(null);
        }
        loadReportHistory();
      }
    } catch (error: any) {
      message.error(error.response?.data?.detail || '删除报告失败');
    }
  };

  // 导出报告
  const handleExportReport = () => {
    if (!currentReport || !currentReport.report_data) {
      message.warning('没有可导出的报告数据');
      return;
    }

    // 简单的导出实现
    const reportContent = JSON.stringify(currentReport.report_data, null, 2);
    const blob = new Blob([reportContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `月度报告_${currentReport.year}年${currentReport.month}月.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    message.success('报告已导出');
  };

  // 获取报告状态标签
  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      'draft': { color: 'default', text: '草稿' },
      'generating': { color: 'processing', text: '生成中' },
      'completed': { color: 'success', text: '已完成' },
      'failed': { color: 'error', text: '失败' }
    };
    
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 监听日期变化
  useEffect(() => {
    const year = selectedDate.year();
    const month = selectedDate.month() + 1;

    // 取消之前的轮询
    if (cancelPollingRef.current) {
      cancelPollingRef.current();
      cancelPollingRef.current = null;
    }

    // 重置所有相关状态
    setShowReportContent(false);
    setGenerationProgress(undefined);
    setGenerationError('');
    setGenerating(false);

    loadReport(year, month);
  }, [selectedDate, currentWorkspace]); // 移除cancelPolling依赖，避免无限循环

  // 组件卸载时清理轮询
  useEffect(() => {
    return () => {
      if (cancelPollingRef.current) {
        cancelPollingRef.current();
      }
    };
  }, []); // 只在组件挂载时设置清理函数

  // 加载默认智能体配置
  const loadDefaultPrompt = async () => {
    if (!currentWorkspace) return;

    try {
      // 获取工作区默认模板
      const defaultTemplateResponse = await monthlyReportService.getWorkspaceDefaultTemplate(currentWorkspace.id);

      if (defaultTemplateResponse.success && defaultTemplateResponse.data) {
        // 获取模板列表
        const templatesResponse = await monthlyReportService.getPromptTemplates(currentWorkspace.id);

        if (templatesResponse.success && templatesResponse.data) {
          const defaultTemplate = templatesResponse.data.find(t => t.id === defaultTemplateResponse.data);
          if (defaultTemplate && defaultTemplate.template_content) {
            setCurrentPrompt(defaultTemplate.template_content);
          }
        }
      }
    } catch (error) {
      console.error('加载默认智能体配置失败:', error);
    }
  };

  // 监听历史报告弹窗状态，打开时刷新数据
  useEffect(() => {
    if (historyVisible) {
      loadReportHistory();
    }
  }, [historyVisible, currentWorkspace]);

  // 初始加载
  useEffect(() => {
    loadReportHistory();
    loadDefaultPrompt();
  }, [currentWorkspace]);

  if (!currentWorkspace) {
    return <Empty description="请先选择工作区" />;
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面头部 */}
      <Card style={{ marginBottom: '24px' }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space size="large">
              <div>
                <RobotOutlined style={{ fontSize: '24px', color: '#1890ff', marginRight: '8px' }} />
                <Title level={3} style={{ display: 'inline', margin: 0 }}>
                  AI月度缺陷分析报告
                </Title>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <DatePicker
                picker="month"
                value={selectedDate}
                onChange={(date) => date && setSelectedDate(date)}
                format="YYYY年MM月"
                placeholder="选择月份"
                allowClear={false}
              />

              <Tooltip title="配置智能体">
                <Button
                  icon={<EditOutlined />}
                  onClick={() => {
                    setPromptEditorVisible(true);
                    // 如果当前没有配置，尝试加载默认配置
                    if (!currentPrompt) {
                      loadDefaultPrompt();
                    }
                  }}
                >
                  配置智能体
                </Button>
              </Tooltip>

              <Button
                type="primary"
                icon={<RobotOutlined />}
                loading={generating}
                onClick={() => handleGenerateReport()}
                disabled={loading}
              >
                生成新报告
              </Button>

              {currentReport && currentReport.status === 'completed' && (
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleExportReport}
                >
                  导出
                </Button>
              )}
              
              <Button
                icon={<HistoryOutlined />}
                onClick={() => setHistoryVisible(true)}
              >
                历史报告
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 报告内容区域 */}
      <Spin spinning={loading}>
        {currentReport ? (
          <>
            {/* 报告内容展示 */}
            {currentReport.status === 'completed' && currentReport.report_data && showReportContent && (
              <ReportViewer
                reportData={currentReport.report_data}
                year={currentReport.year}
                month={currentReport.month}
              />
            )}

            {/* 生成中状态 - 显示进度时间线 */}
            {(currentReport.status === 'generating' || currentReport.status === 'completed_waiting') && (
              <GenerationProgressInline
                year={currentReport.year}
                month={currentReport.month}
                progress={generationProgress}
                error={generationError}
                isCompleted={currentReport.status === 'completed_waiting'}
                onViewReport={handleViewCurrentReport}
              />
            )}

            {/* 生成失败状态 - 也显示进度时间线，但标记为失败 */}
            {currentReport.status === 'failed' && (
              <GenerationProgressInline
                year={currentReport.year}
                month={currentReport.month}
                progress={generationProgress}
                error={currentReport.error_message || generationError || '生成失败'}
                isCompleted={false}
                onViewReport={undefined}
              />
            )}
          </>
        ) : (
          <Card>
            <Empty
              image={<RobotOutlined style={{ fontSize: '64px', color: '#d9d9d9' }} />}
              description={
                <div>
                  <Text type="secondary" style={{ fontSize: '16px' }}>
                    {selectedDate.format('YYYY年MM月')}的分析报告尚未生成
                  </Text>
                  <br />
                  <Text type="secondary">
                    点击"生成新报告"开始AI智能分析
                  </Text>
                </div>
              }
            />
          </Card>
        )}
      </Spin>

      {/* 提示词编辑器 */}
      <PromptEditor
        open={promptEditorVisible}
        onClose={() => setPromptEditorVisible(false)}
        workspaceId={currentWorkspace.id}
        onTemplateSelect={setCurrentPrompt}
        currentTemplate={currentPrompt}
      />





      {/* 历史报告弹窗 */}
      <Modal
        title="历史报告"
        open={historyVisible}
        onCancel={() => setHistoryVisible(false)}
        width={800}
        footer={null}
        style={{ maxHeight: '90vh' }}
        styles={{
          body: {
            maxHeight: '70vh',
            overflowY: 'auto',
            padding: '16px'
          }
        }}
      >
        <List
          dataSource={reportHistory}
          renderItem={(report) => (
            <List.Item
              actions={[
                <Button
                  key="view"
                  type="text"
                  icon={<EyeOutlined />}
                  onClick={() => handleViewReport(report)}
                  disabled={report.status !== 'completed'}
                >
                  查看
                </Button>,
                <Button
                  key="regenerate"
                  type="text"
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    setSelectedDate(dayjs().year(report.year).month(report.month - 1));
                    setHistoryVisible(false);
                    setTimeout(() => handleGenerateReport(), 100);
                  }}
                >
                  重新生成
                </Button>,
                <Popconfirm
                  key="delete"
                  title="确定要删除这个报告吗？"
                  onConfirm={() => handleDeleteReport(report.id)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                  >
                    删除
                  </Button>
                </Popconfirm>
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <span>{report.year}年{report.month}月</span>
                    {getStatusTag(report.status)}
                  </Space>
                }
                description={
                  <div>
                    <Text type="secondary">
                      创建时间: {new Date(report.created_at).toLocaleString()}
                    </Text>
                    {report.error_message && (
                      <div>
                        <Text type="danger">错误: {report.error_message}</Text>
                      </div>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
};

export default MonthlyReportSection;
