import React, { useMemo, useRef } from 'react';
import { Card, Typography, Empty, Spin } from 'antd';
import ReactECharts from 'echarts-for-react';
import {
  LineChartOutlined
} from '@ant-design/icons';

const { Title } = Typography;

interface PriorityTrendDataPoint {
  date: string;
  [priority: string]: string | number; // 动态优先级字段，存储累计数量
}

interface PriorityTrendChartProps {
  data: PriorityTrendDataPoint[];
  loading?: boolean;
}

// 定义优先级颜色映射
const PRIORITY_COLOR_PALETTE: Record<string, string> = {
  '紧急': '#ff4d4f',
  '最高': '#ff7875', 
  '高': '#ffa940',
  '中': '#1890ff',
  '低': '#52c41a',
  '未指定': '#d9d9d9'
};

const PriorityTrendChart: React.FC<PriorityTrendChartProps> = ({
  data,
  loading = false
}) => {
  const chartRef = useRef<any>(null);



  // 从数据中提取所有优先级
  const priorities = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    const prioritySet = new Set<string>();
    data.forEach(item => {
      Object.keys(item).forEach(key => {
        if (key !== 'date') {
          prioritySet.add(key);
        }
      });
    });

    // 按优先级重要性排序
    const priorityOrder = ['紧急', '最高', '高', '中', '低', '未指定'];
    return Array.from(prioritySet).sort((a, b) => {
      const indexA = priorityOrder.indexOf(a);
      const indexB = priorityOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [data]);

  // 计算Y轴范围
  const calculateYAxisRange = (visiblePriorities: string[]) => {
    if (!data || data.length === 0 || visiblePriorities.length === 0) {
      return { min: 0, max: 10 };
    }

    const allValues: number[] = [];
    visiblePriorities.forEach(priority => {
      data.forEach(item => {
        const value = item[priority];
        if (typeof value === 'number') {
          allValues.push(value);
        }
      });
    });

    if (allValues.length === 0) {
      return { min: 0, max: 10 };
    }

    const maxValue = Math.max(...allValues);
    const minValue = Math.min(...allValues);
    
    // 添加一些边距
    const range = maxValue - minValue;
    const padding = Math.max(1, range * 0.1);
    
    return {
      min: Math.max(0, Math.floor(minValue - padding)),
      max: Math.ceil(maxValue + padding)
    };
  };

  const chartOption = useMemo(() => {
    if (!data || data.length === 0) {
      return {};
    }

    // 提取日期
    const dates = data.map(item => item.date);

    // 为每个优先级准备数据
    const seriesData = priorities.map(priority => {
      const values = data.map(item => {
        const value = item[priority];
        return typeof value === 'number' ? value : 0;
      });

      return {
        name: priority,
        type: 'line',
        data: values,
        smooth: false,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          width: 3,
          color: PRIORITY_COLOR_PALETTE[priority] || '#1890ff'
        },
        itemStyle: {
          color: PRIORITY_COLOR_PALETTE[priority] || '#1890ff',
          borderColor: '#fff',
          borderWidth: 2
        },
        emphasis: {
          focus: 'series'
        }
      };
    });

    // 初始Y轴范围
    const initialRange = calculateYAxisRange(priorities);

    const chartConfig = {
      color: priorities.map(priority => PRIORITY_COLOR_PALETTE[priority] || '#1890ff'),
      title: {
        show: false
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: '#6a7985'
          }
        },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return '';

          const date = params[0].axisValue;
          let content = `<div style="padding: 8px;">`;
          content += `<div style="margin-bottom: 8px; font-weight: bold; color: #262626; border-bottom: 1px solid #f0f0f0; padding-bottom: 4px;">${date} 累计缺陷数</div>`;

          // 按优先级重要性排序
          const sortedParams = params.sort((a, b) => {
            return priorities.indexOf(a.seriesName) - priorities.indexOf(b.seriesName);
          });

          sortedParams.forEach(param => {
            const color = param.color;
            content += `<div style="margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between;">`;
            content += `<span style="display: flex; align-items: center;">`;
            content += `<span style="display: inline-block; width: 10px; height: 10px; background-color: ${color}; border-radius: 50%; margin-right: 8px;"></span>`;
            content += `<span style="color: #595959;">${param.seriesName}</span>`;
            content += `</span>`;
            content += `<span style="font-weight: bold; color: #262626; margin-left: 16px;">${param.value}</span>`;
            content += `</div>`;
          });

          content += `</div>`;
          return content;
        }
      },
      legend: {
        show: true,
        data: priorities,
        top: 10,
        left: 'center',
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 20,
        textStyle: {
          fontSize: 12,
          color: '#666'
        },
        itemStyle: {
          borderWidth: 0
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '15%', // 增加顶部空间以容纳图例
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates,
        axisLine: {
          lineStyle: {
            color: '#d9d9d9'
          }
        },
        axisLabel: {
          color: '#666',
          fontSize: 12,
          rotate: dates.length > 10 ? 45 : 0
        }
      },
      yAxis: {
        type: 'value',
        min: initialRange.min,
        max: initialRange.max,
        axisLine: {
          lineStyle: {
            color: '#d9d9d9'
          }
        },
        axisLabel: {
          color: '#666',
          fontSize: 12
        },
        splitLine: {
          lineStyle: {
            color: '#f0f0f0',
            type: 'dashed'
          }
        }
      },
      series: seriesData
    };

    return chartConfig;
  }, [data, priorities]);

  // 处理图例切换事件
  const onEvents = {
    'legendselectchanged': (params: any) => {
      const chart = chartRef.current?.getEchartsInstance();
      if (!chart) return;

      // 获取当前显示的系列
      const visiblePriorities = Object.keys(params.selected).filter(
        key => params.selected[key]
      );

      // 重新计算Y轴范围
      const newRange = calculateYAxisRange(visiblePriorities);

      // 更新Y轴配置
      chart.setOption({
        yAxis: {
          min: newRange.min,
          max: newRange.max
        }
      });
    }
  };

  return (
    <div style={{ height: '400px', width: '100%' }}>
      <Spin spinning={loading}>
        {data.length > 0 ? (
          <ReactECharts
            ref={chartRef}
            option={chartOption}
            style={{ height: '400px', width: '100%' }}
            opts={{ renderer: 'canvas' }}
            onEvents={onEvents}
            key={`priority-trend-chart-${data.length}-${JSON.stringify(data[0])}`}
          />
        ) : (
          <Empty
            description="暂无趋势数据"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              height: '350px'
            }}
          />
        )}
      </Spin>
    </div>
  );
};

export default PriorityTrendChart;
