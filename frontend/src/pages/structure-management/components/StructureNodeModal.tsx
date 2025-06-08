import React, { useState, useEffect, useRef } from 'react';
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
  // 创建输入框ref，用于手动聚焦
  const inputRef = useRef<any>(null);

  // 当模态框打开时，初始化表单
  useEffect(() => {
    if (visible) {
      if (type === 'edit' && node) {
        // 在编辑模式下，设置表单值
        form.setFieldsValue({
          name: node.name,
          module_type: node.is_content_page ? 'content_page' : 'structure_node',
        });
      } else if (type === 'add') {
        // 在添加模式下，重置表单并强制设置默认值
        form.setFieldsValue({
          name: '',
          module_type: 'structure_node',
        });
      }
    }
  }, [visible, type, node, form]);

  // 用于在模态框打开后聚焦到输入框
  useEffect(() => {
    if (visible) {
      // 使用setTimeout确保在Modal完全显示后再聚焦
      const focusTimer = setTimeout(() => {
        if (inputRef.current && inputRef.current.focus) {
          inputRef.current.focus();
        }
      }, 100); // 延迟100ms，确保模态框已完全显示
      
      return () => {
        clearTimeout(focusTimer);
      };
    }
  }, [visible]);

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
    } catch (error: any) {
      console.error(type === 'add' ? '创建失败:' : '更新失败:', error);
      
      // 提取错误信息
      let errorMessage = type === 'add' ? '创建失败' : '更新失败';
      
      // 检查错误响应中的message字段
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // 显示具体错误消息
      message.error(errorMessage);
      setLoading(false);
    }
  };

  // 处理关闭模态框
  const handleCancel = () => {
    // 关闭模态框时重置表单，避免表单状态残留
    form.resetFields();
    // 重置后确保默认选择节点类型
    if (type === 'add') {
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
          <Input 
            placeholder="请输入模块名称" 
            autoFocus 
            ref={inputRef} 
          />
        </Form.Item>
        
        <Form.Item
          name="module_type"
          label="模块类型"
          rules={[{ required: true, message: '请选择模块类型' }]}
        >
          <Radio.Group defaultValue="structure_node">
            <Radio value="structure_node">节点 (可添加子模块)</Radio>
            <Radio value="content_page">内容页面 (根据配置模板渲染模块内容)</Radio>
          </Radio.Group>
        </Form.Item>
        
        {/* 使用Form.Item的noStyle和dependencies属性监听module_type字段变化 */}
        <Form.Item noStyle dependencies={['module_type']}>
          {({ getFieldValue }) => {
            const moduleType = getFieldValue('module_type');
            return (
              <>
                {moduleType === 'structure_node' && (
                  <div style={{ backgroundColor: '#f5f5f5', padding: '8px 12px', borderRadius: '4px', marginBottom: '12px' }}>
                    <p style={{ margin: 0, color: '#555' }}>
                      目录节点可用于组织系统模块结构，支持添加子模块和子页面，但不直接包含内容。
                    </p>
                  </div>
                )}
                {moduleType === 'content_page' && (
                  <div style={{ backgroundColor: '#f5f5f5', padding: '8px 12px', borderRadius: '4px', marginBottom: '12px' }}>
                    <p style={{ margin: 0, color: '#555' }}>
                      内容页面将根据配置模板按顺序渲染对应的模块内容，此为填写业务逻辑的页面。
                    </p>
                  </div>
                )}
              </>
            );
          }}
        </Form.Item>
      </Form>
    </Modal>
  );
};

// 为了向后兼容，同时提供默认导出
export default StructureNodeModal; 