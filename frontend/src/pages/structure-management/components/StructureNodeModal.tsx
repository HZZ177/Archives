import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, message, Radio } from 'antd';
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

export const StructureNodeModal: React.FC<StructureNodeModalProps> = ({
  visible,
  type,
  node,
  parentNode,
  onCancel,
  onComplete,
}) => {
  // 确保form实例在组件渲染时已创建
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);

  // 当模态框打开时，初始化表单
  useEffect(() => {
    if (visible) {
      console.log('模态框打开，type:', type, 'node:', node);
      
      if (type === 'edit' && node) {
        console.log('编辑模式，设置表单值');
        // 在编辑模式下，设置表单值
        form.setFieldsValue({
          name: node.name,
          module_type: node.is_content_page ? 'content_page' : 'structure_node',
        });
      } else if (type === 'add') {
        console.log('添加模式，设置默认值');
        // 在添加模式下，重置表单并强制设置默认值
        form.setFieldsValue({
          name: '',
          module_type: 'structure_node',
        });
      }
    }
  }, [visible, type, node, form]);

  // 添加一个useEffect用于监控表单值变化
  useEffect(() => {
    if (visible) {
      // 定义一个函数来打印表单当前值
      const logFormValues = () => {
        const currentValues = form.getFieldsValue();
        console.log('当前表单值:', currentValues);
      };
      
      // 立即打印一次
      logFormValues();
      
      // 设置一个定时器定期检查表单值，用于调试
      const interval = setInterval(logFormValues, 1000);
      
      return () => {
        clearInterval(interval);
      };
    }
  }, [visible, form]);

  // 处理表单提交
  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      // 表单验证
      const values = await form.validateFields();
      
      const nodeData: ModuleStructureNodeRequest = {
        name: values.name,
        is_content_page: values.module_type === 'content_page'
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
      // 调用完成回调，触发刷新
      onComplete();
    } catch (error) {
      console.error(type === 'add' ? '创建失败:' : '更新失败:', error);
      message.error(type === 'add' ? '创建失败' : '更新失败');
      setLoading(false);
    }
  };

  // 处理关闭模态框
  const handleCancel = () => {
    // 关闭模态框时重置表单，避免表单状态残留
    console.log('取消操作，重置表单');
    form.resetFields();
    // 重置后确保默认选择节点类型
    if (type === 'add') {
      console.log('是添加模式，重新设置默认值');
      form.setFieldsValue({
        module_type: 'structure_node',
      });
    }
    onCancel();
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
      onCancel={handleCancel}
      confirmLoading={loading}
      maskClosable={false}
      destroyOnClose={true}
    >
      <Form
        form={form}
        layout="vertical"
        name="structure_node_form"
        preserve={false}
        initialValues={{
          module_type: type === 'edit' && node ? (node.is_content_page ? 'content_page' : 'structure_node') : 'structure_node'
        }}
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
          <Radio.Group defaultValue="structure_node">
            <Radio value="structure_node">节点 (可添加子模块)</Radio>
            <Radio value="content_page">内容页面 (显示六部分模板)</Radio>
          </Radio.Group>
        </Form.Item>
        
        {form.getFieldValue('module_type') === 'content_page' && (
          <div style={{ backgroundColor: '#f5f5f5', padding: '8px 12px', borderRadius: '4px', marginBottom: '12px' }}>
            <p style={{ margin: 0, color: '#555' }}>
              内容页面将显示模块功能概述、逻辑图、功能详解、数据库表、关联模块、涉及接口六部分编辑内容。
            </p>
          </div>
        )}
      </Form>
    </Modal>
  );
};

// 为了向后兼容，同时提供默认导出
export default StructureNodeModal; 