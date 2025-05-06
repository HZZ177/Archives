import React from 'react';
import { Input } from 'antd';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const { TextArea } = Input;

interface PrincipleSectionProps {
  value: string;
  onChange: (value: string) => void;
}

const PrincipleSection: React.FC<PrincipleSectionProps> = ({ value, onChange }) => {
  // 富文本编辑器配置
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'color': [] }, { 'background': [] }],
      ['link', 'image', 'code-block'],
      ['clean']
    ]
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet', 'indent',
    'color', 'background',
    'link', 'image', 'code-block'
  ];

  return (
    <div className="section-content">
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder="请输入模块的实现原理和技术细节..."
        style={{ height: '300px', marginBottom: '50px' }}
      />
    </div>
  );
};

export default PrincipleSection; 