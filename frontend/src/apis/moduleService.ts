import request from '../utils/request';
import { 
  ModuleStructureNode, 
  ModuleContent, 
  ModuleStructureNodeRequest, 
  ModuleContentRequest,
  ModuleTreeResponse
} from '../types/modules';

const API_MODULE_STRUCTURES = '/module-structures';
const API_MODULE_CONTENTS = '/module-contents';

// 模块结构树API
export const fetchModuleTree = async (parentId?: number): Promise<ModuleTreeResponse> => {
  const params = parentId ? { parent_id: parentId } : {};
  const response = await request.get(API_MODULE_STRUCTURES, { params });
  return response.data;
};

export const fetchModuleNode = async (nodeId: number): Promise<ModuleStructureNode> => {
  const response = await request.get(`${API_MODULE_STRUCTURES}/${nodeId}`);
  return response.data;
};

export const createModuleNode = async (data: ModuleStructureNodeRequest): Promise<ModuleStructureNode> => {
  const response = await request.post(API_MODULE_STRUCTURES, data);
  return response.data;
};

export const updateModuleNode = async (nodeId: number, data: ModuleStructureNodeRequest): Promise<ModuleStructureNode> => {
  const response = await request.put(`${API_MODULE_STRUCTURES}/${nodeId}`, data);
  return response.data;
};

export const deleteModuleNode = async (nodeId: number): Promise<void> => {
  await request.delete(`${API_MODULE_STRUCTURES}/${nodeId}`);
};

// 模块内容API
export const fetchModuleContent = async (moduleNodeId: number): Promise<ModuleContent> => {
  try {
    const response = await request.get(`${API_MODULE_CONTENTS}/by-node/${moduleNodeId}`);
    return response.data;
  } catch (error: any) {
    // 如果内容不存在，返回空对象
    if (error.response && error.response.status === 404) {
      return {
        id: 0,
        module_node_id: moduleNodeId,
        user_id: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    throw error;
  }
};

export const saveModuleContent = async (moduleNodeId: number, data: ModuleContentRequest): Promise<ModuleContent> => {
  const response = await request.put(`${API_MODULE_CONTENTS}/by-node/${moduleNodeId}`, data);
  return response.data;
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
  
  const response = await request.post(
    `${API_MODULE_CONTENTS}/by-node/${moduleNodeId}/upload-diagram`, 
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  
  return response.data;
}; 