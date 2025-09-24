import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Typography, Spin, Empty, message, Modal, Input, Pagination } from 'antd';
import { PlusOutlined, ApiOutlined, SearchOutlined, ImportOutlined, EditOutlined } from '@ant-design/icons';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { usePermission } from '../../contexts/PermissionContext';
import { getWorkspaceInterfaces, createWorkspaceInterface, updateWorkspaceInterface, deleteWorkspaceInterface } from '../../apis/workspaceService';
import { WorkspaceInterface, WorkspaceInterfaceCreate, WorkspaceInterfaceUpdate } from '../../types/workspace';
import { ApiInterfaceCard } from '../../types/modules';
import { ROUTES } from '../../config/constants';
import { Navigate } from 'react-router-dom';
import './WorkspaceResourcesPage.css';
import { debounce } from '../../utils/throttle';

// 复用内容页面中的接口组件
import InterfaceSection from '../module-content/components/sections/InterfaceSection';
import ApiInterfaceForm from '../module-content/components/sections/ApiInterfaceForm';
import InterfaceImportModal from './components/InterfaceImportModal';
import InterfaceBatchEditModal from './components/InterfaceBatchEditModal';

const { Title } = Typography;
const { Search } = Input;

const WorkspaceInterfacesPage: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const { hasPermission } = usePermission();
  const [interfaces, setInterfaces] = useState<WorkspaceInterface[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [formVisible, setFormVisible] = useState<boolean>(false);
  const [currentInterface, setCurrentInterface] = useState<WorkspaceInterface | null>(null);
  const [expandedApiCards, setExpandedApiCards] = useState<string[]>([]);
  
  // 添加导入相关状态
  const [importModalVisible, setImportModalVisible] = useState<boolean>(false);
  
  // 添加批量编辑相关状态
  const [batchEditModalVisible, setBatchEditModalVisible] = useState<boolean>(false);
  
  // 搜索相关状态
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [searchInputValue, setSearchInputValue] = useState<string>('');
  
  // 分页相关状态
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  
  // 检查权限
  const hasInterfacesPermission = hasPermission(ROUTES.WORKSPACE_INTERFACES);
  
  // 如果没有权限，重定向到无权限页面
  if (!hasInterfacesPermission) {
    return <Navigate to="/no-permission" replace />;
  }
  
  // 使用useCallback和debounce创建去抖的搜索函数
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchKeyword(value.trim());
      // 搜索时重置到第一页
      setPagination(prev => ({ ...prev, current: 1 }));
      // 使用新的搜索条件加载数据
      loadInterfaces(1, pagination.pageSize, value.trim());
    }, 500), // 500ms的去抖延迟
    [currentWorkspace, pagination.pageSize]
  );

  // 处理搜索框输入变化
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInputValue(value);
    debouncedSearch(value);
  };
  
  // 处理搜索按钮点击
  const handleSearch = (value: string) => {
    setSearchInputValue(value);
    setSearchKeyword(value.trim());
    // 搜索时重置到第一页
    setPagination(prev => ({ ...prev, current: 1 }));
    // 使用新的搜索条件加载数据
    loadInterfaces(1, pagination.pageSize, value.trim());
  };

  // 加载工作区接口
  const loadInterfaces = async (
    page = pagination.current,
    pageSize = pagination.pageSize,
    search = searchKeyword
  ) => {
    if (!currentWorkspace) return;
    
    setLoading(true);
    try {
      const data = await getWorkspaceInterfaces(currentWorkspace.id, page, pageSize, search);
      // 更新接口列表和分页信息
      setInterfaces(data.items);
      setPagination({
        current: data.page,
        pageSize: data.page_size,
        total: data.total
      });
    } catch (error) {
      console.error('加载工作区接口失败:', error);
      message.error('加载工作区接口失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理分页变化
  const handlePageChange = (page: number, pageSize?: number) => {
    setPagination(prev => ({
      ...prev,
      current: page,
      pageSize: pageSize || prev.pageSize
    }));
    loadInterfaces(page, pageSize || pagination.pageSize);
  };

  // 初始加载
  useEffect(() => {
    if (currentWorkspace) {
      loadInterfaces(1, pagination.pageSize, '');
    }
  }, [currentWorkspace]);

  // 打开创建接口弹窗
  const handleAddInterface = () => {
    setCurrentInterface(null);
    setFormVisible(true);
  };

  // 打开编辑接口弹窗
  const handleEditInterface = (interfaceId: string) => {
    const interfaceToEdit = interfaces.find(item => item.id.toString() === interfaceId);
    if (interfaceToEdit) {
      setCurrentInterface(interfaceToEdit);
      setFormVisible(true);
    }
  };

  // 处理删除接口
  const handleDeleteInterface = async (interfaceId: string) => {
    if (!currentWorkspace) return;
    
    const interfaceToDelete = interfaces.find(item => item.id.toString() === interfaceId);
    if (!interfaceToDelete) return;
    
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除接口 "${interfaceToDelete.path}" 吗？此操作不可撤销。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteWorkspaceInterface(currentWorkspace.id, interfaceToDelete.id);
          message.success('接口删除成功');
          loadInterfaces(); // 保持在当前页
        } catch (error) {
          console.error('删除接口失败:', error);
          message.error('删除接口失败');
        }
      }
    });
  };

  // 处理表单提交
  const handleFormSubmit = async (values: ApiInterfaceCard) => {
    if (!currentWorkspace) return;
    
    try {
      
      // 检查是否存在相同路径和方法的接口
      const isEdit = !!currentInterface;
      const existingInterface = interfaces.find(item => 
        item.path.toLowerCase() === values.path.toLowerCase() && 
        item.method.toLowerCase() === values.method.toLowerCase() &&
        // 如果是编辑模式，则排除当前正在编辑的接口
        (isEdit ? item.id !== currentInterface?.id : true)
      );
      
      if (existingInterface) {
        message.error(`工作区中已存在路径为 '${values.path}' 且方法为 '${values.method}' 的接口`);
        return;
      }
      
      if (currentInterface) {
        // 更新接口
        const updateData: WorkspaceInterfaceUpdate = {
          path: values.path,
          method: values.method,
          description: values.description,
          content_type: values.contentType,
          request_params_json: values.requestParams,
          response_params_json: values.responseParams,
          request_example: values.requestExample,
          response_example: values.responseExample
        };
        
        console.log('更新接口数据:', updateData);
        const result = await updateWorkspaceInterface(currentWorkspace.id, currentInterface.id, updateData);
        console.log('更新接口响应:', result);
        message.success('接口更新成功');
      } else {
        // 创建接口
        const createData: WorkspaceInterfaceCreate = {
          workspace_id: currentWorkspace.id,
          path: values.path,
          method: values.method,
          description: values.description,
          content_type: values.contentType,
          request_params_json: values.requestParams,
          response_params_json: values.responseParams,
          request_example: values.requestExample,
          response_example: values.responseExample
        };
        
        console.log('创建接口数据:', createData);
        const result = await createWorkspaceInterface(currentWorkspace.id, createData);
        console.log('创建接口响应:', result);
        message.success('接口创建成功');
      }
      
      // 重新加载接口列表
      loadInterfaces(); // 保持在当前页
      setFormVisible(false);
    } catch (error) {
      console.error('保存接口失败:', error);
      message.error('保存接口失败');
    }
  };

  // 打开导入接口弹窗
  const handleImport = () => {
    setImportModalVisible(true);
  };

  // 打开批量编辑弹窗
  const handleBatchEdit = () => {
    setBatchEditModalVisible(true);
  };

  // 渲染接口列表
  const renderInterfaceList = () => {
    if (loading) {
      return (
        <Spin tip="加载中...">
          <div style={{ minHeight: '100px' }} />
        </Spin>
      );
    }

    if (interfaces.length === 0) {
      return (
        <Empty
          description={searchKeyword ? "没有匹配的接口" : "暂无接口"}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    // 将WorkspaceInterface转换为ApiInterfaceCard格式以便复用组件
    const formattedInterfaces: ApiInterfaceCard[] = interfaces.map(item => ({
      id: item.id.toString(),
      path: item.path,
      method: item.method as any,
      description: item.description || '',
      contentType: item.content_type || 'application/json',
      requestParams: item.request_params_json || [],
      responseParams: item.response_params_json || [],
      requestExample: item.request_example || '',
      responseExample: item.response_example || ''
    }));

    return (
      <>
        <InterfaceSection
          interfaces={formattedInterfaces}
          onChange={() => {}} // 只读模式，不需要处理变更
          expandedApiCards={expandedApiCards}
          setExpandedApiCards={setExpandedApiCards}
          onEdit={handleEditInterface}
          onDelete={handleDeleteInterface}
          showWorkspaceSelectButton={false} // 禁用从工作区选择接口按钮
          isEditable={true} // 添加此属性，确保显示编辑和删除按钮
        />
        
        {/* 添加分页组件 */}
        {pagination.total > 0 && (
          <div className="pagination-container">
            <Pagination
              current={pagination.current}
              pageSize={pagination.pageSize}
              total={pagination.total}
              onChange={handlePageChange}
              showSizeChanger
              showQuickJumper
              showTotal={(total) => `共 ${total} 条数据`}
              size="small"
              style={{ marginBottom: 8 }} // 添加底部边距，确保输入框下边线可见
            />
          </div>
        )}
      </>
    );
  };

  // 准备表单初始值
  const getFormInitialValues = (): Partial<ApiInterfaceCard> | undefined => {
    if (!currentInterface) return undefined;
    
    return {
      id: currentInterface.id.toString(),
      path: currentInterface.path,
      method: currentInterface.method as any,
      description: currentInterface.description || '',
      contentType: currentInterface.content_type || 'application/json',
      requestParams: currentInterface.request_params_json || [],
      responseParams: currentInterface.response_params_json || [],
      requestExample: currentInterface.request_example || '',
      responseExample: currentInterface.response_example || ''
    };
  };

  return (
    <div className="workspace-resources-page">
      <div className="resources-page-header">
        <Title level={5}><ApiOutlined /> 接口池</Title>
      </div>
      
      <div className="resources-content-container">
        {/* 搜索框和添加按钮 */}
        {currentWorkspace && (
          <div className="resources-actions">
            <Search
              placeholder="搜索接口路径或描述"
              allowClear
              onSearch={handleSearch}
              onChange={handleSearchInputChange}
              value={searchInputValue}
              style={{ width: '100%', maxWidth: '500px' }}
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              size="middle"
            />
            <div>
              <Button 
                icon={<EditOutlined />} 
                onClick={handleBatchEdit}
                disabled={!currentWorkspace}
                style={{ marginRight: 6 }}
                size="middle"
              >
                批量编辑
              </Button>
              <Button 
                icon={<ImportOutlined />} 
                onClick={handleImport}
                disabled={!currentWorkspace}
                style={{ marginRight: 6 }}
                size="middle"
              >
                导入接口
              </Button>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={handleAddInterface}
                disabled={!currentWorkspace}
                size="middle"
              >
                添加接口
              </Button>
            </div>
          </div>
        )}
        
        {/* 显示搜索结果统计 */}
        {searchKeyword && !loading && currentWorkspace && (
          <div style={{ padding: '0 24px', marginBottom: 16, color: '#666' }}>
            搜索 "{searchKeyword}" 的结果: {pagination.total} 条记录
          </div>
        )}
        
        <div className="resources-list">
          {renderInterfaceList()}
        </div>
      </div>
      
      {/* 接口表单弹窗 */}
      <Modal
        title={currentInterface ? "编辑接口" : "添加接口"}
        open={formVisible}
        onCancel={() => setFormVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setFormVisible(false)}>
            取消
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            onClick={() => {
              // 触发ApiInterfaceForm组件中定义的自定义事件
              document.dispatchEvent(new Event('api-interface-form-submit'));
            }}
          >
            保存
          </Button>
        ]}
        width={1200}
        destroyOnClose
      >
        <ApiInterfaceForm
          open={formVisible}
          initialValues={getFormInitialValues()}
          onOk={handleFormSubmit}
          onCancel={() => setFormVisible(false)}
          useCustomModal={true}
        />
      </Modal>
      
      {/* 添加导入接口Modal */}
      <InterfaceImportModal
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        workspaceId={currentWorkspace?.id}
        onSuccess={() => {
          loadInterfaces(1); // 导入后回到第一页，但不关闭弹窗
        }}
      />
      
      {/* 添加批量编辑Modal */}
      <InterfaceBatchEditModal
        open={batchEditModalVisible}
        onCancel={() => setBatchEditModalVisible(false)}
        workspaceId={currentWorkspace?.id}
        onSuccess={() => {
          loadInterfaces(); // 保持在当前页
        }}
      />
    </div>
  );
};

export default WorkspaceInterfacesPage; 