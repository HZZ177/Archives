import request, { unwrapResponse } from '../utils/request';
import { 
  ModuleStructureNode, 
  ModuleContent, 
  ModuleStructureNodeRequest, 
  ModuleContentRequest,
  ModuleTreeResponse
} from '../types/modules';
import { APIResponse } from '../types/api';
import { getWorkspaceTables } from './workspaceService';

const API_MODULE_STRUCTURES = '/module-structures';
const API_MODULE_CONTENTS = '/module-contents';

// 模块树缓存
let moduleTreeCache: {
  data: ModuleTreeResponse | null;
  timestamp: number;
  loading: boolean;
  pendingPromise: Promise<ModuleTreeResponse> | null;
} = {
  data: null,
  timestamp: 0,
  loading: false,
  pendingPromise: null
};

// 缓存失效时间，单位：毫秒（默认3分钟）
const CACHE_TTL = 180000;

// 刷新缓存函数
export const invalidateModuleTreeCache = () => {
  moduleTreeCache.data = null;
  moduleTreeCache.timestamp = 0;
  moduleTreeCache.loading = false;
  moduleTreeCache.pendingPromise = null;
  console.log('模块树缓存已清空');
};

// 模块结构树API
export const fetchModuleTree = async (parentId?: number, forceRefresh = false): Promise<ModuleTreeResponse> => {
  const now = Date.now();
  
  // 改进缓存验证逻辑：添加更严格的类型检查
  const isCacheValid = 
    moduleTreeCache.data !== null && 
    typeof moduleTreeCache.timestamp === 'number' && 
    (now - moduleTreeCache.timestamp < CACHE_TTL) && 
    !forceRefresh;

  // 如果缓存有效，直接返回缓存数据
  if (isCacheValid && moduleTreeCache.data) {
    console.log(`使用模块树缓存数据，缓存时间：${new Date(moduleTreeCache.timestamp).toLocaleTimeString()}，强制刷新：${forceRefresh}`);
    return moduleTreeCache.data;
  }

  // 记录无效缓存原因
  if (forceRefresh) {
    console.log('模块树缓存：强制刷新，忽略现有缓存');
  } else if (!moduleTreeCache.data) {
    console.log('模块树缓存：缓存为空，需要获取新数据');
  } else if (now - moduleTreeCache.timestamp >= CACHE_TTL) {
    console.log(`模块树缓存：缓存已过期（${Math.floor((now - moduleTreeCache.timestamp)/1000)}秒前），需要刷新`);
  }

  // 如果已经在加载中，复用同一个请求
  if (moduleTreeCache.loading && moduleTreeCache.pendingPromise) {
    console.log('复用模块树正在进行的请求');
    return moduleTreeCache.pendingPromise;
  }

  // 发起新请求
  console.log(`发起新的模块树请求，forceRefresh=${forceRefresh}`);
  moduleTreeCache.loading = true;

  const fetchPromise = async (): Promise<ModuleTreeResponse> => {
    try {
      const params = parentId ? { parent_id: parentId } : {};
      
      const response = await request.get<APIResponse<any>>(API_MODULE_STRUCTURES, { params });
      const unwrappedData = unwrapResponse<any>(response.data);
      
      // 适配不同的响应格式
      let nodeItems: ModuleStructureNode[] = [];
      
      // 判断响应数据的格式并提取节点列表
      if (unwrappedData) {
        if (Array.isArray(unwrappedData)) {
          // 数据直接是节点数组
          nodeItems = unwrappedData;
        } else if (unwrappedData.items && Array.isArray(unwrappedData.items)) {
          // 数据包含items字段
          nodeItems = unwrappedData.items;
        } else if (unwrappedData.nodes && Array.isArray(unwrappedData.nodes)) {
          // 数据包含nodes字段
          nodeItems = unwrappedData.nodes;
        } else {
          console.warn('响应数据格式不符合预期:', unwrappedData);
          nodeItems = [];
        }
      }
      
      // 创建符合前端期望的响应结构
      const formattedData: ModuleTreeResponse = {
        items: nodeItems
      };
      
      // 更新缓存
      moduleTreeCache.data = formattedData;
      moduleTreeCache.timestamp = Date.now();
      moduleTreeCache.loading = false;
      moduleTreeCache.pendingPromise = null;
      
      console.log(`模块树数据已更新到缓存，时间：${new Date(moduleTreeCache.timestamp).toLocaleTimeString()}`);
      return moduleTreeCache.data;
    } catch (error) {
      // 请求失败，重置加载状态
      moduleTreeCache.loading = false;
      moduleTreeCache.pendingPromise = null;
      console.error('获取模块树失败:', error);
      throw error;
    }
  };

  moduleTreeCache.pendingPromise = fetchPromise();
  return moduleTreeCache.pendingPromise;
};

