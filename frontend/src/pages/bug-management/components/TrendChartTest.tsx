import React from 'react';
import BugTrendChart from './BugTrendChart';
import { TrendDataPoint } from '../../../types/bug-analysis';

// 测试数据
const testData: TrendDataPoint[] = [
  {
    date: '2024-01-01',
    totalBugs: 45,
    newBugs: 5,
    resolvedBugs: 30,
    pendingBugs: 15
  },
  {
    date: '2024-01-02',
    totalBugs: 48,
    newBugs: 8,
    resolvedBugs: 32,
    pendingBugs: 16
  },
  {
    date: '2024-01-03',
    totalBugs: 52,
    newBugs: 12,
    resolvedBugs: 35,
    pendingBugs: 17
  },
  {
    date: '2024-01-04',
    totalBugs: 49,
    newBugs: 3,
    resolvedBugs: 38,
    pendingBugs: 11
  },
  {
    date: '2024-01-05',
    totalBugs: 46,
    newBugs: 2,
    resolvedBugs: 40,
    pendingBugs: 6
  },
  {
    date: '2024-01-06',
    totalBugs: 44,
    newBugs: 1,
    resolvedBugs: 42,
    pendingBugs: 2
  },
  {
    date: '2024-01-07',
    totalBugs: 43,
    newBugs: 0,
    resolvedBugs: 43,
    pendingBugs: 0
  }
];

const TrendChartTest: React.FC = () => {
  return (
    <div style={{ padding: '20px', height: '100vh' }}>
      <h2>趋势图表测试 - 最新颜色修复</h2>
      <div style={{ marginBottom: '20px' }}>
        <p><strong>🎨 最新修复方案：</strong></p>
        <ul>
          <li>✅ 在数据中直接添加color字段</li>
          <li>✅ 使用colorField配置</li>
          <li>✅ 使用datum.color设置线条和点的颜色</li>
          <li>✅ 添加详细调试信息</li>
        </ul>
        <p><strong>🌈 预期颜色：</strong></p>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div><span style={{color: '#1890ff', fontSize: '20px'}}>●</span> 总缺陷 (蓝色)</div>
          <div><span style={{color: '#ff4d4f', fontSize: '20px'}}>●</span> 新增缺陷 (红色)</div>
          <div><span style={{color: '#52c41a', fontSize: '20px'}}>●</span> 已解决 (绿色)</div>
          <div><span style={{color: '#faad14', fontSize: '20px'}}>●</span> 待处理 (橙色)</div>
        </div>
        <p style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
          📊 请查看控制台的"Unique types in data"确认数据结构
        </p>
      </div>
      <div style={{ height: '500px', border: '1px solid #d9d9d9', borderRadius: '6px', padding: '16px' }}>
        <BugTrendChart data={testData} loading={false} />
      </div>
    </div>
  );
};

export default TrendChartTest;
