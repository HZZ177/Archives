import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
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
  ReadOutlined,
  SolutionOutlined,
  NodeIndexOutlined,
  DeploymentUnitOutlined,
  DatabaseOutlined,
  ApiOutlined,
  LinkOutlined,
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
  ApiInterfaceCard,
  GlossaryItem
} from '../../../types/modules';
import { fetchModuleContent, saveModuleContent, fetchModuleTree, updateDiagram } from '../../../apis/moduleService';
import type { DiagramEditorHandle } from '../../../components/business/SectionModules/DiagramEditor';
import {
  OverviewSection,
  DiagramSection,
  KeyTechSection,
  DatabaseTablesSection,
  RelatedModulesSection,
  InterfaceSection,
  GlossarySection
} from './sections';
import ApiInterfaceCardComponent from './sections/ApiInterfaceCard';
import SideNavigation from './SideNavigation';
import RelatedModuleCard from './RelatedModuleCard';
import { API_BASE_URL } from '../../../config/constants';
import './ModuleContentEditor.css';
import ModuleGraph from '../../../components/ModuleGraph/ModuleGraph';

const { Title } = Typography;

const sectionConfig: { [key: string]: { title: string; icon: React.ReactNode } } = {
  overview: { title: '功能概述', icon: <FileTextOutlined /> },
  terminology: { title: '名称解释', icon: <ReadOutlined /> },
  keyTech: { title: '功能详解', icon: <SolutionOutlined /> },
  diagram: { title: '业务流程图', icon: <NodeIndexOutlined /> },
  tableRelation: { title: '表关联关系图', icon: <DeploymentUnitOutlined /> },
  database: { title: '数据库表', icon: <DatabaseOutlined /> },
  related: { title: '关联模块', icon: <LinkOutlined /> },
  interface: { title: '涉及接口', icon: <ApiOutlined /> },
};

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
  onSectionVisibilityChange: (key: string) => void;
  isEditMode?: boolean;
  setIsEditMode: (isEditMode: boolean) => void;
  saving?: boolean;
  setSaving: (saving: boolean) => void;
  onSectionsUpdate: (filledKeys: Set<string>) => void;
  enabledSections: string[];  // 新增：启用的模块列表
}

