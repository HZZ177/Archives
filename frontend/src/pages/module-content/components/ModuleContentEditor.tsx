import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { 
  Button, 
  message, 
  Spin,
  Image, 
  Typography,
  Divider,
  Tag,
  Row,
  Col,
  Table,
  Space,
  Tooltip,
  Modal
} from 'antd';
import { 
  SaveOutlined,
  EditOutlined,
  LoadingOutlined,
  PlusOutlined,
  MinusCircleOutlined,
  FileTextOutlined,
  NodeIndexOutlined
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
  DatabaseTable,
  ModuleStructureNode,
  ApiInterface,
  ApiInterfaceCard
} from '../../../types/modules';
import { fetchModuleContent, saveModuleContent, fetchModuleTree } from '../../../apis/moduleService';
import OverviewSection from './sections/OverviewSection';
import DiagramSection from './sections/DiagramSection';
import KeyTechSection from './sections/KeyTechSection';
import DatabaseTablesSection from './sections/DatabaseTablesSection';
import RelatedModulesSection from './sections/RelatedModulesSection';
import InterfaceSection from './sections/InterfaceSection';
import ApiInterfaceCardComponent from './sections/ApiInterfaceCard';
import { API_BASE_URL } from '../../../config/constants';
import './ModuleContentEditor.css';
import ModuleGraph from '../../../components/ModuleGraph/ModuleGraph';

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
  // 使用时间戳和随机数字，避免使用特殊字符
  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 10000);
  return `viewer-${prefix}-${suffix}-${timestamp}${randomNum}`;
};

// 编辑器组件接口，暴露方法给父组件
export interface ModuleContentEditorHandle {
  scrollToSection: (key: string) => void;
  saveContent: () => Promise<boolean>;
  reloadContent: () => void;
}

interface ModuleContentEditorProps {
  moduleNodeId: number;
  onSectionVisibilityChange?: (key: string) => void;
  isEditMode?: boolean;
  setIsEditMode?: React.Dispatch<React.SetStateAction<boolean>>;
  saving?: boolean;
  setSaving?: React.Dispatch<React.SetStateAction<boolean>>;
  onSectionsUpdate?: (filledSections: Set<string>) => void;
}

