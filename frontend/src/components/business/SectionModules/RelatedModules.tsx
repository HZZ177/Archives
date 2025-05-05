import React, { useState, useEffect } from 'react';
import { Card, Space, Typography, Button, Table, Modal, Select, Form, Input, Tag } from 'antd';
import { EditOutlined, SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { Section, Relation } from '../../../types/document';
import axios from 'axios';
import { API_BASE_URL } from '../../../config/constants';

const { Title } = Typography;
const { Option } = Select;

interface RelatedModulesProps {
  section: Section;
  documentId: number;
  onSave: (content: string) => void;
  isEditable?: boolean;
}

interface DocumentOption {
  id: number;
  title: string;
}

/**
 * 关联模块组件
 * 用于编辑和展示与当前模块关联的其他模块
 */
const RelatedModules: React.FC<RelatedModulesProps> = ({
  section,
  documentId,
  onSave,
  isEditable = true,
}) => {
  const [relations, setRelations] = useState<Relation[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [documentOptions, setDocumentOptions] = useState<DocumentOption[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载关联模块数据
  useEffect(() => {
    const fetchRelations = async () => {
      try {
        if (!documentId) return;
        
        const token = localStorage.getItem('token');
        const headers = {
          Authorization: `Bearer ${token}`
        };
        
        const response = await axios.get(`${API_BASE_URL}/documents/${documentId}/relations`, { headers });
        
        setRelations(response.data || []);
      } catch (error) {
        console.error('Failed to fetch relations:', error);
        setRelations([]);
      }
    };

    fetchRelations();
  }, [documentId]);

  // 切换编辑状态
  const toggleEdit = () => {
    setIsEditing(!isEditing);
    if (!isEditing) {
      fetchDocumentOptions();
    }
  };

  // 获取可选的文档列表
  const fetchDocumentOptions = async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };
      
      const response = await axios.get(`${API_BASE_URL}/documents`, { 
        params: { pageSize: 100 },
        headers
      });
      
      // 过滤掉当前文档
      const options = response.data.items
        .filter((doc: any) => doc.id !== documentId)
        .map((doc: any) => ({
          id: doc.id,
          title: doc.title,
        }));
      
      setDocumentOptions(options);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch document options:', error);
      setLoading(false);
    }
  };

  // 添加关联
  const handleAdd = () => {
    form.resetFields();
    setIsModalOpen(true);
  };

  // 删除关联
  const handleDelete = async (relationId: number) => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };
      
      await axios.delete(`${API_BASE_URL}/relations/${relationId}`, { headers });
      
      setRelations(relations.filter(relation => relation.id !== relationId));
    } catch (error) {
      console.error('Failed to delete relation:', error);
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };
      
      const response = await axios.post(`${API_BASE_URL}/documents/${documentId}/relations`, {
        target_doc_id: values.target_doc_id,
        relation_type: values.relation_type,
        description: values.description,
      }, { headers });
      
      setRelations([...relations, response.data]);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to create relation:', error);
    }
  };

  // 保存内容
  const handleSave = () => {
    // 关联模块的保存逻辑可能与其他模块不同，这里可能需要特殊处理
    onSave(JSON.stringify(relations));
    setIsEditing(false);
  };

  // 表格列定义
  const columns = [
    {
      title: '模块名称',
      dataIndex: 'target_doc_title',
      key: 'target_doc_title',
    },
    {
      title: '关联类型',
      dataIndex: 'relation_type',
      key: 'relation_type',
      render: (relationType: string) => (
        <Tag color="blue">{relationType || '默认关联'}</Tag>
      ),
    },
    {
      title: '关联说明',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Relation) => (
        isEditable && isEditing && (
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        )
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <span style={{ color: '#1890ff', marginRight: '8px' }}>5</span>
          <Title level={5} style={{ margin: 0 }}>关联模块</Title>
        </Space>
      }
      extra={
        isEditable && (
          isEditing ? (
            <Space>
              <Button
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                添加关联
              </Button>
              <Button 
                type="primary" 
                icon={<SaveOutlined />} 
                onClick={handleSave}
              >
                保存
              </Button>
              <Button 
                onClick={toggleEdit}
              >
                取消
              </Button>
            </Space>
          ) : (
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={toggleEdit}
            >
              编辑
            </Button>
          )
        )
      }
    >
      {relations.length > 0 ? (
        <Table
          columns={isEditing ? columns : columns.slice(0, -1)}
          dataSource={relations}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      ) : (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          暂无关联模块
        </div>
      )}

      <Modal
        title="添加关联模块"
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => setIsModalOpen(false)}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="target_doc_id"
            label="目标模块"
            rules={[{ required: true, message: '请选择关联模块' }]}
          >
            <Select
              placeholder="请选择模块"
              loading={loading}
              showSearch
              optionFilterProp="children"
            >
              {documentOptions.map(option => (
                <Option key={option.id} value={option.id}>{option.title}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="relation_type"
            label="关联类型"
          >
            <Select placeholder="请选择关联类型">
              <Option value="依赖">依赖</Option>
              <Option value="引用">引用</Option>
              <Option value="扩展">扩展</Option>
              <Option value="关联">关联</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="description"
            label="关联说明"
          >
            <Input.TextArea placeholder="请输入关联说明" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default RelatedModules; 