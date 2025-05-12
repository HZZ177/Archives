import { message } from 'antd';
import request, { unwrapResponse } from '../utils/request';
import { Document, DocumentDetail, DocumentFormData, TemplateFormData, Section, SectionFormData, Image, Relation, RelationFormData } from '../types/document';
import { APIResponse, PaginatedData } from '../types/api';

// 分页查询文档
export const fetchDocuments = async (params: any) => {
  try {
    const response = await request.get<APIResponse<PaginatedData<Document>>>('/documents', { params });
    return unwrapResponse<PaginatedData<Document>>(response.data);
  } catch (error) {
    message.error('获取文档列表失败');
    throw error;
  }
};

// 获取单个文档
export const fetchDocument = async (id: number | string) => {
  try {
    const response = await request.get<APIResponse<DocumentDetail>>(`/documents/${id}`);
    return unwrapResponse<DocumentDetail>(response.data);
  } catch (error) {
    message.error('获取文档详情失败');
    throw error;
  }
};

// 创建文档
export const createDocument = async (data: DocumentFormData) => {
  try {
    const response = await request.post<APIResponse<Document>>('/documents', data);
    message.success('创建文档成功');
    return unwrapResponse<Document>(response.data);
  } catch (error) {
    message.error('创建文档失败');
    throw error;
  }
};

// 更新文档
export const updateDocument = async (id: number | string, data: DocumentFormData) => {
  try {
    const response = await request.put<APIResponse<Document>>(`/documents/${id}`, data);
    message.success('更新文档成功');
    return unwrapResponse<Document>(response.data);
  } catch (error) {
    message.error('更新文档失败');
    throw error;
  }
};

// 删除文档
export const deleteDocument = async (id: number | string) => {
  try {
    await request.delete<APIResponse<void>>(`/documents/${id}`);
    message.success('删除文档成功');
  } catch (error) {
    message.error('删除文档失败');
    throw error;
  }
};

// 分页查询模板
export const fetchTemplates = async (params?: any) => {
  try {
    const response = await request.get<APIResponse<Document[]>>('/templates', { params });
    return unwrapResponse<Document[]>(response.data);
  } catch (error) {
    message.error('获取模板列表失败');
    throw error;
  }
};

// 获取单个模板
export const fetchTemplate = async (id: number | string) => {
  try {
    const response = await request.get<APIResponse<Document>>(`/templates/${id}`);
    return unwrapResponse<Document>(response.data);
  } catch (error) {
    message.error('获取模板详情失败');
    throw error;
  }
};

// 创建模板
export const createTemplate = async (data: TemplateFormData) => {
  try {
    const response = await request.post<APIResponse<Document>>('/templates', data);
    message.success('创建模板成功');
    return unwrapResponse<Document>(response.data);
  } catch (error) {
    message.error('创建模板失败');
    throw error;
  }
};

// 更新部分
export const updateSection = async (id: number | string, data: SectionFormData) => {
  try {
    const response = await request.put<APIResponse<Section>>(`/sections/${id}`, data);
    message.success('更新部分成功');
    return unwrapResponse<Section>(response.data);
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
    
    const response = await request.post<APIResponse<Image>>(
      `/sections/${sectionId}/images`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    
    message.success('上传图片成功');
    return unwrapResponse<Image>(response.data);
  } catch (error) {
    message.error('上传图片失败');
    throw error;
  }
};

// 删除图片
export const deleteImage = async (imageId: number | string) => {
  try {
    await request.delete<APIResponse<void>>(`/images/${imageId}`);
    message.success('删除图片成功');
  } catch (error) {
    message.error('删除图片失败');
    throw error;
  }
};

// 创建关联
export const createRelation = async (documentId: number | string, data: RelationFormData) => {
  try {
    const response = await request.post<APIResponse<Relation>>(
      `/documents/${documentId}/relations`,
      data
    );
    message.success('创建关联成功');
    return unwrapResponse<Relation>(response.data);
  } catch (error) {
    message.error('创建关联失败');
    throw error;
  }
};

// 删除关联
export const deleteRelation = async (relationId: number | string) => {
  try {
    await request.delete<APIResponse<void>>(`/relations/${relationId}`);
    message.success('删除关联成功');
  } catch (error) {
    message.error('删除关联失败');
    throw error;
  }
}; 