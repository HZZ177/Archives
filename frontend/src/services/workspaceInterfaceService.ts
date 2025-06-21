import { apiClient } from '../utils/apiClient';
import { WorkspaceInterface, WorkspaceInterfaceDetail } from '../types/workspace';

const BASE_URL = '/workspace-interfaces';

/**
 * 获取工作区下的所有接口
 * @param workspaceId 工作区ID
 * @returns 接口列表
 */
export async function getWorkspaceInterfaces(workspaceId: number): Promise<WorkspaceInterface[]> {
  const response = await apiClient.get(`${BASE_URL}/workspace/${workspaceId}`);
  return response.data.data;
}

/**
 * 获取接口详情
 * @param interfaceId 接口ID
 * @returns 接口详情
 */
export async function getInterfaceDetail(interfaceId: number): Promise<WorkspaceInterfaceDetail> {
  const response = await apiClient.get(`${BASE_URL}/${interfaceId}`);
  return response.data.data;
}

/**
 * 创建接口
 * @param workspaceId 工作区ID
 * @param interfaceData 接口数据
 * @returns 创建的接口
 */
export async function createInterface(workspaceId: number, interfaceData: any): Promise<WorkspaceInterface> {
  const response = await apiClient.post(`${BASE_URL}/workspace/${workspaceId}`, interfaceData);
  return response.data.data;
}

/**
 * 更新接口
 * @param interfaceId 接口ID
 * @param interfaceData 接口数据
 * @returns 更新后的接口
 */
export async function updateInterface(interfaceId: number, interfaceData: any): Promise<WorkspaceInterface> {
  const response = await apiClient.put(`${BASE_URL}/${interfaceId}`, interfaceData);
  return response.data.data;
}

/**
 * 删除接口
 * @param interfaceId 接口ID
 * @returns 是否成功
 */
export async function deleteInterface(interfaceId: number): Promise<boolean> {
  const response = await apiClient.delete(`${BASE_URL}/${interfaceId}`);
  return response.data.success;
} 