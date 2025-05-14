import React, { useState, useEffect, useRef } from 'react';
import { Tree, Button, Space, Dropdown, Menu, Modal, message, Spin, Tooltip } from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  MoreOutlined, 
  DownOutlined, 
  ExclamationCircleOutlined,
  FolderOutlined,
  FileOutlined
} from '@ant-design/icons';
import { DataNode } from 'antd/lib/tree';
import { ModuleStructureNode } from '../../../types/modules';
import { StructureNodeModal } from './StructureNodeModal';
import { deleteModuleNode } from '../../../apis/moduleService';
import { refreshModuleTreeEvent } from '../../../layouts/MainLayout';
import { useModules } from '../../../contexts/ModuleContext';
import { Key } from 'rc-tree/lib/interface';
import './treeStyles.css'; // 新增样式文件引用

interface StructureTreeEditorProps {
  treeData: ModuleStructureNode[];
  loading: boolean;
  onTreeDataChange: () => void;
  focusNodeId?: number;
  onNodeSelect?: (node: ModuleStructureNode) => void; // 新增节点选择回调
}

// 将ModuleStructureNode转换为Tree组件的DataNode
const convertToTreeNode = (
  nodes: ModuleStructureNode[], 
  onEdit: (node: ModuleStructureNode) => void,
  onAddChild: (parentNode: ModuleStructureNode) => void,
  onDelete: (node: ModuleStructureNode) => void,
  onSelect?: (node: ModuleStructureNode) => void // 新增节点选择回调
): DataNode[] => {
  return nodes.map(node => ({
    key: node.id.toString(),
    icon: node.is_content_page ? <FileOutlined /> : <FolderOutlined />,
    title: (
      <div className="tree-node-wrapper">
        {node.name}
        
        {/* 操作按钮区域 - 只有非内容页面节点才显示添加按钮 */}
        <div className={`node-actions ${node.is_content_page ? 'content-node-actions' : ''}`} onClick={e => e.stopPropagation()}>
          {/* 只有当节点不是内容页面时才显示添加按钮 */}
          {!node.is_content_page && (
          <Tooltip title="添加子模块" placement="top">
            <Button 
              type="text" 
              size="small" 
              icon={<PlusOutlined />} 
              className="node-action-btn"
                onClick={(e) => {
                e.stopPropagation();
                onAddChild(node);
                }}
            />
          </Tooltip>
          )}
          
          <Tooltip title="删除" placement="top">
            <Button 
              type="text" 
              size="small" 
                icon={<DeleteOutlined />}
              className="node-action-btn"
                danger
                onClick={(e) => {
                e.stopPropagation();
                  onDelete(node);
                }}
            />
          </Tooltip>
        </div>
      </div>
    ),
    children: node.children && node.children.length > 0 
      ? convertToTreeNode(node.children, onEdit, onAddChild, onDelete, onSelect) 
      : undefined,
    // 保存原始节点信息，方便后续使用
    originNode: node,
  }));
};

// 递归获取树中所有节点的key
const getAllTreeKeys = (treeData: DataNode[]): Key[] => {
  let keys: Key[] = [];
  
  treeData.forEach(node => {
    keys.push(node.key);
    if (node.children) {
      keys = keys.concat(getAllTreeKeys(node.children));
    }
  });
  
  return keys;
};

