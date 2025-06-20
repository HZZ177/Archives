import React, { useState, useEffect } from 'react';
import { Button, Empty, Row, Col, Radio, Space, Table, Card, Typography, Tag, Badge, Spin, message } from 'antd';
import { PlusOutlined, ApiOutlined, ReloadOutlined } from '@ant-design/icons';
import { ApiInterfaceCard, ReferencedInterface } from '../../../../types/modules';
import ApiInterfaceCardComponent from './ApiInterfaceCard';
import ApiInterfaceForm from './ApiInterfaceForm';
import './SectionStyles.css';
import { useWorkspaceContext } from '../../../../contexts/WorkspaceContext';
import { getWorkspaceInterfaces } from '../../../../services/workspaceInterfaceService';
import { getReferencedInterfaces, updateInterfaceRefs } from '../../../../services/moduleContentService';

const { Text } = Typography;

interface InterfaceSectionProps {
  interfaces: ApiInterfaceCard[];
  onChange: (interfaces: ApiInterfaceCard[]) => void;
  expandedApiCards?: string[];
  setExpandedApiCards?: React.Dispatch<React.SetStateAction<string[]>>;
  moduleNodeId?: number; // 添加模块节点ID，用于引用模式
  interfaceRefs?: number[]; // 添加接口引用ID列表
  onInterfaceRefsChange?: (refs: number[]) => void; // 添加接口引用变更回调
  isEditMode?: boolean; // 添加编辑模式标志
}

