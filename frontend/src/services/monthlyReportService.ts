import request from '../utils/request';
import { APIResponse } from '../types/api';

// 类型定义
export interface GenerationProgress {
  current_step: number;
  total_steps: number;
  step_name: string;
  step_description: string;
  progress_percentage: number;
  data_count?: number;
  estimated_remaining?: number;
}

export interface ReportData {
  executive_summary: string;
  key_metrics: {
    total_bugs: number;
    resolution_rate: number;
    critical_bugs: number;
    critical_rate: number;
  };
  trend_analysis: Array<{
    date: string;
    [priority: string]: string | number;
  }>;
  hotspot_analysis: Array<{
    module: string;
    count: number;
    percentage: number;
  }>;
  ai_insights: string;
  detailed_data: {
    raw_bugs: any[];
    analysis_summary: any;
    trend_summary: any;
  };
  generation_metadata: {
    generated_at: string;
    data_range: string;
    version: string;
  };
}

export interface MonthlyReport {
  id: number;
  workspace_id: number;
  year: number;
  month: number;
  prompt_template?: string;
  report_data?: ReportData;
  status: string;
  generation_progress?: GenerationProgress;
  error_message?: string;
  created_by: number;
  created_at: string;
  updated_at?: string;
}

export interface AgentPromptConfig {
  role: string;
  goal: string;
  backstory: string;
}

export interface TaskPromptConfig {
  description: string;
  expected_output: string;
}

export interface PromptTemplate {
  id: number;
  workspace_id: number;
  template_name: string;
  template_content: string; // 兼容旧版本或存储JSON格式
  agent_config?: AgentPromptConfig;
  task_config?: TaskPromptConfig;
  is_active: boolean;
  is_default: boolean;
  created_by: number;
  created_at: string;
  updated_at?: string;
}

export interface GenerateReportRequest {
  workspace_id: number;
  year: number;
  month: number;
  prompt_template?: string;
}

export interface PromptTemplateCreate {
  workspace_id: number;
  template_name: string;
  template_content: string;
  is_active?: boolean;
  is_default?: boolean;
}

class MonthlyReportService {
  // 生成月度报告
  async generateReport(requestData: GenerateReportRequest): Promise<APIResponse<MonthlyReport>> {
    const response = await request.post('/monthly-reports/generate', requestData);
    return response.data;
  }

  // 获取生成进度
  async getGenerationProgress(reportId: number): Promise<APIResponse<GenerationProgress | null>> {
    const response = await request.get(`/monthly-reports/progress/${reportId}`);
    return response.data;
  }

  // 获取报告历史
  async getReportHistory(workspaceId: number, limit: number = 50): Promise<APIResponse<MonthlyReport[]>> {
    const response = await request.get('/monthly-reports/history', {
      params: { workspace_id: workspaceId, limit }
    });
    return response.data;
  }

  // 获取单个报告
  async getReport(reportId: number): Promise<APIResponse<MonthlyReport | null>> {
    const response = await request.get(`/monthly-reports/${reportId}`);
    return response.data;
  }

  // 根据年月获取报告
  async getReportByMonth(workspaceId: number, year: number, month: number): Promise<APIResponse<MonthlyReport | null>> {
    const response = await request.get(`/monthly-reports/by-month/${workspaceId}/${year}/${month}`);
    return response.data;
  }

  // 更新报告
  async updateReport(reportId: number, updateData: Partial<MonthlyReport>): Promise<APIResponse<MonthlyReport>> {
    const response = await request.put(`/monthly-reports/${reportId}`, updateData);
    return response.data;
  }

  // 删除报告
  async deleteReport(reportId: number): Promise<APIResponse<boolean>> {
    const response = await request.delete(`/monthly-reports/${reportId}`);
    return response.data;
  }

  // 创建提示词模板
  async createPromptTemplate(templateData: PromptTemplateCreate): Promise<APIResponse<PromptTemplate>> {
    const response = await request.post('/monthly-reports/prompt-templates', templateData);
    return response.data;
  }

  // 获取提示词模板列表
  async getPromptTemplates(workspaceId: number): Promise<APIResponse<PromptTemplate[]>> {
    const response = await request.get(`/monthly-reports/prompt-templates/${workspaceId}`);
    return response.data;
  }

