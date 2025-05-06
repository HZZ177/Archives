import React, { useState, useEffect } from 'react';
import { Card, message } from 'antd';
import StructureTreeEditor from './components/StructureTreeEditor';
import { ModuleStructureNode } from '../../types/modules';
import { fetchModuleTree } from '../../apis/moduleService';

const StructureManagementPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [treeData, setTreeData] = useState<ModuleStructureNode[]>([]);

  // 获取模块结构树
  const loadModuleTree = async () => {
    try {
      setLoading(true);
      const response = await fetchModuleTree();
      setTreeData(response.items);
      setLoading(false);
    } catch (error) {
      console.error('加载模块结构树失败:', error);
      message.error('加载模块结构树失败');
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadModuleTree();
  }, []);

  return (
    <div>
      <Card 
        title="结构管理" 
        bordered={false}
        extra={<div>管理资料结构树</div>}
      >
        <StructureTreeEditor 
          treeData={treeData} 
          loading={loading} 
          onTreeDataChange={loadModuleTree} 
        />
      </Card>
    </div>
  );
};

export default StructureManagementPage; 