import React, { useState, useCallback, useRef, useLayoutEffect, useEffect, useMemo } from 'react';
import { Button, Tooltip, message, Input } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  DownOutlined,
  DragOutlined,
  FileOutlined,
  FolderOutlined,
  SearchOutlined,
  UpOutlined
} from '@ant-design/icons';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ModuleStructureNode } from '../../../types/modules';
import { batchUpdateNodeOrder } from '../../../apis/moduleService';
import { throttle } from '../../../utils/throttle';
import DraggableNode from './DraggableNode';
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
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [draggedNode, setDraggedNode] = useState<ModuleStructureNode | null>(null);
  // 搜索相关状态
  const [searchValue, setSearchValue] = useState<string>('');
  const [matchedNodeIds, setMatchedNodeIds] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);

  // @dnd-kit 传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px 移动距离后才开始拖拽
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 优化树渲染性能：使用useLayoutEffect，减少React渲染次数
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

  // 搜索节点函数
  const searchNodes = (value: string) => {
    if (!value.trim()) {
      // 如果搜索值为空，清除搜索结果
      setSearchValue('');
      setMatchedNodeIds([]);
      setCurrentMatchIndex(0);
      
      // 强制重渲染树，确保所有高亮状态都被清除
      setTimeout(() => {
        setLocalTreeData([...localTreeData]);
      }, 10);
      return;
    }

    const lowerCaseValue = value.toLowerCase();
    const matches: number[] = [];
    
    // 递归查找匹配的节点
    const findMatchingNodes = (nodes: ModuleStructureNode[]) => {
      nodes.forEach(node => {
        if (node.name.toLowerCase().includes(lowerCaseValue)) {
          matches.push(node.id);
        }
        if (node.children && node.children.length > 0) {
          findMatchingNodes(node.children);
        }
      });
    };
    
    findMatchingNodes(localTreeData);
    
    // 使用setTimeout确保状态更新按顺序处理
    setTimeout(() => {
      setSearchValue(value);
      setMatchedNodeIds(matches);
      setCurrentMatchIndex(0);
      
      // 强制重渲染树以应用高亮状态
      setLocalTreeData([...localTreeData]);
      
      if (matches.length > 0) {
        // 收集所有匹配节点的父节点ID
        const allParentIds: number[] = [];
        
        // 为每个匹配的节点获取其父节点路径
        matches.forEach(matchId => {
          const parentIds = getNodeParentIds(localTreeData, matchId);
          allParentIds.push(...parentIds);
        });
        
        // 自动展开所有匹配节点的父节点
        setExpandedKeys(prevKeys => {
          // 合并现有展开的节点和所有匹配节点的父节点，去重
          const newKeys = [...new Set([...prevKeys, ...allParentIds])];
          return newKeys;
        });

        // 自动选中第一个匹配的节点
        const firstMatchId = matches[0];
        setSelectedKey(firstMatchId);
        const matchedNode = findNodeById(localTreeData, firstMatchId);
        if (matchedNode && onNodeSelect) {
          onNodeSelect(matchedNode);
        }
      }
    }, 10);
  };
  
  // 根据节点ID查找节点
  const findNodeById = (nodes: ModuleStructureNode[], nodeId: number): ModuleStructureNode | null => {
    for (const node of nodes) {
      if (node.id === nodeId) {
        return node;
      }
      if (node.children && node.children.length > 0) {
        const foundNode = findNodeById(node.children, nodeId);
        if (foundNode) {
          return foundNode;
        }
      }
    }
    return null;
  };
  
  // 获取节点的所有父节点ID
  const getNodeParentIds = (nodes: ModuleStructureNode[], nodeId: number, path: number[] = []): number[] => {
    for (const node of nodes) {
      if (node.id === nodeId) {
        return path;
      }
      
      if (node.children && node.children.length > 0) {
        const newPath = [...path, node.id];
        const result = getNodeParentIds(node.children, nodeId, newPath);
        if (result.length > 0) {
          return result;
        }
      }
    }
    return [];
  };

  // 跳转到下一个搜索结果
  const goToNextMatch = () => {
    if (matchedNodeIds.length === 0) return;
    
    const nextIndex = (currentMatchIndex + 1) % matchedNodeIds.length;
    const nextMatchId = matchedNodeIds[nextIndex];
    
    // 更新当前匹配索引并强制重渲染
    setTimeout(() => {
      setCurrentMatchIndex(nextIndex);
      
      // 展开所有父节点
      const parentIds = getNodeParentIds(localTreeData, nextMatchId);
      setExpandedKeys(prevKeys => {
        const newKeys = [...new Set([...prevKeys, ...parentIds])];
        return newKeys;
      });
      
      // 选中该节点
      setSelectedKey(nextMatchId);
      const matchedNode = findNodeById(localTreeData, nextMatchId);
      if (matchedNode && onNodeSelect) {
        onNodeSelect(matchedNode);
      }
      
      // 强制重渲染树
      setLocalTreeData([...localTreeData]);
    }, 10);
  };
  
  // 跳转到上一个搜索结果
  const goToPrevMatch = () => {
    if (matchedNodeIds.length === 0) return;
    
    const prevIndex = (currentMatchIndex - 1 + matchedNodeIds.length) % matchedNodeIds.length;
    const prevMatchId = matchedNodeIds[prevIndex];
    
    // 更新当前匹配索引并强制重渲染
    setTimeout(() => {
      setCurrentMatchIndex(prevIndex);
      
      // 展开所有父节点
      const parentIds = getNodeParentIds(localTreeData, prevMatchId);
      setExpandedKeys(prevKeys => {
        const newKeys = [...new Set([...prevKeys, ...parentIds])];
        return newKeys;
      });
      
      // 选中该节点
      setSelectedKey(prevMatchId);
      const matchedNode = findNodeById(localTreeData, prevMatchId);
      if (matchedNode && onNodeSelect) {
        onNodeSelect(matchedNode);
      }
      
      // 强制重渲染树
      setLocalTreeData([...localTreeData]);
    }, 10);
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

  // @dnd-kit 拖拽开始处理
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id);
    setIsDragging(true);
    setIsValidDrop(true);
    setShowDragTip(true);
    setHasMoved(false);

    // 找到被拖动的节点
    const draggedNodeId = parseInt(active.id.toString());
    const node = findNodeById(localTreeData, draggedNodeId);
    setDraggedNode(node);

    // 自动收起同层级所有节点（包括被拖动节点本身）
    const { siblings } = findNodeAndParent(localTreeData, draggedNodeId);
    if (siblings && siblings.length > 0) {
      setExpandedKeys(prev => prev.filter(key => !siblings.some(sib => sib.id === key)));
    }
  };

  // @dnd-kit 拖拽结束处理
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setDraggedNode(null);
    setIsDragging(false);
    setShowDragTip(false);
    setHasMoved(false);

    if (!over || active.id === over.id) {
      return;
    }

    try {
      const draggedNodeId = parseInt(active.id.toString());
      const targetNodeId = parseInt(over.id.toString());

      // 找到被拖动的节点及其父节点
      const { node: draggedNode, parent: sourceParent, siblings: sourceSiblings } = findNodeAndParent(localTreeData, draggedNodeId);
      const { parent: targetParent } = findNodeAndParent(localTreeData, targetNodeId);

      if (!draggedNode) {
        throw new Error('找不到被拖动的节点');
      }

      // 检查是否在同一层级（同一父节点）
      const sourceParentId = sourceParent?.id || null;
      const targetParentId = targetParent?.id || null;

      if (sourceParentId !== targetParentId) {
        message.error('只能在同级节点之间进行排序');
        return;
      }

      // 获取当前排序
      const oldIndex = sourceSiblings.findIndex(node => node.id === draggedNodeId);
      const newIndex = sourceSiblings.findIndex(node => node.id === targetNodeId);

      if (oldIndex === newIndex) return;

      // 使用 arrayMove 重新排序
      const newSiblings = arrayMove(sourceSiblings, oldIndex, newIndex);

      // 乐观更新：立即更新本地状态
      const updatedNodes = newSiblings.map((node, idx) => ({
        ...node,
        order_index: (idx + 1) * 10
      }));

      // 更新本地树数据
      let newTreeData = [...localTreeData];
      if (sourceParentId === null) {
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

        newTreeData = updateChildrenInTree(newTreeData, sourceParentId, updatedNodes);
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
    }
  };

  // @dnd-kit 拖拽悬停处理
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;

    if (!over) {
      setIsValidDrop(false);
      return;
    }

    const draggedNodeId = parseInt(active.id.toString());
    const targetNodeId = parseInt(over.id.toString());

    // 找到被拖动的节点和目标节点的父节点
    const { parent: sourceParent } = findNodeAndParent(localTreeData, draggedNodeId);
    const { parent: targetParent } = findNodeAndParent(localTreeData, targetNodeId);

    // 检查是否在同一层级
    const sourceParentId = sourceParent?.id || null;
    const targetParentId = targetParent?.id || null;

    const isValidDrop = sourceParentId === targetParentId;
    setIsValidDrop(isValidDrop);
  };

  // 获取所有节点的ID列表（用于SortableContext）
  const getAllNodeIds = useCallback((nodes: ModuleStructureNode[]): string[] => {
    const ids: string[] = [];
    const traverse = (nodeList: ModuleStructureNode[]) => {
      nodeList.forEach(node => {
        ids.push(node.id.toString());
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      });
    };
    traverse(nodes);
    return ids;
  }, []);

  // 递归渲染节点，使用 @dnd-kit
  const renderNodes = useCallback((nodes: ModuleStructureNode[], parentId: number | null = null, level: number = 0, indentInfo: boolean[] = []) => {
    return (
      <div
        className={`droppable-area${isDragging && !isValidDrop ? ' invalid-drop' : ''}${isDragging && isValidDrop ? ' valid-drop' : ''}`}
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
          <React.Fragment key={`${node.id}-${searchValue ? 'search' : 'normal'}-${matchedNodeIds.includes(node.id) ? 'match' : 'nomatch'}`}>
              {/* 使用优化后的DraggableNode组件 */}
              <DraggableNode
                node={node}
                index={index}
                level={level}
                indentInfo={indentInfo}
                isSelected={selectedKey === node.id}
                isExpanded={expandedKeys.includes(node.id)}
                isValidDrop={isValidDrop}
                isHighlighted={searchValue.trim() !== '' && matchedNodeIds.includes(node.id)}
                searchValue={searchValue}
                onSelect={handleSelect}
                onExpand={handleExpand}
                onAddChild={onAddChild}
                onDelete={onDelete}
              />
              {/* 只在本节点下方递归渲染children */}
              {node.children && node.children.length > 0 && (
                <div className={`node-children-wrapper ${expandedKeys.includes(node.id) ? 'expanded' : ''}`}>
                    {renderNodes(node.children, node.id, level + 1, currentIndentInfo)}
                </div>
              )}
          </React.Fragment>
          );
        })}
      </div>
    );
  }, [expandedKeys, selectedKey, isValidDrop, isDragging, handleSelect, handleExpand, onAddChild, onDelete, searchValue, matchedNodeIds, localTreeData]);

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
        {/* 搜索框 */}
        <div className="search-container">
          <Input.Search
            placeholder="搜索模块"
            allowClear
            onSearch={searchNodes}
            onChange={(e) => {
              if (!e.target.value) {
                // 清空搜索条件时立即清除所有高亮状态
                setTimeout(() => {
                  setSearchValue('');
                  setMatchedNodeIds([]);
                  setCurrentMatchIndex(0);
                  // 强制重渲染树
                  setLocalTreeData([...localTreeData]);
                }, 10);
              }
            }}
            style={{ width: '100%', marginBottom: 8 }}
            enterButton
            prefix={<SearchOutlined style={{ color: '#1890ff' }} />}
          />
          
          {/* 搜索结果导航 */}
          {matchedNodeIds.length > 0 && (
            <div className="search-navigation" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>找到 {matchedNodeIds.length} 个结果</span>
              <div>
                <Button 
                  size="small" 
                  onClick={goToPrevMatch} 
                  style={{ marginRight: 8 }}
                  icon={<UpOutlined />}
                  title="上一个结果"
                >
                  上一个
                </Button>
                <Button 
                  size="small" 
                  onClick={goToNextMatch}
                  icon={<DownOutlined />}
                  title="下一个结果"
                >
                  下一个
                </Button>
              </div>
            </div>
          )}
        </div>
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={getAllNodeIds(localTreeData)}
            strategy={verticalListSortingStrategy}
          >
            {renderNodes(localTreeData)}
          </SortableContext>
          <DragOverlay>
            {activeId && draggedNode ? (
              <div className="tree-node-wrapper dragging">
                <div className="node-content">
                  {draggedNode.name}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
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