const InterfaceSection: React.FC<InterfaceSectionProps> = ({ 
  interfaces, 
  onChange, 
  expandedApiCards = [], 
  setExpandedApiCards,
  moduleNodeId,
  interfaceRefs = [],
  onInterfaceRefsChange = () => {},
  isEditMode = true
}) => {
  const { currentWorkspace } = useWorkspaceContext();
  // 表单可见性状态
  const [formVisible, setFormVisible] = useState(false);
  // 当前编辑的接口
  const [currentInterface, setCurrentInterface] = useState<ApiInterfaceCard | undefined>(undefined);
  // 表单标题
  const [formTitle, setFormTitle] = useState('添加接口');
  
  // 添加引用模式相关状态
  const [mode, setMode] = useState<'direct' | 'reference'>('direct');
  const [workspaceInterfaces, setWorkspaceInterfaces] = useState<any[]>([]);
  const [referencedInterfaces, setReferencedInterfaces] = useState<ReferencedInterface[]>([]);
  const [selectedInterfaceIds, setSelectedInterfaceIds] = useState<number[]>(interfaceRefs || []);
  const [loadingWorkspaceInterfaces, setLoadingWorkspaceInterfaces] = useState(false);
  const [loadingReferencedInterfaces, setLoadingReferencedInterfaces] = useState(false);
  
  // 加载工作区接口
  useEffect(() => {
    if (currentWorkspace?.id && isEditMode) {
      loadWorkspaceInterfaces();
    }
  }, [currentWorkspace?.id, isEditMode]);
  
  // 加载已引用的接口
  useEffect(() => {
    if (moduleNodeId && mode === 'reference' && isEditMode) {
      loadReferencedInterfaces();
    }
  }, [moduleNodeId, mode, isEditMode]);
  
  // 初始化模式
  useEffect(() => {
    if (interfaceRefs && interfaceRefs.length > 0) {
      setMode('reference');
      setSelectedInterfaceIds(interfaceRefs);
    } else {
      setMode('direct');
    }
  }, [interfaceRefs]);
  
  // 加载工作区接口
  const loadWorkspaceInterfaces = async () => {
    if (!currentWorkspace?.id) return;
    
    try {
      setLoadingWorkspaceInterfaces(true);
      const data = await getWorkspaceInterfaces(currentWorkspace.id);
      setWorkspaceInterfaces(data);
    } catch (error) {
      console.error('加载工作区接口失败:', error);
      message.error('加载工作区接口失败，请稍后重试');
    } finally {
      setLoadingWorkspaceInterfaces(false);
    }
  };
  
  // 加载已引用的接口
  const loadReferencedInterfaces = async () => {
    if (!moduleNodeId) return;
    
    try {
      setLoadingReferencedInterfaces(true);
      const data = await getReferencedInterfaces(moduleNodeId);
      setReferencedInterfaces(data);
    } catch (error) {
      console.error('加载引用的接口失败:', error);
      message.error('加载引用的接口失败，请稍后重试');
    } finally {
      setLoadingReferencedInterfaces(false);
    }
  };
  
  // 切换模式
  const handleModeChange = (e: any) => {
    const newMode = e.target.value;
    setMode(newMode);
    
    if (newMode === 'reference') {
      // 切换到引用模式，保存当前的直接编辑接口
      // 这里不做任何操作，保留当前接口数据
      loadReferencedInterfaces();
    } else {
      // 切换到直接编辑模式，清空引用
      setSelectedInterfaceIds([]);
      onInterfaceRefsChange([]);
    }
  };
  
  // 处理接口选择变更
  const handleInterfaceSelectionChange = async (selectedRowKeys: React.Key[]) => {
    const interfaceIds = selectedRowKeys.map(key => Number(key));
    setSelectedInterfaceIds(interfaceIds);
    
    if (moduleNodeId) {
      try {
        await updateInterfaceRefs(moduleNodeId, interfaceIds);
        message.success('接口引用已更新');
        onInterfaceRefsChange(interfaceIds);
        loadReferencedInterfaces();
      } catch (error) {
        console.error('更新接口引用失败:', error);
        message.error('更新接口引用失败，请稍后重试');
      }
    } else {
      onInterfaceRefsChange(interfaceIds);
    }
  };

  // 处理接口的展开/收起状态
  const handleToggleExpand = (id: string, expanded: boolean) => {
    if (setExpandedApiCards) {
      setExpandedApiCards(prev => {
        if (expanded) {
          return [...prev, id];
        } else {
          return prev.filter(apiId => apiId !== id);
        }
      });
    }
  };

  // 添加接口
  const handleAdd = () => {
    setCurrentInterface(undefined);
    setFormTitle('添加接口');
    setFormVisible(true);
  };

  // 编辑接口
  const handleEdit = (id: string) => {
    const interfaceToEdit = interfaces.find(item => item.id === id);
    if (interfaceToEdit) {
      setCurrentInterface(interfaceToEdit);
      setFormTitle('编辑接口');
      setFormVisible(true);
    }
  };

  // 删除接口
  const handleDelete = (id: string) => {
    onChange(interfaces.filter(item => item.id !== id));
  };

  // 提交表单
  const handleFormSubmit = (values: ApiInterfaceCard) => {
    // 确保所有必要字段都存在，避免数据丢失
    const completeValues = {
      ...values,
      path: values.path || '',
      method: values.method || 'GET',
      contentType: values.contentType || 'application/json',
      description: values.description || '',
      requestParams: values.requestParams || [],
      responseParams: values.responseParams || []
    };
    
    // 调试日志
    console.log('提交的接口数据:', completeValues);
    
    if (currentInterface) {
      // 编辑现有接口
      const updatedInterfaces = interfaces.map(item => 
        item.id === currentInterface.id ? { ...completeValues, id: item.id } : item
      );
      console.log('更新后的接口列表:', updatedInterfaces);
      onChange(updatedInterfaces);
    } else {
      // 添加新接口
      const newId = `api_${Date.now()}`;
      const newInterfaces = [...interfaces, { ...completeValues, id: newId }];
      console.log('添加后的接口列表:', newInterfaces);
      onChange(newInterfaces);
    }
    setFormVisible(false);
  };

  // 渲染接口卡片网格
  const renderInterfaceCards = () => {
    if (interfaces.length === 0) {
      return (
        <Empty 
          description="暂无接口信息" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    return (
      <Row gutter={[12, 12]} className="interface-card-grid">
        {interfaces.map(item => (
          <Col xs={24} sm={24} md={24} lg={12} xl={12} key={item.id}>
            <ApiInterfaceCardComponent
              data={item}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleExpand={handleToggleExpand}
              isExpanded={expandedApiCards.includes(item.id)}
            />
          </Col>
        ))}
      </Row>
    );
  };
  
  // 获取HTTP方法对应的颜色
  const getMethodColor = (method: string) => {
    const methodColors: Record<string, string> = {
      GET: 'green',
      POST: 'blue',
      PUT: 'orange',
      DELETE: 'red',
      PATCH: 'purple'
    };
    
    return methodColors[method.toUpperCase()] || 'default';
  };
  
  // 渲染引用模式
  const renderReferenceMode = () => {
    const workspaceInterfaceColumns = [
      {
        title: '路径',
        dataIndex: 'path',
        key: 'path',
        render: (text: string) => (
          <Space>
            <ApiOutlined style={{ color: '#1890ff' }} />
            <Text strong>{text}</Text>
          </Space>
        )
      },
      {
        title: '方法',
        dataIndex: 'method',
        key: 'method',
        render: (text: string) => (
          <Tag color={getMethodColor(text)}>
            {text.toUpperCase()}
          </Tag>
        )
      },
      {
        title: '描述',
        dataIndex: 'description',
        key: 'description',
        render: (text: string) => text || '-'
      },
      {
        title: '内容类型',
        dataIndex: 'content_type',
        key: 'content_type',
        render: (text: string) => text || 'application/json'
      },
      {
        title: '参数',
        key: 'params',
        render: (_: any, record: any) => (
          <Space>
            <Badge count={(record.request_params_json || []).length} showZero color="blue" overflowCount={99} />
            <Text>请求</Text>
            <Badge count={(record.response_params_json || []).length} showZero color="green" overflowCount={99} />
            <Text>响应</Text>
          </Space>
        )
      }
    ];
    
    return (
      <div className="reference-mode-container">
        <div className="reference-mode-header" style={{ marginBottom: 16 }}>
          <Button 
            type="primary" 
            onClick={loadWorkspaceInterfaces} 
            icon={<ReloadOutlined />}
            loading={loadingWorkspaceInterfaces}
          >
            刷新工作区接口列表
          </Button>
          
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">
              已选择 {selectedInterfaceIds.length} 个接口
            </Text>
          </div>
        </div>
        
        <Table
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys: selectedInterfaceIds,
            onChange: handleInterfaceSelectionChange
          }}
          columns={workspaceInterfaceColumns}
          dataSource={workspaceInterfaces}
          rowKey="id"
          loading={loadingWorkspaceInterfaces}
          pagination={{ pageSize: 10 }}
          expandable={{
            expandedRowRender: (record) => {
              const requestParams = record.request_params_json || [];
              const responseParams = record.response_params_json || [];
              
              return (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <Text strong>请求参数：</Text>
                    {requestParams.length === 0 ? (
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary">无请求参数</Text>
                      </div>
                    ) : (
                      <Table
                        columns={[
                          { title: '参数名', dataIndex: 'param_name', key: 'param_name' },
                          { title: '类型', dataIndex: 'param_type', key: 'param_type' },
                          { 
                            title: '必需', 
                            dataIndex: 'required', 
                            key: 'required',
                            render: (required) => required ? '是' : '否'
                          },
                          { title: '描述', dataIndex: 'description', key: 'description' },
                          { title: '示例', dataIndex: 'example', key: 'example' }
                        ]}
                        dataSource={requestParams}
                        rowKey="param_name"
                        pagination={false}
                        size="small"
                      />
                    )}
                  </div>
                  
                  <div>
                    <Text strong>响应参数：</Text>
                    {responseParams.length === 0 ? (
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary">无响应参数</Text>
                      </div>
                    ) : (
                      <Table
                        columns={[
                          { title: '参数名', dataIndex: 'param_name', key: 'param_name' },
                          { title: '类型', dataIndex: 'param_type', key: 'param_type' },
                          { title: '描述', dataIndex: 'description', key: 'description' },
                          { title: '示例', dataIndex: 'example', key: 'example' }
                        ]}
                        dataSource={responseParams}
                        rowKey="param_name"
                        pagination={false}
                        size="small"
                      />
                    )}
                  </div>
                </div>
              );
            }
          }}
        />
      </div>
    );
  };
  
  // 渲染已引用的接口
  const renderReferencedInterfaces = () => {
    if (referencedInterfaces.length === 0) {
      return (
        <Empty 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无引用的接口"
        />
      );
    }
    
    return (
      <div className="referenced-interfaces-container">
        {referencedInterfaces.map((item, index) => (
          <Card 
            key={item.id} 
            title={
              <Space>
                <ApiOutlined style={{ color: '#1890ff' }} />
                <Text strong>{item.path}</Text>
                <Tag color={getMethodColor(item.method)}>{item.method}</Tag>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            {item.description && (
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary">{item.description}</Text>
              </div>
            )}
            
            <div style={{ marginBottom: 16 }}>
              <Text strong>请求参数：</Text>
              {item.request_params.length === 0 ? (
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">无请求参数</Text>
                </div>
              ) : (
                <Table
                  columns={[
                    { title: '参数名', dataIndex: 'param_name', key: 'param_name' },
                    { title: '类型', dataIndex: 'param_type', key: 'param_type' },
                    { 
                      title: '必需', 
                      dataIndex: 'required', 
                      key: 'required',
                      render: (required) => required ? '是' : '否'
                    },
                    { title: '描述', dataIndex: 'description', key: 'description' },
                    { title: '示例', dataIndex: 'example', key: 'example' }
                  ]}
                  dataSource={item.request_params}
                  rowKey="param_name"
                  pagination={false}
                  size="small"
                />
              )}
            </div>
            
            <div>
              <Text strong>响应参数：</Text>
              {item.response_params.length === 0 ? (
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">无响应参数</Text>
                </div>
              ) : (
                <Table
                  columns={[
                    { title: '参数名', dataIndex: 'param_name', key: 'param_name' },
                    { title: '类型', dataIndex: 'param_type', key: 'param_type' },
                    { title: '描述', dataIndex: 'description', key: 'description' },
                    { title: '示例', dataIndex: 'example', key: 'example' }
                  ]}
                  dataSource={item.response_params}
                  rowKey="param_name"
                  pagination={false}
                  size="small"
                />
              )}
            </div>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="interface-section">
      {isEditMode && (
        <div className="mode-selector" style={{ marginBottom: 16 }}>
          <Radio.Group value={mode} onChange={handleModeChange} buttonStyle="solid">
            <Radio.Button value="direct">直接编辑</Radio.Button>
            <Radio.Button value="reference">引用工作区接口</Radio.Button>
          </Radio.Group>
          
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">
              {mode === 'direct' ? 
                '直接编辑模式：在此页面直接定义接口' : 
                '引用模式：引用工作区级别定义的接口'}
            </Text>
          </div>
        </div>
      )}
      
      {mode === 'reference' ? (
        isEditMode ? renderReferenceMode() : renderReferencedInterfaces()
      ) : (
        <>
      {renderInterfaceCards()}
      
          {isEditMode && (
      <Button
        type="dashed"
        onClick={handleAdd}
        style={{ marginTop: 16, width: '100%' }}
        icon={<PlusOutlined />}
      >
        添加接口
      </Button>
          )}
        </>
      )}

      {/* 接口表单对话框 */}
      {isEditMode && mode === 'direct' && (
      <ApiInterfaceForm
        visible={formVisible}
        title={formTitle}
        initialValues={currentInterface}
        onOk={handleFormSubmit}
        onCancel={() => setFormVisible(false)}
      />
      )}
    </div>
  );
};

export default InterfaceSection; 