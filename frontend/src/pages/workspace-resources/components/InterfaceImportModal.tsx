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
  Divider,
  Result,
  Collapse,
  Progress
} from 'antd';
import { 
  InboxOutlined, 
  ImportOutlined,
  ApiOutlined,
  FileTextOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { RcFile } from 'antd/lib/upload';
import { ImportPreviewItem, ImportResult, parseOpenApi } from '../../../utils/openApiParser';
import { createWorkspaceInterface, checkInterfaceExists } from '../../../apis/workspaceService';
import { WorkspaceInterfaceCreate } from '../../../types/workspace';

const { Dragger } = Upload;
const { Text } = Typography;
const { Panel } = Collapse;

// 导入结果的接口项
interface ImportResultItem {
  path: string;
  method: string;
  status: 'success' | 'failed' | 'skipped';
  reason?: string;
}

interface InterfaceImportModalProps {
  open: boolean;
  onCancel: () => void;
  workspaceId?: number;
  onSuccess: () => void;
}

/**
 * 接口导入Modal组件（适配workspace-resources）
 */
const InterfaceImportModal: React.FC<InterfaceImportModalProps> = ({
  open,
  onCancel,
  workspaceId,
  onSuccess
}) => {
  const [fileList, setFileList] = useState<RcFile[]>([]);
  const [importing, setImporting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ImportResult | null>(null);
  const [previewList, setPreviewList] = useState<ImportPreviewItem[]>([]);
  
  // 添加导入结果状态
  const [importFinished, setImportFinished] = useState(false);
  const [importResults, setImportResults] = useState<ImportResultItem[]>([]);
  const [importStats, setImportStats] = useState({
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0
  });
  
  // 添加进度状态
  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
    percent: 0
  });
  
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
      let importDuplicated = 0; // 添加重复接口计数
      
      // 初始化进度状态
      setImportProgress({
        current: 0,
        total: importTotal,
        percent: 0
      });
      
      // 存储详细的导入结果
      const results: ImportResultItem[] = [];
      
      // 使用递归函数处理每个接口，确保进度条正确更新
      const processInterface = async (index: number) => {
        if (index >= selectedInterfaces.length) {
          // 所有接口处理完成
          // 设置导入结果状态
          setImportResults(results);
          setImportStats({
            total: importTotal,
            success: importSuccess,
            failed: importFailed,
            skipped: importDuplicated
          });
          setImportFinished(true);
          
          // 调用onSuccess回调，但不关闭弹窗
          if (importSuccess > 0) {
            onSuccess();
          }
          
          setImporting(false);
          return;
        }
        
        const item = selectedInterfaces[index];
        try {
          const interfaceData: WorkspaceInterfaceCreate = {
            workspace_id: workspaceId,
            path: item.path,
            method: item.method,
            description: item.description,
            content_type: item.content_type,
            request_params_json: item.request_params_json,
            response_params_json: item.response_params_json
          };
          
          // 先检查接口是否已存在
          const exists = await checkInterfaceExists(
            workspaceId,
            item.path,
            item.method
          );
          
          if (exists) {
            // 接口已存在，记录为重复
            console.log(`接口已存在，跳过导入: ${item.method} ${item.path}`);
            importDuplicated++;
            results.push({
              path: item.path,
              method: item.method,
              status: 'skipped',
              reason: '接口已存在'
            });
          } else {
            // 接口不存在，创建新接口
            await createWorkspaceInterface(workspaceId, interfaceData);
            importSuccess++;
            results.push({
              path: item.path,
              method: item.method,
              status: 'success'
            });
          }
        } catch (error) {
          console.error('导入接口失败:', error, item);
          importFailed++;
          results.push({
            path: item.path,
            method: item.method,
            status: 'failed',
            reason: error instanceof Error ? error.message : '未知错误'
          });
        }
        
        // 更新进度状态
        const currentProgress = index + 1;
        const percent = Math.floor((currentProgress / importTotal) * 100);
        
        // 使用setTimeout确保UI更新
        setImportProgress({
          current: currentProgress,
          total: importTotal,
          percent
        });
        
        // 使用setTimeout延迟处理下一个接口，确保UI有时间更新
        setTimeout(() => {
          processInterface(index + 1);
        }, 10);
      };
      
      // 开始处理第一个接口
      processInterface(0);
      
    } catch (error) {
      message.error('导入接口失败');
      console.error('导入接口失败:', error);
      setImporting(false);
    }
  };
  
  // 关闭弹窗并重置状态
  const handleClose = () => {
    setFileList([]);
    setParseResult(null);
    setPreviewList([]);
    setImportFinished(false);
    setImportResults([]);
    setImportStats({
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0
    });
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
          showUploadList={false}
        >
          {fileList.length > 0 ? (
            <div style={{ padding: '20px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileTextOutlined style={{ fontSize: 36, color: '#1890ff', marginRight: 16 }} />
                <div style={{ flex: 1 }}>
                  <Text strong>{fileList[0].name}</Text>
                  <div>
                    <Text type="secondary">
                      {(fileList[0].size / 1024).toFixed(2)} KB
                    </Text>
                  </div>
                </div>
                <Button 
                  type="text" 
                  danger 
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleRemove();
                  }}
                  icon={<DeleteOutlined />}
                >
                  删除
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持单个文件上传，仅支持JSON格式
              </p>
            </>
          )}
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
              disabled={getSelectedCount() === 0 || importing}
              loading={importing}
            >
              导入选中接口
            </Button>
          </Space>
        </div>
      </div>
    );
  };
  
  // 渲染导入结果页面
  const renderImportResult = () => {
    const { total, success, failed, skipped } = importStats;
    
    // 过滤不同状态的接口
    const successItems = importResults.filter(item => item.status === 'success');
    const failedItems = importResults.filter(item => item.status === 'failed');
    const skippedItems = importResults.filter(item => item.status === 'skipped');
    
    return (
      <div>
        <Result
          status={failed > 0 ? 'warning' : 'success'}
          title={`导入完成 (${success}/${total})`}
          subTitle={
            <div>
              <div>成功: {success} 个</div>
              <div>失败: {failed} 个</div>
              <div>跳过: {skipped} 个</div>
            </div>
          }
        />
        
        <Divider />
        
        <Collapse defaultActiveKey={failed > 0 ? ['failed'] : []}>
          {success > 0 && (
            <Panel 
              header={<><CheckCircleOutlined style={{ color: '#52c41a' }} /> 成功导入 ({success})</>} 
              key="success"
            >
              <List
                size="small"
                dataSource={successItems}
                renderItem={item => (
                  <List.Item>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <Tag color={getMethodColor(item.method)} style={{ marginRight: 8 }}>
                        {item.method}
                      </Tag>
                      <Text style={{ flex: 1 }}>{item.path}</Text>
                    </div>
                  </List.Item>
                )}
              />
            </Panel>
          )}
          
          {failed > 0 && (
            <Panel 
              header={<><CloseCircleOutlined style={{ color: '#ff4d4f' }} /> 导入失败 ({failed})</>} 
              key="failed"
            >
              <List
                size="small"
                dataSource={failedItems}
                renderItem={item => (
                  <List.Item>
                    <div style={{ display: 'flex', width: '100%', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <Tag color={getMethodColor(item.method)} style={{ marginRight: 8 }}>
                          {item.method}
                        </Tag>
                        <Text style={{ flex: 1 }}>{item.path}</Text>
                      </div>
                      {item.reason && (
                        <div style={{ marginTop: 4, paddingLeft: 8 }}>
                          <Text type="danger">原因: {item.reason}</Text>
                        </div>
                      )}
                    </div>
                  </List.Item>
                )}
              />
            </Panel>
          )}
          
          {skipped > 0 && (
            <Panel 
              header={<><InfoCircleOutlined style={{ color: '#1890ff' }} /> 已跳过 ({skipped})</>} 
              key="skipped"
            >
              <List
                size="small"
                dataSource={skippedItems}
                renderItem={item => (
                  <List.Item>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <Tag color={getMethodColor(item.method)} style={{ marginRight: 8 }}>
                        {item.method}
                      </Tag>
                      <Text style={{ flex: 1 }}>{item.path}</Text>
                      <Text type="secondary">{item.reason}</Text>
                    </div>
                  </List.Item>
                )}
              />
            </Panel>
          )}
        </Collapse>
        
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Button type="primary" onClick={handleClose}>
            确定
          </Button>
        </div>
      </div>
    );
  };
  
  // 渲染导入进度
  const renderImportProgress = () => {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ marginBottom: 20 }}>
          <Text strong>正在导入接口...</Text>
          <div style={{ margin: '16px 0' }}>
            <Text>{`${importProgress.current} / ${importProgress.total}`}</Text>
          </div>
        </div>
        
        <Progress 
          percent={importProgress.percent} 
          status="active" 
          style={{ width: '100%' }}
        />
        
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">请耐心等待，导入完成后将显示详细结果</Text>
        </div>
      </div>
    );
  };
  
  // 渲染Modal内容
  const renderModalContent = () => {
    if (parsing) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin tip="正在解析文件..." />
        </div>
      );
    }
    
    if (importing) {
      return renderImportProgress();
    }
    
    if (importFinished) {
      return renderImportResult();
    }
    
    if (parseResult && parseResult.success && previewList.length > 0) {
      return renderPreviewList();
    }
    
    return renderUploader();
  };
  
  return (
    <Modal
      title={
        <div>
          <Space>
            <ImportOutlined />
            <span>
              {importFinished ? '导入结果' : '导入接口'}
            </span>
          </Space>
        </div>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width={800}
      destroyOnClose
    >
      {renderModalContent()}
    </Modal>
  );
};

export default InterfaceImportModal; 