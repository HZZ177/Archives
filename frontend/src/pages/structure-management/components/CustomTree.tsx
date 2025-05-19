import React, { useState, useCallback, useRef, useLayoutEffect } from 'react';
import { Button, Tooltip, message } from 'antd';
import { PlusOutlined, DeleteOutlined, FolderOutlined, FileOutlined, DownOutlined, DragOutlined } from '@ant-design/icons';
import { DragDropContext, Droppable, Draggable, DropResult, DragUpdate } from 'react-beautiful-dnd';
import { ModuleStructureNode } from '../../../types/modules';
import { batchUpdateNodeOrder } from '../../../apis/moduleService';
import './treeStyles.css';

interface CustomTreeProps {
  treeData: ModuleStructureNode[];
  loading: boolean;
  onTreeDataChange: () => void;
  focusNodeId?: number;
  onNodeSelect?: (node: ModuleStructureNode) => void;
  onAddRoot: () => void;
  onAddChild: (node: ModuleStructureNode) => void;
  onDelete: (node: ModuleStructureNode) => void;
}

export const CustomTree: React.FC<CustomTreeProps> = ({
  treeData,
  loading,
  onTreeDataChange,
  focusNodeId,
  onNodeSelect,
  onAddRoot,
  onAddChild,
  onDelete,
}) => {
  const [expandedKeys, setExpandedKeys] = useState<number[]>(() => treeData.length > 0 ? [treeData[0].id] : []);
  const [selectedKey, setSelectedKey] = useState<number | null>(focusNodeId || null);
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const [treeWidth, setTreeWidth] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isValidDrop, setIsValidDrop] = useState(true);
  const [localTreeData, setLocalTreeData] = useState<ModuleStructureNode[]>(treeData);

  useLayoutEffect(() => {
    setLocalTreeData(treeData);
  }, [treeData]);

  useLayoutEffect(() => {
    if (treeContainerRef.current) {
      setTreeWidth(treeContainerRef.current.offsetWidth);
    }
  }, [localTreeData]);

  const handleExpand = (id: number) => {
    setExpandedKeys(keys => keys.includes(id) ? keys.filter(k => k !== id) : [...keys, id]);
  };

  const handleSelect = (node: ModuleStructureNode) => {
    setSelectedKey(node.id);
    if (onNodeSelect) onNodeSelect(node);
  };

  // 递归查找节点及其父节点
  const findNodeAndParent = (nodes: ModuleStructureNode[], nodeId: number): { node: ModuleStructureNode | null, parent: ModuleStructureNode | null, siblings: ModuleStructureNode[] } => {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === nodeId) {
        return { node: nodes[i], parent: null, siblings: nodes };
      }
      if (nodes[i].children) {
        const result = findNodeAndParent(nodes[i].children, nodeId);
        if (result.node) {
          return { ...result, parent: nodes[i] };
        }
      }
    }
    return { node: null, parent: null, siblings: [] };
  };

  // 递归更新节点顺序
  const updateNodeOrderInTree = (nodes: ModuleStructureNode[], nodeId: number, newOrderIndex: number): ModuleStructureNode[] => {
    return nodes.map(node => {
      if (node.id === nodeId) {
        return { ...node, order_index: newOrderIndex };
      }
      if (node.children) {
        return {
          ...node,
          children: updateNodeOrderInTree(node.children, nodeId, newOrderIndex)
        };
      }
      return node;
    });
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const { source, destination } = result;
    const sourceId = source.droppableId;
    const destId = destination.droppableId;
    const dragIndex = source.index;
    const dropIndex = destination.index;
    
    if (sourceId === destId && dragIndex === dropIndex) return;

    try {
      // 找到被拖动的节点及其父节点
      const { node: draggedNode, parent: sourceParent, siblings: sourceSiblings } = findNodeAndParent(localTreeData, parseInt(result.draggableId));
      if (!draggedNode) {
        throw new Error('找不到被拖动的节点');
      }

      // 检查是否在同一层级
      if (sourceId !== destId) {
        message.error('只能在同级节点之间进行排序');
        return;
      }

      // 从源位置移除节点
      const newSourceSiblings = Array.from(sourceSiblings);
      const [removed] = newSourceSiblings.splice(dragIndex, 1);
      
      // 插入到目标位置
      const newDestSiblings = newSourceSiblings;
      newDestSiblings.splice(dropIndex, 0, removed);

      // 乐观更新：立即更新本地状态
      const updatedNodes = newDestSiblings.map((node, idx) => ({
        ...node,
        order_index: (idx + 1) * 10
      }));

      // 更新本地树数据
      let newTreeData = [...localTreeData];
      const parentNode = sourceParent || { id: null };
      if (parentNode.id === null) {
        newTreeData = updatedNodes;
      } else {
        newTreeData = updateNodeOrderInTree(newTreeData, parentNode.id, 0);
        const parent = findNodeAndParent(newTreeData, parentNode.id);
        if (parent.node) {
          parent.node.children = updatedNodes;
        }
      }

      // 立即更新本地状态
      setLocalTreeData(newTreeData);

      // 异步更新后端
      const updates = updatedNodes.map(node => ({
        node_id: node.id,
        order_index: node.order_index
      }));

      await batchUpdateNodeOrder(updates);
      message.success('排序更新成功');
      onTreeDataChange();
    } catch (error) {
      console.error('更新排序失败:', error);
      message.error('更新排序失败');
      // 恢复原始状态
      setLocalTreeData(treeData);
    } finally {
      setIsDragging(false);
    }
  };

  const handleDragUpdate = (update: DragUpdate) => {
    if (!update.destination) {
      setIsValidDrop(false);
      return;
    }

    const sourceId = update.source.droppableId;
    const destId = update.destination.droppableId;
    setIsValidDrop(sourceId === destId);
  };

  // 递归渲染节点，缩进用tree-indent占位div
  const renderNodes = useCallback((nodes: ModuleStructureNode[], parentId: number | null = null, level: number = 0) => {
    return (
      <Droppable droppableId={parentId === null ? 'root' : parentId.toString()} type="NODE">
        {(provided, snapshot) => (
          <div 
            ref={provided.innerRef} 
            {...provided.droppableProps} 
            className={`droppable-area${snapshot.isDraggingOver ? ' drag-over' : ''}${snapshot.isDraggingOver && !isValidDrop ? ' invalid-drop' : ''}${snapshot.isDraggingOver && isValidDrop ? ' valid-drop' : ''}`}
            style={{ 
              width: '100%',
              overflow: 'visible'
            }}
          >
            {nodes.map((node, index) => (
              <React.Fragment key={node.id}>
                <Draggable draggableId={node.id.toString()} index={index}>
                  {(provided, snapshot) => (
                    <div
                      className={`tree-node-wrapper${selectedKey === node.id ? ' ant-tree-node-selected' : ''}${snapshot.isDragging ? ' dragging' : ''}${snapshot.isDragging && !isValidDrop ? ' invalid-drop' : ''}${snapshot.isDragging && isValidDrop ? ' valid-drop' : ''}`}
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      style={{
                        ...provided.draggableProps.style,
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        background: selectedKey === node.id ? '#e6f7ff' : undefined,
                      }}
                      onClick={() => handleSelect(node)}
                      onMouseEnter={e => e.currentTarget.classList.add('ant-tree-treenode-hover')}
                      onMouseLeave={e => e.currentTarget.classList.remove('ant-tree-treenode-hover')}
                    >
                      {/* 缩进占位 */}
                      {level > 0 && <div className="tree-indent" style={{ width: level * 24, flex: '0 0 auto' }} />}
                      {/* 展开/收起箭头或占位 */}
                      <span
                        className="ant-tree-switcher"
                        onClick={node.children && node.children.length > 0 ? (e => { e.stopPropagation(); handleExpand(node.id); }) : undefined}
                        style={{ width: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: node.children && node.children.length > 0 ? 'pointer' : 'default' }}
                      >
                        {node.children && node.children.length > 0 ? (
                          <DownOutlined style={{ transform: expandedKeys.includes(node.id) ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
                        ) : null}
                      </span>
                      {/* 图标 */}
                      {node.is_content_page ? <FileOutlined style={{ marginRight: 6 }} /> : <FolderOutlined style={{ marginRight: 6 }} />}
                      {/* 名称 */}
                      <span className="node-content" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 100 }}>{node.name}</span>
                      {/* 操作按钮区 */}
                      <div className={`node-actions${node.is_content_page ? ' content-node-actions' : ''}`} style={{ display: 'flex', gap: 4, alignItems: 'center', position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }} onClick={e => e.stopPropagation()}>
                        {!node.is_content_page && (
                          <Tooltip title="添加子模块" placement="top">
                            <Button type="text" size="small" icon={<PlusOutlined />} className="node-action-btn"
                              onClick={e => { e.stopPropagation(); onAddChild(node); }} />
                          </Tooltip>
                        )}
                        <Tooltip title="删除" placement="top">
                          <Button type="text" size="small" icon={<DeleteOutlined />} className="node-action-btn" danger
                            onClick={e => { e.stopPropagation(); onDelete(node); }} />
                        </Tooltip>
                        <div {...provided.dragHandleProps} className="drag-handle">
                          <DragOutlined />
                        </div>
                      </div>
                    </div>
                  )}
                </Draggable>
                {/* 只在本节点下方递归渲染children */}
                {expandedKeys.includes(node.id) && node.children && node.children.length > 0 && (
                  <div>
                    {renderNodes(node.children, node.id, level + 1)}
                  </div>
                )}
              </React.Fragment>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    );
  }, [expandedKeys, selectedKey, onAddChild, onDelete, treeWidth, isValidDrop]);

  return (
    <div 
      className="structure-tree-container" 
      ref={treeContainerRef} 
      style={{ 
        width: '100%',
        height: '100%',
        overflowX: 'hidden',
        overflowY: 'auto'
      }}
    >
      <div className="tree-header">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onAddRoot}
          className="add-root-button"
          disabled={loading}
        >
          新增顶级模块
        </Button>
      </div>
      {localTreeData.length === 0 ? (
        <div className="empty-tree-placeholder">
          <FolderOutlined style={{ fontSize: '32px', opacity: 0.5 }} />
          <p>暂无模块数据</p>
        </div>
      ) : (
        <DragDropContext 
          onDragStart={() => {
            setIsDragging(true);
            setIsValidDrop(true);
          }}
          onDragUpdate={handleDragUpdate}
          onDragEnd={handleDragEnd}
        >
          {renderNodes(localTreeData)}
        </DragDropContext>
      )}
    </div>
  );
}; 