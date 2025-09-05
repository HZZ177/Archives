// 缺陷分析相关的类型定义

export interface ModuleTreeNode {
  id: number;
  name: string;
  isContentPage: boolean;
  healthScore: number;
  bugCount: number;
  children?: ModuleTreeNode[];
}

export interface ModuleStats {
  totalBugs: number;
  newBugs: number;
  resolvedBugs: number;
  pendingBugs: number;
  priorityDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
}

export interface TrendDataPoint {
  date: string;
  totalBugs: number;
  newBugs: number;
  resolvedBugs: number;
  pendingBugs: number;
}

export interface AISummary {
  month: string;
  title: string;
  summary: string;
  keyPoints: string[];
  status: string;
}

export interface AnalysisData {
  moduleTree: ModuleTreeNode[];
  statistics: ModuleStats;
  trendData: TrendDataPoint[];
  aiSummaries: AISummary[];
  selectedModuleId?: number;
}

export interface FilterParams {
  startDate?: string;
  endDate?: string;
  labels?: string[];
  priority?: string;
  status?: string;
}

// 图表数据类型
export interface ChartDataPoint {
  date: string;
  type: string;
  value: number;
  category: string;
}

// 健康分等级
export type HealthScoreLevel = 'excellent' | 'good' | 'warning' | 'danger';

export interface HealthScoreStyle {
  className: HealthScoreLevel;
  text: string;
}
