import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { 
  Button, 
  message, 
  Spin,
  Image, 
  Typography,
  Divider
} from 'antd';
import { 
  SaveOutlined,
  EditOutlined
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MdEditor, MdPreview } from 'md-editor-rt';
import 'md-editor-rt/lib/style.css';
import 'md-editor-rt/lib/preview.css';
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
import './ModuleContentEditor.css';

const { Title } = Typography;

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

// 为阅读模式下的Markdown编辑器生成唯一ID
const getViewerId = (prefix: string, suffix: string | number) => {
  return `viewer-${prefix}-${suffix}-${Date.now()}`;
};

// 编辑器组件接口，暴露方法给父组件
export interface ModuleContentEditorHandle {
  scrollToSection: (key: string) => void;
}

interface ModuleContentEditorProps {
  moduleNodeId: number;
  onSectionVisibilityChange?: (key: string) => void;
}

const ModuleContentEditor = forwardRef<ModuleContentEditorHandle, ModuleContentEditorProps>(({ 
  moduleNodeId,
  onSectionVisibilityChange 
}, ref) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [content, setContent] = useState<ModuleContent | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  
  // 本地状态，用于收集各部分的内容
  const [overviewText, setOverviewText] = useState<string>('');
  const [keyTechItems, setKeyTechItems] = useState<KeyTechItem[]>([]);
  const [principleText, setPrincipleText] = useState<string>('');
  const [databaseTables, setDatabaseTables] = useState<DatabaseTable[]>([]);
  const [relatedModuleIds, setRelatedModuleIds] = useState<number[]>([]);
  const [apiInterfaces, setApiInterfaces] = useState<InterfaceItem[]>([]);
  const [diagramPath, setDiagramPath] = useState<string>('');

  // 创建各部分的ref，用于滚动定位
  const overviewRef = useRef<HTMLDivElement>(null);
  const diagramRef = useRef<HTMLDivElement>(null);
  const keyTechRef = useRef<HTMLDivElement>(null);
  const databaseRef = useRef<HTMLDivElement>(null);
  const relatedRef = useRef<HTMLDivElement>(null);
  const interfaceRef = useRef<HTMLDivElement>(null);

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
        setPrincipleText(data.principle_text || '');
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

  // 滚动到指定部分
  const scrollToSection = (key: string) => {
    const refMap: {[key: string]: React.RefObject<HTMLDivElement>} = {
      'overview': overviewRef,
      'diagram': diagramRef,
      'keyTech': keyTechRef,
      'database': databaseRef,
      'related': relatedRef,
      'interface': interfaceRef,
    };

    const ref = refMap[key];
    if (ref && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (onSectionVisibilityChange) {
        onSectionVisibilityChange(key);
      }
    }
  };

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    scrollToSection
  }));

  // 监听滚动事件，更新活动节点
  useEffect(() => {
    const handleScroll = () => {
      const sections = [
        { key: 'overview', ref: overviewRef },
        { key: 'diagram', ref: diagramRef },
        { key: 'keyTech', ref: keyTechRef },
        { key: 'database', ref: databaseRef },
        { key: 'related', ref: relatedRef },
        { key: 'interface', ref: interfaceRef },
      ];

      for (const section of sections) {
        if (section.ref.current) {
          const rect = section.ref.current.getBoundingClientRect();
          // 如果部分在视窗中
          if (rect.top <= 150 && rect.bottom >= 150) {
            if (onSectionVisibilityChange) {
              onSectionVisibilityChange(section.key);
            }
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [onSectionVisibilityChange]);

  // 保存模块内容
  const handleSave = async () => {
    try {
      setSaving(true);
      
      const contentData: ModuleContentRequest = {
        overview_text: overviewText,
        key_tech_items_json: keyTechItems,
        principle_text: principleText,
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

  // 检查某部分是否有内容
  const hasContent = (key: string): boolean => {
    switch (key) {
      case 'overview':
        return !!overviewText && overviewText.trim().length > 0;
      case 'diagram':
        return !!diagramPath;
      case 'keyTech':
        return !!principleText && principleText.trim().length > 0;
      case 'database':
        return databaseTables.length > 0;
      case 'related':
        return relatedModuleIds.length > 0;
      case 'interface':
        return apiInterfaces.length > 0;
      default:
        return false;
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
      <div className="editor-header">
        <div className="mode-indicator">
          当前模式: <span className="mode-text">{isEditMode ? '编辑' : '阅读'}</span>
        </div>
        <Button 
          type="primary" 
          icon={isEditMode ? <SaveOutlined /> : <EditOutlined />} 
          onClick={isEditMode ? handleSave : () => setIsEditMode(true)}
          loading={saving}
        >
          {isEditMode ? '保存' : '编辑'}
        </Button>
      </div>
      
      <div className="editor-content">
        {/* 模块功能概述 */}
        <div id="section-overview" className="content-section" ref={overviewRef}>
          <Title level={4} className="section-title">模块功能概述</Title>
          <Divider className="section-divider" />
          
          {isEditMode ? (
            <OverviewSection 
              value={overviewText} 
              onChange={setOverviewText} 
            />
          ) : (
            <div className="section-content">
              {overviewText ? (
                <MdPreview
                  modelValue={overviewText}
                  previewTheme="github"
                  style={{ background: 'transparent' }}
                  id={getViewerId('overview', moduleNodeId)}
                />
              ) : (
                <div className="empty-content">暂无内容</div>
              )}
            </div>
          )}
        </div>
        
        {/* 逻辑图/数据流向图 */}
        <div id="section-diagram" className="content-section" ref={diagramRef}>
          <Title level={4} className="section-title">逻辑图/数据流向图</Title>
          <Divider className="section-divider" />
          
          {isEditMode ? (
            <DiagramSection 
              moduleNodeId={moduleNodeId}
              imagePath={diagramPath}
              onImagePathChange={setDiagramPath}
            />
          ) : (
            <div className="section-content text-center">
              {diagramPath ? (
                <Image 
                  src={processImageUrl(diagramPath)} 
                  alt="模块逻辑图" 
                  style={{ maxWidth: '100%' }} 
                />
              ) : (
                <div className="empty-content">暂无图片</div>
              )}
            </div>
          )}
        </div>
        
        {/* 功能详解 */}
        <div id="section-keyTech" className="content-section" ref={keyTechRef}>
          <Title level={4} className="section-title">功能详解</Title>
          <Divider className="section-divider" />
          
          {isEditMode ? (
            <OverviewSection 
              value={principleText} 
              onChange={setPrincipleText} 
            />
          ) : (
            <div className="section-content">
              {principleText ? (
                <MdPreview
                  modelValue={principleText}
                  previewTheme="github"
                  style={{ background: 'transparent' }}
                  id={getViewerId('principle', moduleNodeId)}
                />
              ) : (
                <div className="empty-content">暂无内容</div>
              )}
            </div>
          )}
        </div>
        
        {/* 数据库表 */}
        <div id="section-database" className="content-section" ref={databaseRef}>
          <Title level={4} className="section-title">数据库表</Title>
          <Divider className="section-divider" />
          
          {isEditMode ? (
            <DatabaseTablesSection 
              tables={databaseTables} 
              onChange={setDatabaseTables} 
            />
          ) : (
            <div className="section-content">
              {databaseTables.length > 0 ? (
                databaseTables.map((table, index) => (
                  <div key={index} className="database-table-item">
                    <h4>{table.table_name}</h4>
                    <div>包含 {table.columns.length} 个字段</div>
                    <div className="table-columns">
                      {table.columns.map((column, colIndex) => (
                        <div key={colIndex} className="table-column">
                          <span className="column-name">{column.field_name}</span>
                          <span className="column-type">{column.field_type}</span>
                          {column.description && (
                            <span className="column-desc">
                              <MdPreview
                                modelValue={column.description}
                                previewTheme="github"
                                style={{ background: 'transparent' }}
                                id={getViewerId('database', `${index}-${colIndex}`)}
                              />
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-content">暂无内容</div>
              )}
            </div>
          )}
        </div>
        
        {/* 关联模块 */}
        <div id="section-related" className="content-section" ref={relatedRef}>
          <Title level={4} className="section-title">关联模块</Title>
          <Divider className="section-divider" />
          
          {isEditMode ? (
            <RelatedModulesSection 
              selectedModuleIds={relatedModuleIds} 
              onChange={setRelatedModuleIds} 
            />
          ) : (
            <div className="section-content">
              {relatedModuleIds.length > 0 ? (
                <div className="related-modules-list">
                  已关联 {relatedModuleIds.length} 个模块
                </div>
              ) : (
                <div className="empty-content">暂无关联模块</div>
              )}
            </div>
          )}
        </div>
        
        {/* 涉及接口 */}
        <div id="section-interface" className="content-section" ref={interfaceRef}>
          <Title level={4} className="section-title">涉及接口</Title>
          <Divider className="section-divider" />
          
          {isEditMode ? (
            <InterfaceSection 
              interfaces={apiInterfaces} 
              onChange={setApiInterfaces} 
            />
          ) : (
            <div className="section-content">
              {apiInterfaces.length > 0 ? (
                apiInterfaces.map((api, index) => (
                  <div key={index} className="api-interface-item">
                    <h4>{api.name}</h4>
                    <div><strong>类型:</strong> {api.type}</div>
                    <div><strong>必需:</strong> {api.required ? '是' : '否'}</div>
                    <div><strong>描述:</strong> 
                      <div className="api-description">
                        <MdPreview
                          modelValue={api.description}
                          previewTheme="github"
                          style={{ background: 'transparent' }}
                          id={getViewerId('interface', `${index}-${api.id}`)}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-content">暂无内容</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default ModuleContentEditor; 