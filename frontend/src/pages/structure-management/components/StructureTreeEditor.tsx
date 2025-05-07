import React, { useState } from 'react';
import { Tree, Button, Space, Dropdown, Menu, Modal, message, Spin } from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  EllipsisOutlined, 
  DownOutlined, 
  ExclamationCircleOutlined 
} from '@ant-design/icons';
import { DataNode } from 'antd/lib/tree';
import { ModuleStructureNode } from '../../../types/modules';
import StructureNodeModal from './StructureNodeModal';
import { deleteModuleNode } from '../../../apis/moduleService';
import { refreshModuleTreeEvent } from '../../../layouts/MainLayout';

interface StructureTreeEditorProps {
  treeData: ModuleStructureNode[];
  loading: boolean;
  onTreeDataChange: () => void;
}

// 将ModuleStructureNode转换为Tree组件的DataNode
const convertToTreeNode = (
  nodes: ModuleStructureNode[], 
  onEdit: (node: ModuleStructureNode) => void,
  onAddChild: (parentNode: ModuleStructureNode) => void,
  onDelete: (node: ModuleStructureNode) => void
): DataNode[] => {
  return nodes.map(node => ({
    key: node.id.toString(),
    title: (
      <Space>
        <span>{node.name}</span>
        <Dropdown
          overlay={
            <Menu>
              <Menu.Item 
                key="add" 
                icon={<PlusOutlined />}
                onClick={(e) => {
                  e.domEvent.stopPropagation();
                  onAddChild(node);
                }}
              >
                添加子模块
              </Menu.Item>
              <Menu.Item 
                key="edit" 
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.domEvent.stopPropagation();
                  onEdit(node);
                }}
              >
                编辑
              </Menu.Item>
              <Menu.Item 
                key="delete" 
                icon={<DeleteOutlined />}
                danger
                onClick={(e) => {
                  e.domEvent.stopPropagation();
                  onDelete(node);
                }}
              >
                删除
              </Menu.Item>
            </Menu>
          }
          trigger={['click']}
        >
          <EllipsisOutlined onClick={(e) => e.stopPropagation()} />
        </Dropdown>
      </Space>
    ),
    children: node.children && node.children.length > 0 
      ? convertToTreeNode(node.children, onEdit, onAddChild, onDelete) 
      : undefined,
  }));
};

const StructureTreeEditor: React.FC<StructureTreeEditorProps> = ({ 
  treeData, 
  loading, 
  onTreeDataChange 
}) => {
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [currentNode, setCurrentNode] = useState<ModuleStructureNode | null>(null);
  const [modalType, setModalType] = useState<'add' | 'edit'>('add');
  const [parentNode, setParentNode] = useState<ModuleStructureNode | null>(null);
  const { confirm } = Modal;

  // 触发刷新事件，更新左侧导航
  const triggerRefreshEvent = () => {
    // 触发全局刷新事件
    window.dispatchEvent(refreshModuleTreeEvent);
  };

  // 打开添加顶级模块的模态框
  const handleAddRoot = () => {
    setModalType('add');
    setCurrentNode(null);
    setParentNode(null);
    setModalVisible(true);
  };

  // 打开添加子模块的模态框
  const handleAddChild = (parent: ModuleStructureNode) => {
    setModalType('add');
    setCurrentNode(null);
    setParentNode(parent);
    setModalVisible(true);
  };

  // 打开编辑模块的模态框
  const handleEdit = (node: ModuleStructureNode) => {
    setModalType('edit');
    setCurrentNode(node);
    setParentNode(null);
    setModalVisible(true);
  };

  // 处理删除模块
  const handleDelete = (node: ModuleStructureNode) => {
    confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除"${node.name}"及其所有子模块吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        try {
          await deleteModuleNode(node.id);
          message.success('删除成功');
          onTreeDataChange();
          // 触发左侧导航刷新
          triggerRefreshEvent();
        } catch (error) {
          console.error('删除失败:', error);
          message.error('删除失败');
        }
      },
    });
  };

  // 模态框完成回调
  const handleModalComplete = () => {
    setModalVisible(false);
    onTreeDataChange();
    // 触发左侧导航刷新
    triggerRefreshEvent();
  };

  // 转换树数据
  const treeNodes = convertToTreeNode(
    treeData,
    handleEdit,
    handleAddChild,
    handleDelete
  );

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAddRoot}
        >
          新增顶级模块
        </Button>
      </div>
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin />
        </div>
      ) : (
        <Tree
          showLine={true}
          showIcon={false}
          defaultExpandAll={true}
          switcherIcon={<DownOutlined />}
          treeData={treeNodes}
        />
      )}
      
      <StructureNodeModal
        visible={modalVisible}
        type={modalType}
        node={currentNode}
        parentNode={parentNode}
        onCancel={() => setModalVisible(false)}
        onComplete={handleModalComplete}
      />
    </div>
  );
};

export default StructureTreeEditor; 