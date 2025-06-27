import React, { useState, useEffect, useMemo } from 'react';
import { Button, Empty, Row, Col, Modal, Table, Tag, Input, Pagination, Spin, message } from 'antd';
import { PlusOutlined, SelectOutlined, ExpandOutlined, CompressOutlined, SearchOutlined } from '@ant-design/icons';
import { ApiInterfaceCard } from '../../../../types/modules';
import ApiInterfaceCardComponent from './ApiInterfaceCard';
import ApiInterfaceForm from '../sections/ApiInterfaceForm';
import './SectionStyles.css';
import { useWorkspace } from '../../../../contexts/WorkspaceContext';
import { getWorkspaceInterfaces } from '../../../../apis/workspaceService';
import { WorkspaceInterface } from '../../../../types/workspace';
import { debounce } from '../../../../utils/throttle';

const { Search } = Input;

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
  
  // 添加分页相关状态
  const [interfacePagination, setInterfacePagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  
  // 添加搜索相关状态
  const [interfaceSearchKeyword, setInterfaceSearchKeyword] = useState<string>('');
  
  // 添加加载状态
  const [interfacesLoading, setInterfacesLoading] = useState<boolean>(false);
  
  // 获取工作区接口列表
  useEffect(() => {
    if (currentWorkspace && enableWorkspaceInterfaceSelection) {
      fetchWorkspaceInterfaces();
    }
  }, [currentWorkspace, enableWorkspaceInterfaceSelection]);

  // 获取工作区接口，支持分页和搜索
  const fetchWorkspaceInterfaces = async (
    page = interfacePagination.current,
    pageSize = interfacePagination.pageSize,
    search = interfaceSearchKeyword
  ) => {
    if (!currentWorkspace) return;
    
    try {
      setInterfacesLoading(true);
      console.log('获取工作区接口列表，参数:', { page, pageSize, search });
      
      // 使用分页参数和搜索关键词调用API
      const result = await getWorkspaceInterfaces(
        currentWorkspace.id, 
        page, 
        pageSize, 
        search
      );
      
      console.log('获取到的工作区接口列表:', result);
      
      // 更新接口数据和分页信息
      setWorkspaceInterfaces(result.items || []);
      setInterfacePagination({
        current: result.page || 1,
        pageSize: result.page_size || 10,
        total: result.total || 0
      });
    } catch (error) {
      console.error('获取工作区接口失败:', error);
      setWorkspaceInterfaces([]);
      // 重置分页信息
      setInterfacePagination({
        current: 1,
        pageSize: 10,
        total: 0
      });
    } finally {
      setInterfacesLoading(false);
    }
  };

  // 使用useMemo创建debounced版本的搜索函数
  const debouncedFetch = useMemo(() => {
    return debounce((searchVal: string) => {
      fetchWorkspaceInterfaces(1, interfacePagination.pageSize, searchVal);
    }, 500);
  }, [currentWorkspace, interfacePagination.pageSize]);

  // 处理搜索输入变化
  const handleInterfaceSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setInterfaceSearchKeyword(value);
    debouncedFetch(value);
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
      
      // 检查是否已存在相同路径和方法的接口（本地检查，作为补充）
      const isDuplicate = interfaces.some(item => 
        item.path === completeValues.path && item.method === completeValues.method
      );
      
      if (isDuplicate) {
        message.error(`已存在路径为 '${completeValues.path}' 且方法为 '${completeValues.method}' 的接口`);
        return;
      }
      
      const newInterfaces = [...interfaces, { ...completeValues, id: newId }];
      onChange(newInterfaces);
    }
    setFormVisible(false);
  };
  
  // 打开工作区接口选择对话框
  const openWorkspaceInterfaceSelect = () => {
    setWorkspaceInterfaceSelectVisible(true);
    // 重置搜索和分页状态
    setInterfaceSearchKeyword('');
    setInterfacePagination({
      current: 1,
      pageSize: 10,
      total: 0
    });
    // 打开弹窗时自动加载第一页数据
    fetchWorkspaceInterfaces(1, 10, '');
  };

  // 关闭工作区接口选择对话框
  const closeWorkspaceInterfaceSelect = () => {
    setWorkspaceInterfaceSelectVisible(false);
    // 清空选择状态
    setSelectedWorkspaceInterfaceIds([]);
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
  const confirmWorkspaceInterfaceSelect = async () => {
    console.log('确认选择工作区接口，当前工作区接口数据:', workspaceInterfaces);
    console.log('已选择的接口ID:', selectedWorkspaceInterfaceIds);
    
    // 确保workspaceInterfaces是数组
    if (!Array.isArray(workspaceInterfaces) || workspaceInterfaces.length === 0) {
      console.log('工作区接口不是数组或为空，关闭对话框');
      closeWorkspaceInterfaceSelect();
      return;
    }

    // 如果没有选择任何接口，提示用户
    if (selectedWorkspaceInterfaceIds.length === 0) {
      Modal.info({
        title: '提示',
        content: '请至少选择一个接口进行导入'
      });
      return;
    }

    // 获取选中的工作区接口
    const selectedInterfaces = workspaceInterfaces.filter(iface => 
      selectedWorkspaceInterfaceIds.includes(iface.id)
    );
    console.log('选中的工作区接口:', selectedInterfaces);
    
    // 检查哪些接口已经被导入（通过workspace_interface_id判断）
    const existingWorkspaceInterfaceIds = new Set(
      interfaces
        .filter(item => item.workspace_interface_id !== undefined)
        .map(item => item.workspace_interface_id)
    );
    console.log('已存在的工作区接口ID:', [...existingWorkspaceInterfaceIds]);
    
    // 过滤出未导入的接口
    const newSelectedInterfaces = selectedInterfaces.filter(
      iface => !existingWorkspaceInterfaceIds.has(iface.id)
    );
    console.log('新选中的工作区接口:', newSelectedInterfaces);
    
    // 如果所有选中的接口都已导入，则提示用户
    if (newSelectedInterfaces.length === 0 && selectedInterfaces.length > 0) {
      console.log('所有选中的接口都已导入，显示提示');
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
    console.log('转换后的新接口:', newInterfaces);
    
    // 更新接口列表
    onChange([...interfaces, ...newInterfaces]);
    
    // 显示成功提示
    Modal.success({
      title: '导入成功',
      content: `成功导入 ${newInterfaces.length} 个接口`,
      okText: '确定'
    });
    
    // 清空选择状态并关闭对话框
    setSelectedWorkspaceInterfaceIds([]);
    closeWorkspaceInterfaceSelect();
    
    // 重置搜索和分页状态，以便下次打开时显示第一页
    setInterfaceSearchKeyword('');
    setInterfacePagination(prev => ({
      ...prev,
      current: 1
    }));
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
      <Row gutter={[8, 8]} className="interface-card-grid">
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

  // 准备表格列定义
  const tableColumns = [
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
      render: (text: string) => text || '-'
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: WorkspaceInterface) => {
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
  ];

  // 安全的行选择配置
  const safeRowSelection = {
    selectedRowKeys: selectedWorkspaceInterfaceIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      setSelectedWorkspaceInterfaceIds(selectedRowKeys as number[]);
    },
    getCheckboxProps: (record: WorkspaceInterface) => {
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
  };

  // 确保工作区接口数据是数组
  const safeWorkspaceInterfaces = Array.isArray(workspaceInterfaces) ? workspaceInterfaces : [];
  
  // 渲染工作区接口选择对话框内容
  const renderWorkspaceInterfaceModalContent = () => {
    return (
      <>
        <div style={{ marginBottom: 16 }}>
          <Search
            placeholder="搜索接口路径或描述"
            value={interfaceSearchKeyword}
            onChange={handleInterfaceSearchInputChange}
            style={{ width: '100%' }}
            enterButton
            allowClear
          />
        </div>
        
        {interfacesLoading ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Spin tip="加载中..." />
          </div>
        ) : safeWorkspaceInterfaces.length === 0 ? (
          <Empty 
            description={
              interfaceSearchKeyword 
                ? `没有找到与"${interfaceSearchKeyword}"相关的接口` 
                : "工作区中暂无可用的接口"
            } 
          />
        ) : (
          <>
            <Table
              dataSource={safeWorkspaceInterfaces}
              rowKey="id"
              pagination={false}
              rowSelection={safeRowSelection}
              columns={tableColumns}
              size="small"
              loading={interfacesLoading}
            />
            
            {/* 分页控件 */}
            {interfacePagination.total > 0 && (
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <Pagination
                  current={interfacePagination.current}
                  pageSize={interfacePagination.pageSize}
                  total={interfacePagination.total}
                  onChange={handleInterfacePageChange}
                  showSizeChanger
                  showQuickJumper
                  showTotal={(total) => `共 ${total} 条数据`}
                  size="small"
                />
              </div>
            )}
          </>
        )}
      </>
    );
  };

  // 处理分页变化
  const handleInterfacePageChange = (page: number, pageSize?: number) => {
    const newPageSize = pageSize || interfacePagination.pageSize;
    setInterfacePagination({ ...interfacePagination, current: page, pageSize: newPageSize });
    fetchWorkspaceInterfaces(page, newPageSize, interfaceSearchKeyword);
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
        width={900}
        okButtonProps={{ 
          disabled: selectedWorkspaceInterfaceIds.length === 0 || interfacesLoading,
          loading: interfacesLoading
        }}
        okText="导入选中接口"
        cancelText="取消"
        destroyOnClose
      >
        {renderWorkspaceInterfaceModalContent()}
      </Modal>
    </div>
  );
};

export default InterfaceSection; 