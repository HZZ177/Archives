import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, message, Spin, Typography, Row, Col } from 'antd';
import { ModuleStructureNode } from '../../types/modules';
import { fetchModuleNode, getModuleSectionConfig } from '../../apis/moduleService';
import ModuleContentEditor, { ModuleContentEditorHandle } from './components/ModuleContentEditor';
import SideNavigation from './components/SideNavigation';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { Workspace } from '../../types/workspace';
import './ModuleContentPage.css';

const { Title } = Typography;

// 导航项定义
const defaultNavItems = [
  { key: 'overview', title: '功能概述', icon: '📝', filled: false },
  { key: 'diagram', title: '业务流程图', icon: '📊', filled: false },
  { key: 'terminology', title: '名称解释', icon: '📖', filled: false },
  { key: 'keyTech', title: '功能详解', icon: '🔍', filled: false },
  { key: 'database', title: '数据库表', icon: '💾', filled: false },
  { key: 'tableRelation', title: '表关联关系图', icon: '🔄', filled: false },
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
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [navItems, setNavItems] = useState(defaultNavItems);
  const { currentWorkspace, workspaces, setCurrentWorkspace, isChangingWorkspace } = useWorkspace();

  // 加载模块配置
  useEffect(() => {
    const loadModuleConfig = async () => {
      try {
        const response = await getModuleSectionConfig();
        const enabled = response.data.data.filter((item: any) => item.is_enabled);
        const navs = enabled.map((item: any) => ({
          key: item.section_key,
          title: item.section_name,
          icon: <span>{item.section_icon}</span>
        }));
        setNavItems(navs);

        const localConfig = { navs, timestamp: Date.now() };
        localStorage.setItem('moduleSectionsConfig', JSON.stringify(localConfig));
        
        if (!navs.some((nav: any) => nav.key === activeSection)) {
          setActiveSection(navs.length > 0 ? navs[0].key : '');
        }
      } catch (error) {
        console.error('加载模块配置失败:', error);
        setNavItems(defaultNavItems);
      }
    };
    
    loadModuleConfig();
  }, [moduleId, activeSection]);

  useEffect(() => {
    const loadModuleNode = async () => {
      if (!moduleId) return;
      
      try {
        setLoading(true);
        const node = await fetchModuleNode(parseInt(moduleId));
        setModuleNode(node);
        
        // 检查模块所属的工作区ID，如果与当前工作区不同，则切换工作区
        if (node.workspace_id && currentWorkspace?.id !== node.workspace_id && !isChangingWorkspace) {
          console.log(`模块(ID:${node.id})所属工作区(ID:${node.workspace_id})与当前工作区(ID:${currentWorkspace?.id})不同，正在切换工作区...`);
          
          // 查找模块所属的工作区
          const targetWorkspace = workspaces.find(w => w.id === node.workspace_id);
          
          if (targetWorkspace) {
            try {
            // 切换到模块所属的工作区
              await setCurrentWorkspace(targetWorkspace);
            console.log(`已切换到模块所属工作区: ${targetWorkspace.name}(ID:${targetWorkspace.id})`);
            } catch (error) {
              console.error(`切换到模块所属工作区失败:`, error);
              message.error('切换工作区失败，请稍后重试');
            }
          } else {
            console.warn(`未找到模块所属的工作区(ID:${node.workspace_id})，无法切换工作区`);
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error('加载模块节点信息失败:', error);
        message.error('加载模块节点信息失败');
        setLoading(false);
      }
    };
    
    loadModuleNode();
  }, [moduleId, navigate, currentWorkspace, workspaces, setCurrentWorkspace, isChangingWorkspace]);

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

  // 添加处理编辑和保存函数
  const handleEdit = () => {
    setIsEditMode(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editorRef.current) {
      const success = await editorRef.current.saveContent();
      if (success) {
        setIsEditMode(false);
      }
    }
    setSaving(false);
  };

  // 处理取消编辑
  const handleCancel = () => {
    // 直接切换回阅读模式，不保存修改
    setIsEditMode(false);
    // 重新加载内容，丢弃未保存的修改
    if (editorRef.current) {
      editorRef.current.reloadContent();
    }
  };

  // 添加回调函数以同步填充部分
  const handleSectionsUpdate = (filledKeys: Set<string>) => {
    setFilledSections(filledKeys);
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
                isEditMode={isEditMode}
                saving={saving}
                onSave={handleSave}
                onEdit={handleEdit}
                onCancel={handleCancel}
              />
            </div>
            <div className="content-column">
              <ModuleContentEditor 
                ref={editorRef}
                moduleNodeId={parseInt(moduleId || '0')} 
                onSectionVisibilityChange={handleSectionVisibilityChange}
                isEditMode={isEditMode}
                setIsEditMode={setIsEditMode}
                saving={saving}
                setSaving={setSaving}
                onSectionsUpdate={handleSectionsUpdate}
                enabledSections={navItems.map(item => item.key)}
                enableWorkspaceResources={true}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ModuleContentPage; 