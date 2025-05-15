import React, { useState, useEffect } from 'react';
import { 
  Collapse, 
  Button, 
  message, 
  Spin,
  Image 
} from 'antd';
import { 
  SaveOutlined,
  EditOutlined
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
import { API_BASE_URL } from '../../../config/constants';

const { Panel } = Collapse;

// 处理图片URL，确保图片能正确显示
const processImageUrl = (url: string) => {
  if (!url) return '';
  
  // 如果是完整的URL，直接返回
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // 如果是以/api开头的URL，使用API_BASE_URL的域名部分
  if (url.startsWith('/api')) {
    // 从API_BASE_URL提取域名部分 (如 http://localhost:8000)
    const baseUrlParts = API_BASE_URL.split('/api');
    const baseUrl = baseUrlParts[0]; // 例如 http://localhost:8000
    return `${baseUrl}${url}`;
  }
  
  // 如果是以/uploads开头的相对URL，使用API_BASE_URL
  if (url.startsWith('/uploads')) {
    // 从API_BASE_URL移除末尾的/api/v1部分
    const baseUrlParts = API_BASE_URL.split('/api');
    const baseUrl = baseUrlParts[0]; // 例如 http://localhost:8000
    return `${baseUrl}${url}`;
  }
  
  // 其他情况，假设是API相对路径，添加完整API_BASE_URL
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

interface ModuleContentEditorProps {
  moduleNodeId: number;
}

const ModuleContentEditor: React.FC<ModuleContentEditorProps> = ({ moduleNodeId }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [content, setContent] = useState<ModuleContent | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  
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
      setIsEditMode(false); // 保存成功后切换回阅读模式
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
          icon={isEditMode ? <SaveOutlined /> : <EditOutlined />} 
          onClick={isEditMode ? handleSave : () => setIsEditMode(true)}
          loading={saving}
        >
          {isEditMode ? '保存' : '编辑'}
        </Button>
      </div>
      
      <Collapse defaultActiveKey={['1', '2', '3', '4', '5', '6']}>
        <Panel 
          header="模块功能概述" 
          key="1"
        >
          {isEditMode ? (
            <OverviewSection 
              value={overviewText} 
              onChange={setOverviewText} 
            />
          ) : (
            <div className="readonly-content" style={{ padding: '8px', whiteSpace: 'pre-wrap' }}>
              {overviewText || '暂无内容'}
            </div>
          )}
        </Panel>
        
        <Panel 
          header="逻辑图/数据流向图" 
          key="2"
        >
          {isEditMode ? (
            <DiagramSection 
              moduleNodeId={moduleNodeId}
              imagePath={diagramPath}
              onImagePathChange={setDiagramPath}
            />
          ) : (
            <div className="readonly-content" style={{ textAlign: 'center', padding: '16px' }}>
              {diagramPath ? (
                <Image 
                  src={processImageUrl(diagramPath)} 
                  alt="模块逻辑图" 
                  style={{ maxWidth: '100%' }} 
                />
              ) : (
                <div>暂无图片</div>
              )}
            </div>
          )}
        </Panel>
        
        <Panel 
          header="功能详解" 
          key="3"
        >
          {isEditMode ? (
            <KeyTechSection 
              items={keyTechItems} 
              onChange={setKeyTechItems} 
            />
          ) : (
            <div className="readonly-content">
              {keyTechItems.length > 0 ? (
                keyTechItems.map((item, index) => (
                  <div key={index} style={{ marginBottom: '16px' }}>
                    <h4>{item.key}</h4>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{item.value}</div>
                  </div>
                ))
              ) : (
                <div>暂无内容</div>
              )}
            </div>
          )}
        </Panel>
        
        <Panel 
          header="数据库表" 
          key="4"
        >
          {isEditMode ? (
            <DatabaseTablesSection 
              tables={databaseTables} 
              onChange={setDatabaseTables} 
            />
          ) : (
            <div className="readonly-content">
              {databaseTables.length > 0 ? (
                databaseTables.map((table, index) => (
                  <div key={index} style={{ marginBottom: '16px' }}>
                    <h4>{table.table_name}</h4>
                    <div>{table.columns.length > 0 ? `${table.columns.length}个字段` : '无字段'}</div>
                  </div>
                ))
              ) : (
                <div>暂无内容</div>
              )}
            </div>
          )}
        </Panel>
        
        <Panel 
          header="关联模块" 
          key="5"
        >
          {isEditMode ? (
            <RelatedModulesSection 
              selectedModuleIds={relatedModuleIds} 
              onChange={setRelatedModuleIds} 
            />
          ) : (
            <div className="readonly-content">
              {relatedModuleIds.length > 0 ? (
                <div>已关联 {relatedModuleIds.length} 个模块</div>
              ) : (
                <div>暂无关联模块</div>
              )}
            </div>
          )}
        </Panel>
        
        <Panel 
          header="涉及接口" 
          key="6"
        >
          {isEditMode ? (
            <InterfaceSection 
              interfaces={apiInterfaces} 
              onChange={setApiInterfaces} 
            />
          ) : (
            <div className="readonly-content">
              {apiInterfaces.length > 0 ? (
                apiInterfaces.map((api, index) => (
                  <div key={index} style={{ marginBottom: '16px' }}>
                    <h4>{api.name}</h4>
                    <div><strong>类型:</strong> {api.type}</div>
                    <div><strong>必需:</strong> {api.required ? '是' : '否'}</div>
                    <div><strong>描述:</strong> {api.description}</div>
                  </div>
                ))
              ) : (
                <div>暂无内容</div>
              )}
            </div>
          )}
        </Panel>
      </Collapse>
    </div>
  );
};

export default ModuleContentEditor; 