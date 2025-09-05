import React, { useState, useEffect } from 'react';
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
import GenerationProgress from './GenerationProgress';
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
  const [progressVisible, setProgressVisible] = useState(false);
  const [reportViewerVisible, setReportViewerVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [generationProgress, setGenerationProgress] = useState<ProgressData | undefined>();
  const [generationError, setGenerationError] = useState<string>('');

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

    // 如果已有报告，询问是否生成新的
    if (currentReport && currentReport.status === 'completed') {
      Modal.confirm({
        title: '生成新报告',
        content: `${year}年${month}月已有报告，是否生成新的报告？`,
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
          setProgressVisible(true);

          // 开始轮询进度
          monthlyReportService.pollGenerationProgress(
            response.data.id,
            (progress) => {
              setGenerationProgress(progress);
            },
            (report) => {
              setGenerationProgress(undefined);
              setCurrentReport(report);
              setProgressVisible(false);
              setGenerating(false);
              message.success('报告生成完成');
              loadReportHistory();
            },
            (error) => {
              setGenerationError(error);
              setGenerating(false);
            }
          );
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

  // 重试生成
  const handleRetryGeneration = () => {
    setGenerationError('');
    setProgressVisible(false);
    handleGenerateReport();
  };

  // 查看报告
  const handleViewReport = (report?: MonthlyReport) => {
    const targetReport = report || currentReport;
    if (targetReport && targetReport.report_data) {
      setCurrentReport(targetReport);
      setReportViewerVisible(true);
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
    loadReport(year, month);
  }, [selectedDate, currentWorkspace]);

  // 初始加载
  useEffect(() => {
    loadReportHistory();
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
              <Tooltip title="编辑提示词">
                <Button
                  icon={<EditOutlined />}
                  onClick={() => setPromptEditorVisible(true)}
                >
                  编辑提示词
                </Button>
              </Tooltip>
              
              <DatePicker
                picker="month"
                value={selectedDate}
                onChange={(date) => date && setSelectedDate(date)}
                format="YYYY年MM月"
                placeholder="选择月份"
                allowClear={false}
              />
              
              <Button
                type="primary"
                icon={<RobotOutlined />}
                loading={generating}
                onClick={() => handleGenerateReport()}
                disabled={loading}
              >
                生成报告
              </Button>

              {currentReport && (
                <>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => handleGenerateReport()}
                    loading={generating}
                  >
                    生成新报告
                  </Button>
                  
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleExportReport}
                  >
                    导出
                  </Button>
                </>
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
          <Card>
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Space direction="vertical" size="large">
                <div>
                  <CalendarOutlined style={{ fontSize: '48px', color: '#52c41a', marginBottom: '16px' }} />
                  <Title level={2}>
                    {currentReport.year}年{currentReport.month}月分析报告
                  </Title>
                  {getStatusTag(currentReport.status)}
                </div>

                {currentReport.status === 'completed' && currentReport.report_data && (
                  <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                      报告生成时间: {currentReport.report_data.generation_metadata.generated_at ?
                        new Date(currentReport.report_data.generation_metadata.generated_at).toLocaleString() : ''}
                    </Text>
                    <Button
                      type="primary"
                      size="large"
                      icon={<EyeOutlined />}
                      onClick={() => handleViewReport()}
                    >
                      查看完整报告
                    </Button>
                  </div>
                )}

                {currentReport.status === 'failed' && (
                  <div>
                    <Text type="danger" style={{ display: 'block', marginBottom: '16px' }}>
                      生成失败: {currentReport.error_message}
                    </Text>
                    <Button
                      type="primary"
                      icon={<ReloadOutlined />}
                      onClick={() => handleGenerateReport()}
                    >
                      生成新报告
                    </Button>
                  </div>
                )}
              </Space>
            </div>
          </Card>
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
                    点击"生成报告"开始AI智能分析
                  </Text>
                </div>
              }
            >
              <Button
                type="primary"
                size="large"
                icon={<RobotOutlined />}
                onClick={() => handleGenerateReport()}
                loading={generating}
              >
                生成AI分析报告
              </Button>
            </Empty>
          </Card>
        )}
      </Spin>

      {/* 提示词编辑器 */}
      <PromptEditor
        visible={promptEditorVisible}
        onClose={() => setPromptEditorVisible(false)}
        workspaceId={currentWorkspace.id}
        onTemplateSelect={setCurrentPrompt}
        currentTemplate={currentPrompt}
      />

      {/* 生成进度弹窗 */}
      <GenerationProgress
        visible={progressVisible}
        onCancel={() => {
          setProgressVisible(false);
          setGenerating(false);
        }}
        progress={generationProgress}
        error={generationError}
        onRetry={handleRetryGeneration}
      />

      {/* 报告查看器 */}
      {currentReport && currentReport.report_data && (
        <Modal
          title={`${currentReport.year}年${currentReport.month}月分析报告`}
          open={reportViewerVisible}
          onCancel={() => setReportViewerVisible(false)}
          width="90%"
          style={{ top: 20 }}
          footer={null}
        >
          <ReportViewer
            reportData={currentReport.report_data}
            year={currentReport.year}
            month={currentReport.month}
          />
        </Modal>
      )}

      {/* 历史报告弹窗 */}
      <Modal
        title="历史报告"
        open={historyVisible}
        onCancel={() => setHistoryVisible(false)}
        width={800}
        footer={null}
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
                  onClick={() => {
                    setHistoryVisible(false);
                    handleViewReport(report);
                  }}
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
