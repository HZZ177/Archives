import React, { useState, useEffect } from 'react';
import { 
  Collapse, 
  Button, 
  message, 
  Spin 
} from 'antd';
import { 
  SaveOutlined
} from '@ant-design/icons';
import { 
  ModuleContent, 
  ModuleContentRequest, 
  KeyTechItem, 
  ApiInterface as InterfaceItem,
  DatabaseTable
} from '../../../types/modules';
import { fetchModuleContent, saveModuleContent } from '../../../apis/moduleService';
import OverviewSection from './sections/OverviewSection';
import DiagramSection from './sections/DiagramSection';
import KeyTechSection from './sections/KeyTechSection';
import DatabaseTablesSection from './sections/DatabaseTablesSection';
import RelatedModulesSection from './sections/RelatedModulesSection';
import InterfaceSection from './sections/InterfaceSection';

const { Panel } = Collapse;

interface ModuleContentEditorProps {
  moduleNodeId: number;
}

const ModuleContentEditor: React.FC<ModuleContentEditorProps> = ({ moduleNodeId }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [content, setContent] = useState<ModuleContent | null>(null);
  
  // 本地状态，用于收集各部分的内容
  const [overviewText, setOverviewText] = useState<string>('');
  const [keyTechItems, setKeyTechItems] = useState<KeyTechItem[]>([]);
  const [databaseTables, setDatabaseTables] = useState<DatabaseTable[]>([]);
  const [relatedModuleIds, setRelatedModuleIds] = useState<number[]>([]);
  const [apiInterfaces, setApiInterfaces] = useState<InterfaceItem[]>([]);
  const [diagramPath, setDiagramPath] = useState<string>('');

  // 获取模块内容
  useEffect(() => {
    const loadContent = async () => {
      if (!moduleNodeId) return;
      
      try {
        setLoading(true);
        const data = await fetchModuleContent(moduleNodeId);
        setContent(data);
        
        // 初始化各部分状态
        setOverviewText(data.overview_text || '');
        setKeyTechItems(data.key_tech_items_json || []);
        setDatabaseTables(data.database_tables_json || []);
        setRelatedModuleIds(data.related_module_ids_json || []);
        setApiInterfaces(data.api_interfaces_json || []);
        setDiagramPath(data.diagram_image_path || '');
        
        setLoading(false);
      } catch (error) {
        console.error('加载模块内容失败:', error);
        message.error('加载模块内容失败');
        setLoading(false);
      }
    };
    
    loadContent();
  }, [moduleNodeId]);

  // 保存模块内容
  const handleSave = async () => {
    try {
      setSaving(true);
      
      const contentData: ModuleContentRequest = {
        overview_text: overviewText,
        key_tech_items_json: keyTechItems,
        database_tables_json: databaseTables,
        related_module_ids_json: relatedModuleIds,
        api_interfaces_json: apiInterfaces
      };
      
      await saveModuleContent(moduleNodeId, contentData);
      message.success('保存成功');
      setSaving(false);
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <Spin />
      </div>
    );
  }

  return (
    <div className="module-content-editor">
      <div style={{ textAlign: 'right', marginBottom: 16 }}>
        <Button 
          type="primary" 
          icon={<SaveOutlined />} 
          onClick={handleSave}
          loading={saving}
        >
          保存
        </Button>
      </div>
      
      <Collapse defaultActiveKey={['1', '2', '3', '4', '5', '6']}>
        <Panel 
          header="模块功能概述" 
          key="1"
        >
          <OverviewSection 
            value={overviewText} 
            onChange={setOverviewText} 
          />
        </Panel>
        
        <Panel 
          header="逻辑图/数据流向图" 
          key="2"
        >
          <DiagramSection 
            moduleNodeId={moduleNodeId}
            imagePath={diagramPath}
            onImagePathChange={setDiagramPath}
          />
        </Panel>
        
        <Panel 
          header="功能详解" 
          key="3"
        >
          <KeyTechSection 
            items={keyTechItems} 
            onChange={setKeyTechItems} 
          />
        </Panel>
        
        <Panel 
          header="数据库表" 
          key="4"
        >
          <DatabaseTablesSection 
            tables={databaseTables} 
            onChange={setDatabaseTables} 
          />
        </Panel>
        
        <Panel 
          header="关联模块" 
          key="5"
        >
          <RelatedModulesSection 
            selectedModuleIds={relatedModuleIds} 
            onChange={setRelatedModuleIds} 
          />
        </Panel>
        
        <Panel 
          header="涉及接口" 
          key="6"
        >
          <InterfaceSection 
            interfaces={apiInterfaces} 
            onChange={setApiInterfaces} 
          />
        </Panel>
      </Collapse>
    </div>
  );
};

export default ModuleContentEditor; 