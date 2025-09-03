import React, { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { message, Spin, Typography, Divider } from 'antd';
import { BugOutlined } from '@ant-design/icons';
import { ModuleStructureNode } from '../../types/modules';
import { fetchModuleNode, getModuleSectionConfig } from '../../apis/moduleService';
import ModuleContentEditor, { ModuleContentEditorHandle } from './components/ModuleContentEditor';
import SideNavigation from './components/SideNavigation';
import BugAssociationPanel from '../../components/bug/BugAssociationPanel';
import ModuleBugList from '../../components/bug/ModuleBugList';
import BugDetailModal from '../../components/bug/BugDetailModal';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { usePermission } from '../../contexts/PermissionContext';
import { Workspace } from '../../types/workspace';
import { BugProfileResponse } from '../../types/bug';
import './ModuleContentPage.css';

const { Title } = Typography;

const defaultNavItems = [
  { key: 'overview', title: '功能概述', icon: '📝', filled: false },
  { key: 'diagram', title: '业务流程图', icon: '📊', filled: false },
  { key: 'terminology', title: '名称解释', icon: '📖', filled: false },
  { key: 'keyTech', title: '功能详解', icon: '🔍', filled: false },
  { key: 'database', title: '数据库表', icon: '💾', filled: false },
  { key: 'tableRelation', title: '表关联关系图', icon: '🔄', filled: false },
  { key: 'related', title: '关联模块', icon: '🔗', filled: false },
  { key: 'interface', title: '涉及接口', icon: '🔌', filled: false },
  // 新增：缺陷模块（若后端配置未返回，则使用此默认项）
  { key: 'bugs', title: '缺陷', icon: '🐞', filled: false },
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
  const { hasPermission } = usePermission();
  
  // Bug详情弹窗状态
  const [bugDetailVisible, setBugDetailVisible] = useState(false);
  const [selectedBug, setSelectedBug] = useState<BugProfileResponse | null>(null);

  // 处理查看Bug详情
  const handleViewBug = (bug: BugProfileResponse) => {
    setSelectedBug(bug);
    setBugDetailVisible(true);
  };

  // 关闭Bug详情弹窗
  const handleCloseBugDetail = () => {
    setBugDetailVisible(false);
    setSelectedBug(null);
  };

  // 加载模块配置
  const loadModuleConfig = async () => {
    try {
      const response = await getModuleSectionConfig(currentWorkspace?.id);

      // API返回格式: {data: {success: true, data: [...], message: "..."}}
      const apiResponse = response.data;
      if (apiResponse && apiResponse.success && Array.isArray(apiResponse.data)) {
        const configItems = apiResponse.data
          .filter((item: any) => item.is_enabled)
          .sort((a: any, b: any) => a.display_order - b.display_order)
          .map((item: any) => ({
            key: item.section_key,
            title: item.section_name,
            icon: item.section_icon || '📄',
            filled: false
          }));


        setNavItems(configItems);
      } else {
        console.warn('配置数据格式不正确:', apiResponse);
        setNavItems(defaultNavItems);
      }
    } catch (error) {
      console.error('加载模块配置失败:', error);
      // 使用默认配置
      setNavItems(defaultNavItems);
    }
  };

  useEffect(() => {
    loadModuleConfig();

    // 监听localStorage变化，当模块配置更新时重新加载
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'moduleSections') {
        loadModuleConfig();
      }
    };

    // 监听自定义事件，用于同一页面内的配置更新
    const handleConfigUpdate = () => {
      loadModuleConfig();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('moduleConfigUpdated', handleConfigUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('moduleConfigUpdated', handleConfigUpdate);
    };
  }, []);

  useEffect(() => {
    if (moduleId) {
      loadModuleNode();
    }
  }, [moduleId]);

  const loadModuleNode = async () => {
    if (!moduleId) return;
    
    setLoading(true);
    try {
      const node = await fetchModuleNode(parseInt(moduleId));
      setModuleNode(node);
    } catch (error) {
      message.error('加载模块信息失败');
      navigate('/structure-management');
    } finally {
      setLoading(false);
    }
  };

  const handleSectionVisibilityChange = (visibleSections: string[]) => {
    setFilledSections(new Set(visibleSections));
  };

  const handleNavClick = (key: string) => {
    setActiveSection(key);
    const element = document.getElementById(`section-${key}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSave = async () => {
    if (editorRef.current) {
      await editorRef.current.save();
    }
  };

  const handleEdit = () => {
    setIsEditMode(true);
  };

  const handleCancel = () => {
    setIsEditMode(false);
    if (editorRef.current) {
      editorRef.current.cancel();
    }
  };

  const handleSectionsUpdate = (sections: any[]) => {
    // 处理模块内容更新
  };

  const navItemsWithState = navItems.map(item => ({
    ...item,
    filled: filledSections.has(item.key)
  }));

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="module-content-page">
      {moduleNode && (
        <>
          <div className="module-page-header">
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
                // 缺陷模块相关props
                onViewBug={handleViewBug}
                moduleName={moduleNode.name}
              />


            </div>
          </div>
        </>
      )}
      
      {/* Bug详情弹窗 */}
      <BugDetailModal
        visible={bugDetailVisible}
        bug={selectedBug}
        onClose={handleCloseBugDetail}
      />
    </div>
  );
};

export default ModuleContentPage;
