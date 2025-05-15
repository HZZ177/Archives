import React, { useState, useEffect } from 'react';
import { Select, Card, Empty, Spin, Typography } from 'antd';
import { fetchModuleTree } from '../../../../apis/moduleService';
import { ModuleStructureNode } from '../../../../types/modules';
import { MdEditor } from 'md-editor-rt';
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
  const [showMarkdownHint, setShowMarkdownHint] = useState<boolean>(false);

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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '24px' }}>
        <Spin />
      </div>
    );
  }

  // 显示选中模块的详细信息
  const renderSelectedModules = () => {
    if (selectedModuleIds.length === 0) {
      return <Empty description="暂未选择任何关联模块" />;
    }

    const selectedModules = moduleOptions.filter(
      module => selectedModuleIds.includes(module.id)
    ) as ExtendedModuleNode[];

    return (
      <div className="selected-modules-list">
        {selectedModules.map(module => (
          <Card 
            key={module.id}
            size="small"
            title={module.name}
            style={{ marginBottom: '8px' }}
          >
            {module.description ? (
              <div className="markdown-content">
                <MdEditor
                  modelValue={module.description}
                  preview={true}
                  previewTheme="github"
                  language="zh-CN"
                  style={{ border: 'none', padding: 0, background: 'transparent' }}
                />
              </div>
            ) : (
              <Paragraph type="secondary">暂无描述</Paragraph>
            )}
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="section-content">
      <Card title="选择关联模块" bordered={false}>
        {moduleOptions.length > 0 ? (
          <>
            <Select
              mode="multiple"
              style={{ width: '100%', marginBottom: '16px' }}
              placeholder="请选择关联模块"
              value={selectedModuleIds}
              onChange={handleSelectionChange}
              optionFilterProp="label"
              options={moduleOptions.map(module => ({
                value: module.id,
                label: module.name
              }))}
            />
            {renderSelectedModules()}
          </>
        ) : (
          <Empty description="暂无可选模块" />
        )}
      </Card>
    </div>
  );
};

export default RelatedModulesSection; 