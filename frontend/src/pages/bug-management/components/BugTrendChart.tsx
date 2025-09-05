import React from 'react';
import { Card, Typography, Empty, Spin } from 'antd';
import { Line } from '@ant-design/plots';
import {
  LineChartOutlined
} from '@ant-design/icons';
import { TrendDataPoint } from '../../../types/bug-analysis';

const { Title } = Typography;

interface BugTrendChartProps {
  data: TrendDataPoint[];
  loading?: boolean;
}

const BugTrendChart: React.FC<BugTrendChartProps> = ({
  data,
  loading = false
}) => {
  // 转换数据格式为图表需要的格式
  const chartData = data.flatMap(item => [
    {
      date: item.date,
      type: '总缺陷',
      value: item.totalBugs,
      category: 'total'
    },
    {
      date: item.date,
      type: '新增缺陷',
      value: item.newBugs,
      category: 'new'
    },
    {
      date: item.date,
      type: '已解决',
      value: item.resolvedBugs,
      category: 'resolved'
    },
    {
      date: item.date,
      type: '待处理',
      value: item.pendingBugs,
      category: 'pending'
    }
  ]);

  // 图表配置
  const config = {
    data: chartData,
    xField: 'date',
    yField: 'value',
    seriesField: 'type',
    smooth: true,
    animation: {
      appear: {
        animation: 'path-in',
        duration: 1000,
      },
    },
    color: ['#1890ff', '#52c41a', '#faad14', '#ff4d4f'],
    point: {
      size: 3,
      shape: 'circle',
    },
    lineStyle: {
      lineWidth: 2,
    },
    xAxis: {
      type: 'time',
      tickCount: 7,
      label: {
        formatter: (text: string) => {
          const date = new Date(text);
          return `${date.getMonth() + 1}/${date.getDate()}`;
        },
      },
    },
    yAxis: {
      label: {
        formatter: (text: string) => {
          return parseInt(text).toString();
        },
      },
      grid: {
        line: {
          style: {
            stroke: '#f0f0f0',
            lineWidth: 1,
            lineDash: [4, 5],
          },
        },
      },
    },
    legend: {
      position: 'top',
      offsetY: -10,
    },
    tooltip: {
      shared: true,
      showMarkers: true,
      customContent: (title: string, items: any[]) => {
        if (!items || items.length === 0) return '';

        const date = new Date(title);
        const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        let content = `<div style="padding: 8px;">`;
        content += `<div style="margin-bottom: 4px; font-weight: bold;">${formattedDate}</div>`;

        items.forEach(item => {
          const color = item.color || '#1890ff';
          content += `<div style="display: flex; align-items: center; margin: 2px 0;">`;
          content += `<span style="display: inline-block; width: 8px; height: 8px; background-color: ${color}; border-radius: 50%; margin-right: 6px;"></span>`;
          content += `<span>${item.name}: ${item.value} 个</span>`;
          content += `</div>`;
        });

        content += `</div>`;
        return content;
      },
    },
    interactions: [
      {
        type: 'marker-active',
      },
      {
        type: 'brush',
      },
    ],
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
        <div className="trend-chart">
          {data.length > 0 ? (
            <Line {...config} />
          ) : (
            <Empty 
              description="暂无趋势数据" 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                alignItems: 'center',
                height: '200px'
              }} 
            />
          )}
        </div>
      </Spin>


    </Card>
  );
};

export default BugTrendChart;
