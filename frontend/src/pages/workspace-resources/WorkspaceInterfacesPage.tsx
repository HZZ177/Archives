import React, { useState, useEffect } from 'react';
import { Card, Button, Typography, Spin, Empty, message, Modal, Input } from 'antd';
import { PlusOutlined, ApiOutlined, SearchOutlined } from '@ant-design/icons';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { usePermission } from '../../contexts/PermissionContext';
import { getWorkspaceInterfaces, createWorkspaceInterface, updateWorkspaceInterface, deleteWorkspaceInterface } from '../../apis/workspaceService';
import { WorkspaceInterface, WorkspaceInterfaceCreate, WorkspaceInterfaceUpdate } from '../../types/workspace';
import { ApiInterfaceCard } from '../../types/modules';
import { ROUTES } from '../../config/constants';
import { Navigate } from 'react-router-dom';
import './WorkspaceResourcesPage.css';

// 复用内容页面中的接口组件
import InterfaceSection from '../module-content/components/sections/InterfaceSection';
import ApiInterfaceForm from '../module-content/components/sections/ApiInterfaceForm';

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
  
  // 搜索相关状态
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  
  // 检查权限
  const hasInterfacesPermission = hasPermission(ROUTES.WORKSPACE_INTERFACES);
  
  // 如果没有权限，重定向到无权限页面
  if (!hasInterfacesPermission) {
    return <Navigate to="/no-permission" replace />;
  }
  
  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchKeyword(value.trim().toLowerCase());
  };

  // 加载工作区接口
  const loadInterfaces = async () => {
    if (!currentWorkspace) return;
    
    setLoading(true);
    try {
      const data = await getWorkspaceInterfaces(currentWorkspace.id);
      setInterfaces(data);
    } catch (error) {
      console.error('加载工作区接口失败:', error);
      message.error('加载工作区接口失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    if (currentWorkspace) {
      loadInterfaces();
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
          loadInterfaces();
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
        (!isEdit || item.id !== currentInterface?.id)
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
          response_params_json: values.responseParams
        };
        
        await updateWorkspaceInterface(currentWorkspace.id, currentInterface.id, updateData);
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
          response_params_json: values.responseParams
        };
        
        await createWorkspaceInterface(currentWorkspace.id, createData);
        message.success('接口创建成功');
      }
      
      // 重新加载接口列表
      loadInterfaces();
      setFormVisible(false);
    } catch (error) {
      console.error('保存接口失败:', error);
      message.error('保存接口失败');
    }
  };

  // 渲染接口列表
  const renderInterfaceList = () => {
    if (loading) {
      return <Spin tip="加载中..." />;
    }

    // 根据搜索关键词过滤接口
    const filteredInterfaces = searchKeyword
      ? interfaces.filter(item => 
          item.path.toLowerCase().includes(searchKeyword) || 
          (item.description && item.description.toLowerCase().includes(searchKeyword))
        )
      : interfaces;

    if (filteredInterfaces.length === 0) {
      return (
        <Empty
          description={searchKeyword ? "没有匹配的接口" : "暂无接口"}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    // 将WorkspaceInterface转换为ApiInterfaceCard格式以便复用组件
    const formattedInterfaces: ApiInterfaceCard[] = filteredInterfaces.map(item => ({
      id: item.id.toString(),
      path: item.path,
      method: item.method as any,
      description: item.description || '',
      contentType: item.content_type || 'application/json',
      requestParams: item.request_params_json || [],
      responseParams: item.response_params_json || []
    }));

    return (
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
      responseParams: currentInterface.response_params_json || []
    };
  };

  return (
    <div className="workspace-resources-page">
      <div className="resources-page-header">
        <Title level={4}><ApiOutlined /> 接口池</Title>
      </div>
      
      <div className="resources-content-container">
        {/* 搜索框和添加按钮 */}
        {currentWorkspace && (
          <div className="resources-actions">
            <Search
              placeholder="搜索接口路径或描述"
              allowClear
              onSearch={handleSearch}
              onChange={(e) => handleSearch(e.target.value)}
              style={{ width: '100%', maxWidth: '600px' }}
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            />
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={handleAddInterface}
              disabled={!currentWorkspace}
            >
              添加接口
            </Button>
          </div>
        )}
        
        {/* 显示搜索结果统计 */}
        {searchKeyword && !loading && currentWorkspace && (
          <div style={{ marginBottom: 16, color: '#666' }}>
            搜索 "{searchKeyword}" 的结果: {
              interfaces.filter(item => 
                item.path.toLowerCase().includes(searchKeyword) || 
                (item.description && item.description.toLowerCase().includes(searchKeyword))
              ).length
            } / {interfaces.length} 个接口
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
          visible={formVisible}
          initialValues={getFormInitialValues()}
          onOk={handleFormSubmit}
          onCancel={() => setFormVisible(false)}
          useCustomModal={true}
        />
      </Modal>
    </div>
  );
};

export default WorkspaceInterfacesPage; 