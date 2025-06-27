import { apiClient } from '../utils/apiClient';
import { WorkspaceInterface, WorkspaceInterfaceDetail, PaginatedInterfaces } from '../types/workspace';

const BASE_URL = '/workspace-interfaces';

/**
 * 获取工作区下的接口列表，带分页
 * @param workspaceId 工作区ID
 * @param page 页码，从1开始
 * @param pageSize 每页数量
 * @param search 搜索关键词，可选
 * @returns 分页的接口列表数据
 */
export async function getWorkspaceInterfaces(
  workspaceId: number,
  page: number = 1,
  pageSize: number = 10,
  search: string = ''
): Promise<PaginatedInterfaces> {
  console.log(`发送请求: workspaceId=${workspaceId}, page=${page}, pageSize=${pageSize}, search=${search}`);
  
  const params: any = { page, page_size: pageSize };
  if (search) {
    params.search = search;
  }
  
  const response = await apiClient.get(`/workspaces/${workspaceId}/interfaces`, { params });
  
  console.log('接收响应:', response.data);
  
  // 检查返回的数据结构是否符合预期
  const data = response.data.data;
  if (!data.items || !data.total) {
    console.error('后端返回的数据结构不符合预期:', data);
    // 如果后端返回的不是预期的分页格式，尝试兼容处理
    if (Array.isArray(data)) {
      return {
        items: data,
        total: data.length,
        page: 1,
        page_size: data.length
      };
    }
  }
  
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