export const fetchModuleNode = async (nodeId: number): Promise<ModuleStructureNode> => {
  const response = await request.get<APIResponse<ModuleStructureNode>>(`${API_MODULE_STRUCTURES}/${nodeId}`);
  return unwrapResponse<ModuleStructureNode>(response.data)!;
};

export const createModuleNode = async (data: ModuleStructureNodeRequest): Promise<ModuleStructureNode> => {
  const response = await request.post<APIResponse<ModuleStructureNode>>(API_MODULE_STRUCTURES, data);
  invalidateModuleTreeCache();
  return unwrapResponse<ModuleStructureNode>(response.data)!;
};

export const updateModuleNode = async (nodeId: number, data: ModuleStructureNodeRequest): Promise<ModuleStructureNode> => {
  const response = await request.post<APIResponse<ModuleStructureNode>>(`${API_MODULE_STRUCTURES}/update/${nodeId}`, data);
  invalidateModuleTreeCache();
  return unwrapResponse<ModuleStructureNode>(response.data)!;
};

export const deleteModuleNode = async (nodeId: number): Promise<void> => {
  await request.post<APIResponse<void>>(`${API_MODULE_STRUCTURES}/delete/${nodeId}`);
  // 删除节点后清除缓存
  invalidateModuleTreeCache();
};

// 模块内容API
export const fetchModuleContent = async (
  moduleNodeId: number, 
  workspaceId?: number, 
  cachedWorkspaceTables?: any[]
): Promise<ModuleContent> => {
  try {
    const response = await request.get<APIResponse<ModuleContent>>(`${API_MODULE_CONTENTS}/by-node/${moduleNodeId}`);
    const moduleContent = unwrapResponse<ModuleContent>(response.data)!;
    
    // 添加预加载逻辑，确保返回的模块内容包含 database_tables 属性
    if (moduleContent && !('database_tables' in moduleContent)) {
      console.log('模块内容中缺少 database_tables 属性，尝试获取关联表数据');
      
      try {
        // 如果提供了缓存的工作区表数据，直接使用
        if (cachedWorkspaceTables && cachedWorkspaceTables.length > 0) {
          console.log('使用缓存的工作区表数据:', cachedWorkspaceTables.length);
          (moduleContent as any).database_tables = cachedWorkspaceTables;
          return moduleContent;
        }
        
        // 获取模块所属的工作区ID
        let targetWorkspaceId = workspaceId || null;
        
        // 如果没有传入工作区ID，尝试从其他地方获取
        if (!targetWorkspaceId) {
          // 1. 尝试从模块内容中获取工作区ID
          if ((moduleContent as any).workspace_id) {
            targetWorkspaceId = (moduleContent as any).workspace_id;
          }
          // 2. 尝试从模块节点中获取工作区ID
          else {
            const moduleNodeResponse = await request.get<APIResponse<ModuleStructureNode>>(`${API_MODULE_STRUCTURES}/${moduleNodeId}`);
            const moduleNode = unwrapResponse<ModuleStructureNode>(moduleNodeResponse.data);
            if (moduleNode && moduleNode.workspace_id) {
              targetWorkspaceId = moduleNode.workspace_id;
            }
          }
        }
        
        // 如果找到了工作区ID，获取该工作区的表数据
        if (targetWorkspaceId) {
          console.log(`找到工作区ID: ${targetWorkspaceId}，获取工作区表数据`);
          const workspaceTables = await getWorkspaceTables(targetWorkspaceId);
          if (workspaceTables && workspaceTables.length > 0) {
            console.log('成功获取工作区表数据:', workspaceTables);
            (moduleContent as any).database_tables = workspaceTables;
          } else {
            console.log('工作区中没有表数据，设置为空数组');
            (moduleContent as any).database_tables = [];
          }
        } else {
          console.log('未找到工作区ID，设置为空数组');
          (moduleContent as any).database_tables = [];
        }
      } catch (error) {
        console.error('获取关联表数据失败:', error);
        // 设置为空数组，避免后续处理出错
        (moduleContent as any).database_tables = [];
      }
    }
    
    return moduleContent;
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      // 返回一个初始化的内容对象，匹配ModuleContent接口
      return {
        id: 0,
        node_id: moduleNodeId,
        content: {}, // 初始化为空对象
        last_updated_at: new Date().toISOString(),
      };
    }
    throw error;
  }
};

