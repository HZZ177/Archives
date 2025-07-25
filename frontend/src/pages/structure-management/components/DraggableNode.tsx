import React, { memo } from 'react';
import { Button, Tooltip } from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined, 
  FileTextOutlined, 
  FolderOpenOutlined, 
  DownOutlined, 
  DragOutlined,
} from '@ant-design/icons';
import { Draggable } from 'react-beautiful-dnd';
import { ModuleStructureNode } from '../../../types/modules';

interface DraggableNodeProps {
  node: ModuleStructureNode;
  index: number;
  level: number;
  indentInfo: boolean[];
  isSelected: boolean;
  isExpanded: boolean;
  isValidDrop: boolean;
  isHighlighted?: boolean; // 是否高亮显示（搜索匹配时）
  searchValue?: string; // 新增：搜索关键词，用于高亮匹配的文本
  onSelect: (node: ModuleStructureNode) => void;
  onExpand: (id: number) => void;
  onAddChild: (node: ModuleStructureNode) => void;
  onDelete: (node: ModuleStructureNode) => void;
}

/**
 * 高亮文本中匹配的部分
 * @param text 原始文本
 * @param search 搜索关键词
 * @returns 包含高亮标记的 JSX 元素
 */
const highlightText = (text: string, search: string): React.ReactNode => {
  if (!search || search.trim() === '') {
    return text;
  }
  
  const parts = text.split(new RegExp(`(${search})`, 'gi'));
  return (
    <>
      {parts.map((part, index) => (
        part.toLowerCase() === search.toLowerCase() ? (
          <span key={index} className="text-highlight">{part}</span>
        ) : (
          part
        )
      ))}
    </>
  );
};

/**
 * 可拖拽树节点组件 - 使用React.memo优化性能
 * 只有在props变化时才会重新渲染
 */
const DraggableNode: React.FC<DraggableNodeProps> = ({
  node,
  index,
  level,
  indentInfo,
  isSelected,
  isExpanded,
  isValidDrop,
  isHighlighted,
  searchValue = '',
  onSelect,
  onExpand,
  onAddChild,
  onDelete
}) => {
  // 计算当前缩进信息
  const currentIndentInfo = [...indentInfo, index === indentInfo.length - 1];
  
  return (
    <Draggable
      draggableId={node.id.toString()}
      index={index}
    >
      {(provided, snapshot) => (
        <div
          className={`tree-node-wrapper ${isSelected ? ' ant-tree-node-selected' : ''} ${snapshot.isDragging ? ' dragging' : ''} ${snapshot.isDragging && !isValidDrop ? ' invalid-drop' : ''} ${snapshot.isDragging && isValidDrop ? ' valid-drop' : ''} ${isExpanded ? 'expanded' : ''}`}
          ref={provided.innerRef}
          {...provided.draggableProps}
          style={{
            ...provided.draggableProps.style,
            maxWidth: '100%',
            boxSizing: 'border-box',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
          }}
          onClick={() => onSelect(node)}
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
              onClick={node.children && node.children.length > 0 ? (e => { e.stopPropagation(); onExpand(node.id); }) : undefined}
              style={{ width: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: node.children && node.children.length > 0 ? 'pointer' : 'default' }}
            >
              {node.children && node.children.length > 0 ? (
                <DownOutlined className={`tree-arrow-icon ${isExpanded ? 'expanded' : ''}`} />
              ) : null}
            </span>
            {node.is_content_page ? 
              <span className="custom-tree-icon file-icon"><FileTextOutlined style={{ marginRight: 6 }} /></span> : 
              <span className="custom-tree-icon folder-icon"><FolderOpenOutlined style={{ marginRight: 6 }} /></span>
            }
            <span className="node-content" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 0 }}>
              {searchValue ? highlightText(node.name, searchValue) : node.name}
            </span>
          </div>
          {/* 右侧：操作按钮区 */}
          <div className={`node-actions${node.is_content_page ? ' content-node-actions' : ''}`} style={{ display: 'flex', gap: 4, alignItems: 'center', position: 'static', right: 'unset', top: 'unset', transform: 'none' }} onClick={e => e.stopPropagation()}>
            <Tooltip title={node.is_content_page ? "内容页面不可添加子节点" : "添加子模块"} placement="top" color="#fff" overlayInnerStyle={{ color: 'rgba(0, 0, 0, 0.85)' }}>
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
            <Tooltip title="删除" placement="top" color="#fff" overlayInnerStyle={{ color: 'rgba(0, 0, 0, 0.85)' }}>
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
  );
};

// 使用memo缓存组件，减少不必要的重渲染
export default memo(DraggableNode, (prevProps, nextProps) => {
  // 只有在关键属性发生变化时才重新渲染
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.name === nextProps.node.name &&
    prevProps.node.is_content_page === nextProps.node.is_content_page &&
    prevProps.index === nextProps.index &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.isValidDrop === nextProps.isValidDrop &&
    prevProps.isHighlighted === nextProps.isHighlighted &&
    prevProps.searchValue === nextProps.searchValue
  );
}); 