import React, { useState, useEffect, useMemo } from 'react';
import { Spin, Tabs, Button, Form, Input, Radio, message, Space, Divider, Card, Tag, Tooltip, Statistic, Row, Col, Progress, TreeSelect } from 'antd';
import { 
  EditOutlined, 
  SaveOutlined, 
  FolderOutlined, 
  FileOutlined, 
  LinkOutlined,
  CalendarOutlined,
  UserOutlined,
  TeamOutlined,
  NodeIndexOutlined,
  AppstoreOutlined,
  ArrowRightOutlined,
  EyeOutlined,
  LoadingOutlined,
  CheckCircleFilled,
  ExclamationCircleFilled,
  FileTextOutlined,
  PictureOutlined,
  DatabaseOutlined,
  ApiOutlined,
  BookOutlined,
  KeyOutlined,
  ClusterOutlined,
  InfoCircleOutlined,
  BarChartOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { ModuleStructureNode, ModuleStructureNodeRequest } from '../../../types/modules';
import { updateModuleNode, fetchModuleContent, getDiagram, getModuleSectionConfig } from '../../../apis/moduleService';
import { useModules } from '../../../contexts/ModuleContext';
import { refreshModuleTreeEvent } from '../../../layouts/MainLayout';
import { Link } from 'react-router-dom';
import { fetchUserById } from '../../../apis/userService';

const { TabPane } = Tabs;

interface NodeDetailPanelProps {
  node: ModuleStructureNode | null;
  loading: boolean;
  onNodeUpdated: () => void;
  treeData: ModuleStructureNode[]; // 添加完整树数据属性
}

const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({ 
  node, 
  loading,
  onNodeUpdated,
  treeData
}) => {
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [creator, setCreator] = useState<{id: number, username: string} | null>(null);
  const [loadingCreator, setLoadingCreator] = useState<boolean>(false);
  const [moduleContent, setModuleContent] = useState<any | null>(null); // 修改类型以适应新的模块内容结构
  const [loadingContent, setLoadingContent] = useState<boolean>(false);
  const [enabledModules, setEnabledModules] = useState<{[key: string]: boolean}>({});
  const [loadingModuleConfig, setLoadingModuleConfig] = useState<boolean>(false);
  const { fetchModules } = useModules();

  // 处理树数据，过滤不适合作为父节点的选项
  const processTreeData = (
    treeNodes: ModuleStructureNode[], 
    currentNodeId?: number
  ): any[] => {
    // 如果没有节点或是空数组，返回空数组
    if (!treeNodes || treeNodes.length === 0) {
      return [];
    }

    // 递归查找节点所有子节点的ID
    const findAllChildrenIds = (node: ModuleStructureNode): number[] => {
      let ids: number[] = [node.id];
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
          ids = [...ids, ...findAllChildrenIds(child)];
        });
      }
      return ids;
    };

    // 获取当前节点的所有子节点ID
    let disabledIds: number[] = [];
    if (currentNodeId) {
      const findNode = (nodes: ModuleStructureNode[], id: number): ModuleStructureNode | null => {
        for (const n of nodes) {
          if (n.id === id) return n;
          if (n.children && n.children.length > 0) {
            const found = findNode(n.children, id);
            if (found) return found;
          }
        }
        return null;
      };

      const currentNode = findNode(treeNodes, currentNodeId);
      if (currentNode) {
        disabledIds = findAllChildrenIds(currentNode);
      }
    }

    // 转换树节点为TreeSelect需要的格式
    return treeNodes.map(item => {
      // 内容页面不能作为父节点，本身和子节点也不能选择
      const isDisabled = item.is_content_page || 
                         (disabledIds.includes(item.id));
      
      const node = {
        title: item.name,
        value: item.id,
        key: item.id,
        disabled: isDisabled,
        children: item.children && item.children.length > 0 
          ? processTreeData(item.children, currentNodeId)
          : undefined
      };

      return node;
    });
  };

  // 处理后的树数据，用于父节点选择
  const processedTreeData = useMemo(() => {
    return processTreeData(treeData, node?.id);
  }, [treeData, node?.id]);

  // 加载模块配置信息
  const loadModuleConfig = async () => {
    try {
      setLoadingModuleConfig(true);
      
      // 尝试从localStorage获取缓存的模块配置
      const cachedConfig = localStorage.getItem('moduleSections');
      let enabledModulesMap: {[key: string]: boolean} = {};
      
      if (cachedConfig) {
        try {
          const parsedConfig = JSON.parse(cachedConfig);
          // 转换为 key -> enabled 的映射
          parsedConfig.forEach((section: any) => {
            enabledModulesMap[section.section_key] = section.is_enabled;
          });
        } catch (e) {
          console.error('解析缓存的模块配置失败:', e);
        }
      }
      
      // 如果缓存为空或解析失败，从API获取
      if (Object.keys(enabledModulesMap).length === 0) {
        const response = await getModuleSectionConfig();
        if (response.data && response.data.data) {
          response.data.data.forEach((section: any) => {
            enabledModulesMap[section.section_key] = section.is_enabled;
          });
        }
      }
      
      setEnabledModules(enabledModulesMap);
    } catch (error) {
      console.error('加载模块配置失败:', error);
      // 加载失败时，默认所有模块都启用
      setEnabledModules({
        overview: true,
        diagram: true,
        terminology: true,
        keyTech: true,
        database: true,
        tableRelation: true,
        related: true,
        interface: true
      });
    } finally {
      setLoadingModuleConfig(false);
    }
  };

  // 组件挂载时加载模块配置
  useEffect(() => {
    loadModuleConfig();
  }, []);

  // 当节点变化时，重置表单和编辑状态
  useEffect(() => {
    if (node) {
      form.setFieldsValue({
        name: node.name,
        parent_id: node.parent_id || undefined
      });
      setEditing(false);
      
      // 获取创建者信息
      const fetchCreator = async () => {
        if (node.user_id) {
          try {
            setLoadingCreator(true);
            const userData = await fetchUserById(node.user_id);
            setCreator({
              id: userData.id,
              username: userData.username
            });
          } catch (error) {
            console.error('获取创建者信息失败:', error);
            setCreator({ id: node.user_id, username: '未知用户' });
          } finally {
            setLoadingCreator(false);
          }
        } else {
          setCreator(null);
        }
      };
      
      fetchCreator();
      
      // 如果是内容页面，获取模块内容
      if (node.is_content_page) {
        const fetchContent = async () => {
          try {
            setLoadingContent(true);
            // 获取基本模块内容
            const content = await fetchModuleContent(node.id);
            
            // 额外获取业务流程图数据
            try {
              const diagramResponse = await getDiagram(node.id, 'business');
              if (diagramResponse && diagramResponse.data && diagramResponse.data.diagram_data) {
                // 将业务流程图数据存储在moduleContent对象中
                (content as any).diagram_data = diagramResponse.data.diagram_data;
              }
            } catch (diagramError) {
              console.error('获取业务流程图数据失败:', diagramError);
            }
            
            // 额外获取表关联关系图数据
            try {
              const tableRelationResponse = await getDiagram(node.id, 'tableRelation');
              if (tableRelationResponse && tableRelationResponse.data && tableRelationResponse.data.diagram_data) {
                // 将表关联关系图数据存储在moduleContent对象中
                (content as any).table_relation_diagram_data = tableRelationResponse.data.diagram_data;
              }
            } catch (tableRelationError) {
              console.error('获取表关联关系图数据失败:', tableRelationError);
            }
            
            setModuleContent(content);
          } catch (error) {
            console.error('获取模块内容失败:', error);
            setModuleContent(null);
          } finally {
            setLoadingContent(false);
          }
        };
        
        fetchContent();
      } else {
        setModuleContent(null);
      }
    }
  }, [node, form]);

  // 递归计算所有子节点数量
  const countAllChildren = (nodeItem: ModuleStructureNode): number => {
    if (!nodeItem.children || nodeItem.children.length === 0) {
      return 0;
    }
    
    let count = nodeItem.children.length;
    for (const child of nodeItem.children) {
      count += countAllChildren(child);
    }
    
    return count;
  };
  
  // 在完整树中查找指定ID的节点及其完整子树
  const findNodeInTree = (nodeId: number, nodes: ModuleStructureNode[]): ModuleStructureNode | null => {
    for (const currentNode of nodes) {
      if (currentNode.id === nodeId) {
        return currentNode;
      }
      if (currentNode.children && currentNode.children.length > 0) {
        const foundNode = findNodeInTree(nodeId, currentNode.children);
        if (foundNode) {
          return foundNode;
        }
      }
    }
    return null;
  };

  // 使用useMemo优化子节点计数的计算，只有当节点ID或树数据变化时才重新计算
  const childrenCount = useMemo(() => {
    if (!node || !treeData || !treeData.length) {
      return 0;
    }
    
    // 在完整的树数据中查找当前节点
    const nodeWithFullChildren = findNodeInTree(node.id, treeData);
    
    if (nodeWithFullChildren && nodeWithFullChildren.children && nodeWithFullChildren.children.length > 0) {
      const count = countAllChildren(nodeWithFullChildren);
      return count;
    } else {
      return 0;
    }
  }, [node?.id, treeData]);
  
  // 格式化日期显示 - 更紧凑的格式
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };
  
  // 渲染模块状态卡片
  const renderModuleStatusCards = () => {
    if (loadingContent || loadingModuleConfig) {
      return (
        <div className="module-status-loading">
          <Spin indicator={<LoadingOutlined spin />} />
          <span className="loading-text">
            {loadingContent && loadingModuleConfig ? '加载中...' : 
             loadingContent ? '加载模块内容...' : '加载模块配置...'}
          </span>
        </div>
      );
    }
    
    if (!moduleContent) {
      return (
        <div className="module-status-empty">
          <ExclamationCircleFilled className="status-icon empty" />
          <span>未能加载模块内容信息</span>
        </div>
      );
    }
    
    // 定义模块类型及其图标和检查函数 - 统一使用蓝色系图标，与系统中的实际模块保持一致
    
    const moduleTypes = [
      {
        key: 'overview',
        name: '功能概述',
        icon: <FileTextOutlined />,
        hasContent: () => {
          // 检查两个可能的位置：overview_text和content.overview，只要求内容非空
          const hasOverview = 
            (!!moduleContent.overview_text && moduleContent.overview_text.trim().length > 0) || 
            (!!moduleContent.content?.overview && moduleContent.content.overview.trim().length > 0);
          return hasOverview;
        }
      },
      {
        key: 'diagram',
        name: '业务流程图',
        icon: <PictureOutlined />,
        hasContent: () => {
          // 检查业务流程图数据是否存在，并过滤掉已删除的元素
          let diagramElements = null;
          let nonDeletedElements = 0;
          
          // 检查从单独API获取的数据
          if ((moduleContent as any).diagram_data && 
              (moduleContent as any).diagram_data.elements && 
              Array.isArray((moduleContent as any).diagram_data.elements)) {
            diagramElements = (moduleContent as any).diagram_data.elements;
            // 过滤掉已删除的元素
            nonDeletedElements = diagramElements.filter((el: any) => !el.isDeleted).length;
          }
          // 如果没有找到元素，检查content.diagram（兼容旧格式）
          else if (moduleContent.content?.diagram && 
                   moduleContent.content.diagram.elements && 
                   Array.isArray(moduleContent.content.diagram.elements)) {
            diagramElements = moduleContent.content.diagram.elements;
            // 过滤掉已删除的元素
            nonDeletedElements = diagramElements.filter((el: any) => !el.isDeleted).length;
          }
          
          // 只有当存在未删除的元素时，才认为有内容
          const hasDiagram = nonDeletedElements > 0;
          
          return hasDiagram;
        }
      },
      {
        key: 'terminology',
        name: '名称解释',
        icon: <BookOutlined />,
        hasContent: () => {
          // 检查两个可能的位置：content.glossary和terminology_json
          const hasGlossary = 
            (!!moduleContent.content?.glossary && moduleContent.content.glossary.length > 0) ||
            (Array.isArray((moduleContent as any).terminology_json) && (moduleContent as any).terminology_json.length > 0);
          return hasGlossary;
        },
        getCount: () => {
          let count = 0;
          if (!!moduleContent.content?.glossary && Array.isArray(moduleContent.content.glossary)) {
            count = moduleContent.content.glossary.length;
          } else if (Array.isArray((moduleContent as any).terminology_json)) {
            count = (moduleContent as any).terminology_json.length;
          }
          return count;
        }
      },
      {
        key: 'keyTech',
        name: '功能详解',
        icon: <KeyOutlined />,
        hasContent: () => {
          // 检查两个可能的位置：details_text和content.key_tech
          const hasKeyTech = 
            (!!(moduleContent as any).details_text && (moduleContent as any).details_text.trim().length > 10) ||
            (Array.isArray(moduleContent.content?.key_tech) && moduleContent.content.key_tech.length > 0);
          return hasKeyTech;
        }
      },
      {
        key: 'database',
        name: '数据库表',
        icon: <DatabaseOutlined />,
        hasContent: () => {
          // 检查两个可能的位置
          const hasDbTables = 
            (!!moduleContent.content?.database_tables && moduleContent.content.database_tables.length > 0) ||
            (Array.isArray((moduleContent as any).database_tables) && (moduleContent as any).database_tables.length > 0);
          return hasDbTables;
        },
        getCount: () => {
          let count = 0;
          if (!!moduleContent.content?.database_tables && Array.isArray(moduleContent.content.database_tables)) {
            count = moduleContent.content.database_tables.length;
          } else if (Array.isArray((moduleContent as any).database_tables)) {
            count = (moduleContent as any).database_tables.length;
          }
          return count;
        }
      },
      {
        key: 'tableRelation',
        name: '表关联关系图',
        icon: <PictureOutlined />,
        hasContent: () => {
          // 检查表关联关系图数据是否存在，并过滤掉已删除的元素
          let tableRelationElements = null;
          let nonDeletedElements = 0;
          
          // 按优先级检查多个可能的位置
          // 1. 检查从单独API获取的数据（主要路径）
          if ((moduleContent as any).table_relation_diagram_data && 
              (moduleContent as any).table_relation_diagram_data.elements && 
              Array.isArray((moduleContent as any).table_relation_diagram_data.elements)) {
            tableRelationElements = (moduleContent as any).table_relation_diagram_data.elements;
            nonDeletedElements = tableRelationElements.filter((el: any) => !el.isDeleted).length;
          }
          // 2. 检查moduleContent.table_relation_diagram（用户提到的路径）
          else if ((moduleContent as any).table_relation_diagram && 
                   (moduleContent as any).table_relation_diagram.elements && 
                   Array.isArray((moduleContent as any).table_relation_diagram.elements)) {
            tableRelationElements = (moduleContent as any).table_relation_diagram.elements;
            nonDeletedElements = tableRelationElements.filter((el: any) => !el.isDeleted).length;
          }
          // 3. 检查content.tableRelation（兼容旧格式）
          else if ((moduleContent.content as any)?.tableRelation && 
                   (moduleContent.content as any).tableRelation.elements && 
                   Array.isArray((moduleContent.content as any).tableRelation.elements)) {
            tableRelationElements = (moduleContent.content as any).tableRelation.elements;
            nonDeletedElements = tableRelationElements.filter((el: any) => !el.isDeleted).length;
          }
          // 4. 检查content.tableRelationDiagram（兼容旧格式）
          else if ((moduleContent.content as any)?.tableRelationDiagram && 
                   (moduleContent.content as any).tableRelationDiagram.elements && 
                   Array.isArray((moduleContent.content as any).tableRelationDiagram.elements)) {
            tableRelationElements = (moduleContent.content as any).tableRelationDiagram.elements;
            nonDeletedElements = tableRelationElements.filter((el: any) => !el.isDeleted).length;
          }
          // 5. 检查content.table_relation_diagram（兼容旧格式）
          else if ((moduleContent.content as any)?.table_relation_diagram && 
                   (moduleContent.content as any).table_relation_diagram.elements && 
                   Array.isArray((moduleContent.content as any).table_relation_diagram.elements)) {
            tableRelationElements = (moduleContent.content as any).table_relation_diagram.elements;
            nonDeletedElements = tableRelationElements.filter((el: any) => !el.isDeleted).length;
          }
          
          // 只有当存在未删除的元素时，才认为有内容
          const hasTableRelation = nonDeletedElements > 0;
          
          return hasTableRelation;
        }
      },
      {
        key: 'related',
        name: '关联模块',
        icon: <ClusterOutlined />,
        hasContent: () => {
          // 检查两个可能的位置：content.related_modules和related_module_ids_json
          const hasRelatedModules = 
            (Array.isArray(moduleContent.content?.related_modules) && moduleContent.content.related_modules.length > 0) ||
            (Array.isArray((moduleContent as any).related_module_ids_json) && (moduleContent as any).related_module_ids_json.length > 0);
          return hasRelatedModules;
        },
        getCount: () => {
          let count = 0;
          if (Array.isArray(moduleContent.content?.related_modules)) {
            count = moduleContent.content.related_modules.length;
          } else if (Array.isArray((moduleContent as any).related_module_ids_json)) {
            count = (moduleContent as any).related_module_ids_json.length;
          }
          return count;
        }
      },
      {
        key: 'interface',
        name: '涉及接口',
        icon: <ApiOutlined />,
        hasContent: () => {
          // 检查两个可能的位置：内容中的接口定义和工作区引用的接口
          const hasInterfaces = 
            (!!moduleContent.content?.interface_definitions && moduleContent.content.interface_definitions.length > 0) ||
            (Array.isArray((moduleContent as any).api_interfaces) && (moduleContent as any).api_interfaces.length > 0);
          return hasInterfaces;
        },
        getCount: () => {
          let count = 0;
          if (!!moduleContent.content?.interface_definitions && Array.isArray(moduleContent.content.interface_definitions)) {
            count = moduleContent.content.interface_definitions.length;
          } else if (Array.isArray((moduleContent as any).api_interfaces)) {
            count = (moduleContent as any).api_interfaces.length;
          }
          return count;
        }
      }
    ];
    
    // 根据启用状态过滤模块类型
    const filteredModuleTypes = moduleTypes.filter(module => {
      // 如果模块在enabledModules中未定义，默认为启用
      return enabledModules[module.key] !== false;
    });
    
    // 只计算已启用模块的填充情况
    const filledModules = filteredModuleTypes.filter(module => module.hasContent()).length;
    const totalModules = filteredModuleTypes.length;
    const completionPercentage = totalModules > 0 
      ? Math.round((filledModules / totalModules) * 100)
      : 0;
    
    return (
      <div className="module-status-container">
        <div className="module-completion-status">
          <div className="completion-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="completion-title">内容完成度</span>
            <span style={{ fontSize: '11px', color: '#999' }}>仅展示和计算工作区已启用的模块</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <Progress 
                percent={completionPercentage} 
                size="small"
                format={percent => ''}
                status={completionPercentage === 100 ? "success" : "active"} 
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
            </div>
            <span style={{ marginLeft: '8px', color: '#1890ff', fontWeight: 500 }}>{completionPercentage}%</span>
          </div>
        </div>
        
        <div className="module-cards-grid">
          {filteredModuleTypes.map(module => {
            const hasContent = module.hasContent();
            // 显示数量的模块列表
            const countableModules = ['terminology', 'database', 'related', 'interface'];
            const showCount = countableModules.includes(module.key) && hasContent && module.getCount;
            const count = showCount ? module.getCount() : 0;
            
            return (
              <div 
                key={module.key} 
                className={`module-status-card ${hasContent ? 'has-content' : 'no-content'}`}
              >
                <div className="module-icon">
                  {module.icon}
                </div>
                <div className="module-info">
                  <div className="module-name">
                    {module.name}
                    {showCount && count > 0 && (
                      <span style={{ marginLeft: '4px', fontSize: '12px', color: '#1890ff' }}>
                        ({count})
                      </span>
                    )}
                  </div>
                  <div className="module-status">
                    {hasContent ? (
                      <span className="status-filled">
                        <CheckCircleFilled className="status-icon filled" /> 已填写
                      </span>
                    ) : (
                      <span className="status-empty">
                        <ExclamationCircleFilled className="status-icon empty" /> 未填写
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 如果没有选中节点或正在加载，显示优化后的加载状态
  if (!node) {
    return (
      <div className="empty-detail-panel">
        <AppstoreOutlined style={{ fontSize: 64, color: '#d9d9d9', marginBottom: 16 }} />
        <p className="empty-detail-message">请从左侧选择一个节点查看详情</p>
      </div>
    );
  }

  // 处理表单提交
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      
      const nodeData: ModuleStructureNodeRequest = {
        name: values.name,
        is_content_page: node.is_content_page, // 使用当前节点的is_content_page
        // 明确处理parent_id，当用户清除选择时，将其设置为null（顶级节点）
        parent_id: values.parent_id === undefined ? null : values.parent_id
      };
      
      // 调用API更新节点
      await updateModuleNode(node.id, nodeData);
      message.success('更新成功');
      setSaving(false);
      setEditing(false);
      
      // 触发全局刷新事件
      window.dispatchEvent(refreshModuleTreeEvent);
      
      // 调用父组件的更新回调
      onNodeUpdated();
    } catch (error) {
      console.error('更新失败:', error);
      message.error('更新失败');
      setSaving(false);
    }
  };

  // 取消编辑
  const handleCancel = () => {
    if (node) {
      form.setFieldsValue({
        name: node.name,
        parent_id: node.parent_id || undefined // 确保parent_id存在
      });
    }
    setEditing(false);
  };

  return (
    <Spin spinning={loading || saving}>
      <div className="node-detail-panel">
        {/* 节点详细信息卡片，适用于所有节点类型 */}
        {!editing ? (
          <div className="node-details-section">
            <Row gutter={[16, 16]}>
              {/* 合并的信息卡片 */}
              <Col span={24}>
                <Card 
                  bordered={false}
                  className="info-card combined-card"
                  bodyStyle={{ padding: '16px 24px' }}
                >
                  {/* 原第一个卡片的内容 */}
                  <div className="node-header" style={{ marginBottom: '20px', borderBottom: '1px solid #f0f0f0', paddingBottom: '16px' }}>
                    <div className="node-icon-title">
                      {node.is_content_page ? (
                          <FileOutlined className="node-type-icon content-page" />
                      ) : (
                          <FolderOutlined className="node-type-icon structure-node" />
                      )}
                      <h2 className="node-title">{node.name}</h2>
                        <Tag color={node.is_content_page ? 'blue' : 'green'} className="node-type-tag">
                          {node.is_content_page ? '内容页面' : '结构节点'}
                        </Tag>
                    </div>
                      
                    <Space>
                      {node.is_content_page && (
                        <Tooltip title="查看内容页面" color="#fff" overlayInnerStyle={{ color: 'rgba(0, 0, 0, 0.85)' }}>
                          <Link to={`/module-content/${node.id}`}>
                            <Button 
                              type="default" 
                              icon={<EyeOutlined />}
                              className="view-content-btn"
                            >
                              查看页面
                            </Button>
                          </Link>
                        </Tooltip>
                      )}
                  
                      <Button 
                        type="primary" 
                        icon={<EditOutlined />} 
                        onClick={() => setEditing(true)}
                      >
                        编辑
                      </Button>
                    </Space>
                  </div>
                  
                  {/* 原第二个卡片的内容 */}
                  <Row gutter={8}>
                    {/* 基本信息部分 */}
                    <Col xs={24} md={7}>
                      <div className="info-section-title">
                        <InfoCircleOutlined className="info-icon" />
                        <span>基本信息</span>
                      </div>
                      <div className="basic-info">
                        <div className="info-item">
                          <span className="label">ID:</span>
                          <span className="value">{node.id}</span>
                        </div>
                        <div className="info-item">
                          <span className="label">名称:</span>
                          <span className="value">{node.name}</span>
                        </div>
                      </div>
                    </Col>
                    
                    {/* 统计信息部分 - 改为左名称右内容的结构 */}
                    <Col xs={24} md={7}>
                      <div className="info-section-title">
                        <BarChartOutlined className="info-icon" />
                        <span>统计信息</span>
                      </div>
                      <div className="basic-info">
                        {!node.is_content_page && (
                          <div className="info-item">
                            <span className="label">子节点总数:</span>
                            <span className="value">{childrenCount}</span>
                          </div>
                        )}
                        <div className="info-item">
                          <span className="label">创建者:</span>
                          <span className="value">{loadingCreator ? '加载中...' : (creator ? creator.username : '未知')}</span>
                        </div>
                      </div>
                    </Col>
                    
                    {/* 时间信息部分 */}
                    <Col xs={24} md={10}>
                      <div className="info-section-title">
                        <ClockCircleOutlined className="info-icon" />
                        <span>时间信息</span>
                      </div>
                      <div className="time-info">
                        <div className="time-item">
                          <span className="time-label">创建时间:</span>
                          <span className="time-value">{formatDate(node.created_at)}</span>
                        </div>
                        <div className="time-item">
                          <span className="time-label">更新时间:</span>
                          <span className="time-value">{formatDate(node.updated_at)}</span>
                        </div>
                      </div>
                    </Col>
                  </Row>
                </Card>
              </Col>
            </Row>
            
            {/* 内容页面专用卡片 - 显示模块内容状态 */}
            {node.is_content_page && (
              <Card 
                title={
                  <div className="card-title-with-icon">
                    <FileOutlined />
                    <span>内容页面信息</span>
                  </div>
                }
                className="content-page-card"
                bordered={false}
                style={{ marginTop: 10 }}
              >
                {renderModuleStatusCards()}
              </Card>
            )}
          </div>
        ) : (
          <Card 
            title="编辑节点信息" 
            bordered={false}
            className="edit-form-card"
            style={{ marginTop: 0 }}
          >
          <Form
            form={form}
            layout="vertical"
            className="node-edit-form"
          >
            <Form.Item
              name="name"
              label="模块名称"
              rules={[{ required: true, message: '请输入模块名称' }]}
            >
              <Input placeholder="请输入模块名称" />
            </Form.Item>
            
            <Form.Item
              name="parent_id"
              label="父节点"
              help="选择新的父节点可以更改模块在结构中的层级位置，清除选择则将其设置为顶级节点"
            >
              <TreeSelect
                showSearch
                style={{ width: '100%' }}
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                placeholder="请选择父节点"
                allowClear
                treeDefaultExpandAll
                treeData={processedTreeData}
                treeNodeFilterProp="title"
              />
            </Form.Item>
            
            <div className="form-actions" style={{ marginTop: '20px', textAlign: 'right' }}>
              <Space>
                <Button onClick={handleCancel}>取消</Button>
                <Button type="primary" icon={<SaveOutlined />} onClick={handleSubmit} loading={saving}>
                  保存
                </Button>
              </Space>
            </div>
          </Form>
          </Card>
        )}
      </div>
      
    </Spin>
  );
};

export default NodeDetailPanel; 