import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { ModuleStructureNode, ModuleStructureNodeRequest } from '../../../types/modules';
import { createModuleNode, updateModuleNode } from '../../../apis/moduleService';

interface StructureNodeModalProps {
  visible: boolean;
  type: 'add' | 'edit';
  node: ModuleStructureNode | null;
  parentNode: ModuleStructureNode | null;
  onCancel: () => void;
  onComplete: () => void;
}

const StructureNodeModal: React.FC<StructureNodeModalProps> = ({
  visible,
  type,
  node,
  parentNode,
  onCancel,
  onComplete,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);

  // 当模态框打开时，初始化表单
  useEffect(() => {
    if (visible) {
      if (type === 'edit' && node) {
        form.setFieldsValue({
          name: node.name,
        });
      } else {
        form.resetFields();
      }
    }
  }, [visible, type, node, form]);

  // 处理表单提交
  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      // 表单验证
      const values = await form.validateFields();
      
      const nodeData: ModuleStructureNodeRequest = {
        name: values.name,
      };
      
      // 如果是添加子节点，设置parent_id
      if (type === 'add' && parentNode) {
        nodeData.parent_id = parentNode.id;
      }
      
      if (type === 'edit' && node) {
        // 更新节点
        await updateModuleNode(node.id, nodeData);
        message.success('更新成功');
      } else {
        // 创建新节点
        await createModuleNode(nodeData);
        message.success('创建成功');
      }
      
      setLoading(false);
      onComplete();
    } catch (error) {
      console.error(type === 'add' ? '创建失败:' : '更新失败:', error);
      message.error(type === 'add' ? '创建失败' : '更新失败');
      setLoading(false);
    }
  };

  return (
    <Modal
      title={type === 'add' 
        ? parentNode 
          ? `添加"${parentNode.name}"的子模块` 
          : '添加顶级模块' 
        : `编辑模块"${node?.name}"`}
      open={visible}
      onOk={handleSubmit}
      onCancel={onCancel}
      confirmLoading={loading}
      maskClosable={false}
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Form.Item
          name="name"
          label="模块名称"
          rules={[{ required: true, message: '请输入模块名称' }]}
        >
          <Input placeholder="请输入模块名称" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default StructureNodeModal; 