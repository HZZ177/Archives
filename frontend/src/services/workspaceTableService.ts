import { apiClient } from '../utils/apiClient';
import { WorkspaceTable, WorkspaceTableDetail, PaginatedTables } from '../types/workspace';

const BASE_URL = '/workspace-tables';

/**
 * 获取工作区下的所有数据库表
 * @param workspaceId 工作区ID
 * @returns 数据库表列表
 */
export async function getWorkspaceTables(workspaceId: number): Promise<WorkspaceTable[]> {
  const response = await apiClient.get(`${BASE_URL}/workspace/${workspaceId}`);
  return response.data.data;
}

/**
 * 获取工作区下的所有数据库表，支持分页和搜索
 * @param workspaceId 工作区ID
 * @param page 页码，从1开始
 * @param pageSize 每页数量
 * @param search 搜索关键词
 * @returns 分页的数据库表列表和总数
 */
export async function getWorkspaceTablesPaginated(
  workspaceId: number,
  page: number = 1,
  pageSize: number = 10,
  search: string = ''
): Promise<PaginatedTables> {
  let url = `${BASE_URL}/workspace/${workspaceId}/paginated?page=${page}&page_size=${pageSize}`;
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }
  
  const response = await apiClient.get(url);
  return response.data.data;
}

/**
 * 获取数据库表详情
 * @param tableId 数据库表ID
 * @returns 数据库表详情
 */
export async function getTableDetail(tableId: number): Promise<WorkspaceTableDetail> {
  const response = await apiClient.get(`${BASE_URL}/${tableId}`);
  return response.data.data;
}

/**
 * 创建数据库表
 * @param workspaceId 工作区ID
 * @param tableData 数据库表数据
 * @returns 创建的数据库表
 */
export async function createTable(workspaceId: number, tableData: any): Promise<WorkspaceTable> {
  const response = await apiClient.post(`${BASE_URL}/workspace/${workspaceId}`, tableData);
  return response.data.data;
}

/**
 * 更新数据库表
 * @param tableId 数据库表ID
 * @param tableData 数据库表数据
 * @returns 更新后的数据库表
 */
export async function updateTable(tableId: number, tableData: any): Promise<WorkspaceTable> {
  const response = await apiClient.put(`${BASE_URL}/${tableId}`, tableData);
  return response.data.data;
}

/**
 * 删除数据库表
 * @param tableId 数据库表ID
 * @returns 是否成功
 */
export async function deleteTable(tableId: number): Promise<boolean> {
  const response = await apiClient.delete(`${BASE_URL}/${tableId}`);
  return response.data.success;
} 