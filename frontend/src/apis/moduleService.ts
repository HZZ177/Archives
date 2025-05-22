import request, { unwrapResponse } from '../utils/request';
import { 
  ModuleStructureNode, 
  ModuleContent, 
  ModuleStructureNodeRequest, 
  ModuleContentRequest,
  ModuleTreeResponse
} from '../types/modules';
import { APIResponse } from '../types/api';

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
  return unwrapResponse<ModuleStructureNode>(response.data);
};

export const createModuleNode = async (data: ModuleStructureNodeRequest): Promise<ModuleStructureNode> => {
  const response = await request.post<APIResponse<ModuleStructureNode>>(API_MODULE_STRUCTURES, data);
  // 新建节点后清除缓存
  invalidateModuleTreeCache();
  return unwrapResponse<ModuleStructureNode>(response.data);
};

export const updateModuleNode = async (nodeId: number, data: ModuleStructureNodeRequest): Promise<ModuleStructureNode> => {
  const response = await request.post<APIResponse<ModuleStructureNode>>(`${API_MODULE_STRUCTURES}/update/${nodeId}`, data);
  
  // 更新节点后清除缓存
  invalidateModuleTreeCache();
  
  return unwrapResponse<ModuleStructureNode>(response.data);
};

export const deleteModuleNode = async (nodeId: number): Promise<void> => {
  await request.post<APIResponse<void>>(`${API_MODULE_STRUCTURES}/delete/${nodeId}`);
  // 删除节点后清除缓存
  invalidateModuleTreeCache();
};

// 模块内容API
export const fetchModuleContent = async (moduleNodeId: number): Promise<ModuleContent> => {
  try {
    const response = await request.get<APIResponse<ModuleContent>>(`${API_MODULE_CONTENTS}/by-node/${moduleNodeId}`);
    return unwrapResponse<ModuleContent>(response.data);
  } catch (error: any) {
    // 如果内容不存在，返回空对象，允许用户创建新内容
    if (error.response && error.response.status === 404) {
      // 返回一个初始化的内容对象
      return {
        id: 0,
        module_node_id: moduleNodeId,
        user_id: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        overview_text: '',
        diagram_image_path: '',
        key_tech_items_json: [],
        database_tables_json: [],
        related_module_ids_json: [],
        api_interfaces_json: []
      };
    }
    throw error;
  }
};

export const saveModuleContent = async (moduleNodeId: number, data: ModuleContentRequest): Promise<ModuleContent> => {
  // 后端的接口已经实现了upsert逻辑，可以直接使用
  const response = await request.post<APIResponse<ModuleContent>>(`${API_MODULE_CONTENTS}/update/by-node/${moduleNodeId}`, data);
  return unwrapResponse<ModuleContent>(response.data);
};

/**
 * 上传模块逻辑图
 * @param moduleNodeId 模块节点ID
 * @param file 图片文件
 * @returns 
 */
export const uploadDiagramImage = async (moduleNodeId: number, file: File): Promise<{diagram_image_path: string}> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await request.post<APIResponse<ModuleContent>>(
    `${API_MODULE_CONTENTS}/upload-diagram/${moduleNodeId}`, 
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  
  const content = unwrapResponse<ModuleContent>(response.data);
  return { diagram_image_path: content.diagram_image_path || '' };
};

/**
 * 删除模块逻辑图
 * @param moduleNodeId 模块节点ID
 * @returns 已更新的模块内容
 */
export const deleteDiagramImage = async (moduleNodeId: number): Promise<ModuleContent> => {
  const response = await request.delete<APIResponse<ModuleContent>>(
    `${API_MODULE_CONTENTS}/delete-diagram/${moduleNodeId}`
  );
  
  return unwrapResponse<ModuleContent>(response.data);
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
  // 更新顺序后清除缓存
  invalidateModuleTreeCache();
  return unwrapResponse<ModuleStructureNode>(response.data);
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
  // 更新顺序后清除缓存
  invalidateModuleTreeCache();
  return unwrapResponse<ModuleStructureNode[]>(response.data);
}; 