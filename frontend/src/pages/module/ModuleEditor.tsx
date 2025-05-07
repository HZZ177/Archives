import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, Card, Button, message, Spin, Breadcrumb } from 'antd';
import { HomeOutlined, SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/constants';
import request from '../../utils/request';
import { ModuleDetail } from '../../types/module';

// 导入六个固定模块组件
import FunctionOverview from '../../components/business/SectionModules/FunctionOverview';
import DiagramUpload from '../../components/business/SectionModules/DiagramUpload';
import FunctionDetail from '../../components/business/SectionModules/FunctionDetail';
import DatabaseTable from '../../components/business/SectionModules/DatabaseTable';
import RelatedModules from '../../components/business/SectionModules/RelatedModules';
import ApiInterface from '../../components/business/SectionModules/ApiInterface';

const { TabPane } = Tabs;

interface ModuleEditorProps {
  // 可以根据需要添加更多props
}

/**
 * 模块编辑器组件
 * 使用六个固定模块展示和编辑模块内容
 */
const ModuleEditor: React.FC<ModuleEditorProps> = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState('1');
  const [moduleData, setModuleData] = useState<ModuleDetail | null>(null);
  const [moduleName, setModuleName] = useState('');
  
  // 加载模块数据
  const fetchModuleData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const response = await request.get(`/modules/${id}`);
      
      if (response?.data) {
        setModuleData(response.data.detail);
        setModuleName(response.data.name);
      } else {
        message.error('获取模块数据失败');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('获取模块数据失败:', error);
      message.error('获取模块数据失败');
      setLoading(false);
    }
  };
  
  // 初始加载
  useEffect(() => {
    if (id) {
      fetchModuleData();
    }
  }, [id]);
  
  // 处理保存
  const handleSave = async () => {
    if (!id || !moduleData) return;
    
    try {
      setSaving(true);
      await request.put(`/modules/${id}/detail`, moduleData);
      message.success('模块内容保存成功');
      setSaving(false);
    } catch (error) {
      console.error('保存模块内容失败:', error);
      message.error('保存模块内容失败');
      setSaving(false);
    }
  };
  
  // 更新概述内容
  const updateOverview = (content: string) => {
    if (!moduleData) return;
    setModuleData({
      ...moduleData,
      overview: content,
    });
  };
  
  // 更新功能详情
  const updateFunctionDetail = (content: string) => {
    if (!moduleData) return;
    setModuleData({
      ...moduleData,
      detail_content: content,
    });
  };
  
  // 上传图表
  const handleUploadDiagram = async (file: File) => {
    if (!id) return;
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('module_id', id);
      
      const response = await request.post('/modules/diagrams', formData);
      
      if (response?.data && moduleData) {
        setModuleData({
          ...moduleData,
          diagrams: [...moduleData.diagrams, response.data],
        });
      }
    } catch (error) {
      console.error('上传图表失败:', error);
      message.error('上传图表失败');
      throw error;
    }
  };
  
  // 删除图表
  const handleDeleteDiagram = async (diagramId: number) => {
    try {
      await request.delete(`/modules/diagrams/${diagramId}`);
      
      if (moduleData) {
        setModuleData({
          ...moduleData,
          diagrams: moduleData.diagrams.filter(diagram => diagram.id !== diagramId),
        });
      }
    } catch (error) {
      console.error('删除图表失败:', error);
      message.error('删除图表失败');
      throw error;
    }
  };
  
  // 更新数据库表
  const updateDatabaseTables = (tables: any[]) => {
    if (!moduleData) return;
    setModuleData({
      ...moduleData,
      database_tables: tables,
    });
  };
  
  // 更新关联模块
  const updateRelatedModules = (modules: any[]) => {
    if (!moduleData) return;
    setModuleData({
      ...moduleData,
      related_modules: modules,
    });
  };
  
  // 更新API接口
  const updateApiInterfaces = (apis: any[]) => {
    if (!moduleData) return;
    setModuleData({
      ...moduleData,
      api_interfaces: apis,
    });
  };
  
  // 如果正在加载，显示加载中
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
        <p>加载模块内容中...</p>
      </div>
    );
  }
  
  return (
    <div className="module-editor">
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item>
          <Link to="/"><HomeOutlined /></Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <Link to="/structure">模块结构</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>{moduleName || '模块内容'}</Breadcrumb.Item>
      </Breadcrumb>
      
      <Card
        title={moduleName || '模块内容'}
        extra={
          <div>
            <Button 
              icon={<ArrowLeftOutlined />} 
              style={{ marginRight: 8 }}
              onClick={() => navigate('/structure')}
            >
              返回
            </Button>
            <Button 
              type="primary" 
              icon={<SaveOutlined />} 
              loading={saving}
              onClick={handleSave}
            >
              保存
            </Button>
          </div>
        }
      >
        <Tabs
          activeKey={activeTabKey}
          onChange={setActiveTabKey}
          type="card"
          size="large"
          tabPosition="left"
          style={{ minHeight: 500 }}
        >
          <TabPane 
            tab={
              <span>
                <span style={{ color: '#1890ff', marginRight: '4px' }}>1</span>
                模块功能概述
              </span>
            } 
            key="1"
          >
            <FunctionOverview
              section={{ 
                id: '1', 
                title: '模块功能概述', 
                content: moduleData?.overview || ''
              }}
              onSave={updateOverview}
            />
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                <span style={{ color: '#1890ff', marginRight: '4px' }}>2</span>
                逻辑图/数据流向图
              </span>
            } 
            key="2"
          >
            <DiagramUpload
              section={{ 
                id: '2', 
                title: '逻辑图/数据流向图', 
                images: moduleData?.diagrams || [],
                content: ''
              }}
              onUpload={handleUploadDiagram}
              onDelete={handleDeleteDiagram}
            />
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                <span style={{ color: '#1890ff', marginRight: '4px' }}>3</span>
                功能详解
              </span>
            } 
            key="3"
          >
            <FunctionDetail
              section={{ 
                id: '3', 
                title: '功能详解', 
                content: moduleData?.detail_content || ''
              }}
              onSave={updateFunctionDetail}
            />
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                <span style={{ color: '#1890ff', marginRight: '4px' }}>4</span>
                数据库表
              </span>
            } 
            key="4"
          >
            <DatabaseTable
              tables={moduleData?.database_tables || []}
              onChange={updateDatabaseTables}
            />
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                <span style={{ color: '#1890ff', marginRight: '4px' }}>5</span>
                关联模块
              </span>
            } 
            key="5"
          >
            <RelatedModules
              relatedModules={moduleData?.related_modules || []}
              onChange={updateRelatedModules}
            />
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                <span style={{ color: '#1890ff', marginRight: '4px' }}>6</span>
                涉及接口
              </span>
            } 
            key="6"
          >
            <ApiInterface
              interfaces={moduleData?.api_interfaces || []}
              onChange={updateApiInterfaces}
            />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default ModuleEditor; 