import React, { useState, useEffect } from 'react';
import { Select, Spin, Typography, Tag, Space, Tree, Input, Tooltip } from 'antd';
import { fetchModuleTree } from '../../../../apis/moduleService';
import { ModuleStructureNode } from '../../../../types/modules';
import 'md-editor-rt/lib/style.css';
import type { TreeProps } from 'antd';
import { SearchOutlined, FileTextOutlined, FolderOpenOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Paragraph } = Typography;

// 扩展ModuleStructureNode接口，添加description属性
interface ExtendedModuleNode extends ModuleStructureNode {
  description?: string; // 模块描述，可能在API返回中存在
}

interface RelatedModulesSectionProps {
  selectedModuleIds: number[];
  onChange: (moduleIds: number[]) => void;
}

const RelatedModulesSection: React.FC<RelatedModulesSectionProps> = ({ 
  selectedModuleIds, 
  onChange 
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [moduleOptions, setModuleOptions] = useState<ExtendedModuleNode[]>([]);
  const [searchValue, setSearchValue] = useState<string>('');
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState<boolean>(true);

  // 加载所有模块选项
  useEffect(() => {
    const loadModules = async () => {
      setLoading(true);
      try {
        const response = await fetchModuleTree();
        setModuleOptions(flattenModuleTree(response.items) as ExtendedModuleNode[]);
        setLoading(false);
      } catch (error) {
        console.error('加载模块列表失败:', error);
        setLoading(false);
      }
    };
    
    loadModules();
  }, []);

  // 将模块树扁平化为一维数组，用于选择框
  const flattenModuleTree = (nodes: ModuleStructureNode[]): ModuleStructureNode[] => {
    let result: ModuleStructureNode[] = [];
    
    for (const node of nodes) {
      result.push(node);
      if (node.children && node.children.length > 0) {
        result = result.concat(flattenModuleTree(node.children));
      }
    }
    
    return result;
  };

  // 检查节点及其子节点中是否有内容页面节点
  const hasContentPageDescendant = (node: ModuleStructureNode): boolean => {
    // 如果当前节点是内容页面，直接返回true
    if (node.is_content_page) {
      return true;
    }
    
    // 如果节点没有子节点，返回false
    if (!node.children || node.children.length === 0) {
      return false;
    }
    
    // 递归检查子节点
    return node.children.some(childNode => hasContentPageDescendant(childNode));
  };

  // 将模块数据转换为Tree组件所需的数据结构
  const convertToTreeData = (nodes: ModuleStructureNode[]): any[] => {
    return nodes.map(node => {
      // 检查该节点下是否有内容页面节点
      const hasContentPage = hasContentPageDescendant(node);
      
      return {
        title: node.name,
        key: node.id.toString(),
        children: node.children && node.children.length > 0 
          ? convertToTreeData(node.children) 
          : undefined,
        // 保存原始节点数据用于后续处理
        originNode: node,
        // 添加节点类型区分
        isContentPage: node.is_content_page,
        // 添加图标区分，带自定义样式
        icon: node.is_content_page 
          ? <span className="custom-tree-icon file-icon"><FileTextOutlined /></span> 
          : <span className="custom-tree-icon folder-icon"><FolderOpenOutlined /></span>,
        // 为节点设置样式类
        className: node.is_content_page 
          ? 'content-node' 
          : hasContentPage 
            ? 'structure-node' 
            : 'empty-structure-node',
        // 如果是非内容页面节点且其下没有内容页面节点，则禁用
        disabled: !node.is_content_page && !hasContentPage,
        // 标记是否有内容页面子节点
        hasContentPage: hasContentPage,
      };
    });
  };

  // 递归查找所有选中节点的子节点ID
  const getAllChildrenIds = (nodes: ModuleStructureNode[], selectedIds: number[]): number[] => {
    let childrenIds: number[] = [];
    
    const findChildren = (node: ModuleStructureNode) => {
      if (node.children && node.children.length > 0) {
        node.children.forEach(childNode => {
          childrenIds.push(childNode.id);
          findChildren(childNode);
        });
      }
    };
    
    nodes.forEach(node => {
      if (selectedIds.includes(node.id)) {
        findChildren(node);
      }
      if (node.children && node.children.length > 0) {
        childrenIds = [...childrenIds, ...getAllChildrenIds(node.children, selectedIds)];
      }
    });
    
    return childrenIds;
  };

  // 处理选择变化
  const handleSelectionChange = (value: number[]) => {
    onChange(value);
  };

  // 处理树节点选择
  const handleTreeCheck: TreeProps['onCheck'] = (checked, info) => {
    // 将选中的节点ID转换为数字数组
    const checkedKeys = Array.isArray(checked) 
      ? checked 
      : checked.checked;
    
    // 将字符串键转换为数字
    const numericKeys = checkedKeys.map(key => parseInt(key.toString()));
    
    // 过滤只保留内容页面节点
    const contentPageNodes = moduleOptions.filter(node => 
      node.is_content_page && numericKeys.includes(node.id)
    );
    
    const contentPageIds = contentPageNodes.map(node => node.id);
    
    // 更新选中的模块ID
    onChange(contentPageIds);
  };

  // 处理删除标签
  const handleTagClose = (removedId: number) => {
    const newSelectedIds = selectedModuleIds.filter(id => id !== removedId);
    onChange(newSelectedIds);
  };

  // 获取选中模块的信息
  const getSelectedModules = () => {
    return moduleOptions.filter(
      module => selectedModuleIds.includes(module.id)
    ) as ExtendedModuleNode[];
  };

  // 渲染标签形式的已选模块
  const renderModuleTags = () => {
    const selectedModules = getSelectedModules();
    
    if (selectedModules.length === 0) {
      return <div className="empty-modules-tip">暂未选择任何关联模块，请在下方选择</div>;
    }
    
    return (
      <div className="module-tags-container">
        {selectedModules.map(module => (
          <Tag 
            key={module.id}
            closable
            color="blue"
            onClose={() => handleTagClose(module.id)}
            className="module-tag"
          >
            {module.name}
          </Tag>
        ))}
      </div>
    );
  };

  // 处理搜索
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    setSearchValue(value);
    
    if (value) {
      // 如果有搜索词，找到所有匹配的节点和它们的父节点路径
      const expandedKeysSet = new Set<React.Key>();
      
      const searchTree = (nodes: ModuleStructureNode[], parentKeys: React.Key[] = []) => {
        nodes.forEach(node => {
          const currentPath = [...parentKeys, node.id.toString()];
          
          if (node.name.toLowerCase().includes(value.toLowerCase())) {
            // 匹配到节点，将其父节点路径加入展开集合
            parentKeys.forEach(key => expandedKeysSet.add(key));
          }
          
          if (node.children && node.children.length > 0) {
            searchTree(node.children, currentPath);
          }
        });
      };
      
      // 从根节点开始搜索
      const rootNodes = moduleOptions.filter(node => node.parent_id === null);
      searchTree(rootNodes);
      
      setExpandedKeys(Array.from(expandedKeysSet));
      setAutoExpandParent(true);
    } else {
      // 如果搜索框为空，恢复默认展开状态
      setExpandedKeys([]);
      setAutoExpandParent(false);
    }
  };
  
  // 处理树展开/折叠
  const handleExpand = (expandedKeys: React.Key[]) => {
    setExpandedKeys(expandedKeys);
    setAutoExpandParent(false);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '24px' }}>
        <Spin />
      </div>
    );
  }

  // 创建树组件数据
  const treeData = convertToTreeData(moduleOptions.length > 0 ? moduleOptions.filter(node => node.parent_id === null) : []);

  // 根据搜索值高亮节点标题
  const renderTreeNodes = (data: any[]): any[] => {
    return data.map(item => {
      const index = searchValue ? item.title.toLowerCase().indexOf(searchValue.toLowerCase()) : -1;
      const beforeStr = item.title.substring(0, index);
      const matchStr = item.title.substring(index, index + searchValue.length);
      const afterStr = item.title.substring(index + searchValue.length);
      
      const title = index > -1 ? (
        <span>
          {beforeStr}
          <span style={{ color: '#1890ff', fontWeight: 'bold' }}>{matchStr}</span>
          {afterStr}
        </span>
      ) : (
        <span>{item.title}</span>
      );
      
      // 设置节点的样式
      const titleStyle = item.isContentPage 
        ? { cursor: 'pointer' } 
        : item.hasContentPage
          ? { cursor: 'default', color: '#666' }
          : { cursor: 'not-allowed', color: '#aaa' };
      
      // 如果节点被禁用，添加Tooltip提示
      const nodeTitle = item.disabled ? (
        <Tooltip title="该节点下无内容页面节点，不可选择">
          <span style={titleStyle} className="disabled-node-title">
            {title}
            <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', color: '#aaa' }} />
          </span>
        </Tooltip>
      ) : (
        <span style={titleStyle}>{title}</span>
      );
      
      return {
        ...item,
        title: nodeTitle,
        children: item.children ? renderTreeNodes(item.children) : undefined,
        // 确保图标属性被保留
        icon: item.icon,
      };
    });
  };
  
  const filteredTreeData = searchValue ? renderTreeNodes(treeData) : renderTreeNodes(treeData);

  return (
    <div className="section-content">
      <div className="related-modules-editor">
        <div className="related-modules-tags-wrapper">
          <h4 className="related-modules-title">已选关联模块</h4>
          {renderModuleTags()}
        </div>
        
        <div className="module-select-container">
          <h4 className="related-modules-title">选择关联模块</h4>
          <div className="module-search">
            <Input
              placeholder="搜索模块..."
              prefix={<SearchOutlined />}
              onChange={handleSearch}
              allowClear
              style={{ marginBottom: 8 }}
            />
          </div>
          <div className="module-tree-container">
            <Tree
              checkable
              checkStrictly={false}
              expandedKeys={expandedKeys}
              autoExpandParent={autoExpandParent}
              onExpand={handleExpand}
              height={300}
              checkedKeys={selectedModuleIds.map(id => id.toString())}
              onCheck={handleTreeCheck}
              treeData={filteredTreeData}
              className="modules-tree"
              showIcon={true}
            />
          </div>
          <div className="select-help-text">
            <span className="custom-tree-icon file-icon" style={{ marginRight: 4, verticalAlign: 'middle' }}>
              <FileTextOutlined />
            </span> 表示内容页面，可选择关联
            <span className="custom-tree-icon folder-icon" style={{ marginLeft: 8, marginRight: 4, verticalAlign: 'middle' }}>
              <FolderOpenOutlined />
            </span> 表示目录节点，可用于快速选择/取消其下所有内容页面
            <br />
            已选择 {selectedModuleIds.length} 个内容页面模块
          </div>
        </div>
      </div>
    </div>
  );
};

export default RelatedModulesSection; 