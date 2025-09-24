import React, { useState, useEffect, useRef } from 'react';
import { Modal, Form, Input, message, Radio, TreeSelect } from 'antd';
import { ModuleStructureNode, ModuleStructureNodeRequest } from '../../../types/modules';
import { createModuleNode, updateModuleNode } from '../../../apis/moduleService';

interface StructureNodeModalProps {
  open: boolean;
  type: 'add' | 'edit';
  node: ModuleStructureNode | null;
  parentNode: ModuleStructureNode | null;
  onCancel: () => void;
  onComplete: () => void;
  treeData: ModuleStructureNode[]; // 用于构建父节点选择器的树数据
}

export const StructureNodeModal: React.FC<StructureNodeModalProps> = ({
  open,
  type,
  node,
  parentNode,
  onCancel,
  onComplete,
  treeData,
}) => {
  // 确保form实例在组件渲染时已创建
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  // 创建输入框ref，用于手动聚焦
  const inputRef = useRef<any>(null);

  // 处理树数据，过滤不适合作为父节点的选项
  const processTreeData = (
    treeNodes: ModuleStructureNode[], 
    currentNodeId?: number
  ): any[] => {
    // 如果没有节点或是空数组，返回空数组
    if (!treeNodes || treeNodes.length === 0) {
      return [];
    }

    // 递归查找节点所有子节点的ID
    const findAllChildrenIds = (node: ModuleStructureNode): number[] => {
      let ids: number[] = [node.id];
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
          ids = [...ids, ...findAllChildrenIds(child)];
        });
      }
      return ids;
    };

    // 获取当前节点的所有子节点ID（如果是编辑模式）
    let disabledIds: number[] = [];
    if (type === 'edit' && currentNodeId) {
      const findNode = (nodes: ModuleStructureNode[], id: number): ModuleStructureNode | null => {
        for (const n of nodes) {
          if (n.id === id) return n;
          if (n.children && n.children.length > 0) {
            const found = findNode(n.children, id);
            if (found) return found;
          }
        }
        return null;
      };

      const currentNode = findNode(treeNodes, currentNodeId);
      if (currentNode) {
        disabledIds = findAllChildrenIds(currentNode);
      }
    }

    // 转换树节点为TreeSelect需要的格式
    return treeNodes.map(item => {
      // 内容页面不能作为父节点，本身和子节点也不能选择
      const isDisabled = item.is_content_page || 
                         (disabledIds.includes(item.id));
      
      const node = {
        title: item.name,
        value: item.id,
        key: item.id,
        disabled: isDisabled,
        children: item.children && item.children.length > 0 
          ? processTreeData(item.children, currentNodeId)
          : undefined
      };

      return node;
    });
  };

  // 处理后的树数据，用于父节点选择
  const processedTreeData = processTreeData(treeData, node?.id);

  // 当模态框打开时，初始化表单
  useEffect(() => {
    if (open) {
      if (type === 'edit' && node) {
        // 在编辑模式下，设置表单值
        form.setFieldsValue({
          name: node.name,
          module_type: node.is_content_page ? 'content_page' : 'structure_node',
          parent_id: node.parent_id || undefined
        });
      } else if (type === 'add') {
        // 在添加模式下，重置表单并强制设置默认值
        form.setFieldsValue({
          name: '',
          module_type: 'structure_node',
          parent_id: parentNode?.id || undefined
        });
      }
    }
  }, [open, type, node, form, parentNode]);

  // 用于在模态框打开后聚焦到输入框
  useEffect(() => {
    if (open) {
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
  }, [open]);

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
      
      // 在编辑模式下，如果选择了父节点，设置parent_id
      if (type === 'edit') {
        // 只有当明确选择了父节点值或明确设置为undefined时才包含这个字段
        // 这样可以避免在不需要修改父节点时发送null值
        if ('parent_id' in values) {
          nodeData.parent_id = values.parent_id;
        }
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
      open={open}
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
        
        {type === 'edit' && (
          <Form.Item
            name="parent_id"
            label="父节点"
            help="选择新的父节点可以更改模块在结构中的层级位置"
          >
            <TreeSelect
              showSearch
              style={{ width: '100%' }}
              dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
              placeholder="请选择父节点"
              allowClear
              treeDefaultExpandAll
              treeData={processedTreeData}
              treeNodeFilterProp="title"
            />
          </Form.Item>
        )}
        
        <Form.Item
          name="module_type"
          label="模块类型"
          rules={[{ required: true, message: '请选择模块类型' }]}
        >
          <Radio.Group>
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