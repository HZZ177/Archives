export interface AIModelConfig {
  id: number;
  name: string;
  model_provider: string;
  model_name: string;
  api_key: string;
  base_url: string;
  is_active: boolean;
  is_enabled: boolean;
  description?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

export interface AIModelConfigFormData {
  name: string;
  model_provider: string;
  model_name: string;
  api_key: string;
  base_url: string;
  description?: string;
  is_enabled?: boolean;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  response_time_ms?: number;
  model_info?: Record<string, any>;
}

export interface PoolStatus {
  total_size: number;
  available_count: number;
  active_count: number;
  pending_count: number;
  current_config?: AIModelConfig;
}

export interface AIModelUsageStats {
  id: number;
  config_id: number;
  workspace_id: number;
  usage_date: string;
  request_count: number;
  token_count: number;
  success_count: number;
  error_count: number;
  avg_response_time: number;
  created_at: string;
  updated_at: string;
}
