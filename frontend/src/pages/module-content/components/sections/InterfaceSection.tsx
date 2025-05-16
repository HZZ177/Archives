import React, { useState, useEffect } from 'react';
import { Button, Empty, Row, Col } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { ApiInterfaceCard } from '../../../../types/modules';
import ApiInterfaceCardComponent from './ApiInterfaceCard';
import ApiInterfaceForm from './ApiInterfaceForm';
import './SectionStyles.css';

interface InterfaceSectionProps {
  interfaces: ApiInterfaceCard[];
  onChange: (interfaces: ApiInterfaceCard[]) => void;
  expandedApiCards?: string[];
  setExpandedApiCards?: React.Dispatch<React.SetStateAction<string[]>>;
}

const InterfaceSection: React.FC<InterfaceSectionProps> = ({ 
  interfaces, 
  onChange, 
  expandedApiCards = [], 
  setExpandedApiCards 
}) => {
  // 表单可见性状态
  const [formVisible, setFormVisible] = useState(false);
  // 当前编辑的接口
  const [currentInterface, setCurrentInterface] = useState<ApiInterfaceCard | undefined>(undefined);
  // 表单标题
  const [formTitle, setFormTitle] = useState('添加接口');

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

  return (
    <div className="interface-section">
      {renderInterfaceCards()}
      
      <Button
        type="dashed"
        onClick={handleAdd}
        style={{ marginTop: 16, width: '100%' }}
        icon={<PlusOutlined />}
      >
        添加接口
      </Button>

      {/* 接口表单对话框 */}
      <ApiInterfaceForm
        visible={formVisible}
        title={formTitle}
        initialValues={currentInterface}
        onOk={handleFormSubmit}
        onCancel={() => setFormVisible(false)}
      />
    </div>
  );
};

export default InterfaceSection; 