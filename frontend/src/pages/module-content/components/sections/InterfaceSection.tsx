import React, { useState, useEffect } from 'react';
import { Button, Empty, Row, Col, Modal, Table, Tag } from 'antd';
import { PlusOutlined, SelectOutlined, ExpandOutlined, CompressOutlined } from '@ant-design/icons';
import { ApiInterfaceCard } from '../../../../types/modules';
import ApiInterfaceCardComponent from './ApiInterfaceCard';
import ApiInterfaceForm from '../sections/ApiInterfaceForm';
import './SectionStyles.css';
import { useWorkspace } from '../../../../contexts/WorkspaceContext';
import { getWorkspaceInterfaces } from '../../../../apis/workspaceService';
import { WorkspaceInterface } from '../../../../types/workspace';

interface InterfaceSectionProps {
  interfaces: ApiInterfaceCard[];
  onChange: (interfaces: ApiInterfaceCard[]) => void;
  expandedApiCards?: string[];
  setExpandedApiCards?: React.Dispatch<React.SetStateAction<string[]>>;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  enableWorkspaceInterfaceSelection?: boolean;
  showActionButtons?: boolean;
  showAddButton?: boolean;
  showWorkspaceSelectButton?: boolean;
  isEditable?: boolean;
  showEditButton?: boolean;
}

