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
  const [expandedKeys, setExpandedKeys] = useState<number[]>([]);
  const [selectedKey, setSelectedKey] = useState<number | null>(focusNodeId || null);
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const [treeWidth, setTreeWidth] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isValidDrop, setIsValidDrop] = useState(true);
  const [localTreeData, setLocalTreeData] = useState<ModuleStructureNode[]>(treeData);
  const [showDragTip, setShowDragTip] = useState(false);
  const [dragTipPos, setDragTipPos] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);

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

  // 拖拽时监听鼠标移动，更新dragTipPos
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      setDragTipPos({ x: e.clientX, y: e.clientY });
      setHasMoved(true);
    }
    if (showDragTip) {
      window.addEventListener('mousemove', handleMouseMove);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [showDragTip]);

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
              overflow: 'visible',
              position: 'relative',
              minHeight: 0,
              padding: 0,
              margin: 0
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
                      className={`tree-node-wrapper ${selectedKey === node.id ? ' ant-tree-node-selected' : ''} ${snapshot.isDragging ? ' dragging' : ''} ${snapshot.isDragging && !isValidDrop ? ' invalid-drop' : ''} ${snapshot.isDragging && isValidDrop ? ' valid-drop' : ''} ${expandedKeys.includes(node.id) ? 'expanded' : ''}`}
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
                      {/* 左侧：缩进线、图标、名称 */}
                      <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                        {Array.from({ length: level }).map((_, i) => {
                          let isLastForThisSegment: boolean;
                          if (i < level - 1) {
                            isLastForThisSegment = false;
                          } else {
                            isLastForThisSegment = currentIndentInfo[level];
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
                        <span
                          className="ant-tree-switcher"
                          onClick={node.children && node.children.length > 0 ? (e => { e.stopPropagation(); handleExpand(node.id); }) : undefined}
                          style={{ width: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: node.children && node.children.length > 0 ? 'pointer' : 'default' }}
                        >
                          {node.children && node.children.length > 0 ? (
                            <DownOutlined className={`tree-arrow-icon ${expandedKeys.includes(node.id) ? 'expanded' : ''}`} />
                          ) : null}
                        </span>
                        {node.is_content_page ? <FileOutlined style={{ marginRight: 6 }} /> : <FolderOutlined style={{ marginRight: 6 }} />}
                        <span className="node-content" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 0 }}>{node.name}</span>
                      </div>
                      {/* 右侧：操作按钮区 */}
                      <div className={`node-actions${node.is_content_page ? ' content-node-actions' : ''}`} style={{ display: 'flex', gap: 4, alignItems: 'center', position: 'static', right: 'unset', top: 'unset', transform: 'none' }} onClick={e => e.stopPropagation()}>
                        <Tooltip title={node.is_content_page ? "内容页面不可添加子节点" : "添加子模块"} placement="top">
                          <Button 
                            type="text" 
                            size="small" 
                            icon={<PlusOutlined />} 
                            className="node-action-btn"
                            disabled={node.is_content_page}
                            onClick={e => { 
                              e.stopPropagation(); 
                              if (!node.is_content_page) {
                                onAddChild(node); 
                              }
                            }} 
                          />
                        </Tooltip>
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
                {node.children && node.children.length > 0 && (
                  <div className={`node-children-wrapper ${expandedKeys.includes(node.id) ? 'expanded' : ''}`}>
                      {renderNodes(node.children, node.id, level + 1, currentIndentInfo)}
                  </div>
                )}
              </React.Fragment>
              );
            })}
            {/* 只在拖拽时渲染provided.placeholder，避免撑高区域 */}
            {isDragging && provided.placeholder}
          </div>
        )}
      </Droppable>
    );
  }, [expandedKeys, selectedKey, onAddChild, onDelete, treeWidth, isValidDrop, localTreeData, handleSelect, handleExpand, isDragging]);

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
          onDragStart={initial => {
            setIsDragging(true);
            setIsValidDrop(true);
            setShowDragTip(true);
            setHasMoved(false);
            // 自动收起同层级所有节点（包括被拖动节点本身）
            const draggedId = parseInt(initial.draggableId);
            const { siblings } = findNodeAndParent(localTreeData, draggedId);
            if (siblings && siblings.length > 0) {
              setExpandedKeys(prev => prev.filter(key => !siblings.some(sib => sib.id === key)));
            }
          }}
          onDragUpdate={update => {
            handleDragUpdate(update);
          }}
          onDragEnd={result => {
            setIsDragging(false);
            setShowDragTip(false);
            setHasMoved(false);
            handleDragEnd(result);
          }}
        >
          {renderNodes(localTreeData)}
        </DragDropContext>
      )}
      {/* 全局拖拽提示浮层 */}
      {showDragTip && hasMoved && (
        <div
          className="drag-tip"
          style={{
            position: 'fixed',
            left: dragTipPos.x + 16,
            top: dragTipPos.y + 16,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            color: '#fff',
            padding: '6px 14px',
            borderRadius: 6,
            fontSize: 14,
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}
        >
          只能在同层级拖动排序
        </div>
      )}
    </div>
  );
}; 