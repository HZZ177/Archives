import React, { useState } from 'react';
import { Table, Typography, Button } from 'antd';
import { CaretRightOutlined, CaretDownOutlined } from '@ant-design/icons';
import { ApiParam } from '../../../types/modules';
import styles from './RecursiveParamTable.module.css';

const { Text } = Typography;

// 定义常量
const INDENT_BASE = 20; // 基础缩进值
const EXPAND_BUTTON_WIDTH = 26; // 展开按钮宽度 + 右边距 (22px + 4px)

interface RecursiveParamTableProps {
  params: ApiParam[];
  showRequired?: boolean; // 是否显示"必填"列，请求参数需要，响应参数不需要
}

const RecursiveParamTable: React.FC<RecursiveParamTableProps> = ({ params, showRequired = true }) => {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // 切换展开/折叠状态
  const toggleExpand = (paramPath: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [paramPath]: !prev[paramPath]
    }));
  };

  // 计算缩进值，考虑展开按钮的宽度
  const calculateIndent = (level: number) => {
    if (level === 0) return 0;
    // 每一级嵌套都增加一个展开按钮的宽度
    return level * EXPAND_BUTTON_WIDTH;
  };

  // 递归渲染参数行
  const renderParamRows = (params: ApiParam[], parentPath: string = '', level: number = 0): React.ReactNode[] => {
    return params.flatMap((param, index) => {
      const currentPath = parentPath ? `${parentPath}.${param.name}` : param.name;
      const isExpanded = expandedRows[currentPath] || false;
      const hasChildren = param.children && param.children.length > 0;
      
      const rows = [];
      
      // 当前参数行
      rows.push(
        <tr key={currentPath} className={level > 0 ? styles.nestedRow : ''}>
          <td className={styles.nameColumn}>
            <div className={styles.nameCell} style={{ paddingLeft: `${calculateIndent(level)}px` }}>
              {hasChildren && (
                <Button 
                  type="text" 
                  size="small" 
                  icon={isExpanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
                  onClick={() => toggleExpand(currentPath)}
                  className={styles.expandButton}
                />
              )}
              <Text 
                strong={level === 0}
                className={hasChildren ? styles.objectName : ''}
              >
                {param.name}
              </Text>
            </div>
          </td>
          <td className={styles.typeCell}>
            <Text code>{param.type}</Text>
          </td>
          {showRequired && (
            <td className={styles.requiredColumn}>{param.required ? '是' : '否'}</td>
          )}
          <td className={styles.descriptionColumn}>{param.description || '-'}</td>
        </tr>
      );
      
      // 如果有子参数且当前展开，则递归渲染子参数
      if (hasChildren && isExpanded) {
        rows.push(...renderParamRows(param.children!, currentPath, level + 1));
      }
      
      return rows;
    });
  };

  // 表头配置
  const columns = [
    { title: '参数名', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type' },
    ...(showRequired ? [{ title: '必填', dataIndex: 'required', key: 'required' }] : []),
    { title: '说明', dataIndex: 'description', key: 'description' }
  ];

  return (
    <table className={styles.paramTable}>
      <thead>
        <tr>
          <th className={styles.nameColumn}>参数名</th>
          <th className={styles.typeCell}>类型</th>
          {showRequired && <th className={styles.requiredColumn}>必填</th>}
          <th className={styles.descriptionColumn}>说明</th>
        </tr>
      </thead>
      <tbody>
        {params.length > 0 ? (
          renderParamRows(params)
        ) : (
          <tr>
            <td colSpan={showRequired ? 4 : 3} className={styles.noParams}>
              无参数
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};

export default RecursiveParamTable; 