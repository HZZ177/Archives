import React, { useState } from 'react';
import { MdEditor } from 'md-editor-rt';
import 'md-editor-rt/lib/style.css';
import './SectionStyles.css'; // 导入共享样式

interface OverviewSectionProps {
  value: string;
  onChange: (value: string) => void;
}

const OverviewSection: React.FC<OverviewSectionProps> = ({ value, onChange }) => {
  // 为编辑器ID提供唯一标识
  const [editorId] = useState('overview-editor-' + Date.now());
  
  return (
    <div className="section-content">
      <div className="markdown-hint" style={{ marginBottom: '16px', color: '#888' }}>
        支持Markdown语法，例如: **加粗文本**, *斜体文本*, `代码`, # 标题, 等。左侧编辑，右侧实时预览。
      </div>
      
      <MdEditor
        modelValue={value}
        onChange={onChange}
        id={editorId}
        language="zh-CN"
        previewTheme="github"
        codeTheme="atom"
        preview={true}
        style={{ height: '400px', boxShadow: '0 0 0 1px #f0f0f0' }}
        placeholder="请输入功能概述（支持换行和基本Markdown语法）"
      />
    </div>
  );
};

export default OverviewSection; 