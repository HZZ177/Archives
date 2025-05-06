import React from 'react';
import { Input } from 'antd';

const { TextArea } = Input;

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  height?: string;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language = 'typescript',
  height = '300px'
}) => {
  // 处理文本变更
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="code-editor" style={{ border: '1px solid #d9d9d9', borderRadius: '2px' }}>
      {language && (
        <div 
          style={{ 
            backgroundColor: '#f5f5f5', 
            padding: '4px 11px',
            borderBottom: '1px solid #d9d9d9',
            fontSize: '12px',
            color: '#595959'
          }}
        >
          {language.toUpperCase()}
        </div>
      )}
      <TextArea
        value={value}
        onChange={handleChange}
        style={{ 
          height, 
          fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace',
          fontSize: '14px',
          lineHeight: '1.5',
          padding: '8px 12px',
          resize: 'vertical',
          border: 'none'
        }}
        placeholder={`// 输入${language || '代码'}...`}
      />
    </div>
  );
};

export default CodeEditor; 