// 递归查找指定ID的节点
const findNodeById = (nodes: ModuleStructureNode[], id: number): ModuleStructureNode | null => {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children && node.children.length > 0) {
      const found = findNodeById(node.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

// 查找从根节点到目标节点的路径
const findPathToNode = (nodes: ModuleStructureNode[], targetId: number, path: number[] = []): number[] | null => {
  for (const node of nodes) {
    // 尝试当前节点路径
    const currentPath = [...path, node.id];
    
    // 如果找到目标节点，返回路径
    if (node.id === targetId) {
      return currentPath;
    }
    
    // 如果有子节点，递归搜索
    if (node.children && node.children.length > 0) {
      const foundPath = findPathToNode(node.children, targetId, currentPath);
      if (foundPath) {
        return foundPath;
      }
    }
  }
  
  // 没找到返回null
  return null;
};

const StructureTreeEditor: React.FC<StructureTreeEditorProps> = ({ 
  treeData, 
  loading, 
  onTreeDataChange,
  focusNodeId,
  onNodeSelect
}) => {
  // 获取ModuleContext，以便直接刷新模块数据
  const { fetchModules } = useModules();
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [currentNode, setCurrentNode] = useState<ModuleStructureNode | null>(null);
  const [modalType, setModalType] = useState<'add' | 'edit'>('add');
  const [parentNode, setParentNode] = useState<ModuleStructureNode | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);
  const { confirm } = Modal;

  // 添加一个ref标记是否是首次渲染
  const isFirstRender = useRef(true);

  // 当树数据变化时，只在首次渲染时设置展开的节点
  useEffect(() => {
    if (treeData.length > 0 && isFirstRender.current) {
      // 只在首次渲染时展开第一级
      const firstLevelKeys = treeData.map(node => node.id.toString());
      setExpandedKeys(firstLevelKeys);
      // 标记首次渲染已完成
      isFirstRender.current = false;
    }
  }, [treeData]);

  // 当focusNodeId变化时，设置选中的节点
  useEffect(() => {
    if (focusNodeId && treeData.length > 0) {
      setSelectedKeys([focusNodeId.toString()]);
      
      // 找到从根节点到选中节点的路径
      const nodePath = findPathToNode(treeData, focusNodeId);
      
      if (nodePath) {
        // 只展开路径上的节点，而不是所有节点
        const pathKeys = nodePath.map(id => id.toString());
        
        // 保留用户已手动展开的节点，并添加到选中节点的路径
        setExpandedKeys(prevKeys => {
          // 创建一个Set来去除重复的key
          const keySet = new Set([...prevKeys, ...pathKeys]);
          return Array.from(keySet);
        });
      }
    } else if (!focusNodeId) {
      setSelectedKeys([]);
      // 不重置expandedKeys，保持当前展开状态
    }
  }, [focusNodeId, treeData]);

  // 处理节点展开/折叠
  const handleExpand = (keys: Key[]) => {
    setExpandedKeys(keys);
  };

  // 处理节点选择
  const handleNodeSelect = (node: ModuleStructureNode) => {
    setSelectedKeys([node.id.toString()]);
    // 调用父组件传入的选择回调
    if (onNodeSelect) {
      onNodeSelect(node);
    }
  };

  // 处理树节点选择事件
  const handleTreeSelect = (selectedKeys: Key[], info: any) => {
    if (selectedKeys.length > 0 && info.node.originNode) {
      handleNodeSelect(info.node.originNode);
    }
  };

  // 触发刷新事件，更新左侧导航
  const triggerRefreshEvent = () => {
    console.log('StructureTreeEditor: 触发全局刷新事件 (通过ModuleContext和刷新事件)');
    // 使用ModuleContext直接刷新
    fetchModules(true).then(() => {
      console.log('StructureTreeEditor: ModuleContext数据已强制刷新');
    });
    // 同时触发全局刷新事件，保持兼容性
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
    // 如果父节点是内容页面类型，则不允许添加子模块
    if (parent.is_content_page) {
      message.warning('内容页面节点不能添加子模块');
      return;
    }
    
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
        } catch (error: any) {
          console.error('删除失败:', error);
          // 提取详细的错误信息
          let errorMessage = '删除失败';
          
          // 处理API响应格式的错误
          if (error.response?.data) {
            // 优先使用统一格式的 message 字段
            if (error.response.data.message) {
              errorMessage = error.response.data.message;
            } else if (error.response.data.detail) {
              // 兼容旧格式的 detail 字段
              errorMessage = error.response.data.detail;
            }
          } else if (error.message) {
            // 直接使用错误对象的 message
            errorMessage = error.message;
          }
          
          // 显示详细的错误信息
          message.error(errorMessage);
        }
      },
    });
  };

  // 处理模态框完成事件
  const handleModalComplete = () => {
    setModalVisible(false);
    
    // 刷新树数据
    // 注意：由于修改了useEffect钩子，这里刷新树数据不会重置展开状态
    console.log('StructureTreeEditor: 节点修改完成，刷新树数据');
    onTreeDataChange();
    
    // 如果是添加子节点，自动展开父节点
    if (modalType === 'add' && parentNode) {
      // 确保父节点ID在expandedKeys中
      setExpandedKeys(prevKeys => {
        const parentKey = parentNode.id.toString();
        if (!prevKeys.includes(parentKey)) {
          console.log(`StructureTreeEditor: 自动展开父节点 [${parentNode.name}]`);
          return [...prevKeys, parentKey];
        }
        return prevKeys;
      });
    }
    
    // 同时通知全局刷新
    triggerRefreshEvent();
  };

  // 转换树数据
  const treeNodes = convertToTreeNode(
    treeData,
    handleEdit,
    handleAddChild,
    handleDelete,
    handleNodeSelect
  );

  return (
    <div className="structure-tree-container">
      <div className="tree-header">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAddRoot}
          className="add-root-button"
        >
          新增顶级模块
        </Button>
      </div>
      
      <Spin spinning={loading}>
        {treeNodes.length > 0 ? (
        <Tree
            showLine
            showIcon
          switcherIcon={<DownOutlined />}
            expandedKeys={expandedKeys}
            selectedKeys={selectedKeys}
            onExpand={handleExpand}
            onSelect={handleTreeSelect}
          treeData={treeNodes}
            className="modern-tree"
            motion={false}
        />
        ) : (
          <div className="empty-tree-placeholder">
            <FolderOutlined style={{ fontSize: '32px', opacity: 0.5 }} />
            <p>暂无模块数据</p>
          </div>
      )}
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