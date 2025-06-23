import React, { useState, useEffect } from 'react';
import { 
  Form, 
  Input, 
  Button, 
  Space, 
  message, 
  Spin, 
  Tabs, 
  Table, 
  Select, 
  Checkbox, 
  Tooltip, 
  Divider 
} from 'antd';
import { 
  PlusOutlined, 
  MinusCircleOutlined, 
  InfoCircleOutlined, 
  QuestionCircleOutlined 
} from '@ant-design/icons';
import { WorkspaceTable, WorkspaceTableDetail } from '../../../types/workspace';
import { createTable, updateTable, getTableDetail } from '../../../services/workspaceTableService';

const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

interface TableFormProps {
  workspaceId?: number;
  initialValues: WorkspaceTable | null;
  onSuccess: () => void;
  onCancel: () => void;
}

// 数据库字段类型选项
const FIELD_TYPE_OPTIONS = [
  { label: 'VARCHAR', value: 'varchar' },
  { label: 'CHAR', value: 'char' },
  { label: 'TEXT', value: 'text' },
  { label: 'TINYTEXT', value: 'tinytext' },
  { label: 'MEDIUMTEXT', value: 'mediumtext' },
  { label: 'LONGTEXT', value: 'longtext' },
  { label: 'INT', value: 'int' },
  { label: 'TINYINT', value: 'tinyint' },
  { label: 'SMALLINT', value: 'smallint' },
  { label: 'MEDIUMINT', value: 'mediumint' },
  { label: 'BIGINT', value: 'bigint' },
  { label: 'FLOAT', value: 'float' },
  { label: 'DOUBLE', value: 'double' },
  { label: 'DECIMAL', value: 'decimal' },
  { label: 'DATE', value: 'date' },
  { label: 'DATETIME', value: 'datetime' },
  { label: 'TIMESTAMP', value: 'timestamp' },
  { label: 'TIME', value: 'time' },
  { label: 'YEAR', value: 'year' },
  { label: 'BOOLEAN', value: 'boolean' },
  { label: 'JSON', value: 'json' },
  { label: 'ENUM', value: 'enum' },
  { label: 'SET', value: 'set' },
  { label: 'BLOB', value: 'blob' },
  { label: 'BINARY', value: 'binary' },
  { label: 'VARBINARY', value: 'varbinary' },
];

