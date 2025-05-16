import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, message, Spin, Typography, Row, Col } from 'antd';
import { ModuleStructureNode } from '../../types/modules';
import { fetchModuleNode } from '../../apis/moduleService';
import ModuleContentEditor, { ModuleContentEditorHandle } from './components/ModuleContentEditor';
import SideNavigation from './components/SideNavigation';
import './ModuleContentPage.css';

const { Title } = Typography;

// 导航项定义
const navItems = [
  { key: 'overview', title: '功能概述', icon: '📝', filled: false },
  { key: 'diagram', title: '逻辑图', icon: '📊', filled: false },
  { key: 'keyTech', title: '功能详解', icon: '🔍', filled: false },
  { key: 'database', title: '数据库表', icon: '💾', filled: false },
  { key: 'related', title: '关联模块', icon: '🔗', filled: false },
  { key: 'interface', title: '涉及接口', icon: '🔌', filled: false },
];

const ModuleContentPage: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const editorRef = useRef<ModuleContentEditorHandle>(null);
  const [loading, setLoading] = useState(false);
  const [moduleNode, setModuleNode] = useState<ModuleStructureNode | null>(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [filledSections, setFilledSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadModuleNode = async () => {
      if (!moduleId) return;
      
      try {
        setLoading(true);
        const node = await fetchModuleNode(parseInt(moduleId));
        setModuleNode(node);
        setLoading(false);
      } catch (error) {
        console.error('加载模块节点信息失败:', error);
        message.error('加载模块节点信息失败');
        setLoading(false);
      }
    };
    
    loadModuleNode();
  }, [moduleId, navigate]);

  // 处理导航点击
  const handleNavClick = (key: string) => {
    setActiveSection(key);
    // 调用编辑器组件的滚动方法
    if (editorRef.current) {
      editorRef.current.scrollToSection(key);
    }
  };

  // 处理部分可见性变化
  const handleSectionVisibilityChange = (key: string) => {
    setActiveSection(key);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  // 为导航项添加已填充状态
  const navItemsWithState = navItems.map(item => ({
    ...item,
    filled: filledSections.has(item.key)
  }));

  return (
    <div className="module-content-page">
      {moduleNode && (
        <>
          <div className="page-header">
            <Title level={4} className="module-title">
              {moduleNode.name}
            </Title>
          </div>
          <div className="content-container">
            <div className="nav-column">
              <SideNavigation
                items={navItemsWithState}
                activeKey={activeSection}
                onNavClick={handleNavClick}
              />
            </div>
            <div className="content-column">
              <ModuleContentEditor 
                ref={editorRef}
                moduleNodeId={parseInt(moduleId || '0')} 
                onSectionVisibilityChange={handleSectionVisibilityChange}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ModuleContentPage; 