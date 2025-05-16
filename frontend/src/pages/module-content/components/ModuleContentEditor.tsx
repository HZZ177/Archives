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
  Space
} from 'antd';
import { 
  SaveOutlined,
  EditOutlined,
  LoadingOutlined,
  PlusOutlined,
  MinusCircleOutlined
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

  // 表格折叠状态管理
  const [collapsedTables, setCollapsedTables] = useState<Record<number, boolean>>({});

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
    const newCollapsedState: Record<number, boolean> = {};
    databaseTables.forEach((_, index) => {
      newCollapsedState[index] = false;
    });
    setCollapsedTables(newCollapsedState);
  };

  // 全部折叠
  const collapseAllTables = () => {
    const newCollapsedState: Record<number, boolean> = {};
    databaseTables.forEach((_, index) => {
      newCollapsedState[index] = true;
    });
    setCollapsedTables(newCollapsedState);
  };

  // 获取模块内容
  useEffect(() => {
    const loadContent = async () => {
      try {
        setLoading(true);
        const moduleContent = await fetchModuleContent(moduleNodeId);
        console.log('模块内容数据:', moduleContent);
        
        // 初始化各部分状态
        setOverviewText(moduleContent.overview_text || '');
        setPrincipleText(moduleContent.principle_text || '');
        setDiagramPath(moduleContent.diagram_image_path || '');
        
        // 处理数据库表数据，兼容旧格式
        if (moduleContent.database_tables_json && Array.isArray(moduleContent.database_tables_json)) {
          // 检查是否为新格式（包含扩展字段）
          const isNewFormat = moduleContent.database_tables_json.length > 0 && 
                             ('nullable' in (moduleContent.database_tables_json[0].columns?.[0] || {}));
          
          if (isNewFormat) {
            // 如果是新格式，直接使用
            setDatabaseTables(moduleContent.database_tables_json);
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
            setDatabaseTables(convertedTables);
          }
        } else {
          setDatabaseTables([]);
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
    
    loadContent();
  }, [moduleNodeId]);

  // 获取关联模块的详细信息
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
      
      // 构建保存数据对象，并转换 apiInterfaces 为 ApiInterface[] 类型
      const contentData = {
        overview_text: overviewText,
        principle_text: principleText,
        diagram_image_path: diagramPath,
        database_tables_json: databaseTables,
        related_module_ids_json: relatedModuleIds,
        // 将 ApiInterfaceCard[] 转换为后端需要的 ApiInterface[] 格式
        api_interfaces_json: apiInterfaces.map(card => ({
          id: card.id,
          name: card.path || '',  // 确保path不为空
          type: card.method || 'GET',  // 确保method不为空，默认使用GET
          required: true,
          description: card.description || '',
          // 添加请求参数和响应参数
          path: card.path || '',
          method: card.method || 'GET',
          // 将ApiParam结构转换为后端期望的ApiInterfaceParameter结构
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
        setIsEditMode(false);
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
      <div className="editor-header">
        <div className="mode-indicator">
          当前模式: <span className="mode-text">{isEditMode ? '编辑' : '阅读'}</span>
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
                <div className="empty-content" onClick={handleEmptyContentClick}>点击"编辑"添加模块功能详解</div>
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
                      
                      {!isTableCollapsed(index) && (
                        <>
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
                        </>
                      )}
                      
                      {isTableCollapsed(index) && (
                        <div className="table-collapsed-summary">
                          共{table.columns.length}个字段
                          {table.columns.filter(col => col.is_primary_key).length > 0 && '，含主键'}
                          {table.columns.some(col => col.foreign_key) && '，含外键'}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {databaseTables.length > 1 && (
                    <div className="table-actions">
                      <Space>
                        <Button size="small" onClick={expandAllTables}>全部展开</Button>
                        <Button size="small" onClick={collapseAllTables}>全部折叠</Button>
                      </Space>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-content" onClick={handleEmptyContentClick}>点击"编辑"添加数据库表结构</div>
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
                <div className="related-modules-tags">
                  {relatedModules.map(module => (
                    <Tag key={module.id} color="blue" className="module-tag">
                      {module.name}
                    </Tag>
                  ))}
                </div>
              ) : (
                <div className="empty-content" onClick={handleEmptyContentClick}>暂无关联模块，点击"编辑"添加</div>
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
                <Row gutter={[12, 12]} className="interface-card-grid">
                  {apiInterfaces.map(api => (
                    <Col xs={24} sm={24} md={24} lg={12} xl={12} key={api.id}>
                      <ApiInterfaceCardComponent
                        data={api}
                        onEdit={() => {}} // 阅读模式无需编辑功能
                        onDelete={() => {}} // 阅读模式无需删除功能
                        isEditable={false}
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
    </div>
  );
});

export default ModuleContentEditor; 