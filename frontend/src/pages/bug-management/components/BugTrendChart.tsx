import React, { useMemo, useRef, useEffect } from 'react';
import { Card, Typography, Empty, Spin } from 'antd';
import ReactECharts from 'echarts-for-react';
import {
  LineChartOutlined
} from '@ant-design/icons';
import { TrendDataPoint } from '../../../types/bug-analysis';

const { Title } = Typography;

interface BugTrendChartProps {
  data: TrendDataPoint[];
  loading?: boolean;
}

// 定义颜色映射 - 确保与图例完全一致
const COLOR_PALETTE = {
  '总缺陷': '#1890ff',
  '新增缺陷': '#ff4d4f',
  '已解决': '#52c41a',
  '待处理': '#faad14'
};

// 定义系列顺序
const SERIES_ORDER = ['总缺陷', '新增缺陷', '已解决', '待处理'];

const BugTrendChart: React.FC<BugTrendChartProps> = ({
  data,
  loading = false
}) => {
  const chartRef = useRef<any>(null);

  // 计算Y轴范围的函数
  const calculateYAxisRange = (visibleSeries: string[]) => {
    if (!data || data.length === 0 || visibleSeries.length === 0) {
      return { min: 0, max: 10 };
    }

    const allValues: number[] = [];

    visibleSeries.forEach(seriesName => {
      switch(seriesName) {
        case '总缺陷':
          allValues.push(...data.map(item => item.totalBugs));
          break;
        case '新增缺陷':
          allValues.push(...data.map(item => item.newBugs));
          break;
        case '已解决':
          allValues.push(...data.map(item => item.resolvedBugs));
          break;
        case '待处理':
          allValues.push(...data.map(item => item.pendingBugs));
          break;
      }
    });

    if (allValues.length === 0) {
      return { min: 0, max: 10 };
    }

    const maxValue = Math.max(...allValues);
    const minValue = Math.min(...allValues);
    const range = maxValue - minValue;
    const padding = Math.max(1, Math.ceil(range * 0.1));

    return {
      min: Math.max(0, minValue - padding),
      max: maxValue + padding
    };
  };

  // 为ECharts准备数据格式
  const chartOption = useMemo(() => {
    if (!data || data.length === 0) {
      return {};
    }

    // 提取日期作为X轴
    const dates = data.map(item => item.date);

    // 为每个系列准备数据
    const seriesData = SERIES_ORDER.map(seriesName => {
      let values: number[] = [];

      switch(seriesName) {
        case '总缺陷':
          values = data.map(item => item.totalBugs);
          break;
        case '新增缺陷':
          values = data.map(item => item.newBugs);
          break;
        case '已解决':
          values = data.map(item => item.resolvedBugs);
          break;
        case '待处理':
          values = data.map(item => item.pendingBugs);
          break;
      }

      return {
        name: seriesName,
        type: 'line',
        data: values,
        smooth: false,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          width: 3,
          color: COLOR_PALETTE[seriesName as keyof typeof COLOR_PALETTE]
        },
        itemStyle: {
          color: COLOR_PALETTE[seriesName as keyof typeof COLOR_PALETTE],
          borderColor: '#fff',
          borderWidth: 2
        },
        emphasis: {
          focus: 'series'
        }
      };
    });

    // 初始Y轴范围（基于所有系列）
    const initialRange = calculateYAxisRange(SERIES_ORDER);

    return {
      // 设置全局颜色调色板，确保图例颜色正确
      color: SERIES_ORDER.map(name => COLOR_PALETTE[name as keyof typeof COLOR_PALETTE]),
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
          content += `<div style="margin-bottom: 8px; font-weight: bold; color: #262626; border-bottom: 1px solid #f0f0f0; padding-bottom: 4px;">${date}</div>`;

          // 按照固定顺序排序
          const sortedParams = params.sort((a, b) => {
            return SERIES_ORDER.indexOf(a.seriesName) - SERIES_ORDER.indexOf(b.seriesName);
          });

          sortedParams.forEach(param => {
            content += `<div style="display: flex; align-items: center; justify-content: space-between; margin: 4px 0; padding: 2px 0;">`;
            content += `<div style="display: flex; align-items: center;">`;
            content += `<span style="display: inline-block; width: 10px; height: 10px; background-color: ${param.color}; border-radius: 50%; margin-right: 8px;"></span>`;
            content += `<span style="color: #595959; font-size: 12px;">${param.seriesName}</span>`;
            content += `</div>`;
            content += `<span style="font-weight: bold; color: #262626; font-size: 13px;">${param.value}</span>`;
            content += `</div>`;
          });

          content += `</div>`;
          return content;
        }
      },
      legend: {
        show: true, // 启用ECharts内置图例以支持交互
        top: 10,
        left: 'center',
        itemWidth: 12,
        itemHeight: 12,
        textStyle: {
          fontSize: 12,
          color: '#666'
        },
        // 自定义图例项的样式
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
          formatter: (value: string) => {
            // 处理 YYYY-MM 格式的月份数据
            if (value.match(/^\d{4}-\d{2}$/)) {
              const [year, month] = value.split('-');
              return `${year}-${month}`;
            }
            // 兼容原有的日期格式
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }
            return value;
          }
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
  }, [data]);

  // 处理图例切换事件，动态调整Y轴范围
  const onEvents = {
    'legendselectchanged': (params: any) => {
      const chart = chartRef.current?.getEchartsInstance();
      if (!chart) return;

      // 获取当前显示的系列
      const visibleSeries = Object.keys(params.selected).filter(
        key => params.selected[key]
      );

      // 重新计算Y轴范围
      const newRange = calculateYAxisRange(visibleSeries);

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
    <Card
      className="trend-chart-card"
      title={
        <span>
          <LineChartOutlined /> 缺陷趋势分析
        </span>
      }
      size="small"
    >
      <Spin spinning={loading}>
        <div className="trend-chart-container" style={{ height: '400px', width: '100%' }}>
          {data.length > 0 ? (
            <ReactECharts
              ref={chartRef}
              option={chartOption}
              style={{ height: '400px', width: '100%' }} // 增加高度以容纳内置图例
              opts={{ renderer: 'canvas' }}
              onEvents={onEvents}
              key={`trend-chart-${data.length}-${JSON.stringify(data[0])}`}
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
        </div>
      </Spin>
    </Card>
  );
};

export default BugTrendChart;
