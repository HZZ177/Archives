import React from 'react';
import { Table, Input, Select, Button, Form, Space } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { ApiParam, PARAM_TYPES } from '../../../../types/modules';

const { Option } = Select;

interface ApiParamTableProps {
  value?: ApiParam[];
  onChange?: (params: ApiParam[]) => void;
  readOnly?: boolean;
  title?: string;
}

/**
 * 接口参数表格组件
 * 用于编辑接口的请求参数或响应参数
 */
const ApiParamTable: React.FC<ApiParamTableProps> = ({
  value = [],
  onChange,
  readOnly = false,
  title = '参数'
}) => {
  // 添加参数
  const handleAdd = () => {
    const newParam: ApiParam = {
      name: '',
      type: 'string',
      required: false,
      description: ''
    };
    onChange?.([...value, newParam]);
  };

  // 删除参数
  const handleDelete = (index: number) => {
    const newParams = [...value];
    newParams.splice(index, 1);
    onChange?.(newParams);
  };

  // 更新参数
  const handleChange = (index: number, field: keyof ApiParam, fieldValue: any) => {
    const newParams = [...value];
    newParams[index] = {
      ...newParams[index],
      [field]: fieldValue
    };
    onChange?.(newParams);
  };

  // 表格列配置
  const columns = [
    {
      title: '参数名',
      dataIndex: 'name',
      key: 'name',
      width: '20%',
      render: (text: string, _: any, index: number) => (
        readOnly ? text : (
          <Input
            value={text}
            onChange={(e) => handleChange(index, 'name', e.target.value)}
            placeholder="参数名称"
          />
        )
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: '15%',
      render: (text: string, _: any, index: number) => (
        readOnly ? text : (
          <Select
            value={text}
            style={{ width: '100%' }}
            onChange={(value) => handleChange(index, 'type', value)}
          >
            {PARAM_TYPES.map((type) => (
              <Option key={type} value={type}>{type}</Option>
            ))}
          </Select>
        )
      )
    },
    {
      title: '必填',
      dataIndex: 'required',
      key: 'required',
      width: '10%',
      render: (required: boolean, _: any, index: number) => (
        readOnly ? (required ? '是' : '否') : (
          <Select
            value={required}
            style={{ width: '100%' }}
            onChange={(value) => handleChange(index, 'required', value)}
          >
            <Option value={true}>是</Option>
            <Option value={false}>否</Option>
          </Select>
        )
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string, _: any, index: number) => (
        readOnly ? text : (
          <Input
            value={text}
            onChange={(e) => handleChange(index, 'description', e.target.value)}
            placeholder="参数描述"
          />
        )
      )
    },
    {
      title: '示例值',
      dataIndex: 'example',
      key: 'example',
      render: (text: string, _: any, index: number) => (
        readOnly ? text : (
          <Input
            value={text}
            onChange={(e) => handleChange(index, 'example', e.target.value)}
            placeholder="示例值"
          />
        )
      )
    }
  ];

  // 如果是编辑模式，添加操作列
  if (!readOnly) {
    columns.push({
      title: '操作',
      key: 'action',
      dataIndex: 'action',
      width: '10%',
      render: (_: any, __: any, index: number) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(index)}
        />
      )
    });
  }

  return (
    <div className="api-param-table-container">
      {title && <div className="api-param-title">{title}</div>}
      <Table
        rowKey={(_, index) => `param-${index}`}
        dataSource={value}
        columns={columns}
        pagination={false}
        size="small"
        bordered
        locale={{
          emptyText: <div className="api-param-empty">暂无参数</div>
        }}
      />
      {!readOnly && (
        <Button
          type="dashed"
          onClick={handleAdd}
          style={{ marginTop: 8, width: '100%' }}
          icon={<PlusOutlined />}
        >
          添加参数
        </Button>
      )}
    </div>
  );
};

export default ApiParamTable; 