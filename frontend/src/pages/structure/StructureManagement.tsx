import React, { useState, useEffect } from 'react';
import { Card, Tree, Button, Modal, Form, Input, message, Space, Dropdown, Menu } from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  MoreOutlined,
  ExclamationCircleOutlined 
} from '@ant-design/icons';
import { Key } from 'rc-tree/lib/interface';
import type { DataNode, TreeProps } from 'antd/es/tree';
import { ModuleStructure } from '../../types/module';
import request from '../../utils/request';

const { DirectoryTree } = Tree;
const { confirm } = Modal;

/**
 * 结构管理页面
 * 用于管理系统的模块结构，允许用户创建自定义模块和组织结构树
 */
const StructureManagement: React.FC = () => {
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingModule, setEditingModule] = useState<ModuleStructure | null>(null);
  const [form] = Form.useForm();
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);

  // 加载模块结构
  const fetchModuleStructure = async () => {
    try {
      setLoading(true);
      const response = await request.get('/module-structures');
      
      if (response?.data) {
        // 将后端数据转换为树形结构
        const treeData = convertToTreeData(response.data);
        setTreeData(treeData);
        
        // 默认展开第一级
        const firstLevelKeys = treeData.map(item => item.key);
        setExpandedKeys(firstLevelKeys);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('获取模块结构失败:', error);
      message.error('获取模块结构失败');
      setLoading(false);
    }
  };

  // 将后端数据转换为树形结构
  const convertToTreeData = (data: ModuleStructure[]): DataNode[] => {
    // 这里的实现会根据您的后端数据结构而定
    // 示例实现
    const buildTree = (items: ModuleStructure[], parentId: number | null = null): DataNode[] => {
      return items
        .filter(item => item.parent_id === parentId)
        .map(item => ({
          key: item.id.toString(),
          title: item.name,
          data: item,
          children: buildTree(items, item.id),
        }));
    };
    
    return buildTree(data);
  };

  // 初始加载
  useEffect(() => {
    fetchModuleStructure();
  }, []);

  // 打开新增模块弹窗
  const handleAddModule = (parentId?: number) => {
    form.resetFields();
    setEditingModule(null);
    
    if (parentId) {
      form.setFieldsValue({ parent_id: parentId });
    }
    
    setModalVisible(true);
  };

  // 打开编辑模块弹窗
  const handleEditModule = (module: ModuleStructure) => {
    setEditingModule(module);
    form.setFieldsValue({
      name: module.name,
      description: module.description,
      parent_id: module.parent_id,
    });
    setModalVisible(true);
  };

  // 处理模块删除
  const handleDeleteModule = async (moduleId: number) => {
    confirm({
      title: '确定要删除该模块吗?',
      icon: <ExclamationCircleOutlined />,
      content: '删除后将无法恢复，且会同时删除所有子模块和相关资料。',
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await request.delete(`/module-structures/${moduleId}`);
          message.success('模块删除成功');
          fetchModuleStructure();
        } catch (error) {
          console.error('删除模块失败:', error);
          message.error('删除模块失败');
        }
      },
    });
  };

  // 保存模块
  const handleSaveModule = async () => {
    try {
      const values = await form.validateFields();
      
      setLoading(true);
      if (editingModule) {
        // 更新模块
        await request.put(`/module-structures/${editingModule.id}`, values);
        message.success('模块更新成功');
      } else {
        // 创建模块
        await request.post('/module-structures', values);
        message.success('模块创建成功');
      }
      
      setModalVisible(false);
      fetchModuleStructure();
      setLoading(false);
    } catch (error) {
      console.error('保存模块失败:', error);
      message.error('保存模块失败');
      setLoading(false);
    }
  };

  // 处理拖拽排序
  const onDrop: TreeProps['onDrop'] = async (info) => {
    const dropKey = info.node.key as string;
    const dragKey = info.dragNode.key as string;
    const dropPos = info.node.pos.split('-');
    const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1]);
    
    try {
      // 发送请求更新模块顺序和父子关系
      await request.post('/module-structures/reorder', {
        drag_id: parseInt(dragKey),
        drop_id: parseInt(dropKey),
        drop_position: dropPosition,
      });
      
      message.success('模块位置更新成功');
      fetchModuleStructure();
    } catch (error) {
      console.error('更新模块位置失败:', error);
      message.error('更新模块位置失败');
    }
  };

  // 模块操作菜单
  const getNodeMenu = (module: ModuleStructure) => (
    <Menu
      items={[
        {
          key: 'add-child',
          icon: <PlusOutlined />,
          label: '添加子模块',
          onClick: () => handleAddModule(module.id),
        },
        {
          key: 'edit',
          icon: <EditOutlined />,
          label: '编辑模块',
          onClick: () => handleEditModule(module),
        },
        {
          key: 'delete',
          icon: <DeleteOutlined />,
          label: '删除模块',
          danger: true,
          onClick: () => handleDeleteModule(module.id),
        },
      ]}
    />
  );

  // 自定义树节点渲染
  const renderTreeNodes = (data: DataNode[]): DataNode[] => {
    return data.map(item => {
      const module = item.data as ModuleStructure;
      const newItem = { ...item };
      
      // 定制节点标题，添加操作按钮
      newItem.title = (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span>{item.title}</span>
          <Dropdown overlay={getNodeMenu(module)} trigger={['click']}>
            <Button 
              type="text" 
              icon={<MoreOutlined />} 
              size="small"
              onClick={e => e.stopPropagation()}
            />
          </Dropdown>
        </div>
      );
      
      if (item.children) {
        newItem.children = renderTreeNodes(item.children);
      }
      
      return newItem;
    });
  };

  return (
    <div className="structure-management">
      <Card
        title="模块结构管理"
        extra={
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => handleAddModule()}
          >
            添加顶级模块
          </Button>
        }
        style={{ minHeight: 500 }}
      >
        {treeData.length > 0 ? (
          <DirectoryTree
            draggable
            blockNode
            onDrop={onDrop}
            treeData={renderTreeNodes(treeData)}
            expandedKeys={expandedKeys}
            selectedKeys={selectedKeys}
            onSelect={(keys) => setSelectedKeys(keys)}
            onExpand={(keys) => setExpandedKeys(keys)}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p>暂无模块结构，请添加顶级模块</p>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => handleAddModule()}
            >
              添加顶级模块
            </Button>
          </div>
        )}
      </Card>

      {/* 模块编辑弹窗 */}
      <Modal
        title={editingModule ? '编辑模块' : '新增模块'}
        open={modalVisible}
        onOk={handleSaveModule}
        onCancel={() => setModalVisible(false)}
        confirmLoading={loading}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ parent_id: null }}
        >
          <Form.Item
            name="name"
            label="模块名称"
            rules={[{ required: true, message: '请输入模块名称' }]}
          >
            <Input placeholder="请输入模块名称" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="模块描述"
          >
            <Input.TextArea rows={4} placeholder="请输入模块描述" />
          </Form.Item>
          
          <Form.Item
            name="parent_id"
            label="父模块"
            hidden
          >
            <Input type="hidden" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StructureManagement; 