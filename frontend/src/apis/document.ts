import axios from 'axios';
import { message } from 'antd';
import { API_BASE_URL, STORAGE_TOKEN_KEY } from '../config/constants';
import { Document, DocumentDetail, DocumentFormData, TemplateFormData, Section, SectionFormData, Image, Relation, RelationFormData } from '../types/document';

// 获取请求头
const getHeaders = () => {
  const token = localStorage.getItem(STORAGE_TOKEN_KEY);
  return {
    Authorization: `Bearer ${token}`
  };
};

// 分页查询文档
export const fetchDocuments = async (params: any) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/documents`, {
      params,
      headers: getHeaders()
    });
    return response.data;
  } catch (error) {
    message.error('获取文档列表失败');
    throw error;
  }
};

// 获取单个文档
export const fetchDocument = async (id: number | string) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/documents/${id}`, {
      headers: getHeaders()
    });
    return response.data;
  } catch (error) {
    message.error('获取文档详情失败');
    throw error;
  }
};

// 创建文档
export const createDocument = async (data: DocumentFormData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/documents`, data, {
      headers: getHeaders()
    });
    message.success('创建文档成功');
    return response.data;
  } catch (error) {
    message.error('创建文档失败');
    throw error;
  }
};

// 更新文档
export const updateDocument = async (id: number | string, data: DocumentFormData) => {
  try {
    const response = await axios.put(`${API_BASE_URL}/documents/${id}`, data, {
      headers: getHeaders()
    });
    message.success('更新文档成功');
    return response.data;
  } catch (error) {
    message.error('更新文档失败');
    throw error;
  }
};

// 删除文档
export const deleteDocument = async (id: number | string) => {
  try {
    await axios.delete(`${API_BASE_URL}/documents/${id}`, {
      headers: getHeaders()
    });
    message.success('删除文档成功');
  } catch (error) {
    message.error('删除文档失败');
    throw error;
  }
};

// 分页查询模板
export const fetchTemplates = async (params?: any) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/templates`, {
      params,
      headers: getHeaders()
    });
    return response.data;
  } catch (error) {
    message.error('获取模板列表失败');
    throw error;
  }
};

// 获取单个模板
export const fetchTemplate = async (id: number | string) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/templates/${id}`, {
      headers: getHeaders()
    });
    return response.data;
  } catch (error) {
    message.error('获取模板详情失败');
    throw error;
  }
};

// 创建模板
export const createTemplate = async (data: TemplateFormData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/templates`, data, {
      headers: getHeaders()
    });
    message.success('创建模板成功');
    return response.data;
  } catch (error) {
    message.error('创建模板失败');
    throw error;
  }
};

// 更新部分
export const updateSection = async (id: number | string, data: SectionFormData) => {
  try {
    const response = await axios.put(`${API_BASE_URL}/sections/${id}`, data, {
      headers: getHeaders()
    });
    message.success('更新部分成功');
    return response.data;
  } catch (error) {
    message.error('更新部分失败');
    throw error;
  }
};

// 上传图片
export const uploadImage = async (sectionId: number | string, file: File) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await axios.post(
      `${API_BASE_URL}/sections/${sectionId}/images`,
      formData,
      {
        headers: {
          ...getHeaders(),
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    
    message.success('上传图片成功');
    return response.data;
  } catch (error) {
    message.error('上传图片失败');
    throw error;
  }
};

// 删除图片
export const deleteImage = async (imageId: number | string) => {
  try {
    await axios.delete(`${API_BASE_URL}/images/${imageId}`, {
      headers: getHeaders()
    });
    message.success('删除图片成功');
  } catch (error) {
    message.error('删除图片失败');
    throw error;
  }
};

// 创建关联
export const createRelation = async (documentId: number | string, data: RelationFormData) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/documents/${documentId}/relations`,
      data,
      {
        headers: getHeaders()
      }
    );
    message.success('创建关联成功');
    return response.data;
  } catch (error) {
    message.error('创建关联失败');
    throw error;
  }
};

// 删除关联
export const deleteRelation = async (relationId: number | string) => {
  try {
    await axios.delete(`${API_BASE_URL}/relations/${relationId}`, {
      headers: getHeaders()
    });
    message.success('删除关联成功');
  } catch (error) {
    message.error('删除关联失败');
    throw error;
  }
}; 