const ModuleContentEditor = forwardRef<ModuleContentEditorHandle, ModuleContentEditorProps>(
  ({ moduleNodeId, onSectionVisibilityChange, isEditMode: propIsEditMode, setIsEditMode: propSetIsEditMode, 
     saving: propSaving, setSaving: propSetSaving, onSectionsUpdate }, ref) => {
    const [loading, setLoading] = useState<boolean>(true);
    const [content, setContent] = useState<ModuleContent | null>(null);
    const [navVisible, setNavVisible] = useState<boolean>(true);
    // 记录已展开的API卡片ID
    const [expandedApiCards, setExpandedApiCards] = useState<string[]>([]);
    
    // 本地状态，用于收集各部分的内容
    const [overviewText, setOverviewText] = useState<string>('');
    const [keyTechItems, setKeyTechItems] = useState<KeyTechItem[]>([]);
    const [detailsText, setDetailsText] = useState<string>('');
    const [databaseTables, setDatabaseTables] = useState<DatabaseTable[]>([]);
    const [relatedModuleIds, setRelatedModuleIds] = useState<number[]>([]);
    const [relatedModules, setRelatedModules] = useState<ModuleStructureNode[]>([]);
    const [apiInterfaces, setApiInterfaces] = useState<ApiInterfaceCard[]>([]);
    const [diagramPath, setDiagramPath] = useState<string>('');

    // 创建各部分的ref，用于滚动定位
    const overviewRef = useRef<HTMLDivElement>(null);
    const diagramRef = useRef<HTMLDivElement>(null);
    const keyTechRef = useRef<HTMLDivElement>(null);
    const databaseRef = useRef<HTMLDivElement>(null);
    const relatedRef = useRef<HTMLDivElement>(null);
    const interfaceRef = useRef<HTMLDivElement>(null);

    // 修改表格折叠状态为对象形式
    const [collapsedTables, setCollapsedTables] = useState<{[key: number]: boolean}>({});
    
    // 计算所有表格是否都已折叠或展开
    const allTablesCollapsed = databaseTables.length > 0 && 
      Object.keys(collapsedTables).length === databaseTables.length &&
      Object.values(collapsedTables).every(collapsed => collapsed);
    const allTablesExpanded = databaseTables.length > 0 && 
      Object.keys(collapsedTables).length === 0;
      
    // 计算所有API卡片是否都已折叠或展开
    const apiCardsCollapsed = apiInterfaces.length > 0 && expandedApiCards.length === 0;
    const apiCardsExpanded = apiInterfaces.length > 0 && 
      expandedApiCards.length === apiInterfaces.length;

    // 本地编辑和保存状态（加下划线避免与props冲突）
    const [_isEditMode, _setIsEditMode] = useState<boolean>(false);
    const [_saving, _setSaving] = useState<boolean>(false);
    // 使用外部状态或本地状态
    const isEditMode = propIsEditMode !== undefined ? propIsEditMode : _isEditMode;
    const setIsEditMode = propSetIsEditMode || _setIsEditMode;
    const saving = propSaving !== undefined ? propSaving : _saving;
    const setSaving = propSetSaving || _setSaving;

    // 添加状态用于存储关联模块的附加信息
    const [modulePathMap, setModulePathMap] = useState<{[key: number]: string}>({});
    const [moduleOverviewMap, setModuleOverviewMap] = useState<{[key: number]: string}>({});
    const [loadingModuleInfo, setLoadingModuleInfo] = useState<{[key: number]: boolean}>({});

    // 添加图谱关系Modal的状态
    const [graphModalVisible, setGraphModalVisible] = useState(false);
    const graphRef = useRef<{ zoomToFit: () => void; resetAutoFit: () => void }>(null);

    // 添加时间戳状态用于强制更新图谱
    const [graphUpdateTime, setGraphUpdateTime] = useState<number>(Date.now());

    // 弹窗关闭时重置自动定位标记
    const handleGraphModalClose = () => {
      setGraphModalVisible(false);
    };

    // 修改弹窗打开时的自动缩放逻辑
    useEffect(() => {
      if (graphModalVisible && graphRef.current) {
        // 强制更新图谱时间戳，触发重新渲染
        setGraphUpdateTime(Date.now());
      }
    }, [graphModalVisible]);

    // 切换表格折叠状态
    const toggleTableCollapse = (tableIndex: number) => {
      setCollapsedTables(prev => ({
        ...prev,
        [tableIndex]: !prev[tableIndex]
      }));
    };

    // 检查表格是否折叠
    const isTableCollapsed = (tableIndex: number): boolean => {
      return !!collapsedTables[tableIndex];
    };

    // 全部展开
    const expandAllTables = () => {
      setCollapsedTables({});
    };

    // 全部折叠
    const collapseAllTables = () => {
      const allCollapsed = databaseTables.reduce((acc, _, index) => ({
        ...acc,
        [index]: true
      }), {});
      setCollapsedTables(allCollapsed);
    };

    // 切换所有表格的展开/收起状态
    const toggleAllTables = () => {
      if (allTablesCollapsed) {
        expandAllTables();
      } else {
        collapseAllTables();
      }
    };

    // 切换所有API卡片的展开/收起状态
    const toggleAllApiCards = () => {
      if (apiCardsCollapsed) {
        // 全部展开
        setExpandedApiCards(apiInterfaces.map(api => api.id));
      } else {
        // 全部收起
        setExpandedApiCards([]);
      }
    };

    // 添加获取模块导航路径的函数
    const findModulePath = (modules: ModuleStructureNode[], targetId: number): string => {
      const findPath = (nodes: ModuleStructureNode[], id: number, path: string[] = []): string[] | null => {
        for (const node of nodes) {
          // 尝试当前节点路径
          const currentPath = [...path, node.name];
          
          // 如果找到目标节点，返回路径
          if (node.id === id) {
            return currentPath;
          }
          
          // 如果有子节点，递归搜索
          if (node.children && node.children.length > 0) {
            const foundPath = findPath(node.children, id, currentPath);
            if (foundPath) {
              return foundPath;
            }
          }
        }
        
        // 没找到返回null
        return null;
      };
      
      const result = findPath(modules, targetId);
      return result ? result.join(' > ') : '';
    };
    
    // 添加获取模块功能概述的函数
    const fetchModuleOverview = async (moduleId: number) => {
      if (moduleOverviewMap[moduleId] !== undefined && modulePathMap[moduleId]) return; // 已经获取过
      
      try {
        setLoadingModuleInfo(prev => ({ ...prev, [moduleId]: true }));
        
        // 获取模块功能概述
        const moduleContent = await fetchModuleContent(moduleId);
        setModuleOverviewMap(prev => ({ 
          ...prev, 
          [moduleId]: moduleContent.overview_text || '暂无功能概述'
        }));
        
        // 获取完整模块树以查找模块完整路径
        if (!modulePathMap[moduleId]) {
          try {
            const treeResponse = await fetchModuleTree();
            const fullPath = findModulePath(treeResponse.items, moduleId);
            
            setModulePathMap(prev => ({ 
              ...prev, 
              [moduleId]: fullPath || '无法获取导航路径'
            }));
          } catch (error) {
            console.error(`获取模块 ${moduleId} 导航路径失败:`, error);
            setModulePathMap(prev => ({ 
              ...prev, 
              [moduleId]: '获取导航路径失败'
            }));
          }
        }
      } catch (error) {
        console.error(`获取模块 ${moduleId} 功能概述失败:`, error);
        setModuleOverviewMap(prev => ({ 
          ...prev, 
          [moduleId]: '获取功能概述失败'
        }));
      } finally {
        setLoadingModuleInfo(prev => ({ ...prev, [moduleId]: false }));
      }
    };
    
    // 处理模块标签的悬停事件
    const handleModuleTagHover = (moduleId: number) => {
      // 不再在这里设置路径，而是在fetchModuleOverview中一并处理
      if (moduleOverviewMap[moduleId] === undefined || !modulePathMap[moduleId]) {
        // 异步获取模块功能概述和路径
        fetchModuleOverview(moduleId);
      }
    };

    // 定义加载内容的函数
    const loadContent = async () => {
      try {
        setLoading(true);
        const moduleContent = await fetchModuleContent(moduleNodeId);
        console.log('模块内容数据:', moduleContent);
        
        // 初始化各部分状态
        setOverviewText(moduleContent.overview_text || '');
        setDetailsText(moduleContent.details_text || '');
        setDiagramPath(moduleContent.diagram_image_path || '');
        
        // 处理数据库表数据，兼容旧格式
        if (moduleContent.database_tables_json && Array.isArray(moduleContent.database_tables_json)) {
          let newDbTables: DatabaseTable[]; // Declare newDbTables
          // 检查是否为新格式（包含扩展字段）
          const isNewFormat = moduleContent.database_tables_json.length > 0 && 
                             ('nullable' in (moduleContent.database_tables_json[0].columns?.[0] || {}));
          
          if (isNewFormat) {
            // 如果是新格式，直接使用
            newDbTables = moduleContent.database_tables_json;
            setDatabaseTables(newDbTables);
          } else {
            // 如果是旧格式，转换为新格式
            const convertedTables = moduleContent.database_tables_json.map(table => ({
              table_name: table.table_name,
              schema_name: '',
              description: '',
              columns: (table.columns || []).map(column => ({
                field_name: column.field_name,
                field_type: column.field_type,
                length: undefined,
                nullable: true,
                default_value: undefined,
                description: column.description || '',
                remark: column.remark || '',
                is_primary_key: false,
                is_unique: false,
                is_index: false,
                foreign_key: undefined
              })),
              relationships: []
            }));
            newDbTables = convertedTables;
            setDatabaseTables(newDbTables);
          }

          // 智能初始化 collapsedTables
          // 只有当 collapsedTables 为空对象，或者其键的数量与新加载的 databaseTables 数量不一致时，才将所有表初始化为收起状态。
          // 否则，保持 collapsedTables 的现有状态不变。
          if (Object.keys(collapsedTables).length === 0 || Object.keys(collapsedTables).length !== newDbTables.length) {
            const initialCollapsed = newDbTables.reduce((acc, _, index) => ({
              ...acc,
              [index]: true // 默认收起
            }), {});
            setCollapsedTables(initialCollapsed);
          }
          // 如果表数量一致，则不改变现有的 collapsedTables 状态
        } else {
          setDatabaseTables([]);
          // 清空折叠表格索引
          setCollapsedTables({});
        }
        
        setRelatedModuleIds(moduleContent.related_module_ids_json || []);
        
        // 将现有接口数据转换为新的ApiInterfaceCard格式
        if (moduleContent.api_interfaces_json && Array.isArray(moduleContent.api_interfaces_json)) {
          // 检查是否是新接口格式(ApiInterfaceCard)
          const isNewFormat = moduleContent.api_interfaces_json.length > 0 && 
                              'path' in moduleContent.api_interfaces_json[0];
                              
          if (isNewFormat) {
            // 如果是新格式，确保每个接口都有method字段
            const safeInterfaces = moduleContent.api_interfaces_json.map((api: any) => ({
              ...api,
              method: api.method || 'GET', // 如果method缺失，设置默认值为GET
              // 转换请求和响应参数格式，如果存在
              requestParams: api.request_params ? api.request_params.map((param: any) => ({
                name: param.param_name,
                type: param.param_type,
                required: param.required || false,
                description: param.description || '',
                example: param.example || ''
              })) : [],
              responseParams: api.response_params ? api.response_params.map((param: any) => ({
                name: param.param_name,
                type: param.param_type,
                required: param.required || false,
                description: param.description || '',
                example: param.example || ''
              })) : []
            }));
            setApiInterfaces(safeInterfaces as unknown as ApiInterfaceCard[]);
            // 确保API卡片收起状态
            setExpandedApiCards([]);
          } else {
            // 旧接口格式(ApiInterface)，转换为新格式
            const convertedInterfaces = moduleContent.api_interfaces_json.map((api: ApiInterface) => ({
              id: api.id,
              path: `/api/${api.name.toLowerCase().replace(/\s+/g, '-')}`,
              method: api.type || 'GET', // 使用type字段作为method，如果type缺失，设置默认值为GET
              description: api.description,
              contentType: 'application/json',
              // 设置为空数组
              requestParams: [],
              responseParams: []
            }));
            setApiInterfaces(convertedInterfaces);
            // 确保API卡片收起状态
            setExpandedApiCards([]);
          }
        } else {
          setApiInterfaces([]);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('加载模块内容失败:', error);
        message.error('加载模块内容失败，请刷新页面重试');
        setLoading(false);
      }
    };

    // 获取模块内容
    useEffect(() => {
      loadContent();
    }, [moduleNodeId]);

    // 在关联模块数据加载完成后
    useEffect(() => {
      const loadRelatedModules = async () => {
        if (relatedModuleIds.length === 0) {
          setRelatedModules([]);
          return;
        }

        try {
          // 获取所有模块的树形结构
          const response = await fetchModuleTree();
          
          // 将树形结构扁平化为一维数组
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
          
          const allModules = flattenModuleTree(response.items);
          
          // 找出关联模块的详细信息
          const relatedModuleDetails = relatedModuleIds.map(id => {
            const module = allModules.find(m => m.id === id);
            if (module) {
              return module;
            } else {
              // 创建一个符合ModuleStructureNode类型的最小对象
              return {
                id,
                name: `未知模块(${id})`,
                parent_id: null,
                order_index: 0,
                user_id: 0,
                created_at: '',
                updated_at: '',
                children: [],
                has_content: false,
                is_content_page: false
              };
            }
          });
          
          setRelatedModules(relatedModuleDetails);
        } catch (error) {
          console.error('获取关联模块信息失败:', error);
          // 如果获取失败，使用ID创建符合ModuleStructureNode类型的对象
          const fallbackModules = relatedModuleIds.map(id => ({
            id,
            name: `模块${id}`,
            parent_id: null,
            order_index: 0,
            user_id: 0,
            created_at: '',
            updated_at: '',
            children: [],
            has_content: false,
            is_content_page: false
          }));
          setRelatedModules(fallbackModules);
        }
      };
      
      loadRelatedModules();
    }, [relatedModuleIds]);

    // 处理接口卡片的展开/收起状态
    const handleApiCardToggle = (id: string, expanded: boolean) => {
      setExpandedApiCards(prev => {
        if (expanded) {
          return [...prev, id];
        } else {
          return prev.filter(apiId => apiId !== id);
        }
      });
    };

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

    // 检查某部分是否有内容，并通知父组件
    const updateSectionsFilled = () => {
      const filled = new Set<string>();
      if (hasContent('overview')) filled.add('overview');
      if (hasContent('diagram')) filled.add('diagram');
      if (hasContent('keyTech')) filled.add('keyTech');
      if (hasContent('database')) filled.add('database');
      if (hasContent('related')) filled.add('related');
      if (hasContent('interface')) filled.add('interface');
      
      if (onSectionsUpdate) {
        onSectionsUpdate(filled);
      }
    };
    
    // 当内容变更时更新填充状态
    useEffect(() => {
      updateSectionsFilled();
    }, [overviewText, diagramPath, detailsText, databaseTables, relatedModuleIds, apiInterfaces]);

    // 暴露接口给父组件
    useImperativeHandle(ref, () => ({
      scrollToSection,
      saveContent: async () => {
        await handleSave();
        return true;
      },
      reloadContent: loadContent
    }));

    // 保存模块内容
    const handleSave = async () => {
      try {
        setSaving(true);
        
        // 构建保存数据对象，并转换 apiInterfaces 为 ApiInterface[] 类型
        const contentData = {
          overview_text: overviewText,
          details_text: detailsText,
          diagram_image_path: diagramPath,
          database_tables_json: databaseTables,
          related_module_ids_json: relatedModuleIds,
          api_interfaces_json: apiInterfaces.map(card => ({
            id: card.id,
            name: card.path || '',
            type: card.method || 'GET',
            required: true,
            description: card.description || '',
            path: card.path || '',
            method: card.method || 'GET',
            request_params: (card.requestParams || []).map(param => ({
              param_name: param.name,
              param_type: param.type,
              required: param.required,
              description: param.description,
              example: param.example
            })),
            response_params: (card.responseParams || []).map(param => ({
              param_name: param.name,
              param_type: param.type,
              required: param.required,
              description: param.description,
              example: param.example
            }))
          }))
        };
        
        console.log('保存数据:', contentData);
        
        const result = await saveModuleContent(moduleNodeId, contentData);
        if (result) {
          message.success('保存成功');
          // 更新时间戳以触发图谱重新加载
          setGraphUpdateTime(Date.now());
          setSaving(false);
        } else {
          message.error('保存失败');
        }
        
        setSaving(false);
      } catch (error) {
        console.error('保存模块内容失败:', error);
        message.error('保存失败，请稍后重试');
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
          return !!detailsText && detailsText.trim().length > 0;
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

    // 处理点击编辑按钮
    const handleEdit = () => {
      setIsEditMode(true);
    };

    // 处理点击空内容区域
    const handleEmptyContentClick = () => {
      if (!isEditMode) {
        setIsEditMode(true);
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
        {/* 仅当父组件没有提供状态时才显示编辑器头部 */}
        {(propIsEditMode === undefined) && (
          <div className="editor-header">
            <div className="mode-indicator">
              当前模式: <span className="mode-text">{saving ? '保存中...' : (isEditMode ? '编辑' : '阅读')}</span>
            </div>
            <Button 
              type="primary" 
              icon={isEditMode ? <SaveOutlined /> : <EditOutlined />} 
              onClick={isEditMode ? handleSave : handleEdit}
              loading={saving}
            >
              {isEditMode ? '保存' : '编辑'}
            </Button>
          </div>
        )}
        
        <div className="editor-content">
          {/* 功能概述 */}
          <div id="section-overview" className="content-section" ref={overviewRef}>
            <Title level={4} className="section-title">功能概述</Title>
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
                  <div className="empty-content" onClick={handleEmptyContentClick}>点击"编辑"添加功能概述</div>
                )}
              </div>
            )}
          </div>
          
          {/* 逻辑图 */}
          <div id="section-diagram" className="content-section" ref={diagramRef}>
            <Title level={4} className="section-title">逻辑图</Title>
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
                  <div className="empty-content" onClick={handleEmptyContentClick}>暂未上传模块流程图</div>
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
                value={detailsText} 
                onChange={setDetailsText} 
              />
            ) : (
              <div className="section-content">
                {detailsText ? (
                  <MdPreview
                    modelValue={detailsText}
                    previewTheme="github"
                    style={{ background: 'transparent' }}
                    id={getViewerId('principle', moduleNodeId)}
                  />
                ) : (
                  <div className="empty-content" onClick={handleEmptyContentClick}>点击"编辑"添加模块功能详解</div>
                )}
              </div>
            )}
          </div>
          
          {/* 数据库表结构 */}
          <div id="section-database" className="content-section" ref={databaseRef}>
            <div className="section-title-container api-section-header">
              <div className="section-title-with-button">
                <Title level={4} className="section-title">数据库表</Title>
                {databaseTables.length > 0 && (
                  <Button 
                    size="small" 
                    onClick={toggleAllTables}
                    className="collapse-all-button"
                  >
                    {allTablesCollapsed ? '全部展开' : '全部收起'}
                  </Button>
                )}
              </div>
            </div>
            <Divider className="section-divider" />
            
            {isEditMode ? (
              <DatabaseTablesSection 
                tables={databaseTables} 
                onChange={setDatabaseTables} 
                collapsedTables={collapsedTables}
                setCollapsedTables={setCollapsedTables}
              />
            ) : (
              <div className="section-content">
                {databaseTables.length > 0 ? (
                  <>
                    {databaseTables.map((table, index) => (
                      <div key={index} className={`database-table-item ${isTableCollapsed(index) ? 'collapsed' : ''}`}>
                        <div className="database-table-header">
                          <h4 className="table-name">
                            {table.schema_name && <span className="table-schema">{table.schema_name}.</span>}
                            {table.table_name}
                          </h4>
                          <Button 
                            type="text"
                            className="table-collapse-button"
                            icon={isTableCollapsed(index) ? <PlusOutlined /> : <MinusCircleOutlined />}
                            onClick={() => toggleTableCollapse(index)}
                            size="small"
                          >
                            {isTableCollapsed(index) ? '展开' : '折叠'}
                          </Button>
                        </div>
                        
                        {table.description && (
                          <div className="table-description">{table.description}</div>
                        )}
                        
                        <div className="table-content">
                          <Table
                            dataSource={table.columns}
                            pagination={false}
                            size="small"
                            className="table-columns"
                            rowKey={(record, colIndex) => `${index}_${colIndex}`}
                            columns={[
                              {
                                title: '字段名',
                                dataIndex: 'field_name',
                                key: 'field_name',
                                width: '15%',
                                render: (text, record) => (
                                  <div className="field-name">
                                    {text}
                                    {record.is_primary_key && <span className="field-tag primary-key">主键</span>}
                                    {record.is_unique && !record.is_primary_key && <span className="field-tag unique">唯一</span>}
                                    {record.is_index && !record.is_primary_key && !record.is_unique && <span className="field-tag index">索引</span>}
                                  </div>
                                )
                              },
                              {
                                title: '类型',
                                dataIndex: 'field_type',
                                key: 'field_type',
                                width: '15%',
                                render: (text, record) => (
                                  <span>
                                    {text.toUpperCase()}
                                    {record.length && `(${record.length})`}
                                  </span>
                                )
                              },
                              {
                                title: '允许为空',
                                dataIndex: 'nullable',
                                key: 'nullable',
                                width: '10%',
                                render: (nullable) => (
                                  <span className={`nullable-status ${nullable ? 'nullable' : 'not-nullable'}`}>
                                    {nullable ? '是' : '否'}
                                  </span>
                                )
                              },
                              {
                                title: '默认值',
                                dataIndex: 'default_value',
                                key: 'default_value',
                                width: '10%',
                                render: (text) => text || '-'
                              },
                              {
                                title: '外键',
                                dataIndex: 'foreign_key',
                                key: 'foreign_key',
                                width: '15%',
                                render: (foreignKey) => (
                                  foreignKey ? (
                                    <span className="foreign-key-reference">
                                      {foreignKey.reference_table}.{foreignKey.reference_column}
                                    </span>
                                  ) : '-'
                                )
                              },
                              {
                                title: '描述',
                                dataIndex: 'description',
                                key: 'description',
                                width: '35%',
                                render: (text, record, i) => (
                                  text ? (
                                    <MdPreview
                                      modelValue={text}
                                      previewTheme="github"
                                      style={{ background: 'transparent' }}
                                      id={getViewerId('field', `${index}_${i}`)}
                                    />
                                  ) : '-'
                                )
                              }
                            ]}
                          />
                          
                          {/* 表关系展示 */}
                          {table.relationships && table.relationships.length > 0 && (
                            <div className="table-relationships">
                              <h5>表关系</h5>
                              <ul className="relationship-list">
                                {table.relationships.map((rel, relIndex) => (
                                  <li key={relIndex} className="relationship-item">
                                    <span className="relationship-type">
                                      {rel.type === 'one-to-one' && '一对一'}
                                      {rel.type === 'one-to-many' && '一对多'}
                                      {rel.type === 'many-to-many' && '多对多'}
                                    </span>
                                    <span className="relationship-table">{rel.to_table}</span>
                                    {rel.description && (
                                      <span className="relationship-description">({rel.description})</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        
                        {/* 字段标签展示区域（折叠状态下显示） */}
                        <div className="table-fields-tags">
                          {table.columns.slice(0, 15).map((column, colIndex) => {
                            // 确定字段标签类型
                            let tagClassName = "field-tag-item";
                            if (column.is_primary_key) {
                              tagClassName += " primary";
                            } else if (column.foreign_key) {
                              tagClassName += " foreign";
                            } else if (column.is_unique) {
                              tagClassName += " unique";
                            } else if (column.is_index) {
                              tagClassName += " index";
                            }
                            
                            // 构建完整的字段信息提示
                            const tooltipTitle = (
                              <>
                                <div><strong>名称:</strong> {column.field_name}</div>
                                <div><strong>类型:</strong> {column.field_type.toUpperCase()}{column.length ? `(${column.length})` : ''}</div>
                                <div><strong>可空:</strong> {column.nullable ? '是' : '否'}</div>
                                {column.default_value && <div><strong>默认值:</strong> {column.default_value}</div>}
                                {column.is_primary_key && <div><strong>主键</strong></div>}
                                {column.is_unique && <div><strong>唯一键</strong></div>}
                                {column.is_index && <div><strong>索引</strong></div>}
                                {column.foreign_key && (
                                  <div><strong>外键:</strong> {column.foreign_key.reference_table}.{column.foreign_key.reference_column}</div>
                                )}
                                {column.description && <div><strong>描述:</strong> {column.description}</div>}
                              </>
                            );
                            
                            return (
                              <Tooltip 
                                key={`tag-${colIndex}`}
                                title={tooltipTitle}
                                placement="top"
                              >
                                <span className={tagClassName}>
                                  {column.field_name}
                                </span>
                              </Tooltip>
                            );
                          })}
                          
                          {table.columns.length > 15 && (
                            <Tooltip 
                              title={`还有${table.columns.length - 15}个字段未显示，点击展开查看全部`}
                              placement="top"
                            >
                              <span 
                                className="field-tag-item more-tag"
                                onClick={() => isTableCollapsed(index) && toggleTableCollapse(index)}
                                style={{ cursor: 'pointer' }}
                              >
                                +{table.columns.length - 15}
                              </span>
                            </Tooltip>
                          )}
                        </div>
                        
                        {isTableCollapsed(index) && table.columns.length > 0 && (
                          <div className="table-collapsed-summary">
                            共{table.columns.length}个字段
                            {table.columns.filter(col => col.is_primary_key).length > 0 && 
                              `，${table.columns.filter(col => col.is_primary_key).length}个主键`}
                            {table.columns.filter(col => col.foreign_key).length > 0 && 
                              `，${table.columns.filter(col => col.foreign_key).length}个外键`}
                            {table.columns.filter(col => col.is_unique && !col.is_primary_key).length > 0 && 
                              `，${table.columns.filter(col => col.is_unique && !col.is_primary_key).length}个唯一键`}
                            {table.columns.filter(col => col.is_index && !col.is_unique && !col.is_primary_key).length > 0 && 
                              `，${table.columns.filter(col => col.is_index && !col.is_unique && !col.is_primary_key).length}个索引`}
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="empty-content" onClick={handleEmptyContentClick}>点击"编辑"添加数据库表结构</div>
                )}
              </div>
            )}
          </div>
          
          {/* 关联模块 */}
          <div id="section-related" className="content-section" ref={relatedRef}>
            <div className="section-title-container api-section-header">
              <div className="section-title-with-button">
                <Title level={4} className="section-title">关联模块</Title>
                <Button
                  type="primary"
                  className="graph-modal-button"
                  icon={<NodeIndexOutlined />}
                  onClick={() => setGraphModalVisible(true)}
                >
                  关联关系图谱
                </Button>
              </div>
            </div>
            <Divider className="section-divider" />
            
            {isEditMode ? (
              <RelatedModulesSection 
                selectedModuleIds={relatedModuleIds} 
                onChange={setRelatedModuleIds} 
                currentModuleId={moduleNodeId}
              />
            ) : (
              <div className="section-content">
                {relatedModuleIds.length > 0 ? (
                  <div className="related-modules-viewer">
                    {/* 只保留标签视图和图谱关系按钮 */}
                    <div className="related-modules-group">
                      <div className="related-modules-tags">
                        {relatedModules.map(module => (
                          <Tooltip
                            key={module.id}
                            title={
                              <div className="module-tooltip-content">
                                <div className="module-tooltip-title">{module.name}</div>
                                <div className="module-tooltip-path">
                                  <span className="tooltip-label">导航路径：</span>
                                  {modulePathMap[module.id] || '加载中...'}
                                </div>
                                <div className="module-tooltip-overview">
                                  <span className="tooltip-label">功能概述：</span>
                                  {loadingModuleInfo[module.id] ? (
                                    <span>加载中...</span>
                                  ) : (
                                    <div className="overview-content">
                                      {moduleOverviewMap[module.id] ? 
                                        moduleOverviewMap[module.id] : 
                                        '加载中...'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            }
                            color="#1f1f1f"
                            overlayClassName="module-detailed-tooltip"
                            onVisibleChange={(visible) => {
                              if (visible) {
                                handleModuleTagHover(module.id);
                              }
                            }}
                          >
                            <Tag 
                              key={module.id} 
                              color="blue"
                              className="module-tag module-tag-interactive"
                              icon={<FileTextOutlined />}
                              onClick={() => {
                                window.location.href = `/module-content/${module.id}`;
                              }}
                            >
                              <span className="module-tag-text">{module.name}</span>
                            </Tag>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="empty-content" onClick={handleEmptyContentClick}>暂无关联模块，点击"编辑"添加</div>
                )}
              </div>
            )}
          </div>
          
          {/* 涉及接口 */}
          <div id="section-interface" className="content-section" ref={interfaceRef}>
            <div className="section-title-container api-section-header">
              <div className="section-title-with-button">
                <Title level={4} className="section-title">涉及接口</Title>
                {apiInterfaces.length > 0 && (
                  <Button 
                    size="small" 
                    onClick={toggleAllApiCards}
                    className="collapse-all-button"
                  >
                    {apiCardsCollapsed ? '全部展开' : '全部收起'}
                  </Button>
                )}
              </div>
            </div>
            <Divider className="section-divider" />
            
            {isEditMode ? (
              <InterfaceSection 
                interfaces={apiInterfaces} 
                onChange={setApiInterfaces} 
                expandedApiCards={expandedApiCards}
                setExpandedApiCards={setExpandedApiCards}
              />
            ) : (
              <div className="section-content">
                {apiInterfaces.length > 0 ? (
                  <Row gutter={[12, 12]} className="interface-card-grid">
                    {apiInterfaces.map(api => (
                      <Col xs={24} sm={24} md={24} lg={12} xl={12} key={api.id}>
                        <ApiInterfaceCardComponent
                          data={api}
                          onEdit={() => {}} // 阅读模式无需编辑功能
                          onDelete={() => {}} // 阅读模式无需删除功能
                          isEditable={false}
                          isExpanded={expandedApiCards.includes(api.id)}
                          onToggleExpand={handleApiCardToggle}
                          />
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <div className="empty-content" onClick={handleEmptyContentClick}>点击"编辑"添加接口信息</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 图谱关系Modal */}
        <Modal
          title="模块关系图谱"
          open={graphModalVisible}
          onCancel={handleGraphModalClose}
          width="80%"
          footer={null}
          className="module-graph-modal"
        >
          <div className="module-graph-container">
            <ModuleGraph
              ref={graphRef}
              currentModuleId={moduleNodeId}
              key={graphUpdateTime}
              onNodeClick={(moduleId) => {
                window.location.href = `/module-content/${moduleId}`;
              }}
            />
          </div>
        </Modal>
      </div>
    );
  }
);

export default ModuleContentEditor; 