const ModuleContentEditor: React.ForwardRefRenderFunction<ModuleContentEditorHandle, ModuleContentEditorProps> = ({
  moduleNodeId,
  onSectionVisibilityChange,
  isEditMode: propIsEditMode,
  setIsEditMode: propSetIsEditMode,
  saving: propSaving,
  setSaving: propSetSaving,
  onSectionsUpdate,
  enabledSections,
}, ref) => {
  // 使用传递的props，或者提供默认值
  const isEditMode = propIsEditMode ?? false;
  const setIsEditMode = propSetIsEditMode ?? (() => {});
  const saving = propSaving ?? false;
  const setSaving = propSetSaving ?? (() => {});

  const [loading, setLoading] = useState<boolean>(true);
  const [content, setContent] = useState<ModuleContent | null>(null);
  const [initialContent, setInitialContent] = useState<ModuleContent | null>(null);
  const [filledSections, setFilledSections] = useState<Set<string>>(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [navVisible, setNavVisible] = useState<boolean>(true);
  // 记录已展开的API卡片ID
  const [expandedApiCards, setExpandedApiCards] = useState<string[]>([]);
  
  // 本地状态，用于收集各部分的内容
  const [overviewText, setOverviewText] = useState<string>('');
  const [keyTechItems, setKeyTechItems] = useState<KeyTechItem[]>([]);
  const [glossaryItems, setGlossaryItems] = useState<GlossaryItem[]>([]);
  const [detailsText, setDetailsText] = useState<string>('');
  const [databaseTables, setDatabaseTables] = useState<DatabaseTable[]>([]);
  const [relatedModuleIds, setRelatedModuleIds] = useState<number[]>([]);
  const [relatedModules, setRelatedModules] = useState<ModuleStructureNode[]>([]);
  const [apiInterfaces, setApiInterfaces] = useState<ApiInterfaceCard[]>([]);

  // 创建各部分的ref，用于滚动定位
  const overviewRef = useRef<HTMLDivElement>(null);
  const diagramRef = useRef<HTMLDivElement>(null);
  const terminologyRef = useRef<HTMLDivElement>(null);
  const keyTechRef = useRef<HTMLDivElement>(null);
  const databaseRef = useRef<HTMLDivElement>(null);
  const tableRelationRef = useRef<HTMLDivElement>(null);
  const relatedRef = useRef<HTMLDivElement>(null);
  const interfaceRef = useRef<HTMLDivElement>(null);

  const [collapsedTables, setCollapsedTables] = useState<Set<number>>(new Set());
  
  // 计算所有API卡片是否都已折叠或展开
  const apiCardsCollapsed = apiInterfaces.length > 0 && expandedApiCards.length === 0;
  const apiCardsExpanded = apiInterfaces.length > 0 && 
    expandedApiCards.length === apiInterfaces.length;

  // 添加状态用于存储关联模块的附加信息
  const [modulePathMap, setModulePathMap] = useState<{[key: number]: string}>({});
  const [moduleOverviewMap, setModuleOverviewMap] = useState<{[key: number]: string}>({});
  const [loadingModuleInfo, setLoadingModuleInfo] = useState<{[key: number]: boolean}>({});

  // 添加图谱关系Modal的状态
  const [graphModalVisible, setGraphModalVisible] = useState(false);
  const graphRef = useRef<{ zoomToFit: () => void; resetAutoFit: () => void }>(null);

  // 添加时间戳状态用于强制更新图谱
  const [graphUpdateTime, setGraphUpdateTime] = useState<number>(Date.now());

  // 引用 DiagramEditor，用于获取当前画布数据
  const diagramEditorRef = useRef<DiagramEditorHandle>(null);
  // 添加表关联关系图的ref
  const tableRelationDiagramRef = useRef<DiagramEditorHandle>(null);

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
    if (moduleOverviewMap[moduleId] !== undefined) return; // 已经获取过，不再重复获取
    
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

  // 定义加载内容的函数
  const loadContent = async () => {
    try {
      setLoading(true);
      // 使用 any 类型避免类型检查错误
      const moduleContent: any = await fetchModuleContent(moduleNodeId);
      console.log('模块内容数据:', moduleContent);
      
      // 初始化各部分状态
      setOverviewText(moduleContent.overview_text || '');
      setDetailsText(moduleContent.details_text || '');
      
      // 添加调试日志，确认数据加载
      console.log('加载数据状态:', {
        overview_text: moduleContent.overview_text,
        details_text: moduleContent.details_text,
        overviewText,
        detailsText
      });
      
      // 处理术语表数据
      if (moduleContent.terminology_json && Array.isArray(moduleContent.terminology_json)) {
        // 如果后端直接返回JSON数组格式，直接使用
        setGlossaryItems(moduleContent.terminology_json);
      } else if (moduleContent.terminology_text) {
        // 尝试解析terminology_text为JSON格式
        try {
          const parsedTerminology = JSON.parse(moduleContent.terminology_text);
          if (Array.isArray(parsedTerminology)) {
            setGlossaryItems(parsedTerminology);
          } else {
            // 如果不是数组，创建一个空数组
            setGlossaryItems([]);
          }
        } catch (e) {
          console.warn('术语表数据解析失败，使用空数组:', e);
          setGlossaryItems([]);
        }
      } else {
        // 没有术语表数据，使用空数组
        setGlossaryItems([]);
      }
      
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
          const convertedTables = moduleContent.database_tables_json.map((table: any) => ({
            table_name: table.table_name,
            schema_name: '',
            description: '',
            columns: (table.columns || []).map((column: any) => ({
              field_name: column.field_name,
              field_type: column.field_type,
              length: undefined,
              nullable: false,
              is_primary_key: false,
              is_unique: false,
              is_index: false
            }))
          }));
          newDbTables = convertedTables;
          setDatabaseTables(newDbTables);
        }

        // 根据是否为编辑模式，设置数据库表的初始折叠状态
        if (!isEditMode) {
          // 阅读模式下，默认全部折叠
          setCollapsedTables(new Set(newDbTables.map((_, index) => index)));
        } else {
          // 编辑模式下，默认全部展开
          setCollapsedTables(new Set());
        }
      } else {
        setDatabaseTables([]);
        // 清空折叠表格索引
        setCollapsedTables(new Set());
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
      
      // 创建适用于filteredContent的内容结构
      const contentSections = [
        { key: 'overview', content: moduleContent.overview_text || '' },
        { key: 'diagram', content: moduleContent.content?.diagram || {} },
        { key: 'terminology', content: glossaryItems.length > 0 ? glossaryItems : (moduleContent.terminology_text || '') },
        { key: 'keyTech', content: moduleContent.details_text || '' },
        { key: 'database', content: databaseTables },
        { key: 'tableRelation', content: moduleContent.table_relation_diagram || moduleContent.content?.diagram || {} },
        { key: 'related', content: relatedModuleIds },
        { key: 'interface', content: apiInterfaces }
      ];
      
      // 设置content状态，确保filteredContent能够正确工作
      setContent({
        id: moduleContent.id || 0,
        node_id: moduleNodeId,
        content: {
          overview: moduleContent.overview_text || '',
          diagram: moduleContent.content?.diagram || {},
          glossary: glossaryItems,
          key_tech: [],
          database_tables: databaseTables,
          related_modules: relatedModuleIds,
          interface_definitions: apiInterfaces
        },
        sections: contentSections,
        last_updated_at: moduleContent.last_updated_at || new Date().toISOString()
      });
      
      // 保存初始内容，用于检测未保存的更改
      setInitialContent({
        id: moduleContent.id || 0,
        node_id: moduleNodeId,
        content: {
          overview: moduleContent.overview_text || '',
          diagram: moduleContent.content?.diagram || {},
          glossary: glossaryItems,
          key_tech: [],
          database_tables: databaseTables,
          related_modules: relatedModuleIds,
          interface_definitions: apiInterfaces
        },
        sections: contentSections,
        last_updated_at: moduleContent.last_updated_at || new Date().toISOString()
      });
      
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

        // 为所有关联模块获取功能概述
        if (relatedModuleDetails.length > 0) {
          const overviewPromises = relatedModuleDetails.map(module => 
            fetchModuleOverview(module.id)
          );
          await Promise.all(overviewPromises);
        }

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
      'terminology': terminologyRef,
      'keyTech': keyTechRef,
      'database': databaseRef,
      'tableRelation': tableRelationRef,
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
    if (hasContent('terminology')) filled.add('terminology');
    if (hasContent('keyTech')) filled.add('keyTech');
    if (hasContent('database')) filled.add('database');
    if (hasContent('tableRelation')) filled.add('tableRelation');
    if (hasContent('related')) filled.add('related');
    if (hasContent('interface')) filled.add('interface');
    
    if (onSectionsUpdate) {
      onSectionsUpdate(filled);
    }
  };
  
  // 当内容变更时更新填充状态
  useEffect(() => {
    updateSectionsFilled();
  }, [overviewText, detailsText, databaseTables, relatedModuleIds, apiInterfaces]);

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
      
      // 添加调试日志，确认保存前的数据
      console.log('保存前数据检查:', {
        overviewText,
        detailsText,
        glossaryItems,
        databaseTables,
        relatedModuleIds,
        apiInterfaces
      });
      
      // 构建保存数据对象，并转换 apiInterfaces 为 ApiInterface[] 类型
      const contentData = {
        overview_text: overviewText,
        details_text: detailsText,
        terminology_json: glossaryItems, // 添加术语表数据
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
        })),
        // 添加必要的字段以符合ModuleContentRequest接口
        node_id: moduleNodeId,
        content: {
          overview: overviewText,
          diagram: {},
          key_tech: [],
          database_tables: databaseTables,
          related_modules: relatedModuleIds,
          interface_definitions: apiInterfaces,
          glossary: glossaryItems
        }
      };
      
      console.log('保存数据:', contentData);
      
      const result = await saveModuleContent(moduleNodeId, contentData);
      if (result) {
        message.success('保存成功');
        
        // 保存业务流程图数据
        const diagramData = diagramEditorRef.current?.getDiagramData();
        if (diagramData) {
          try {
            await updateDiagram(moduleNodeId, diagramData, 'business');
            console.log('业务流程图保存成功');
          } catch (error) {
            console.error('业务流程图保存失败:', error);
          }
        }
        
        // 保存表关联关系图数据
        const tableRelationData = tableRelationDiagramRef.current?.getDiagramData();
        if (tableRelationData) {
          try {
            await updateDiagram(moduleNodeId, tableRelationData, 'tableRelation');
            console.log('表关联关系图保存成功');
          } catch (error) {
            console.error('表关联关系图保存失败:', error);
          }
        }
        
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
      case 'terminology':
        return !!filteredContent?.sections.find(s => s.key === 'terminology')?.content && 
               filteredContent.sections.find(s => s.key === 'terminology')?.content.toString().trim().length > 0;
      case 'keyTech':
        return !!detailsText && detailsText.trim().length > 0;
      case 'database':
        return databaseTables.length > 0;
      case 'tableRelation':
        // 表关联关系图模块使用与业务流程图相同的检查逻辑
        return !!filteredContent?.content?.diagram && Object.keys(filteredContent.content.diagram).length > 0;
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

  // 根据启用的模块过滤内容
  const filteredContent = useMemo(() => {
    if (!content) return null;
    return {
      ...content,
      sections: content.sections?.filter(section => enabledSections.includes(section.key)) || []
    };
  }, [content, enabledSections]);

  const handleSectionUpdate = (sectionKey: keyof ModuleContent['content'], data: any) => {
    console.log(`更新${sectionKey}部分数据:`, data);
    setContent(prevContent => {
      if (!prevContent) return null;
      const newContent = {
        ...prevContent,
        content: {
          ...prevContent.content,
          [sectionKey]: data,
        },
      };
      setHasUnsavedChanges(JSON.stringify(newContent) !== JSON.stringify(initialContent));
      return newContent;
    });
  };
  
  const checkFilledSections = (currentContent: ModuleContent) => {
    const newFilledSections = new Set<string>();
    if (currentContent.content.overview) newFilledSections.add('overview');
    if (currentContent.content.diagram && currentContent.content.diagram.elements?.length > 0) newFilledSections.add('diagram');
    // ... 其他检查
    setFilledSections(newFilledSections);
  };

  const handleValidationChange = (tableIndex: number, errors: string[]) => {
    // 可以在这里处理验证状态，例如显示一个全局的错误指示器
  };

  React.useEffect(() => {
    // 当从编辑模式切换到阅读模式时，折叠所有表格
    if (!propIsEditMode) {
      const allTableIndexes = new Set(databaseTables.map((_, index) => index));
      setCollapsedTables(allTableIndexes);
    }
  }, [propIsEditMode, databaseTables]);

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
        {filteredContent && (
          <>
            {/* 根据enabledSections的顺序渲染各个模块 */}
            {enabledSections.map(sectionKey => {
              const config = sectionConfig[sectionKey];
              if (!config) return null;

              // 根据sectionKey渲染对应的模块内容
              switch(sectionKey) {
                case 'overview':
                  return (
                    <div key={sectionKey} id="section-overview" className="content-section" ref={overviewRef}>
                      <Title level={4} className="section-title">
                        <span className="section-title-icon">{config.icon}</span>
                        {config.title}
                      </Title>
                      <Divider className="section-divider" />
                      
                      {isEditMode ? (
                        <OverviewSection 
                          value={overviewText} 
                          onChange={(value) => {
                            console.log('功能概述更新:', value);
                            setOverviewText(value); // 更新overviewText状态
                            const updatedSections = filteredContent.sections.map(section =>
                              section.key === 'overview' ? { ...section, content: value } : section
                            );
                            setContent({ ...filteredContent, sections: updatedSections });
                          }}
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
                  );
                
                case 'diagram':
                  return (
                    <div key={sectionKey} id="section-diagram" className="content-section" ref={diagramRef}>
                      <Title level={4} className="section-title">
                        <span className="section-title-icon">{config.icon}</span>
                        {config.title}
                      </Title>
                      <Divider className="section-divider" />
                      <DiagramSection
                        ref={diagramEditorRef}
                        moduleNodeId={moduleNodeId}
                        isEditable={isEditMode}
                        diagramType="business"
                      />
                    </div>
                  );
                
                case 'keyTech':
                  return (
                    <div key={sectionKey} id="section-keyTech" className="content-section" ref={keyTechRef}>
                      <Title level={4} className="section-title">
                        <span className="section-title-icon">{config.icon}</span>
                        {config.title}
                      </Title>
                      <Divider className="section-divider" />
                      
                      {isEditMode ? (
                        <OverviewSection 
                          value={detailsText} 
                          onChange={(value) => {
                            console.log('功能详解更新:', value);
                            setDetailsText(value); // 更新detailsText状态
                            const updatedSections = filteredContent.sections.map(section =>
                              section.key === 'keyTech' ? { ...section, content: value } : section
                            );
                            setContent({ ...filteredContent, sections: updatedSections });
                          }}
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
                  );
                
                case 'database':
                  return (
                    <div key={sectionKey} id="section-database" className="content-section" ref={databaseRef}>
                      <Title level={4} className="section-title">
                        <span className="section-title-icon">{config.icon}</span>
                        {config.title}
                      </Title>
                      <Divider className="section-divider" />
                      <div className="section-content">
                        <DatabaseTablesSection 
                          tables={databaseTables} 
                          onChange={setDatabaseTables}
                          onValidationChange={handleValidationChange}
                          isEditMode={isEditMode}
                          collapsedTables={collapsedTables}
                          setCollapsedTables={setCollapsedTables}
                        />
                      </div>
                    </div>
                  );
                
                case 'related':
                  return (
                    <div key={sectionKey} id="section-related" className="content-section" ref={relatedRef}>
                      <div className="section-title-container api-section-header">
                        <div className="section-title-with-button">
                          <Title level={4} className="section-title">
                            <span className="section-title-icon">{config.icon}</span>
                            {config.title}
                          </Title>
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
                          {relatedModules.length > 0 ? (
                            <Row gutter={[16, 16]}>
                                  {relatedModules.map(module => (
                                <Col key={module.id} xs={24} sm={12} md={8} lg={8} xl={6}>
                                  <RelatedModuleCard 
                                    module={module}
                                    overview={moduleOverviewMap[module.id]}
                                  />
                                </Col>
                              ))}
                            </Row>
                          ) : (
                            <div className="empty-content" onClick={handleEmptyContentClick}>暂无关联模块，点击"编辑"添加</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                
                case 'interface':
                  return (
                    <div key={sectionKey} id="section-interface" className="content-section" ref={interfaceRef}>
                      <div className="section-title-container api-section-header">
                        <div className="section-title-with-button">
                          <Title level={4} className="section-title">
                            <span className="section-title-icon">{config.icon}</span>
                            {config.title}
                          </Title>
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
                  );
                
                case 'tableRelation':
                  return (
                    <div key={sectionKey} id="section-tableRelation" className="content-section" ref={tableRelationRef}>
                      <Title level={4} className="section-title">
                        <span className="section-title-icon">{config.icon}</span>
                        {config.title}
                      </Title>
                      <Divider className="section-divider" />
                      <DiagramSection
                        ref={tableRelationDiagramRef}
                        moduleNodeId={moduleNodeId}
                        isEditable={isEditMode}
                        diagramType="tableRelation"
                      />
                    </div>
                  );
                
                case 'terminology':
                  return (
                    <div key={sectionKey} id="section-terminology" className="content-section" ref={terminologyRef}>
                      <Title level={4} className="section-title">
                        <span className="section-title-icon">{config.icon}</span>
                        {config.title}
                      </Title>
                      <Divider className="section-divider" />
                      <div className="section-content">
                        {isEditMode ? (
                          <GlossarySection
                            content={glossaryItems}
                            onChange={setGlossaryItems}
                            isEditable={true}
                          />
                        ) : (
                          hasContent(sectionKey) ? (
                            <GlossarySection
                              content={glossaryItems}
                              onChange={() => {}}
                              isEditable={false}
                            />
                          ) : (
                            <div className="empty-content" onClick={handleEmptyContentClick}>点击"编辑"添加名称解释</div>
                          )
                        )}
                      </div>
                    </div>
                  );
                
                default:
                  return null;
              }
            })}
          </>
        )}
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
};

export default forwardRef(ModuleContentEditor); 