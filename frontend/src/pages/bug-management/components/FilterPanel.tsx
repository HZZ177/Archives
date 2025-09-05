import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  DatePicker,
  Select,
  Button,
  Space,
  Tag,
  Input,
  message
} from 'antd';
import {
  FilterOutlined,
  ClearOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import locale from 'antd/es/date-picker/locale/zh_CN';
import 'dayjs/locale/zh-cn';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import request from '../../../utils/request';
import { unwrapResponse } from '../../../utils/request';

// 设置dayjs为中文
dayjs.locale('zh-cn');

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
  const { currentWorkspace } = useWorkspace();
  const [localFilters, setLocalFilters] = useState<FilterParams>(filters);
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [labelsLoading, setLabelsLoading] = useState(false);

  // 获取可用标签
  const fetchAvailableLabels = async () => {
    if (!currentWorkspace?.id) return;

    setLabelsLoading(true);
    try {
      const response = await request.get('/coding-bugs/available-labels', {
        params: { workspace_id: currentWorkspace.id }
      });

      if (response.data.success) {
        const labels = unwrapResponse(response.data) as string[];
        setAvailableLabels(labels);
      } else {
        message.error(response.data.message || '获取标签失败');
      }
    } catch (error) {
      message.error('获取标签失败');
      console.error('获取可用标签失败:', error);
    } finally {
      setLabelsLoading(false);
    }
  };

  // 同步外部filters到本地状态
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // 获取可用标签
  useEffect(() => {
    fetchAvailableLabels();
  }, [currentWorkspace?.id]);

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

  // 处理标签变化
  const handleLabelsChange = (selectedLabels: string[]) => {
    const newFilters = {
      ...localFilters,
      labels: selectedLabels.length > 0 ? selectedLabels : undefined
    };
    setLocalFilters(newFilters);
    onChange(newFilters);
  };



  // 清空所有筛选条件
  const handleClearAll = () => {
    const emptyFilters: FilterParams = {};
    setLocalFilters(emptyFilters);
    onChange(emptyFilters);
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
              locale={locale}
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
              <Option value="新">新</Option>
              <Option value="待处理">待处理</Option>
              <Option value="处理中">处理中</Option>
              <Option value="已解决">已解决</Option>
              <Option value="已关闭">已关闭</Option>
            </Select>
          </div>
        </Col>

        <Col span={6}>
          <div className="filter-item">
            <Select
              mode="multiple"
              value={localFilters.labels || []}
              onChange={handleLabelsChange}
              placeholder="选择标签"
              style={{ width: '100%' }}
              loading={labelsLoading}
              showSearch
              allowClear
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ||
                (option?.value as string)?.toLowerCase().includes(input.toLowerCase())
              }
              maxTagCount="responsive"
            >
              {availableLabels.map(label => (
                <Option key={label} value={label}>
                  {label}
                </Option>
              ))}
            </Select>
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




    </div>
  );
};

export default FilterPanel;
