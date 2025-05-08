/**
 * 格式化日期时间
 * @param dateString ISO格式的日期字符串或Date对象
 * @param format 格式化选项，默认为'datetime'，可选值：'date'(仅日期),'time'(仅时间),'datetime'(日期和时间)
 * @returns 格式化后的日期字符串，如果输入无效返回'-'
 */
export function formatDate(dateString: string | Date | undefined | null, format: 'date' | 'time' | 'datetime' = 'datetime'): string {
  if (!dateString) return '-';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) return '-';
    
    // 配置格式化选项
    const options: Intl.DateTimeFormatOptions = {
      hour12: false // 使用24小时制
    };
    
    if (format === 'date' || format === 'datetime') {
      options.year = 'numeric';
      options.month = '2-digit';
      options.day = '2-digit';
    }
    
    if (format === 'time' || format === 'datetime') {
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.second = '2-digit';
    }
    
    return date.toLocaleString('zh-CN', options);
  } catch (error) {
    console.error('日期格式化错误:', error);
    return '-';
  }
} 