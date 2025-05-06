import React, { useState } from 'react';
import { Upload, Button, message, Image } from 'antd';
import { UploadOutlined, InboxOutlined } from '@ant-design/icons';
import { RcFile, UploadChangeParam } from 'antd/lib/upload';
import { uploadDiagramImage } from '../../../../apis/moduleService';

interface DiagramSectionProps {
  moduleNodeId: number;
  imagePath: string;
  onImagePathChange: (path: string) => void;
}

const DiagramSection: React.FC<DiagramSectionProps> = ({ 
  moduleNodeId, 
  imagePath, 
  onImagePathChange 
}) => {
  const [uploading, setUploading] = useState<boolean>(false);

  // 处理图片上传
  const handleUpload = async (file: RcFile) => {
    try {
      setUploading(true);
      const response = await uploadDiagramImage(moduleNodeId, file);
      onImagePathChange(response.diagram_image_path || '');
      message.success('上传成功');
      setUploading(false);
      return false; // 阻止默认上传行为
    } catch (error) {
      console.error('上传失败:', error);
      message.error('上传失败');
      setUploading(false);
      return false;
    }
  };

  // 上传前验证
  const beforeUpload = (file: RcFile) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件!');
      return false;
    }
    
    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error('图片必须小于5MB!');
      return false;
    }
    
    return handleUpload(file);
  };

  return (
    <div className="section-content">
      {imagePath ? (
        <div style={{ marginBottom: '16px' }}>
          <Image 
            src={imagePath} 
            alt="模块逻辑图" 
            style={{ maxWidth: '100%' }} 
          />
          <div style={{ marginTop: '16px' }}>
            <Upload
              name="file"
              showUploadList={false}
              beforeUpload={beforeUpload}
              disabled={uploading}
            >
              <Button 
                icon={<UploadOutlined />} 
                loading={uploading}
              >
                更换图片
              </Button>
            </Upload>
          </div>
        </div>
      ) : (
        <Upload.Dragger
          name="file"
          multiple={false}
          showUploadList={false}
          beforeUpload={beforeUpload}
          disabled={uploading}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持单个图片上传，格式包括：JPG/JPEG、PNG、GIF、SVG
          </p>
        </Upload.Dragger>
      )}
    </div>
  );
};

export default DiagramSection; 