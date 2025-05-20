import React, { useState } from 'react';
import { message, Spin, Modal } from 'antd';
import { deleteModuleNode, updateNodeOrder } from '../../../apis/moduleService';
import { refreshModuleTreeEvent } from '../../../layouts/MainLayout';
import { useModules } from '../../../contexts/ModuleContext';
import { ModuleStructureNode } from '../../../types/modules';
import { StructureNodeModal } from './StructureNodeModal';
import { CustomTree } from './CustomTree';

interface StructureTreeEditorProps {
  treeData: ModuleStructureNode[];
  loading: boolean;
  onTreeDataChange: () => void;
  focusNodeId?: number;
  onNodeSelect?: (node: ModuleStructureNode) => void;
}

const StructureTreeEditor: React.FC<StructureTreeEditorProps> = ({
  treeData,
  loading,
  onTreeDataChange,
  focusNodeId,
  onNodeSelect
}) => {
  const { fetchModules } = useModules();
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [currentNode, setCurrentNode] = useState<ModuleStructureNode | null>(null);
  const [modalType, setModalType] = useState<'add' | 'edit'>('add');
  const [parentNode, setParentNode] = useState<ModuleStructureNode | null>(null);
  const { confirm } = Modal;
  const [autoExpandParentId, setAutoExpandParentId] = useState<number | null>(null);

  // 触发刷新事件，更新左侧导航
  const triggerRefreshEvent = () => {
    fetchModules(true).then(() => {
      // console.log('StructureTreeEditor: ModuleContext数据已强制刷新');
    });
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
    if (parent.is_content_page) {
      message.warning('内容页面节点不能添加子模块');
      return;
    }
    setModalType('add');
    setCurrentNode(null);
    setParentNode(parent);
    setModalVisible(true);
  };

  // 处理删除模块
  const handleDelete = (node: ModuleStructureNode) => {
    confirm({
      title: '确认删除',
      content: `确定要删除"${node.name}"及其所有子模块吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        try {
          await deleteModuleNode(node.id);
          message.success('删除成功');
          onTreeDataChange();
          triggerRefreshEvent();
        } catch (error: any) {
          let errorMessage = '删除失败';
          if (error.response?.data) {
            if (error.response.data.message) {
              errorMessage = error.response.data.message;
            } else if (error.response.data.detail) {
              errorMessage = error.response.data.detail;
            }
          } else if (error.message) {
            errorMessage = error.message;
          }
          message.error(errorMessage);
        }
      },
    });
  };

  // 处理模态框完成事件
  const handleModalComplete = (newNode?: ModuleStructureNode) => {
    setModalVisible(false);
    onTreeDataChange();
    triggerRefreshEvent();
    // 新建节点后自动展开父节点
    if (parentNode && modalType === 'add') {
      setAutoExpandParentId(parentNode.id);
    }
  };

  return (
    <div className="structure-tree-container">
      <Spin spinning={loading}>
        <CustomTree
          treeData={treeData}
          loading={loading}
          onTreeDataChange={onTreeDataChange}
          focusNodeId={focusNodeId}
          onNodeSelect={onNodeSelect}
          onAddRoot={handleAddRoot}
          onAddChild={handleAddChild}
          onDelete={handleDelete}
          autoExpandParentId={autoExpandParentId}
        />
      </Spin>
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