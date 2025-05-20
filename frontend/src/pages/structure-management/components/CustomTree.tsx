import React, { useState, useCallback, useRef, useLayoutEffect, useEffect } from 'react';
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
  autoExpandParentId?: number | null;
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
  autoExpandParentId,
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

  useEffect(() => {
    if (autoExpandParentId && !expandedKeys.includes(autoExpandParentId)) {
      setExpandedKeys(keys => [...keys, autoExpandParentId]);
    }
  }, [autoExpandParentId]);

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
      console.log('拖拽完成:', {
        draggedId: result.draggableId,
        sourceId,
        destId,
        dragIndex,
        dropIndex
      });
      
      // 找到被拖动的节点及其父节点
      const { node: draggedNode, parent: sourceParent, siblings: sourceSiblings } = findNodeAndParent(localTreeData, parseInt(result.draggableId));
      if (!draggedNode) {
        throw new Error('找不到被拖动的节点');
      }

      // 解析droppableId，提取父节点ID
      // 格式：parentId_level_X 或 root
      const getParentIdFromDroppableId = (droppableId: string): number | null => {
        if (droppableId === 'root') return null;
        const parts = droppableId.split('_level_');
        return parts.length > 0 ? parseInt(parts[0]) : null;
      };
      
      // 提取源和目标的父节点ID
      const sourceParentId = getParentIdFromDroppableId(sourceId);
      const destParentId = getParentIdFromDroppableId(destId);

      // 检查是否在同一层级
      if (sourceParentId !== destParentId) {
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
        // 对于非根节点，更新父节点的子节点列表
        const updateChildrenInTree = (nodes: ModuleStructureNode[], parentId: number, newChildren: ModuleStructureNode[]): ModuleStructureNode[] => {
          return nodes.map(node => {
            if (node.id === parentId) {
              return { ...node, children: newChildren };
            }
            if (node.children && node.children.length > 0) {
              return {
                ...node,
                children: updateChildrenInTree(node.children, parentId, newChildren)
              };
            }
            return node;
          });
        };
        
        newTreeData = updateChildrenInTree(newTreeData, parentNode.id, updatedNodes);
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
    
    // 提取拖拽节点ID
    const draggedNodeId = parseInt(update.draggableId);
    
    // 寻找被拖拽节点及其父节点，确定节点层级
    const { node: draggedNode, parent: sourceParent } = findNodeAndParent(localTreeData, draggedNodeId);
    
    // 进行更精确的判断，确保同级拖拽有效
    // 1. 同一父节点下的拖拽总是有效的（同级排序）
    // 2. 对于sourceId和destId，进行特殊处理以支持所有层级的节点
    const isValidDrop = sourceId === destId;
    
    console.log('拖拽状态更新:', {
      sourceId,
      destId,
      draggedNodeId,
      isValidDrop,
      draggedNodeParentId: sourceParent?.id || 'root'
    });
    
    setIsValidDrop(isValidDrop);
  };

  // 递归渲染节点，缩进用tree-indent占位div
  const renderNodes = useCallback((nodes: ModuleStructureNode[], parentId: number | null = null, level: number = 0, indentInfo: boolean[] = []) => {
    return (
      <Droppable 
        droppableId={parentId === null ? 'root' : `${parentId.toString()}_level_${level}`}
        type={`NODE_LEVEL_${level}`}
      >
        {(provided, snapshot) => (
          <div 
            ref={provided.innerRef} 
            {...provided.droppableProps} 
            className={`droppable-area${snapshot.isDraggingOver ? ' drag-over' : ''}${snapshot.isDraggingOver && !isValidDrop ? ' invalid-drop' : ''}${snapshot.isDraggingOver && isValidDrop ? ' valid-drop' : ''}`}
            style={{ 
              width: '100%',
              overflow: 'visible'
            }}
            data-level={level}
          >
            {nodes.map((node, index) => {
              const currentIndentInfo = [...indentInfo, index === nodes.length - 1];
              return (
              <React.Fragment key={node.id}>
                  <Draggable
                    draggableId={node.id.toString()}
                    index={index}
                  >
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
                        data-node-id={node.id}
                        data-level={level}
                        data-is-leaf={!node.children || node.children.length === 0 ? 'true' : 'false'}
                        data-is-content-page={node.is_content_page ? 'true' : 'false'}
                    >
                        {/* 调整缩进线渲染逻辑 */}
                        {Array.from({ length: level }).map((_, i) => {
                          // i 是当前渲染的缩进段的索引 (0 to level-1)
                          // currentIndentInfo 数组的长度是 level + 1
                          // currentIndentInfo[j] 表示在深度j的节点是否是其父节点的最后一个孩子
                          let isLastForThisSegment: boolean;
                          if (i < level - 1) {
                            // 对于祖先层级的缩进段，强制为I型（非L型）
                            isLastForThisSegment = false;
                          } else { // i === level - 1，这是最靠近当前节点的缩进段
                            // 这个缩进段的 L 型转角取决于当前节点是否是其父节点的最后一个孩子
                            isLastForThisSegment = currentIndentInfo[level]; // currentIndentInfo[level] 即 isLastChild
                          }
                          
                          return (
                            <div
                              key={`indent-${node.id}-${i}`}
                              className="tree-indent"
                              style={{ width: 24, flex: '0 0 auto' }}
                              data-is-last={isLastForThisSegment.toString()}
                            />
                          );
                        })}
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
                      {renderNodes(node.children, node.id, level + 1, currentIndentInfo)}
                  </div>
                )}
              </React.Fragment>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    );
  }, [expandedKeys, selectedKey, onAddChild, onDelete, treeWidth, isValidDrop, localTreeData, handleSelect, handleExpand]);

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