import React, { useState, useEffect, useMemo } from 'react';
import { Spin, Tabs, Button, Form, Input, Radio, message, Space, Divider, Card, Tag, Tooltip, Statistic, Row, Col, Progress } from 'antd';
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
import { ModuleStructureNode, ModuleStructureNodeRequest, ModuleContent } from '../../../types/modules';
import { updateModuleNode, fetchModuleContent, getDiagram } from '../../../apis/moduleService';
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
  const [moduleContent, setModuleContent] = useState<ModuleContent | null>(null);
  const [loadingContent, setLoadingContent] = useState<boolean>(false);
  const { fetchModules } = useModules();

  // 当节点变化时，重置表单和编辑状态
  useEffect(() => {
    if (node) {
      form.setFieldsValue({
        name: node.name,
        module_type: node.is_content_page ? 'content_page' : 'structure_node',
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
              console.log('获取业务流程图数据...');
              const diagramResponse = await getDiagram(node.id, 'business');
              if (diagramResponse && diagramResponse.data && diagramResponse.data.diagram_data) {
                console.log('业务流程图数据获取成功');
                // 将业务流程图数据存储在moduleContent对象中
                (content as any).diagram_data = diagramResponse.data.diagram_data;
              } else {
                console.log('未找到业务流程图数据');
              }
            } catch (diagramError) {
              console.error('获取业务流程图数据失败:', diagramError);
            }
            
            // 额外获取表关联关系图数据
            try {
              console.log('获取表关联关系图数据...');
              const tableRelationResponse = await getDiagram(node.id, 'tableRelation');
              if (tableRelationResponse && tableRelationResponse.data && tableRelationResponse.data.diagram_data) {
                console.log('表关联关系图数据获取成功');
                // 将表关联关系图数据存储在moduleContent对象中
                (content as any).table_relation_diagram_data = tableRelationResponse.data.diagram_data;
              } else {
                console.log('未找到表关联关系图数据');
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
      console.log(`节点ID ${node.id} 的子节点总数: ${count}`);
      return count;
    } else {
      console.log(`节点ID ${node.id} 的子节点总数: 0 (无子节点或未在树中找到节点)`);
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
    if (loadingContent) {
      return (
        <div className="module-status-loading">
          <Spin indicator={<LoadingOutlined spin />} />
          <span className="loading-text">加载模块内容...</span>
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
    // 添加调试信息，帮助排查问题
    console.log('模块内容数据结构:', moduleContent);
    
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
          console.log('功能概述内容检查:', hasOverview, 
            '内容长度:', 
            moduleContent.overview_text ? moduleContent.overview_text.trim().length : 0,
            moduleContent.content?.overview ? moduleContent.content.overview.trim().length : 0
          );
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
          
          console.log('业务流程图内容检查:', {
            hasDiagram,
            totalElements: diagramElements?.length || 0,
            nonDeletedElements,
            deletedElements: (diagramElements?.length || 0) - nonDeletedElements
          });
          
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
          console.log('名称解释内容检查:', hasGlossary, moduleContent.content?.glossary, (moduleContent as any).terminology_json);
          return hasGlossary;
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
          console.log('功能详解内容检查:', hasKeyTech, (moduleContent as any).details_text, moduleContent.content?.key_tech);
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
          console.log('数据库表内容检查:', hasDbTables, moduleContent.content?.database_tables, (moduleContent as any).database_tables);
          return hasDbTables;
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
          
          console.log('表关联关系图内容检查:', {
            hasTableRelation,
            totalElements: tableRelationElements?.length || 0,
            nonDeletedElements,
            deletedElements: (tableRelationElements?.length || 0) - nonDeletedElements,
            dataSource: tableRelationElements ? '找到了元素' : '未找到元素'
          });
          
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
          console.log('关联模块内容检查:', hasRelatedModules, moduleContent.content?.related_modules, (moduleContent as any).related_module_ids_json);
          return hasRelatedModules;
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
          console.log('涉及接口内容检查:', hasInterfaces, moduleContent.content?.interface_definitions, (moduleContent as any).api_interfaces);
          return hasInterfaces;
        }
      }
    ];
    
    // 计算已填写的模块数量
    const filledModules = moduleTypes.filter(module => module.hasContent()).length;
    const totalModules = moduleTypes.length;
    const completionPercentage = Math.round((filledModules / totalModules) * 100);
    
    return (
      <div className="module-status-container">
        <div className="module-completion-status">
          <div className="completion-header">
            <span className="completion-title">内容完成度</span>
            <span className="completion-percentage">{completionPercentage}%</span>
          </div>
          <Progress 
            percent={completionPercentage} 
            size="small" 
            status={completionPercentage === 100 ? "success" : "active"} 
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
        </div>
        
        <div className="module-cards-grid">
          {moduleTypes.map(module => {
            const hasContent = module.hasContent();
            return (
              <div 
                key={module.key} 
                className={`module-status-card ${hasContent ? 'has-content' : 'no-content'}`}
              >
                <div className="module-icon">
                  {module.icon}
                </div>
                <div className="module-info">
                  <div className="module-name">{module.name}</div>
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
        is_content_page: values.module_type === 'content_page'
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
        module_type: node.is_content_page ? 'content_page' : 'structure_node',
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
                        <Tooltip title="查看内容页面">
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
                        <div className="info-item">
                          <span className="label">子节点总数:</span>
                          <span className="value">{childrenCount}</span>
                        </div>
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
                style={{ marginTop: 16 }}
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
              name="module_type"
              label="模块类型"
              rules={[{ required: true, message: '请选择模块类型' }]}
                extra="注意：修改节点类型可能会影响其功能和行为"
            >
              <Radio.Group disabled>
                <Radio value="structure_node">节点 (可添加子模块)</Radio>
                <Radio value="content_page">内容页面 (可编辑模块功能)</Radio>
              </Radio.Group>
            </Form.Item>
            
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSubmit}
                >
                  保存
                </Button>
                <Button onClick={handleCancel}>取消</Button>
              </Space>
            </Form.Item>
          </Form>
          </Card>
        )}
      </div>
    </Spin>
  );
};

export default NodeDetailPanel; 