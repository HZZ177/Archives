import React, { useState, useEffect } from 'react';
import { Spin, Tabs, Button, Form, Input, Radio, message, Space, Divider } from 'antd';
import { EditOutlined, SaveOutlined, FolderOutlined, FileOutlined } from '@ant-design/icons';
import { ModuleStructureNode, ModuleStructureNodeRequest } from '../../../types/modules';
import { updateModuleNode } from '../../../apis/moduleService';

const { TabPane } = Tabs;

interface NodeDetailPanelProps {
  node: ModuleStructureNode | null;
  loading: boolean;
  onNodeUpdated: () => void;
}

const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({ 
  node, 
  loading,
  onNodeUpdated
}) => {
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // 当节点变化时，重置表单和编辑状态
  useEffect(() => {
    if (node) {
      form.setFieldsValue({
        name: node.name,
        module_type: node.is_content_page ? 'content_page' : 'structure_node',
      });
      setEditing(false);
    }
  }, [node, form]);

  // 如果没有选中节点或正在加载，显示加载状态
  if (!node) {
    return (
      <div className="empty-detail-panel">
        <p>请从左侧选择一个节点查看详情</p>
      </div>
    );
  }

  // 处理表单提交
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      
      const nodeData: ModuleStructureNodeRequest = {
        name: values.name,
        is_content_page: values.module_type === 'content_page'
      };
      
      await updateModuleNode(node.id, nodeData);
      message.success('更新成功');
      setSaving(false);
      setEditing(false);
      onNodeUpdated();
    } catch (error) {
      console.error('更新失败:', error);
      message.error('更新失败');
      setSaving(false);
    }
  };

  // 取消编辑
  const handleCancel = () => {
    if (node) {
      form.setFieldsValue({
        name: node.name,
        module_type: node.is_content_page ? 'content_page' : 'structure_node',
      });
    }
    setEditing(false);
  };

  return (
    <Spin spinning={loading || saving}>
      <div className="node-detail-panel">
        <div className="node-header">
          <div className="node-icon-title">
            {node.is_content_page ? (
              <FileOutlined className="node-icon" />
            ) : (
              <FolderOutlined className="node-icon" />
            )}
            <h2 className="node-title">{node.name}</h2>
          </div>
          
          {!editing && (
            <Button 
              type="primary" 
              icon={<EditOutlined />} 
              onClick={() => setEditing(true)}
            >
              编辑
            </Button>
          )}
        </div>
        
        <Divider />
        
        {editing ? (
          <Form
            form={form}
            layout="vertical"
            className="node-edit-form"
          >
            <Form.Item
              name="name"
              label="模块名称"
              rules={[{ required: true, message: '请输入模块名称' }]}
            >
              <Input placeholder="请输入模块名称" />
            </Form.Item>
            
            <Form.Item
              name="module_type"
              label="模块类型"
              rules={[{ required: true, message: '请选择模块类型' }]}
            >
              <Radio.Group>
                <Radio value="structure_node">节点 (可添加子模块)</Radio>
                <Radio value="content_page">内容页面 (可编辑模块功能)</Radio>
              </Radio.Group>
            </Form.Item>
            
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSubmit}
                >
                  保存
                </Button>
                <Button onClick={handleCancel}>取消</Button>
              </Space>
            </Form.Item>
          </Form>
        ) : (
          <div className="node-info">
            <div className="info-item">
              <span className="label">ID:</span>
              <span className="value">{node.id}</span>
            </div>
            <div className="info-item">
              <span className="label">名称:</span>
              <span className="value">{node.name}</span>
            </div>
            <div className="info-item">
              <span className="label">类型:</span>
              <span className="value">
                {node.is_content_page ? '内容页面' : '结构节点'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">父节点ID:</span>
              <span className="value">
                {node.parent_id ? node.parent_id : '无 (顶级节点)'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">创建时间:</span>
              <span className="value">
                {new Date(node.created_at).toLocaleString()}
              </span>
            </div>
            <div className="info-item">
              <span className="label">更新时间:</span>
              <span className="value">
                {new Date(node.updated_at).toLocaleString()}
              </span>
            </div>
          </div>
        )}
        
        {/* 如果是内容页面，这里将来可以添加更多内容编辑选项 */}
        {node.is_content_page && !editing && (
          <div className="content-page-section">
            <Divider orientation="left">内容页面信息</Divider>
            <div className="content-placeholder">
              <p>此处将显示内容页面的相关信息及编辑功能，包括：</p>
              <ul>
                <li>模块功能概述</li>
                <li>逻辑图</li>
                <li>功能详解</li>
                <li>数据库表</li>
                <li>关联模块</li>
                <li>涉及接口</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </Spin>
  );
};

export default NodeDetailPanel; 