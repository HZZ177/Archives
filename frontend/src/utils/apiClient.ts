import request from './request';

/**
 * API客户端，封装了请求方法
 */
export const apiClient = {
  /**
   * 发送GET请求
   * @param url 请求URL
   * @param params 请求参数
   * @returns 响应数据
   */
  async get(url: string, params?: any) {
    return request.get(url, { params });
  },

  /**
   * 发送POST请求
   * @param url 请求URL
   * @param data 请求数据
   * @returns 响应数据
   */
  async post(url: string, data?: any) {
    return request.post(url, data);
  },

  /**
   * 发送PUT请求
   * @param url 请求URL
   * @param data 请求数据
   * @returns 响应数据
   */
  async put(url: string, data?: any) {
    return request.put(url, data);
  },

  /**
   * 发送DELETE请求
   * @param url 请求URL
   * @param params 请求参数
   * @returns 响应数据
   */
  async delete(url: string, params?: any) {
    return request.delete(url, { params });
  },

  /**
   * 发送PATCH请求
   * @param url 请求URL
   * @param data 请求数据
   * @returns 响应数据
   */
  async patch(url: string, data?: any) {
    return request.patch(url, data);
  }
}; 