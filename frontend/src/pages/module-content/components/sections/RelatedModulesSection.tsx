import React, { useState, useEffect } from 'react';
import { Select, Card, Empty, Spin } from 'antd';
import { fetchModuleTree } from '../../../../apis/moduleService';
import { ModuleStructureNode } from '../../../../types/modules';

interface RelatedModulesSectionProps {
  selectedModuleIds: number[];
  onChange: (moduleIds: number[]) => void;
}

const RelatedModulesSection: React.FC<RelatedModulesSectionProps> = ({ 
  selectedModuleIds, 
  onChange 
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [moduleOptions, setModuleOptions] = useState<ModuleStructureNode[]>([]);

  // 加载所有模块选项
  useEffect(() => {
    const loadModules = async () => {
      setLoading(true);
      try {
        const response = await fetchModuleTree();
        setModuleOptions(flattenModuleTree(response.items));
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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '24px' }}>
        <Spin />
      </div>
    );
  }

  return (
    <div className="section-content">
      <Card title="选择关联模块" bordered={false}>
        {moduleOptions.length > 0 ? (
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
          />
        ) : (
          <Empty description="暂无可选模块" />
        )}
      </Card>
    </div>
  );
};

export default RelatedModulesSection; 