const TableForm: React.FC<TableFormProps> = ({ 
  workspaceId, 
  initialValues, 
  onSuccess, 
  onCancel 
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [tableDetail, setTableDetail] = useState<WorkspaceTableDetail | null>(null);
  
  // 如果是编辑模式，加载表详情
  useEffect(() => {
    const fetchTableDetail = async () => {
      if (initialValues?.id) {
        try {
          setDetailLoading(true);
          const detail = await getTableDetail(initialValues.id);
          setTableDetail(detail);
          
          // 设置表单初始值
          form.setFieldsValue({
            table_name: detail.name,
            schema_name: detail.schema_name,
            description: detail.description,
            columns: detail.columns || []
          });
        } catch (error) {
          console.error('获取表详情失败:', error);
          message.error('获取表详情失败，请稍后重试');
        } finally {
          setDetailLoading(false);
        }
      } else {
        // 新建表，初始化一个空字段
        form.setFieldsValue({
          columns: [{ 
            field_name: '', 
            field_type: 'varchar',
            length: 255,
            nullable: true,
            is_primary_key: false,
            is_unique: false,
            is_index: false
          }]
        });
      }
    };
    
    fetchTableDetail();
  }, [initialValues, form]);
  
  // 表单提交
  const handleSubmit = async (values: any) => {
    if (!workspaceId) {
      message.error('未选择工作区');
      return;
    }
    
    try {
      setLoading(true);
      
      // 准备提交数据
      const tableData = {
        name: values.table_name,
        schema_name: values.schema_name,
        description: values.description,
        columns_json: values.columns.map((column: any) => ({
          field_name: column.field_name,
          field_type: column.field_type,
          length: column.length ? parseInt(column.length) : undefined,
          nullable: column.nullable,
          default_value: column.default_value,
          description: column.description,
          is_primary_key: column.is_primary_key,
          is_unique: column.is_unique,
          is_index: column.is_index,
          foreign_key: column.reference_table && column.reference_column ? {
            reference_table: column.reference_table,
            reference_column: column.reference_column
          } : undefined
        }))
      };
      
      if (initialValues?.id) {
        // 更新表
        await updateTable(initialValues.id, tableData);
        message.success('表更新成功');
      } else {
        // 创建表
        await createTable(workspaceId, {
          ...tableData,
          workspace_id: workspaceId
        });
        message.success('表创建成功');
      }
      
      onSuccess();
    } catch (error) {
      console.error('保存表失败:', error);
      message.error('保存失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  
  // 添加字段
  const addField = () => {
    const columns = form.getFieldValue('columns') || [];
    form.setFieldsValue({
      columns: [...columns, { 
        field_name: '', 
        field_type: 'varchar',
        length: 255,
        nullable: true,
        is_primary_key: false,
        is_unique: false,
        is_index: false
      }]
    });
  };
  
  // 删除字段
  const removeField = (index: number) => {
    const columns = form.getFieldValue('columns');
    form.setFieldsValue({
      columns: columns.filter((_: any, i: number) => i !== index)
    });
  };
  
  // 渲染字段表单
  const renderColumnFields = () => {
    return (
      <Form.List name="columns">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <div key={key} style={{ marginBottom: 16, padding: 16, border: '1px dashed #d9d9d9', borderRadius: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <h4>字段 #{name + 1}</h4>
                  <Button 
                    type="text" 
                    danger 
                    icon={<MinusCircleOutlined />} 
                    onClick={() => remove(name)}
                    disabled={fields.length === 1}
                  >
                    删除
                  </Button>
                </div>
                
                <Form.Item
                  {...restField}
                  name={[name, 'field_name']}
                  label="字段名"
                  rules={[{ required: true, message: '请输入字段名' }]}
                >
                  <Input placeholder="字段名" />
                </Form.Item>
                
                <div style={{ display: 'flex', gap: 8 }}>
                  <Form.Item
                    {...restField}
                    name={[name, 'field_type']}
                    label="字段类型"
                    rules={[{ required: true, message: '请选择字段类型' }]}
                    style={{ flex: 1 }}
                  >
                    <Select placeholder="选择字段类型">
                      {FIELD_TYPE_OPTIONS.map(option => (
                        <Option key={option.value} value={option.value}>
                          {option.label}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                  
                  <Form.Item
                    {...restField}
                    name={[name, 'length']}
                    label="长度/精度"
                    style={{ flex: 1 }}
                  >
                    <Input type="number" placeholder="长度/精度" />
                  </Form.Item>
                </div>
                
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <Form.Item
                    {...restField}
                    name={[name, 'nullable']}
                    valuePropName="checked"
                    style={{ marginBottom: 0 }}
                  >
                    <Checkbox>允许为空</Checkbox>
                  </Form.Item>
                  
                  <Form.Item
                    {...restField}
                    name={[name, 'is_primary_key']}
                    valuePropName="checked"
                    style={{ marginBottom: 0 }}
                  >
                    <Checkbox>主键</Checkbox>
                  </Form.Item>
                  
                  <Form.Item
                    {...restField}
                    name={[name, 'is_unique']}
                    valuePropName="checked"
                    style={{ marginBottom: 0 }}
                  >
                    <Checkbox>唯一</Checkbox>
                  </Form.Item>
                  
                  <Form.Item
                    {...restField}
                    name={[name, 'is_index']}
                    valuePropName="checked"
                    style={{ marginBottom: 0 }}
                  >
                    <Checkbox>索引</Checkbox>
                  </Form.Item>
                </div>
                
                <Form.Item
                  {...restField}
                  name={[name, 'default_value']}
                  label="默认值"
                >
                  <Input placeholder="默认值" />
                </Form.Item>
                
                <Form.Item
                  {...restField}
                  name={[name, 'description']}
                  label="描述"
                >
                  <Input placeholder="字段描述" />
                </Form.Item>
                
                <Divider orientation="left" plain>外键关系（可选）</Divider>
                
                <div style={{ display: 'flex', gap: 8 }}>
                  <Form.Item
                    {...restField}
                    name={[name, 'reference_table']}
                    label="引用表"
                    style={{ flex: 1 }}
                  >
                    <Input placeholder="引用表名" />
                  </Form.Item>
                  
                  <Form.Item
                    {...restField}
                    name={[name, 'reference_column']}
                    label="引用字段"
                    style={{ flex: 1 }}
                  >
                    <Input placeholder="引用字段名" />
                  </Form.Item>
                </div>
              </div>
            ))}
            
            <Form.Item>
              <Button 
                type="dashed" 
                onClick={() => add()} 
                block 
                icon={<PlusOutlined />}
              >
                添加字段
              </Button>
            </Form.Item>
          </>
        )}
      </Form.List>
    );
  };
  
  // 渲染加载状态
  if (initialValues?.id && detailLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '30px 0' }}>
        <Spin tip="加载表详情..." />
      </div>
    );
  }
  
  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        table_name: initialValues?.name || '',
        schema_name: initialValues?.schema_name || '',
        description: initialValues?.description || '',
      }}
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="基本信息" key="basic">
          <Form.Item
            name="table_name"
            label="表名"
            rules={[{ required: true, message: '请输入表名' }]}
          >
            <Input placeholder="表名" />
          </Form.Item>
          
          <Form.Item
            name="schema_name"
            label="模式名称"
          >
            <Input placeholder="模式名称（可选）" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="表描述"
          >
            <TextArea rows={4} placeholder="表描述（可选）" />
          </Form.Item>
        </TabPane>
        
        <TabPane tab="字段定义" key="columns">
          {renderColumnFields()}
        </TabPane>
      </Tabs>
      
      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            {initialValues ? '更新' : '创建'}
          </Button>
        </Space>
      </div>
    </Form>
  );
};

export default TableForm; 