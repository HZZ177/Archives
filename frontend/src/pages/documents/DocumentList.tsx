import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Space, Card, Popconfirm, message, Select, Tag } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, FileOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../config/constants';
import { Document, Template } from '../../types/document';
import axios from 'axios';
import { API_BASE_URL } from '../../config/constants';

const { Search } = Input;
const { Option } = Select;

const DocumentList: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<number | undefined>(undefined);
  
  const navigate = useNavigate();

  // 获取文档列表
  const fetchDocuments = async (page = current, size = pageSize, params: any = {}) => {
    try {
      setLoading(true);
      // 构建查询参数
      const queryParams = {
        page,
        pageSize: size,
        ...params
      };
      
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };
      
      const response = await axios.get(`${API_BASE_URL}/documents`, { 
        params: queryParams,
        headers
      });
      
      setDocuments(response.data.items);
      setTotal(response.data.total);
      setCurrent(page);
      setPageSize(size);
      setLoading(false);
    } catch (error) {
      message.error('获取文档列表失败');
      setLoading(false);
    }
  };

  // 获取模板列表
  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };
      
      const response = await axios.get(`${API_BASE_URL}/templates`, { headers });
      setTemplates(response.data.items);
    } catch (error) {
      message.error('获取模板列表失败');
    }
  };

  // 初始加载
  useEffect(() => {
    fetchDocuments();
    fetchTemplates();
  }, []);

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    fetchDocuments(1, pageSize, { keyword: value, template_id: selectedTemplate });
  };

  // 处理模板筛选变化
  const handleTemplateChange = (value: number | undefined) => {
    setSelectedTemplate(value);
    fetchDocuments(1, pageSize, { keyword: searchKeyword, template_id: value });
  };

  // 处理分页变化
  const handleTableChange = (pagination: any) => {
    fetchDocuments(
      pagination.current, 
      pagination.pageSize, 
      { 
        keyword: searchKeyword, 
        template_id: selectedTemplate 
      }
    );
  };

  // 处理删除文档
  const handleDelete = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };
      
      await axios.delete(`${API_BASE_URL}/documents/${id}`, { headers });
      message.success('删除文档成功');
      fetchDocuments(current, pageSize, { keyword: searchKeyword, template_id: selectedTemplate });
    } catch (error) {
      message.error('删除文档失败');
    }
  };

  // 创建新文档
  const handleCreateDocument = (templateId?: number) => {
    if (templateId) {
      navigate(`${ROUTES.DOCUMENT_LIST}/new?template=${templateId}`);
    } else {
      navigate(`${ROUTES.DOCUMENT_LIST}/new`);
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => (
        <Space>
          <FileOutlined />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '模板',
      dataIndex: 'template_id',
      key: 'template_id',
      render: (templateId: number) => {
        const template = templates.find(t => t.id === templateId);
        return template ? (
          <Tag color="blue">{template.name}</Tag>
        ) : (
          <Tag color="default">未知模板</Tag>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Document) => (
        <Space size="middle">
          <Button 
            type="link" 
            icon={<EditOutlined />} 
            onClick={() => navigate(`${ROUTES.DOCUMENT_LIST}/${record.id}`)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除该文档吗?"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card bordered={false}>
        <div style={{ marginBottom: 16 }}>
          <Space size="large" style={{ marginBottom: 16 }}>
            <Search
              placeholder="搜索文档标题"
              allowClear
              enterButton={<Button type="primary" icon={<SearchOutlined />}>搜索</Button>}
              size="middle"
              onSearch={handleSearch}
              style={{ width: 300 }}
            />
            
            <Select
              placeholder="选择模板筛选"
              style={{ width: 200 }}
              allowClear
              onChange={handleTemplateChange}
            >
              {templates.map(template => (
                <Option key={template.id} value={template.id}>{template.name}</Option>
              ))}
            </Select>
            
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => handleCreateDocument()}
            >
              新建文档
            </Button>
          </Space>
          
          {templates.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <span style={{ marginRight: 8 }}>从模板创建:</span>
              {templates.map(template => (
                <Button 
                  key={template.id} 
                  style={{ marginRight: 8 }}
                  onClick={() => handleCreateDocument(template.id)}
                >
                  {template.name}
                </Button>
              ))}
            </div>
          )}
        </div>
        
        <Table
          columns={columns}
          dataSource={documents}
          rowKey="id"
          pagination={{
            current,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          onChange={handleTableChange}
          loading={loading}
        />
      </Card>
    </div>
  );
};

export default DocumentList; 