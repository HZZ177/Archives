import React, { useEffect } from 'react';
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
}

const SideNavigation: React.FC<SideNavigationProps> = ({
  items,
  activeKey,
  onNavClick,
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