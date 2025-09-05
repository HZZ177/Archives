import request from '../utils/request';
import { 
  DefectAnalysisRequest, 
  DefectAnalysisResult, 
  AIAgentExecution 
} from '../types/ai-agents';
import { APIResponse, PaginatedResponse } from '../types/common';

export const aiAgentService = {
  // 执行缺陷分析
  async executeDefectAnalysis(data: DefectAnalysisRequest): Promise<APIResponse<DefectAnalysisResult>> {
    return request.post('/ai-agents/defect-analysis', data);
  },

  // 获取执行历史
  async getExecutionHistory(
    workspaceId: number, 
    page = 1, 
    pageSize = 10,
    agentType?: string
  ): Promise<APIResponse<PaginatedResponse<AIAgentExecution>>> {
    return request.get('/ai-agents/executions', {
      params: { 
        workspace_id: workspaceId, 
        page, 
        page_size: pageSize,
        agent_type: agentType
      }
    });
  },

  // 获取执行详情
  async getExecutionDetail(id: number): Promise<APIResponse<AIAgentExecution>> {
    return request.get(`/ai-agents/executions/${id}`);
  }
};
