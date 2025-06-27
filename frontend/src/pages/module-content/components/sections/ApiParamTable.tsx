import React, { useState, useEffect } from 'react';
import { Table, Input, Select, Button, Form, Space, Tooltip } from 'antd';
import { DeleteOutlined, PlusOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import { ApiParam, PARAM_TYPES } from '../../../../types/modules';

const { Option } = Select;

interface ApiParamTableProps {
  value?: ApiParam[];
  onChange?: (params: ApiParam[]) => void;
  readOnly?: boolean;
  title?: string;
  isResponse?: boolean;
}

// 为参数添加唯一标识和层级信息
interface KeyedApiParam extends ApiParam {
  key: string;
  path: number[];
  level: number;
}

/**
 * 接口参数表格组件
 * 用于编辑接口的请求参数或响应参数
 * 支持嵌套参数层级
 */
const ApiParamTable: React.FC<ApiParamTableProps> = ({
  value = [],
  onChange,
  readOnly = false,
  title = '参数',
  isResponse = false
}) => {
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

  // 递归为数据添加key, path, level
  const addKeys = (params: ApiParam[], parentPath: number[] = [], level = 0): KeyedApiParam[] => {
    if (!Array.isArray(params)) {
      console.warn('ApiParamTable: value is not an array, using empty array instead', params);
      return [];
    }
    
    return params.map((param, index) => {
      const currentPath = [...parentPath, index];
      const key = currentPath.join('-');
      const newParam: KeyedApiParam = {
        ...param,
        key,
        path: currentPath,
        level: level,
      };
      if (param.children) {
        newParam.children = addKeys(param.children, currentPath, level + 1);
      }
      return newParam;
    });
  };

  // 确保value是数组
  const safeValue = Array.isArray(value) ? value : [];
  const dataSourceWithKeys = addKeys(safeValue);

  // 更新参数（支持多层级）
  const handleParamChange = (path: number[], field: keyof ApiParam, fieldValue: any) => {
    const newParams: ApiParam[] = JSON.parse(JSON.stringify(safeValue));
    let currentLevel: any = newParams;
    
    path.forEach((p, i) => {
      if (i < path.length - 1) {
        currentLevel = currentLevel[p].children || [];
      } else {
        // 更新目标节点
        currentLevel[p] = { ...currentLevel[p], [field]: fieldValue };

        // 如果类型变更为 object/array 且原本没有children，则添加
        if (
            field === 'type' && 
            (fieldValue === 'object' || fieldValue === 'array') && 
            !currentLevel[p].children
        ) {
            currentLevel[p].children = [];
        }
      }
    });

    onChange?.(newParams);
  };
  
  // 函数：添加顶层参数
  const handleAddParam = () => {
    const newParam: ApiParam = {
      name: '',
      type: 'string',
      required: false,
      description: '',
      example: ''
    };
    onChange?.([...safeValue, newParam]);
  };

  // 函数：添加子参数
  const handleAddChild = (path: number[]) => {
    const newParams: ApiParam[] = JSON.parse(JSON.stringify(safeValue));
    
    let targetNode: ApiParam | undefined;
    let currentLevel: ApiParam[] = newParams;

    // 遍历路径，找到目标父节点
    for (let i = 0; i < path.length; i++) {
        const index = path[i];
        if (!currentLevel || !currentLevel[index]) {
            console.error("添加子参数失败：无效的路径", path);
            return;
        }
        targetNode = currentLevel[index];
        // 如果不是路径的最后一部分，则深入到下一层的 children
        if (i < path.length - 1) {
            currentLevel = targetNode.children!;
        }
    }

    if (targetNode) {
      if (!targetNode.children) {
        targetNode.children = [];
      }
      targetNode.children.push({
        name: '',
        type: 'string',
        required: false,
        description: '',
        example: ''
      });
      
      const key = path.join('-');
      // 自动展开父节点
      if (!expandedRowKeys.includes(key)) {
        setExpandedRowKeys([...expandedRowKeys, key]);
      }
      onChange?.(newParams);
    }
  };

  // 删除参数
  const handleDelete = (path: number[]) => {
    const newParams = JSON.parse(JSON.stringify(safeValue));
    if (path.length === 1) {
      newParams.splice(path[0], 1);
    } else {
      let parent = newParams;
      for (let i = 0; i < path.length - 2; i++) {
        parent = parent[path[i]].children!;
      }
      parent[path[path.length - 2]].children!.splice(path[path.length - 1], 1);
    }
    onChange?.(newParams);
  };

  // 安全处理expandedRowsChange，确保keys是数组
  const handleExpandedRowsChange = (keys: readonly React.Key[]) => {
    if (Array.isArray(keys)) {
      setExpandedRowKeys([...keys]);
    } else {
      console.warn('expandedRowKeys is not an array:', keys);
      setExpandedRowKeys([]);
    }
  };

  const columns: any[] = [
    {
      title: '参数名',
      dataIndex: 'name',
      key: 'name',
      width: '30%',
      className: 'param-name-cell',
      render: (text: string, record: KeyedApiParam) => (
        <div style={{ paddingLeft: record.level * 24 }}>
          {readOnly ? text : (
            <Input
              value={text}
              onChange={(e) => handleParamChange(record.path, 'name', e.target.value)}
              placeholder="参数名称"
            />
          )}
        </div>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: '15%',
      render: (text: string, record: KeyedApiParam) => (
        readOnly ? text : (
          <Select
            value={text}
            style={{ width: '100%' }}
            onChange={(value) => handleParamChange(record.path, 'type', value)}
          >
            {PARAM_TYPES.map((type) => (
              <Option key={type} value={type}>{type}</Option>
            ))}
          </Select>
        )
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string, record: KeyedApiParam) => (
        readOnly ? text : (
          <Input value={text} onChange={(e) => handleParamChange(record.path, 'description', e.target.value)} placeholder="参数描述" />
        )
      )
    },
    {
      title: '示例值',
      dataIndex: 'example',
      key: 'example',
      width: '20%',
      render: (text: string, record: KeyedApiParam) => (
        readOnly ? text : (
          <Input value={text} onChange={(e) => handleParamChange(record.path, 'example', e.target.value)} placeholder="示例值" />
        )
      )
    }
  ];
  
  // 如果不是响应参数，在"类型"列后插入"必填"列
  if (!isResponse) {
    columns.splice(2, 0, {
        title: '必填',
        dataIndex: 'required',
        key: 'required',
        width: '10%',
        render: (required: boolean, record: KeyedApiParam) => (
            readOnly ? (required ? '是' : '否') : (
                <Select
                    value={required}
                    style={{ width: '100%' }}
                    onChange={(val) => handleParamChange(record.path, 'required', val)}
                >
                    <Option value={true}>是</Option>
                    <Option value={false}>否</Option>
                </Select>
            )
        )
    });
  }

  // 如果是编辑模式，在最后添加"操作"列
  if (!readOnly) {
    columns.push({
      title: '操作',
      key: 'action',
      width: '80px',
      align: 'center',
      render: (_: any, record: KeyedApiParam) => {
        const hasAddChildButton = record.type === 'object' || record.type === 'array';
        
        return (
          <div className="param-action-buttons">
            {hasAddChildButton ? (
              <Space size={4}>
                <Tooltip title="添加子参数">
                  <Button type="text" icon={<PlusOutlined />} onClick={() => handleAddChild(record.path)} size="small" />
                </Tooltip>
                <Tooltip title="删除">
                  <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.path)} size="small" />
                </Tooltip>
              </Space>
            ) : (
              <Tooltip title="删除">
                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.path)} size="small" />
              </Tooltip>
            )}
          </div>
        );
      }
    });
  }
  
  return (
    <div className="api-param-table-container">
      <Table
        rowKey="key"
        dataSource={dataSourceWithKeys}
        columns={columns}
        pagination={false}
        size="small"
        bordered
        tableLayout="fixed"
        locale={{ emptyText: <div className="api-param-empty">暂无参数</div> }}
        expandable={{
          expandedRowKeys: expandedRowKeys,
          onExpandedRowsChange: handleExpandedRowsChange,
        }}
      />
      {!readOnly && (
        <Button
          type="dashed"
          onClick={handleAddParam}
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