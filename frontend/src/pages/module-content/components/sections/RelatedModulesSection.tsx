import React, { useState, useEffect } from 'react';
import { Select, Spin, Typography, Tag, Space } from 'antd';
import { fetchModuleTree } from '../../../../apis/moduleService';
import { ModuleStructureNode } from '../../../../types/modules';
import 'md-editor-rt/lib/style.css';

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

  // 处理选择变化
  const handleSelectionChange = (value: number[]) => {
    onChange(value);
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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '24px' }}>
        <Spin />
      </div>
    );
  }

  return (
    <div className="section-content">
      <div className="related-modules-editor">
        <div className="related-modules-tags-wrapper">
          <h4 className="related-modules-title">已选关联模块</h4>
          {renderModuleTags()}
        </div>
        
        <div className="module-select-container">
          <h4 className="related-modules-title">选择关联模块</h4>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="请选择关联模块"
            value={selectedModuleIds}
            onChange={handleSelectionChange}
            optionFilterProp="label"
            options={moduleOptions.map(module => ({
              value: module.id,
              label: module.name
            }))}
            showSearch
            filterOption={(input, option) => 
              (option?.label as string).toLowerCase().includes(input.toLowerCase())
            }
            className="modules-select"
            maxTagCount={3}
            maxTagTextLength={10}
          />
          <div className="select-help-text">
            可输入关键词筛选模块名称，已选择 {selectedModuleIds.length} 个模块
          </div>
        </div>
      </div>
    </div>
  );
};

export default RelatedModulesSection; 