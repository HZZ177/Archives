import { apiClient } from '../utils/apiClient';
import { ModuleContent, DatabaseTable } from '../types/modules';
import { WorkspaceTable } from '../types/workspace';
import { WorkspaceInterface } from '../types/workspace';

// 定义缺少的类型
interface ReferencedTable extends WorkspaceTable {
  // 添加可能的额外属性
}

interface ReferencedInterface extends WorkspaceInterface {
  // 添加可能的额外属性
}

const BASE_URL = '/api/v1/module-contents';

/**
 * 获取模块内容
 * @param nodeId 模块节点ID
 * @returns 模块内容
 */
export async function getModuleContent(nodeId: number): Promise<ModuleContent> {
  const response = await apiClient.get(`${BASE_URL}/by-node/${nodeId}`);
  return response.data.data;
}

/**
 * 更新模块内容
 * @param nodeId 模块节点ID
 * @param content 模块内容数据
 * @returns 更新后的模块内容
 */
export async function updateModuleContent(nodeId: number, content: any): Promise<ModuleContent> {
  const response = await apiClient.post(`${BASE_URL}/update/by-node/${nodeId}`, content);
  return response.data.data;
}

/**
 * 获取模块引用的数据库表
 * @param nodeId 模块节点ID
 * @returns 引用的数据库表列表
 */
export async function getReferencedTables(nodeId: number): Promise<ReferencedTable[]> {
  const response = await apiClient.get(`${BASE_URL}/${nodeId}/referenced-tables`);
  return response.data.data;
}

/**
 * 更新模块引用的数据库表
 * @param nodeId 模块节点ID
 * @param tableIds 数据库表ID列表
 * @returns 更新后的模块内容
 */
export async function updateTableRefs(nodeId: number, tableIds: number[]): Promise<ModuleContent> {
  const response = await apiClient.put(`${BASE_URL}/${nodeId}/table-refs`, tableIds);
  return response.data.data;
}

/**
 * 获取模块引用的接口
 * @param nodeId 模块节点ID
 * @returns 引用的接口列表
 */
export async function getReferencedInterfaces(nodeId: number): Promise<ReferencedInterface[]> {
  const response = await apiClient.get(`${BASE_URL}/${nodeId}/referenced-interfaces`);
  return response.data.data;
}

/**
 * 更新模块引用的接口
 * @param nodeId 模块节点ID
 * @param interfaceIds 接口ID列表
 * @returns 更新后的模块内容
 */
export async function updateInterfaceRefs(nodeId: number, interfaceIds: number[]): Promise<ModuleContent> {
  const response = await apiClient.put(`${BASE_URL}/${nodeId}/interface-refs`, interfaceIds);
  return response.data.data;
}

/**
 * 更新模块流程图
 * @param nodeId 模块节点ID
 * @param diagramData 流程图数据
 * @returns 更新后的模块内容
 */
export async function updateDiagram(nodeId: number, diagramData: any): Promise<ModuleContent> {
  const response = await apiClient.put(`${BASE_URL}/${nodeId}/diagram`, diagramData);
  return response.data.data;
}

/**
 * 获取模块流程图
 * @param nodeId 模块节点ID
 * @returns 流程图数据
 */
export async function getDiagram(nodeId: number): Promise<any> {
  const response = await apiClient.get(`${BASE_URL}/${nodeId}/diagram`);
  return response.data.data;
}

/**
 * 更新表关联关系图
 * @param nodeId 模块节点ID
 * @param diagramData 表关联关系图数据
 * @returns 更新后的模块内容
 */
export async function updateTableRelationDiagram(nodeId: number, diagramData: any): Promise<ModuleContent> {
  const response = await apiClient.put(`${BASE_URL}/${nodeId}/table-relation-diagram`, diagramData);
  return response.data.data;
}

/**
 * 获取表关联关系图
 * @param nodeId 模块节点ID
 * @returns 表关联关系图数据
 */
export async function getTableRelationDiagram(nodeId: number): Promise<any> {
  const response = await apiClient.get(`${BASE_URL}/${nodeId}/table-relation-diagram`);
  return response.data.data;
} 