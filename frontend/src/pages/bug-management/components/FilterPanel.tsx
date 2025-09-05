import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  DatePicker,
  Select,
  Button,
  Space,
  Tag,
  Input
} from 'antd';
import {
  FilterOutlined,
  ClearOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface FilterParams {
  startDate?: string;
  endDate?: string;
  labels?: string[];
  priority?: string;
  status?: string;
}

interface FilterPanelProps {
  filters: FilterParams;
  onChange: (filters: FilterParams) => void;
  loading?: boolean;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onChange,
  loading = false
}) => {
  const [localFilters, setLocalFilters] = useState<FilterParams>(filters);
  const [labelInput, setLabelInput] = useState('');

  // 同步外部filters到本地状态
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // 处理日期范围变化
  const handleDateRangeChange = (dates: any) => {
    if (dates && dates.length === 2) {
      const newFilters = {
        ...localFilters,
        startDate: dates[0].format('YYYY-MM-DD'),
        endDate: dates[1].format('YYYY-MM-DD')
      };
      setLocalFilters(newFilters);
      onChange(newFilters);
    } else {
      const newFilters = {
        ...localFilters,
        startDate: undefined,
        endDate: undefined
      };
      setLocalFilters(newFilters);
      onChange(newFilters);
    }
  };

  // 处理优先级变化
  const handlePriorityChange = (value: string) => {
    const newFilters = {
      ...localFilters,
      priority: value || undefined
    };
    setLocalFilters(newFilters);
    onChange(newFilters);
  };

  // 处理状态变化
  const handleStatusChange = (value: string) => {
    const newFilters = {
      ...localFilters,
      status: value || undefined
    };
    setLocalFilters(newFilters);
    onChange(newFilters);
  };

  // 处理标签输入
  const handleLabelInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLabelInput(e.target.value);
  };

  // 添加标签
  const handleAddLabel = () => {
    if (labelInput.trim()) {
      const currentLabels = localFilters.labels || [];
      if (!currentLabels.includes(labelInput.trim())) {
        const newLabels = [...currentLabels, labelInput.trim()];
        const newFilters = {
          ...localFilters,
          labels: newLabels
        };
        setLocalFilters(newFilters);
        onChange(newFilters);
      }
      setLabelInput('');
    }
  };

  // 移除标签
  const handleRemoveLabel = (labelToRemove: string) => {
    const currentLabels = localFilters.labels || [];
    const newLabels = currentLabels.filter(label => label !== labelToRemove);
    const newFilters = {
      ...localFilters,
      labels: newLabels.length > 0 ? newLabels : undefined
    };
    setLocalFilters(newFilters);
    onChange(newFilters);
  };

  // 清空所有筛选条件
  const handleClearAll = () => {
    const emptyFilters: FilterParams = {};
    setLocalFilters(emptyFilters);
    onChange(emptyFilters);
    setLabelInput('');
  };

  // 获取当前日期范围值
  const getDateRangeValue = (): [dayjs.Dayjs, dayjs.Dayjs] | null => {
    if (localFilters.startDate && localFilters.endDate) {
      return [
        dayjs(localFilters.startDate),
        dayjs(localFilters.endDate)
      ];
    }
    return null;
  };

  return (
    <div className="filter-panel">
      <Row gutter={16} align="top">
        <Col span={6}>
          <div className="filter-item">
            <RangePicker
              value={getDateRangeValue()}
              onChange={handleDateRangeChange}
              format="YYYY-MM-DD"
              placeholder={['开始日期', '结束日期']}
              style={{ width: '100%' }}
              disabled={loading}
              allowEmpty={[true, true]}
            />
          </div>
        </Col>

        <Col span={3}>
          <div className="filter-item">
            <Select
              value={localFilters.priority}
              onChange={handlePriorityChange}
              placeholder="优先级"
              allowClear
              style={{ width: '100%' }}
              disabled={loading}
            >
              <Option value="紧急">紧急</Option>
              <Option value="高">高</Option>
              <Option value="中">中</Option>
              <Option value="低">低</Option>
              <Option value="未指定">未指定</Option>
            </Select>
          </div>
        </Col>

        <Col span={3}>
          <div className="filter-item">
            <Select
              value={localFilters.status}
              onChange={handleStatusChange}
              placeholder="状态"
              allowClear
              style={{ width: '100%' }}
              disabled={loading}
            >
              <Option value="待处理">待处理</Option>
              <Option value="处理中">处理中</Option>
              <Option value="已解决">已解决</Option>
              <Option value="已关闭">已关闭</Option>
            </Select>
          </div>
        </Col>

        <Col span={6}>
          <div className="filter-item">
            <div style={{ display: 'flex', gap: '4px' }}>
              <Input
                value={labelInput}
                onChange={handleLabelInputChange}
                onPressEnter={handleAddLabel}
                placeholder="输入标签名称"
                style={{ flex: 1 }}
                disabled={loading}
              />
              <Button
                type="primary"
                onClick={handleAddLabel}
                disabled={!labelInput.trim() || loading}
                style={{ flexShrink: 0 }}
              >
                添加
              </Button>
            </div>
          </div>
        </Col>

        <Col span={6}>
          <div className="filter-item">
            <div className="filter-actions">
              <Space>
                <Button
                  icon={<ClearOutlined />}
                  onClick={handleClearAll}
                  disabled={loading}
                >
                  清空筛选
                </Button>
              </Space>
            </div>
          </div>
        </Col>
      </Row>

      {/* 显示已选择的标签 */}
      {localFilters.labels && localFilters.labels.length > 0 && (
        <Row style={{ marginTop: 12 }}>
          <Col span={24}>
            <div className="selected-labels">
              <span className="labels-title">已选标签：</span>
              <Space wrap>
                {localFilters.labels.map(label => (
                  <Tag
                    key={label}
                    closable
                    onClose={() => handleRemoveLabel(label)}
                    color="blue"
                  >
                    {label}
                  </Tag>
                ))}
              </Space>
            </div>
          </Col>
        </Row>
      )}


    </div>
  );
};

export default FilterPanel;
