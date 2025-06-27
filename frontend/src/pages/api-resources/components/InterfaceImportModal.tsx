import React, { useState } from 'react';
import { 
  Modal, 
  Upload, 
  Button, 
  Space, 
  Alert, 
  Typography, 
  List, 
  Checkbox, 
  Spin, 
  message, 
  Tag,
  Divider
} from 'antd';
import { 
  InboxOutlined, 
  FileTextOutlined, 
  ImportOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { RcFile } from 'antd/lib/upload';
import { ImportPreviewItem, ImportResult, parseOpenApi } from '../../../utils/openApiParser';
import { createInterface } from '../../../services/workspaceInterfaceService';

const { Dragger } = Upload;
const { Title, Text, Paragraph } = Typography;

interface InterfaceImportModalProps {
  visible: boolean;
  onCancel: () => void;
  workspaceId?: number;
  onSuccess: () => void;
}

/**
 * 接口导入Modal组件
 */
const InterfaceImportModal: React.FC<InterfaceImportModalProps> = ({
  visible, 
  onCancel, 
  workspaceId, 
  onSuccess
}) => {
  const [fileList, setFileList] = useState<RcFile[]>([]);
  const [importing, setImporting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ImportResult | null>(null);
  const [previewList, setPreviewList] = useState<ImportPreviewItem[]>([]);
  
  // 上传文件前的验证
  const beforeUpload = (file: RcFile) => {
    // 验证文件类型
    const isJSON = file.type === 'application/json' || file.name.endsWith('.json');
    if (!isJSON) {
      message.error('只能上传JSON格式的文件!');
      return false;
    }
    
    // 验证文件大小
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('文件不能超过2MB!');
      return false;
    }
    
    // 设置文件列表
    setFileList([file]);
    
    // 返回false阻止自动上传
    return false;
  };
  
  // 移除文件
  const handleRemove = () => {
    setFileList([]);
    setParseResult(null);
    setPreviewList([]);
  };
  
  // 开始解析文件
  const handleParse = async () => {
    if (fileList.length === 0) {
      message.error('请先选择文件');
      return;
    }
    
    try {
      setParsing(true);
      
      // 读取文件内容
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const fileContent = e.target?.result as string;
          const result = parseOpenApi(fileContent);
          
          setParseResult(result);
          setPreviewList(result.previewList);
          
          if (!result.success) {
            message.error(result.message);
          }
        } catch (error) {
          message.error('解析文件失败');
          console.error('解析文件失败:', error);
        } finally {
          setParsing(false);
        }
      };
      
      reader.onerror = () => {
        message.error('读取文件失败');
        setParsing(false);
      };
      
      reader.readAsText(fileList[0]);
    } catch (error) {
      message.error('解析文件失败');
      console.error('解析文件失败:', error);
      setParsing(false);
    }
  };
  
  // 切换接口选中状态
  const toggleSelect = (index: number) => {
    const newList = [...previewList];
    newList[index].selected = !newList[index].selected;
    setPreviewList(newList);
  };
  
  // 全选/取消全选
  const toggleSelectAll = (checked: boolean) => {
    setPreviewList(previewList.map(item => ({
      ...item,
      selected: checked
    })));
  };
  
  // 获取选中的接口数量
  const getSelectedCount = () => {
    return previewList.filter(item => item.selected).length;
  };
  
  // 导入选中的接口
  const handleImport = async () => {
    if (!workspaceId) {
      message.error('未选择工作区');
      return;
    }
    
    const selectedInterfaces = previewList.filter(item => item.selected);
    
    if (selectedInterfaces.length === 0) {
      message.error('请至少选择一个接口');
      return;
    }
    
    try {
      setImporting(true);
      
      // 创建导入进度状态
      const importTotal = selectedInterfaces.length;
      let importSuccess = 0;
      let importFailed = 0;
      
      // 逐个导入接口
      for (const item of selectedInterfaces) {
        try {
          await createInterface(workspaceId, {
            workspace_id: workspaceId,
            path: item.path,
            method: item.method,
            description: item.description,
            content_type: item.content_type,
            request_params_json: item.request_params_json,
            response_params_json: item.response_params_json
          });
          
          importSuccess++;
        } catch (error) {
          console.error('导入接口失败:', error, item);
          importFailed++;
        }
      }
      
      if (importFailed === 0) {
        message.success(`成功导入 ${importSuccess} 个接口`);
      } else {
        message.warning(`导入完成，成功 ${importSuccess} 个，失败 ${importFailed} 个`);
      }
      
      onSuccess();
      handleClose();
    } catch (error) {
      message.error('导入接口失败');
      console.error('导入接口失败:', error);
    } finally {
      setImporting(false);
    }
  };
  
  // 关闭弹窗并重置状态
  const handleClose = () => {
    setFileList([]);
    setParseResult(null);
    setPreviewList([]);
    onCancel();
  };
  
  // 获取HTTP方法对应的颜色
  const getMethodColor = (method: string) => {
    const methodColors: Record<string, string> = {
      GET: 'green',
      POST: 'blue',
      PUT: 'orange',
      DELETE: 'red',
      PATCH: 'purple'
    };
    
    return methodColors[method.toUpperCase()] || 'default';
  };
  
  // 渲染文件上传区域
  const renderUploader = () => {
    return (
      <div>
        <Alert
          message="支持的文件格式"
          description="目前支持上传Swagger 2.0/OpenAPI 3.0格式的JSON文件。请确保文件格式正确，大小不超过2MB。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Dragger
          name="file"
          multiple={false}
          fileList={fileList}
          beforeUpload={beforeUpload}
          onRemove={handleRemove}
          accept=".json,application/json"
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持单个文件上传，仅支持JSON格式
          </p>
        </Dragger>
        
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Space>
            <Button onClick={handleClose}>取消</Button>
            <Button 
              type="primary" 
              onClick={handleParse} 
              disabled={fileList.length === 0 || parsing}
              loading={parsing}
            >
              开始解析
            </Button>
          </Space>
        </div>
      </div>
    );
  };
  
  // 渲染接口预览列表
  const renderPreviewList = () => {
    if (!parseResult || !parseResult.success) {
      return null;
    }
    
    const selectedCount = getSelectedCount();
    
    return (
      <div>
        <Alert
          message="解析成功"
          description={`共解析出 ${previewList.length} 个接口，请选择需要导入的接口。`}
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <div style={{ marginBottom: 16 }}>
          <Checkbox
            checked={selectedCount === previewList.length}
            indeterminate={selectedCount > 0 && selectedCount < previewList.length}
            onChange={e => toggleSelectAll(e.target.checked)}
          >
            全选
          </Checkbox>
          <Text type="secondary" style={{ marginLeft: 8 }}>
            已选择 {selectedCount} / {previewList.length} 个接口
          </Text>
        </div>
        
        <div style={{ maxHeight: 400, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 4, padding: '0 8px' }}>
          <List
            dataSource={previewList}
            renderItem={(item, index) => (
              <List.Item key={`${item.path}_${item.method}`}>
                <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <Checkbox
                    checked={item.selected}
                    onChange={() => toggleSelect(index)}
                    style={{ marginRight: 8 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Tag color={getMethodColor(item.method)} style={{ marginRight: 8 }}>
                        {item.method}
                      </Tag>
                      <Text strong style={{ flex: 1 }}>
                        {item.path}
                      </Text>
                    </div>
                    {item.description && (
                      <div style={{ marginTop: 4 }}>
                        <Text type="secondary">{item.description}</Text>
                      </div>
                    )}
                  </div>
                </div>
              </List.Item>
            )}
          />
        </div>
        
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Space>
            <Button onClick={() => {
              setParseResult(null);
              setPreviewList([]);
            }}>
              返回
            </Button>
            <Button 
              type="primary" 
              icon={<ImportOutlined />}
              onClick={handleImport}
              disabled={selectedCount === 0 || importing}
              loading={importing}
            >
              导入选中接口
            </Button>
          </Space>
        </div>
      </div>
    );
  };
  
  return (
    <Modal
      title={
        <div>
          <Space>
            <ImportOutlined />
            <span>导入接口</span>
          </Space>
        </div>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={800}
      destroyOnClose
    >
      {parseResult && parseResult.success ? renderPreviewList() : renderUploader()}
      
      {parsing && (
        <div style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(255, 255, 255, 0.7)', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{ textAlign: 'center' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>正在解析文件，请稍候...</div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default InterfaceImportModal; 