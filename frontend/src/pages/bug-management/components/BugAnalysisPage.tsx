import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Spin,
  message,
  Typography,
  Space,
  Button,
  Empty
} from 'antd';
import {
  ReloadOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { usePermission } from '../../../contexts/PermissionContext';
import { unwrapResponse } from '../../../utils/request';
import request from '../../../utils/request';
import FilterPanel from './FilterPanel';
import ModuleHealthTree from './ModuleHealthTree';
import BugStatistics from './BugStatistics';
import BugTrendChart from './BugTrendChart';
import AISummarySection from './AISummarySection';
import {
  AnalysisData,
  FilterParams
} from '../../../types/bug-analysis';
import './BugAnalysisPage.css';

const { Title } = Typography;

const BugAnalysisPage: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const { hasPermission } = usePermission();

  // 状态管理
  const [loading, setLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [filters, setFilters] = useState<FilterParams>({});

  // 权限检查
  const canView = hasPermission('/workspaces/bug-management');

  // 获取分析数据
  const fetchAnalysisData = async () => {
    if (!currentWorkspace?.id || !canView) return;

    setLoading(true);
    try {
      const params = {
        workspace_id: currentWorkspace.id,
        module_id: selectedModuleId || undefined,
        start_date: filters.startDate,
        end_date: filters.endDate,
        labels: filters.labels?.join(','),
        priority: filters.priority,
        status: filters.status
      };

      // 移除undefined的参数
      Object.keys(params).forEach(key => {
        if (params[key as keyof typeof params] === undefined) {
          delete params[key as keyof typeof params];
        }
      });

      const response = await request.get('/coding-bugs/module-health-analysis', { params });
      
      if (response.data.success) {
        const data = unwrapResponse(response.data) as AnalysisData;
        setAnalysisData(data);
      } else {
        message.error(response.data.message || '获取分析数据失败');
      }
    } catch (error) {
      message.error('获取分析数据失败');
      console.error('获取分析数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 处理模块选择
  const handleModuleSelect = (moduleId: number | null) => {
    setSelectedModuleId(moduleId);
  };

  // 处理筛选条件变化
  const handleFilterChange = (newFilters: FilterParams) => {
    setFilters(newFilters);
  };

  // 初始化和数据刷新
  useEffect(() => {
    fetchAnalysisData();
  }, [currentWorkspace?.id, selectedModuleId, filters]);

  if (!canView) {
    return (
      <Card>
        <Empty description="您没有权限查看缺陷分析" />
      </Card>
    );
  }

  return (
    <div className="bug-analysis-page">
      <div className="analysis-header">
        <Title level={3}>
          <BarChartOutlined /> 缺陷数据分析
        </Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchAnalysisData}
            loading={loading}
          >
            刷新数据
          </Button>
        </Space>
      </div>

      {/* 筛选条件面板 */}
      <Card className="filter-panel-card" size="small">
        <FilterPanel
          filters={filters}
          onChange={handleFilterChange}
          loading={loading}
        />
      </Card>

      <Spin spinning={loading}>
        {analysisData ? (
          <>
            {/* 组织信息区域 */}
            <Card className="organization-info-card" title="组织信息分析">
              <Row gutter={16}>
                <Col span={8}>
                  <ModuleHealthTree
                    treeData={analysisData.moduleTree}
                    selectedModuleId={selectedModuleId}
                    onSelect={handleModuleSelect}
                  />
                </Col>
                <Col span={16}>
                  <div className="statistics-and-trend">
                    <BugStatistics
                      statistics={analysisData.statistics}
                      selectedModuleId={selectedModuleId}
                    />
                    <div className="trend-chart-container">
                      <BugTrendChart
                        data={analysisData.trendData}
                        loading={loading}
                      />
                    </div>
                  </div>
                </Col>
              </Row>
            </Card>

            {/* AI总结信息区域 */}
            <Card className="ai-summary-card" title="AI分析报告">
              <AISummarySection
                summaries={analysisData.aiSummaries}
              />
            </Card>
          </>
        ) : (
          <Card>
            <Empty description="暂无分析数据" />
          </Card>
        )}
      </Spin>
    </div>
  );
};

export default BugAnalysisPage;