  // 删除提示词模板
  async deletePromptTemplate(templateId: number): Promise<APIResponse<boolean>> {
    const response = await request.delete(`/monthly-reports/prompt-templates/${templateId}`);
    return response.data;
  }

  // 设置工作区默认智能体模板
  async setWorkspaceDefaultTemplate(workspaceId: number, templateId?: number): Promise<APIResponse<boolean>> {
    const params = templateId ? { template_id: templateId } : {};
    const response = await request.put(`/monthly-reports/workspace/${workspaceId}/default-template`, null, { params });
    return response.data;
  }

  // 获取工作区默认智能体模板ID
  async getWorkspaceDefaultTemplate(workspaceId: number): Promise<APIResponse<number | null>> {
    const response = await request.get(`/monthly-reports/workspace/${workspaceId}/default-template`);
    return response.data;
  }

  // 轮询生成进度（带渐进式步骤显示）
  async pollGenerationProgress(
    reportId: number,
    onProgress: (progress: GenerationProgress) => void,
    onComplete: (report: MonthlyReport) => void,
    onError: (error: string) => void,
    interval: number = 1500
  ): Promise<void> {
    let lastDisplayedStep = 0;
    let stepDisplayTimer: NodeJS.Timeout | null = null;

    // 渐进式显示步骤
    const showStepsGradually = (targetStep: number, progress: GenerationProgress) => {
      if (stepDisplayTimer) {
        clearTimeout(stepDisplayTimer);
      }

      const showNextStep = () => {
        if (lastDisplayedStep < targetStep) {
          lastDisplayedStep++;

          // 创建渐进式进度对象
          const gradualProgress: GenerationProgress = {
            ...progress,
            current_step: lastDisplayedStep,
            progress_percentage: (lastDisplayedStep / progress.total_steps) * 100
          };

          onProgress(gradualProgress);

          // 如果还没到目标步骤，继续显示下一步
          if (lastDisplayedStep < targetStep) {
            stepDisplayTimer = setTimeout(showNextStep, 800); // 每0.8秒显示下一步
          }
        }
      };

      showNextStep();
    };

    const poll = async () => {
      try {
        const progressResponse = await this.getGenerationProgress(reportId);
        if (progressResponse.success && progressResponse.data) {
          const progress = progressResponse.data;

          // 检查是否是失败状态
          if (progress.step_name === '失败' || progress.current_step === 0) {
            // 清理定时器
            if (stepDisplayTimer) {
              clearTimeout(stepDisplayTimer);
            }
            // 调用错误回调并停止轮询
            onError(progress.step_description || '生成失败');
            return;
          }

          // 如果后端步骤跳跃了，使用渐进式显示
          if (progress.current_step > lastDisplayedStep + 1) {
            showStepsGradually(progress.current_step, progress);
          } else {
            // 正常显示当前步骤
            lastDisplayedStep = progress.current_step;
            onProgress(progress);
          }

          // 如果进度达到100%，获取最终报告
          if (progress.progress_percentage >= 100 && progress.current_step >= progress.total_steps) {
            const reportResponse = await this.getReport(reportId);
            if (reportResponse.success && reportResponse.data) {
              if (reportResponse.data.status === 'completed') {
                onComplete(reportResponse.data);
                return;
              } else if (reportResponse.data.status === 'failed') {
                onError(reportResponse.data.error_message || '生成失败');
                return;
              }
            }
          }

          // 继续轮询
          setTimeout(poll, interval);
        } else {
          // 没有进度信息，检查报告状态
          const reportResponse = await this.getReport(reportId);
          if (reportResponse.success && reportResponse.data) {
            if (reportResponse.data.status === 'completed') {
              onComplete(reportResponse.data);
            } else if (reportResponse.data.status === 'failed') {
              onError(reportResponse.data.error_message || '生成失败');
            } else if (reportResponse.data.status === 'generating') {
              // 继续轮询
              setTimeout(poll, interval);
            } else {
              onError('报告状态异常');
            }
          } else {
            onError('无法获取报告状态');
          }
        }
      } catch (error: any) {
        console.error('轮询进度失败:', error);
        onError(error.message || '获取进度失败');
      }
    };

    poll();
  }
}

export const monthlyReportService = new MonthlyReportService();
export default monthlyReportService;
