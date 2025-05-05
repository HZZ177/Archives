import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, message, Breadcrumb } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import DocumentEditor from './components/DocumentEditor';
import { ROUTES } from '../../config/constants';
import axios from 'axios';
import { API_BASE_URL } from '../../config/constants';

const DocumentEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [templateId, setTemplateId] = useState<string | undefined>();
  
  // 如果URL中有template参数，则设置模板ID
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const template = searchParams.get('template');
    if (template) {
      setTemplateId(template);
    }
  }, []);
  
  // 保存文档
  const handleSave = async (data: any) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };
      
      if (id) {
        // 更新文档
        await axios.put(`${API_BASE_URL}/documents/${id}`, data, { headers });
        message.success('文档更新成功');
      } else {
        // 创建文档
        const response = await axios.post(`${API_BASE_URL}/documents`, data, { headers });
        message.success('文档创建成功');
        // 导航到新创建的文档
        navigate(`${ROUTES.DOCUMENT_LIST}/${response.data.id}`);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('保存文档失败:', error);
      message.error('保存文档失败');
      setLoading(false);
    }
  };
  
  return (
    <div>
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item>
          <Link to="/"><HomeOutlined /></Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <Link to={ROUTES.DOCUMENT_LIST}>资料列表</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          {id ? '编辑资料' : '新建资料'}
        </Breadcrumb.Item>
      </Breadcrumb>
      
      <DocumentEditor 
        documentId={id} 
        templateId={templateId}
        onSave={handleSave}
      />
    </div>
  );
};

export default DocumentEdit; 