export const saveModuleContent = async (moduleNodeId: number, data: ModuleContentRequest): Promise<ModuleContent> => {
  const response = await request.post<APIResponse<ModuleContent>>(`${API_MODULE_CONTENTS}/update/by-node/${moduleNodeId}`, data);
  return unwrapResponse<ModuleContent>(response.data)!;
};

/**
 * 更新节点排序顺序
 * @param nodeId 节点ID
 * @param orderIndex 新的顺序值
 * @returns 更新后的节点
 */
export const updateNodeOrder = async (nodeId: number, orderIndex: number): Promise<ModuleStructureNode> => {
  const response = await request.post<APIResponse<ModuleStructureNode>>(
    `${API_MODULE_STRUCTURES}/update-order/${nodeId}`, 
    { order_index: orderIndex }
  );
  invalidateModuleTreeCache();
  return unwrapResponse<ModuleStructureNode>(response.data)!;
};

/**
 * 批量更新节点排序顺序
 * @param updates 更新列表，每个项包含 node_id 和 order_index
 * @returns 更新后的节点列表
 */
export const batchUpdateNodeOrder = async (updates: Array<{ node_id: number; order_index: number }>): Promise<ModuleStructureNode[]> => {
  const response = await request.post<APIResponse<ModuleStructureNode[]>>(
    `${API_MODULE_STRUCTURES}/batch-update-order`,
    { updates }
  );
  invalidateModuleTreeCache();
  return unwrapResponse<ModuleStructureNode[]>(response.data)!;
}; 

// 更新流程图数据
export const updateDiagram = async (moduleId: number, diagramData: any, diagramType: 'business' | 'tableRelation' = 'business') => {
  const endpoint = diagramType === 'tableRelation' 
    ? `${API_MODULE_CONTENTS}/${moduleId}/table-relation-diagram` 
    : `${API_MODULE_CONTENTS}/${moduleId}/diagram`;
  
  const response = await request.put<APIResponse<void>>(endpoint, diagramData);
  return response.data;
};

// 获取流程图数据
export const getDiagram = async (moduleId: number, diagramType: 'business' | 'tableRelation' = 'business') => {
  const endpoint = diagramType === 'tableRelation' 
    ? `${API_MODULE_CONTENTS}/${moduleId}/table-relation-diagram` 
    : `${API_MODULE_CONTENTS}/${moduleId}/diagram`;
  
  const response = await request.get<APIResponse<any>>(endpoint);
  return response.data;
};

// 获取模块配置
export const getModuleSectionConfig = () => {
  return request.get('/module-sections/config');
};

// 更新模块配置
export const updateModuleSectionConfig = (sections: any[]) => {
  return request.put('/module-sections/config', sections);
}; 