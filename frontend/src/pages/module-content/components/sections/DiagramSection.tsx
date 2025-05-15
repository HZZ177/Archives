import React, { useState } from 'react';
import { Upload, Button, message, Image, Popconfirm, Space } from 'antd';
import { UploadOutlined, InboxOutlined, DeleteOutlined } from '@ant-design/icons';
import { RcFile, UploadChangeParam } from 'antd/lib/upload';
import { uploadDiagramImage, deleteDiagramImage } from '../../../../apis/moduleService';
import { API_BASE_URL } from '../../../../config/constants';

interface DiagramSectionProps {
  moduleNodeId: number;
  imagePath: string;
  onImagePathChange: (path: string) => void;
}

// 处理图片URL，确保图片能正确显示
const processImageUrl = (url: string) => {
  if (!url) return '';
  
  // 如果是完整的URL，直接返回
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // 如果是以/api开头的URL，使用API_BASE_URL的域名部分
  if (url.startsWith('/api')) {
    // 从API_BASE_URL提取域名部分 (如 http://localhost:8000)
    const baseUrlParts = API_BASE_URL.split('/api');
    const baseUrl = baseUrlParts[0]; // 例如 http://localhost:8000
    return `${baseUrl}${url}`;
  }
  
  // 如果是以/uploads开头的相对URL，使用API_BASE_URL
  if (url.startsWith('/uploads')) {
    // 从API_BASE_URL移除末尾的/api/v1部分
    const baseUrlParts = API_BASE_URL.split('/api');
    const baseUrl = baseUrlParts[0]; // 例如 http://localhost:8000
    return `${baseUrl}${url}`;
  }
  
  // 其他情况，假设是API相对路径，添加完整API_BASE_URL
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const DiagramSection: React.FC<DiagramSectionProps> = ({ 
  moduleNodeId, 
  imagePath, 
  onImagePathChange 
}) => {
  const [uploading, setUploading] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

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

  // 处理图片删除
  const handleDelete = async () => {
    try {
      setDeleting(true);
      const content = await deleteDiagramImage(moduleNodeId);
      onImagePathChange('');
      message.success('图片已删除');
      setDeleting(false);
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
      setDeleting(false);
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

  // 处理完成的图片URL
  const processedImageUrl = processImageUrl(imagePath);
  
  // 添加调试信息，打印处理前后的URL
  console.log('原始图片URL:', imagePath);
  console.log('处理后图片URL:', processedImageUrl);

  return (
    <div className="section-content">
      {imagePath ? (
        <div style={{ marginBottom: '16px' }}>
          <Image 
            src={processedImageUrl} 
            alt="模块逻辑图" 
            style={{ maxWidth: '100%' }} 
          />
          <div style={{ marginTop: '16px' }}>
            <Space>
              <Upload
                name="file"
                showUploadList={false}
                beforeUpload={beforeUpload}
                disabled={uploading || deleting}
              >
                <Button 
                  icon={<UploadOutlined />} 
                  loading={uploading}
                  disabled={deleting}
                >
                  更换图片
                </Button>
              </Upload>
              <Popconfirm
                title="确定要删除图片吗?"
                onConfirm={handleDelete}
                okText="确定"
                cancelText="取消"
              >
                <Button 
                  danger
                  icon={<DeleteOutlined />}
                  loading={deleting}
                  disabled={uploading}
                >
                  删除图片
                </Button>
              </Popconfirm>
            </Space>
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