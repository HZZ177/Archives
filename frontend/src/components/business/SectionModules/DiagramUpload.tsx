import React, { useState } from 'react';
import { Card, Upload, Button, Space, Typography, message, Image } from 'antd';
import { UploadOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { UPLOAD_MAX_SIZE, ALLOWED_IMAGE_TYPES } from '../../../config/constants';

const { Title } = Typography;
const { Dragger } = Upload;

interface DiagramUploadProps {
  section: any;
  onUpload: (file: File) => Promise<void>;
  onDelete: (imageId: number) => Promise<void>;
  isEditable?: boolean;
}

/**
 * 逻辑图/数据流向图上传组件
 * 用于上传和展示模块的逻辑图或数据流向图
 */
const DiagramUpload: React.FC<DiagramUploadProps> = ({
  section,
  onUpload,
  onDelete,
  isEditable = true,
}) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  // 处理上传前的验证
  const beforeUpload = (file: File) => {
    // 检查文件类型
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      message.error('只能上传JPG/PNG/GIF图片格式!');
      return Upload.LIST_IGNORE;
    }
    
    // 检查文件大小
    if (file.size > UPLOAD_MAX_SIZE) {
      message.error(`图片必须小于 ${UPLOAD_MAX_SIZE / 1024 / 1024}MB!`);
      return Upload.LIST_IGNORE;
    }
    
    return true;
  };

  // 自定义上传逻辑
  const customUpload: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
    if (!(file instanceof File)) return;
    
    try {
      setUploading(true);
      await onUpload(file);
      setUploading(false);
      onSuccess?.(null);
      message.success('图片上传成功');
    } catch (error) {
      setUploading(false);
      onError?.(error as Error);
      message.error('图片上传失败');
    }
  };

  // 处理文件删除
  const handleDelete = async (image: any) => {
    try {
      await onDelete(image.id);
      message.success('图片删除成功');
    } catch (error) {
      message.error('图片删除失败');
    }
  };

  // 渲染上传区域
  const renderUploadArea = () => {
    if (!isEditable) return null;
    
    return (
      <Dragger
        name="file"
        beforeUpload={beforeUpload}
        customRequest={customUpload}
        fileList={fileList}
        onChange={({ fileList }) => setFileList(fileList)}
        showUploadList={false}
        disabled={uploading}
        accept="image/*"
      >
        <p className="ant-upload-drag-icon">
          <UploadOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">支持单个或批量上传，仅限图片文件</p>
      </Dragger>
    );
  };

  // 渲染图片列表
  const renderImageList = () => {
    if (!section.images || section.images.length === 0) {
      return <div>暂无图片，请上传图片</div>;
    }

    return (
      <div style={{ marginTop: 16 }}>
        {section.images.map((image: any) => (
          <div key={image.id} style={{ position: 'relative', marginBottom: 16 }}>
            <Image
              src={image.file_path}
              alt={image.original_name || '流程图'}
              style={{ maxWidth: '100%' }}
            />
            {isEditable && (
              <Button
                danger
                type="primary"
                icon={<DeleteOutlined />}
                style={{ position: 'absolute', top: 8, right: 8 }}
                onClick={() => handleDelete(image)}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card
      title={
        <Space>
          <span style={{ color: '#1890ff', marginRight: '8px' }}>2</span>
          <Title level={5} style={{ margin: 0 }}>逻辑图/数据流向图</Title>
        </Space>
      }
      extra={isEditable && (
        <Upload
          beforeUpload={beforeUpload}
          customRequest={customUpload}
          showUploadList={false}
          disabled={uploading}
          accept="image/*"
        >
          <Button icon={<PlusOutlined />} loading={uploading}>
            添加图片
          </Button>
        </Upload>
      )}
    >
      {section.images && section.images.length > 0 ? (
        renderImageList()
      ) : (
        renderUploadArea()
      )}
    </Card>
  );
};

export default DiagramUpload; 