const InterfaceSection: React.FC<InterfaceSectionProps> = ({ 
  interfaces, 
  onChange, 
  expandedApiCards = [], 
  setExpandedApiCards,
  onEdit: externalEditHandler,
  onDelete: externalDeleteHandler,
  enableWorkspaceInterfaceSelection = true,
  showActionButtons = true,
  showAddButton = true,
  showWorkspaceSelectButton = true,
  isEditable = false,
  showEditButton = true
}) => {
  // 表单可见性状态
  const [formVisible, setFormVisible] = useState(false);
  // 当前编辑的接口
  const [currentInterface, setCurrentInterface] = useState<ApiInterfaceCard | undefined>(undefined);
  // 表单标题
  const [formTitle, setFormTitle] = useState('添加接口');
  
  // 工作区接口选择相关状态
  const { currentWorkspace } = useWorkspace();
  const [workspaceInterfaces, setWorkspaceInterfaces] = useState<WorkspaceInterface[]>([]);
  const [workspaceInterfaceSelectVisible, setWorkspaceInterfaceSelectVisible] = useState<boolean>(false);
  const [selectedWorkspaceInterfaceIds, setSelectedWorkspaceInterfaceIds] = useState<number[]>([]);
  
  // 获取工作区接口列表
  useEffect(() => {
    if (currentWorkspace && enableWorkspaceInterfaceSelection) {
      const fetchWorkspaceInterfaces = async () => {
        try {
          const interfaces = await getWorkspaceInterfaces(currentWorkspace.id);
          setWorkspaceInterfaces(interfaces);
        } catch (error) {
          console.error('获取工作区接口失败:', error);
        }
      };
      
      fetchWorkspaceInterfaces();
    }
  }, [currentWorkspace, enableWorkspaceInterfaceSelection]);

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
    // 如果提供了外部编辑处理函数，则使用它
    if (externalEditHandler) {
      externalEditHandler(id);
      return;
    }

    const interfaceToEdit = interfaces.find(item => item.id === id);
    if (interfaceToEdit) {
      setCurrentInterface(interfaceToEdit);
      setFormTitle('编辑接口');
      setFormVisible(true);
    }
  };

  // 删除接口
  const handleDelete = (id: string) => {
    // 如果提供了外部删除处理函数，则使用它
    if (externalDeleteHandler) {
      externalDeleteHandler(id);
      return;
    }

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
    
    if (currentInterface) {
      // 编辑现有接口
      const updatedInterfaces = interfaces.map(item => 
        item.id === currentInterface.id ? { ...completeValues, id: item.id } : item
      );
      onChange(updatedInterfaces);
    } else {
      // 添加新接口
      const newId = `api_${Date.now()}`;
      const newInterfaces = [...interfaces, { ...completeValues, id: newId }];
      onChange(newInterfaces);
    }
    setFormVisible(false);
  };
  
  // 打开工作区接口选择对话框
  const openWorkspaceInterfaceSelect = () => {
    setWorkspaceInterfaceSelectVisible(true);
  };

  // 关闭工作区接口选择对话框
  const closeWorkspaceInterfaceSelect = () => {
    setWorkspaceInterfaceSelectVisible(false);
  };

  // 全部展开/折叠接口卡片
  const toggleAllCards = (expand: boolean) => {
    if (setExpandedApiCards) {
      if (expand) {
        // 全部展开 - 将所有接口ID添加到expandedApiCards中
        setExpandedApiCards(interfaces.map(item => item.id));
      } else {
        // 全部折叠 - 清空expandedApiCards
        setExpandedApiCards([]);
      }
    }
  };

  // 确认选择工作区接口
  const confirmWorkspaceInterfaceSelect = () => {
    // 获取选中的工作区接口
    const selectedInterfaces = workspaceInterfaces.filter(iface => 
      selectedWorkspaceInterfaceIds.includes(iface.id)
    );
    
    // 检查哪些接口已经被导入（通过workspace_interface_id判断）
    const existingWorkspaceInterfaceIds = new Set(
      interfaces
        .filter(item => item.workspace_interface_id !== undefined)
        .map(item => item.workspace_interface_id)
    );
    
    // 过滤出未导入的接口
    const newSelectedInterfaces = selectedInterfaces.filter(
      iface => !existingWorkspaceInterfaceIds.has(iface.id)
    );
    
    // 如果所有选中的接口都已导入，则提示用户
    if (newSelectedInterfaces.length === 0 && selectedInterfaces.length > 0) {
      Modal.info({
        title: '提示',
        content: '所选接口已全部导入，请选择其他接口。'
      });
      return;
    }
    
    // 将工作区接口转换为模块内容接口格式
    const newInterfaces = newSelectedInterfaces.map(iface => ({
      id: `workspace_interface_${iface.id}`,
      path: iface.path,
      method: iface.method as any,
      description: iface.description || '',
      contentType: iface.content_type || 'application/json',
      requestParams: iface.request_params_json || [],
      responseParams: iface.response_params_json || [],
      workspace_interface_id: iface.id // 添加工作区接口ID以便后续引用
    }));
    
    // 更新接口列表
    onChange([...interfaces, ...newInterfaces]);
    
    // 清空选择状态并关闭对话框
    setSelectedWorkspaceInterfaceIds([]);
    closeWorkspaceInterfaceSelect();
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
              isEditable={isEditable}
              showEditButton={showEditButton}
            />
          </Col>
        ))}
      </Row>
    );
  };

  return (
    <div className="interface-section">
      {/* 顶部操作栏 */}
      <div className="interface-header">
        <div className="interface-count">
          共 {interfaces.length} 个接口
        </div>
        <div className="interface-actions">
          {showWorkspaceSelectButton && enableWorkspaceInterfaceSelection && currentWorkspace && (
            <Button 
              type="default"
              size="small"
              icon={<SelectOutlined />}
              onClick={openWorkspaceInterfaceSelect}
              style={{ marginRight: 8 }}
              className="database-action-button"
            >
              从资源池导入接口
            </Button>
          )}
          
          <Button 
            type="default"
            size="small"
            onClick={() => toggleAllCards(true)}
            style={{ marginRight: 8 }}
            className="database-action-button"
            icon={<ExpandOutlined />}
          >
            全部展开
          </Button>
          <Button 
            type="default"
            size="small"
            onClick={() => toggleAllCards(false)}
            className="database-action-button"
            icon={<CompressOutlined />}
          >
            全部折叠
          </Button>
        </div>
      </div>

      {renderInterfaceCards()}
      
      {/* 只有在没有提供外部编辑处理函数时才显示添加按钮 */}
      {showActionButtons && !externalEditHandler && (
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          {showAddButton && (
      <Button
              type="primary"
        onClick={handleAdd}
        icon={<PlusOutlined />}
      >
        添加接口
      </Button>
          )}
        </div>
      )}

      {/* 接口表单对话框 */}
      {!externalEditHandler && (
      <ApiInterfaceForm
        visible={formVisible}
        title={formTitle}
        initialValues={currentInterface}
        onOk={handleFormSubmit}
        onCancel={() => setFormVisible(false)}
      />
      )}
      
      {/* 工作区接口选择对话框 */}
      <Modal
        title="从资源池导入接口"
        open={workspaceInterfaceSelectVisible}
        onCancel={closeWorkspaceInterfaceSelect}
        onOk={confirmWorkspaceInterfaceSelect}
        width={800}
      >
        {workspaceInterfaces.length === 0 ? (
          <Empty description="工作区中暂无可用的接口" />
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <span style={{ color: '#888', fontSize: '13px' }}>注: 已导入的接口将被禁用选择，无法重复导入</span>
            </div>
            <Table
              dataSource={workspaceInterfaces}
              rowKey="id"
              pagination={false}
              rowSelection={{
                selectedRowKeys: selectedWorkspaceInterfaceIds,
                onChange: (selectedRowKeys) => {
                  setSelectedWorkspaceInterfaceIds(selectedRowKeys as number[]);
                },
                getCheckboxProps: (record) => {
                  // 检查该接口是否已经被导入
                  const existingWorkspaceInterfaceIds = new Set(
                    interfaces
                      .filter(item => item.workspace_interface_id !== undefined)
                      .map(item => item.workspace_interface_id)
                  );
                  const isImported = existingWorkspaceInterfaceIds.has(record.id);
                  
                  return {
                    disabled: isImported, // 禁用已导入的接口选择
                  };
                }
              }}
              columns={[
                {
                  title: '路径',
                  dataIndex: 'path',
                  key: 'path',
                },
                {
                  title: '方法',
                  dataIndex: 'method',
                  key: 'method',
                },
                {
                  title: '描述',
                  dataIndex: 'description',
                  key: 'description',
                  render: (text) => text || '-'
                },
                {
                  title: '状态',
                  key: 'status',
                  render: (_, record) => {
                    // 检查该接口是否已经被导入
                    const existingWorkspaceInterfaceIds = new Set(
                      interfaces
                        .filter(item => item.workspace_interface_id !== undefined)
                        .map(item => item.workspace_interface_id)
                    );
                    const isImported = existingWorkspaceInterfaceIds.has(record.id);
                    
                    return isImported ? (
                      <Tag color="green">已导入</Tag>
                    ) : null;
                  }
                }
              ]}
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default InterfaceSection; 