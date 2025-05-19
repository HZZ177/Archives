import React, { useState, useCallback, useRef, useLayoutEffect } from 'react';
import { Button, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, FolderOutlined, FileOutlined, DownOutlined, DragOutlined } from '@ant-design/icons';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { ModuleStructureNode } from '../../../types/modules';
import './treeStyles.css';

interface CustomTreeProps {
  treeData: ModuleStructureNode[];
  loading: boolean;
  onTreeDataChange: () => void;
  focusNodeId?: number;
  onNodeSelect?: (node: ModuleStructureNode) => void;
  onAddRoot: () => void;
  onAddChild: (parent: ModuleStructureNode) => void;
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

  useLayoutEffect(() => {
    if (treeContainerRef.current) {
      setTreeWidth(treeContainerRef.current.offsetWidth);
    }
  }, [treeData]);

  const handleExpand = (id: number) => {
    setExpandedKeys(keys => keys.includes(id) ? keys.filter(k => k !== id) : [...keys, id]);
  };

  const handleSelect = (node: ModuleStructureNode) => {
    setSelectedKey(node.id);
    if (onNodeSelect) onNodeSelect(node);
  };

  const handleDragEnd = (result: DropResult, siblings: ModuleStructureNode[], parentId: number | null) => {
    if (!result.destination) return;
    const dragIndex = result.source.index;
    const dropIndex = result.destination.index;
    if (dragIndex === dropIndex) return;
    const newSiblings = Array.from(siblings);
    const [removed] = newSiblings.splice(dragIndex, 1);
    newSiblings.splice(dropIndex, 0, removed);
    newSiblings.forEach((node, idx) => {
      node.order_index = (idx + 1) * 10;
    });
    onTreeDataChange();
  };

  // 递归渲染节点，缩进用tree-indent占位div
  const renderNodes = useCallback((nodes: ModuleStructureNode[], parentId: number | null = null, level: number = 0) => {
    return (
      <Droppable droppableId={parentId === null ? 'root' : parentId.toString()} type="NODE">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} style={{ width: '100%' }}>
            {nodes.map((node, index) => (
              <React.Fragment key={node.id}>
                <Draggable draggableId={node.id.toString()} index={index}>
                  {(provided, snapshot) => (
                    <div
                      className={`tree-node-wrapper${selectedKey === node.id ? ' ant-tree-node-selected' : ''}${snapshot.isDragging ? ' dragging' : ''}`}
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      style={{
                        ...provided.draggableProps.style,
                        width: snapshot.isDragging && treeWidth ? treeWidth : '100%',
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
                      {/* 展开/收起箭头 */}
                      {node.children && node.children.length > 0 ? (
                        <span
                          className="ant-tree-switcher"
                          onClick={e => { e.stopPropagation(); handleExpand(node.id); }}
                          style={{ marginRight: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                        >
                          <DownOutlined style={{ transform: expandedKeys.includes(node.id) ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
                        </span>
                      ) : (
                        <span style={{ width: 24, display: 'inline-block' }} />
                      )}
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
  }, [expandedKeys, selectedKey, onAddChild, onDelete, treeWidth]);

  return (
    <div className="structure-tree-container" ref={treeContainerRef} style={{ overflowX: 'hidden', width: '100%', maxWidth: 400 }}>
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
      {treeData.length === 0 ? (
        <div className="empty-tree-placeholder">
          <FolderOutlined style={{ fontSize: '32px', opacity: 0.5 }} />
          <p>暂无模块数据</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={result => handleDragEnd(result, treeData, null)}>
          {renderNodes(treeData)}
        </DragDropContext>
      )}
    </div>
  );
}; 