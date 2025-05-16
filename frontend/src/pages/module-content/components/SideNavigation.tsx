import React, { useEffect } from 'react';
import { Button } from 'antd';
import { SaveOutlined, EditOutlined, CloseOutlined } from '@ant-design/icons';
import './SideNavigation.css';

interface NavItem {
  key: string;
  title: string;
  icon: string;
  filled: boolean;
}

interface SideNavigationProps {
  items: NavItem[];
  activeKey: string;
  onNavClick: (key: string) => void;
  isEditMode?: boolean;
  saving?: boolean;
  onSave?: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
}

const SideNavigation: React.FC<SideNavigationProps> = ({
  items,
  activeKey,
  onNavClick,
  isEditMode = false,
  saving = false,
  onSave,
  onEdit,
  onCancel,
}) => {
  useEffect(() => {
    console.log('SideNavigation rendered:', { items, activeKey });
  }, [items, activeKey]);

  // 确保至少有一个可见元素
  if (items.length === 0) {
    return (
      <div className="side-navigation" style={{border: '1px solid red'}}>
        <div className="nav-line"></div>
        <div className="nav-item">
          <div className="nav-node">
            <span className="nav-icon">⚠️</span>
          </div>
          <div className="nav-title">无导航项</div>
        </div>
      </div>
    );
  }

  return (
    <div className="side-navigation">
      {(onSave || onEdit) && (
        <div className={`nav-mode-panel ${isEditMode ? 'edit-mode' : ''}`}>
          <div className="nav-mode-indicator">
            当前模式
          </div>
          <div className="nav-mode-text-container">
            <span className="nav-mode-text">{isEditMode ? '编辑' : '阅读'}</span>
          </div>
          {isEditMode ? (
            <>
              <Button 
                type="primary" 
                icon={<SaveOutlined />} 
                onClick={onSave}
                loading={saving}
                className="nav-action-button"
                size="small"
              >
                保存
              </Button>
              <Button 
                icon={<CloseOutlined />} 
                onClick={onCancel}
                className="nav-action-button nav-cancel-button"
                size="small"
                style={{ marginTop: '8px' }}
              >
                取消
              </Button>
            </>
          ) : (
            <Button 
              type="primary" 
              icon={<EditOutlined />} 
              onClick={onEdit}
              className="nav-action-button"
              size="small"
            >
              编辑
            </Button>
          )}
        </div>
      )}
      
      <div className="nav-line"></div>
      {items.map((item) => (
        <div 
          key={item.key} 
          className={`nav-item ${activeKey === item.key ? 'active' : ''}`}
          onClick={() => onNavClick(item.key)}
        >
          <div className={`nav-node ${item.filled ? 'filled' : ''}`}>
            <span className="nav-icon">{item.icon}</span>
          </div>
          <div className="nav-title">{item.title}</div>
        </div>
      ))}
    </div>
  );
};

export default SideNavigation; 