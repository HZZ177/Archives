export interface AIAgent {
  id: number;
  name: string;
  role: string;
  goal: string;
  backstory: string;
  system_prompt?: string;
  agent_type: string;
  is_enabled: boolean;
  config_json?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

export interface AIAgentExecution {
  id: number;
  agent_id: number;
  task_type: string;
  input_data?: string;
  output_data?: string;
  execution_status: string;
  start_time: string;
  end_time?: string;
  duration_ms?: number;
  error_message?: string;
  workspace_id?: number;
  created_by?: number;
  created_at: string;
}

export interface DefectAnalysisRequest {
  year: number;
  month: number;
  workspace_id: number;
}

export interface DefectAnalysisResult {
  execution_id: number;
  analysis_summary: string;
  time_distribution: Record<string, any>;
  module_distribution: Record<string, any>;
  defect_type_analysis: Record<string, any>;
  root_cause_analysis: Record<string, any>;
  recurring_issues: Array<Record<string, any>>;
  improvement_suggestions: string[];
  generated_at: string;
}
