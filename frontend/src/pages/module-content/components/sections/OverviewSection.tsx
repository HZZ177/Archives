import React from 'react';
import { Input } from 'antd';
import { TextAreaProps } from 'antd/lib/input';

const { TextArea } = Input;

interface OverviewSectionProps {
  value: string;
  onChange: (value: string) => void;
}

const OverviewSection: React.FC<OverviewSectionProps> = ({ value, onChange }) => {
  return (
    <div className="section-content">
      <TextArea
        value={value}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        placeholder="请输入模块功能概述"
        autoSize={{ minRows: 4, maxRows: 10 }}
      />
    </div>
  );
};

export default OverviewSection; 