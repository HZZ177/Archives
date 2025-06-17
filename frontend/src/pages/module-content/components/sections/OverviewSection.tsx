import React, { useState } from 'react';
import { MdEditor } from 'md-editor-rt';
import 'md-editor-rt/lib/style.css';
import axios from 'axios';
import { message } from 'antd';
import { API_BASE_URL } from '../../../../config/constants';
import './SectionStyles.css'; // 导入共享样式

interface OverviewSectionProps {
  value: string;
  onChange: (value: string) => void;
}

const OverviewSection: React.FC<OverviewSectionProps> = ({ value, onChange }) => {
  // 为编辑器ID提供唯一标识
  const [editorId] = useState('overview-editor-' + Date.now());
  
  // 处理图片上传
  const handleUploadImage = async (files: File[], callback: (urls: string[]) => void) => {
    try {
      // 准备上传多个文件的promises
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        // 获取token
        const token = localStorage.getItem('token');
        
        // 发送上传请求
        const response = await axios.post(
          `${API_BASE_URL}/images/upload`, 
          formData, 
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );
        
        // 如果上传成功，返回图片URL
        if (response.data && response.data.success && response.data.data) {
          return response.data.data.url; // 返回完整的图片URL
        } else {
          throw new Error(response.data?.message || '图片上传失败');
        }
      });
      
      // 等待所有上传完成
      const urls = await Promise.all(uploadPromises);
      
      // 调用回调函数，将URL插入编辑器
      callback(urls);
      message.success('图片上传成功');
    } catch (error) {
      console.error('图片上传失败:', error);
      message.error('图片上传失败: ' + (error instanceof Error ? error.message : String(error)));
      // 即使失败也调用回调，避免编辑器卡住
      callback([]);
    }
  };
  
  return (
    <div className="section-content">
      <div className="markdown-hint" style={{ marginBottom: '16px', color: '#888' }}>
        支持Markdown语法，例如: **加粗文本**, *斜体文本*, `代码`, # 标题, 等。左侧编辑，右侧实时预览。
        <br />
        <span style={{ color: '#1890ff' }}>支持粘贴图片</span>
      </div>
      
      <MdEditor
        modelValue={value}
        onChange={onChange}
        id={editorId}
        language="zh-CN"
        previewTheme="github"
        codeTheme="atom"
        preview={true}
        style={{ height: '400px', boxShadow: '0 0 0 1px #f0f0f0' }}
        placeholder="请输入功能概述（支持换行和基本Markdown语法）"
        onUploadImg={handleUploadImage}
      />
    </div>
  );
};

export default OverviewSection; 