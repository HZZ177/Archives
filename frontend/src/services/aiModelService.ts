import request from '../utils/request';
import { 
  AIModelConfig, 
  AIModelConfigFormData, 
  ConnectionTestResult, 
  PoolStatus 
} from '../types/ai-models';
import { APIResponse, PaginatedResponse } from '../types/common';

export const aiModelService = {
  // 创建AI模型配置
  async createConfig(data: AIModelConfigFormData): Promise<APIResponse<AIModelConfig>> {
    const response = await request.post('/ai-models/', data);
    return response.data;
  },

  // 获取配置列表
  async listConfigs(page = 1, pageSize = 10): Promise<APIResponse<PaginatedResponse<AIModelConfig>>> {
    const response = await request.get('/ai-models/', {
      params: { page, page_size: pageSize }
    });
    return response.data;
  },

  // 获取单个配置
  async getConfig(id: number): Promise<APIResponse<AIModelConfig>> {
    const response = await request.get(`/ai-models/${id}`);
    return response.data;
  },

  // 更新配置
  async updateConfig(id: number, data: Partial<AIModelConfigFormData>): Promise<APIResponse<AIModelConfig>> {
    const response = await request.put(`/ai-models/${id}`, data);
    return response.data;
  },

  // 删除配置
  async deleteConfig(id: number): Promise<APIResponse<boolean>> {
    const response = await request.delete(`/ai-models/${id}`);
    return response.data;
  },

  // 测试连接
  async testConnection(id: number): Promise<APIResponse<ConnectionTestResult>> {
    const response = await request.post(`/ai-models/${id}/test`);
    return response.data;
  },

  // 测试配置数据连接（无需保存）
  async testConnectionWithConfig(configData: any): Promise<APIResponse<ConnectionTestResult>> {
    const response = await request.post('/ai-models/test-connection', configData);
    return response.data;
  },

  // 激活配置
  async activateConfig(id: number): Promise<APIResponse<boolean>> {
    const response = await request.post(`/ai-models/${id}/activate`);
    return response.data;
  },

  // 清除活跃配置
  async clearActiveConfig(): Promise<APIResponse<boolean>> {
    const response = await request.post('/ai-models/clear-active');
    return response.data;
  },

  // 获取连接池状态
  async getPoolStatus(): Promise<APIResponse<PoolStatus>> {
    const response = await request.get('/ai-models/pool/status');
    return response.data;
  }
};
