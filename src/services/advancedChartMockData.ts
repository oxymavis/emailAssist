import { 
  EmailVolumeData, 
  SentimentData, 
  CategoryData, 
  PriorityHeatmapData, 
  ResponseTimeData, 
  TopSenderData,
  ChartFilter,
  TimeRange 
} from '@/types';
import { format, subDays, addHours } from 'date-fns';

/**
 * 高级图表Mock数据服务
 * 为高级数据可视化仪表板提供模拟数据
 */
export class AdvancedChartMockDataService {
  
  /**
   * 生成邮件量趋势数据
   */
  static getEmailVolumeData(days: number = 30, filters?: ChartFilter[]): EmailVolumeData[] {
    const data: EmailVolumeData[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dayOfWeek = date.getDay();
      
      // 工作日邮件量更多
      const baseVolume = dayOfWeek >= 1 && dayOfWeek <= 5 ? 40 : 15;
      const variance = Math.random() * 20 - 10;
      const total = Math.max(5, Math.floor(baseVolume + variance));
      
      // 计算各个指标
      const received = Math.floor(total * (0.7 + Math.random() * 0.2));
      const sent = total - received;
      const unread = Math.floor(received * (0.1 + Math.random() * 0.3));
      const processed = received - unread;
      
      data.push({
        date: format(date, 'yyyy-MM-dd'),
        total,
        received,
        sent,
        unread,
        processed,
      });
    }
    
    return this.applyFilters(data, filters);
  }

  /**
   * 生成情感分析数据
   */
  static getSentimentData(filters?: ChartFilter[]): SentimentData[] {
    const baseData = [
      {
        sentiment: 'positive' as const,
        count: 120 + Math.floor(Math.random() * 50),
        percentage: 0,
        trend: Math.random() * 20 - 5,
        color: '#4CAF50',
      },
      {
        sentiment: 'neutral' as const,
        count: 80 + Math.floor(Math.random() * 30),
        percentage: 0,
        trend: Math.random() * 10 - 5,
        color: '#FF9800',
      },
      {
        sentiment: 'negative' as const,
        count: 20 + Math.floor(Math.random() * 15),
        percentage: 0,
        trend: Math.random() * 15 - 10,
        color: '#F44336',
      },
    ];

    // 计算百分比
    const total = baseData.reduce((sum, item) => sum + item.count, 0);
    baseData.forEach(item => {
      item.percentage = Math.round((item.count / total) * 100 * 100) / 100;
    });

    return this.applyFilters(baseData, filters);
  }

  /**
   * 生成分类分布数据
   */
  static getCategoryData(filters?: ChartFilter[]): CategoryData[] {
    const categories = [
      { name: 'Work', color: '#2196F3' },
      { name: 'Personal', color: '#4CAF50' },
      { name: 'Marketing', color: '#FF9800' },
      { name: 'Support', color: '#9C27B0' },
      { name: 'Newsletter', color: '#607D8B' },
      { name: 'Notification', color: '#795548' },
      { name: 'Social', color: '#E91E63' },
      { name: 'Finance', color: '#009688' },
    ];

    const data: CategoryData[] = categories.map(cat => {
      const count = Math.floor(Math.random() * 80) + 10;
      return {
        name: cat.name,
        count,
        percentage: 0, // 稍后计算
        color: cat.color,
        subcategories: this.generateSubcategories(cat.name, count),
      };
    });

    // 计算百分比
    const total = data.reduce((sum, item) => sum + item.count, 0);
    data.forEach(item => {
      item.percentage = Math.round((item.count / total) * 100 * 100) / 100;
    });

    return this.applyFilters(data, filters);
  }

  /**
   * 生成子分类数据
   */
  private static generateSubcategories(category: string, totalCount: number): CategoryData[] {
    const subcatMappings: Record<string, string[]> = {
      Work: ['Project Updates', 'Meetings', 'Reports', 'Tasks'],
      Personal: ['Family', 'Friends', 'Health', 'Finance'],
      Marketing: ['Campaigns', 'Analytics', 'Content', 'Social Media'],
      Support: ['Bug Reports', 'Feature Requests', 'Documentation', 'Training'],
      Newsletter: ['Technology', 'Business', 'Design', 'General'],
      Notification: ['System Alerts', 'Security', 'Updates', 'Reminders'],
      Social: ['LinkedIn', 'Twitter', 'Facebook', 'Instagram'],
      Finance: ['Banking', 'Investments', 'Bills', 'Insurance'],
    };

    const subcats = subcatMappings[category] || ['General'];
    let remainingCount = totalCount;
    
    return subcats.map((subcat, index) => {
      const isLast = index === subcats.length - 1;
      const count = isLast ? remainingCount : Math.floor(Math.random() * (remainingCount / 2)) + 1;
      remainingCount -= count;
      
      return {
        name: subcat,
        count,
        percentage: (count / totalCount) * 100,
        color: `hsl(${Math.random() * 360}, 60%, 70%)`,
      };
    });
  }

  /**
   * 生成优先级热力图数据
   */
  static getPriorityHeatmapData(filters?: ChartFilter[]): PriorityHeatmapData[] {
    const data: PriorityHeatmapData[] = [];
    const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const priorities: Array<'low' | 'normal' | 'high' | 'critical'> = ['low', 'normal', 'high', 'critical'];
    
    days.forEach(day => {
      for (let hour = 0; hour < 24; hour++) {
        priorities.forEach(priority => {
          // 工作时间和工作日有更多邮件
          const isWorkDay = !day.includes('周六') && !day.includes('周日');
          const isWorkHour = hour >= 9 && hour <= 18;
          
          let baseCount = 1;
          if (isWorkDay && isWorkHour) {
            baseCount = priority === 'critical' ? 8 : 
                      priority === 'high' ? 15 :
                      priority === 'normal' ? 25 : 10;
          } else {
            baseCount = priority === 'critical' ? 2 : 
                      priority === 'high' ? 5 :
                      priority === 'normal' ? 8 : 3;
          }
          
          const count = Math.floor(Math.random() * baseCount) + 1;
          const maxIntensity = Math.max(...priorities.map(p => p === priority ? count : 0));
          const intensity = count / Math.max(maxIntensity, 1);
          
          data.push({
            hour,
            day,
            priority,
            count,
            intensity: Math.min(intensity, 1),
          });
        });
      }
    });
    
    return this.applyFilters(data, filters);
  }

  /**
   * 生成响应时间数据
   */
  static getResponseTimeData(days: number = 30, filters?: ChartFilter[]): ResponseTimeData[] {
    const data: ResponseTimeData[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const timeRange = format(date, 'MM/dd');
      
      // 工作日响应时间通常更快
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const baseResponseTime = isWeekend ? 3.5 : 2.2;
      
      const avgResponse = baseResponseTime + (Math.random() - 0.5) * 1.5;
      const medianResponse = avgResponse * (0.8 + Math.random() * 0.4);
      const count = Math.floor(Math.random() * 50) + 20;
      
      // 计算趋势（与前一天比较）
      const prevAvg = data.length > 0 ? data[data.length - 1].avgResponse : avgResponse;
      const trend = ((avgResponse - prevAvg) / prevAvg) * 100;
      
      data.push({
        timeRange,
        avgResponse: Math.round(avgResponse * 100) / 100,
        medianResponse: Math.round(medianResponse * 100) / 100,
        count,
        trend: Math.round(trend * 100) / 100,
      });
    }
    
    return this.applyFilters(data, filters);
  }

  /**
   * 生成主要发件人数据
   */
  static getTopSendersData(limit: number = 20, filters?: ChartFilter[]): TopSenderData[] {
    const domains = [
      'company.com', 'client.org', 'service.net', 'newsletter.com', 
      'support.io', 'team.co', 'system.dev', 'partner.biz'
    ];
    
    const firstNames = [
      'John', 'Mary', 'David', 'Sarah', 'Michael', 'Emma', 'James', 'Lisa',
      'Robert', 'Anna', 'William', 'Jennifer', 'Thomas', 'Amy', 'Daniel', 'Linda'
    ];
    
    const data: TopSenderData[] = [];
    
    for (let i = 0; i < limit; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const domain = domains[Math.floor(Math.random() * domains.length)];
      const email = `${firstName.toLowerCase()}@${domain}`;
      
      // 生成邮件数量（遵循幂律分布）
      const count = Math.floor(120 / (i + 1) + Math.random() * 30);
      
      // 响应时间（随机但合理）
      const avgResponseTime = 1 + Math.random() * 4;
      
      // 情感分数（0-1之间）
      const sentimentScore = 0.2 + Math.random() * 0.6;
      
      // 优先级分布
      const total = count;
      const critical = Math.floor(Math.random() * (total * 0.1));
      const high = Math.floor(Math.random() * (total * 0.2));
      const normal = Math.floor((total - critical - high) * 0.7);
      const low = total - critical - high - normal;
      
      data.push({
        name: firstName,
        email,
        count,
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
        sentimentScore: Math.round(sentimentScore * 100) / 100,
        urgencyDistribution: {
          critical: Math.max(0, critical),
          high: Math.max(0, high),
          normal: Math.max(0, normal),
          low: Math.max(0, low),
        },
      });
    }
    
    // 按邮件数量排序
    data.sort((a, b) => b.count - a.count);
    
    return this.applyFilters(data, filters);
  }

  /**
   * 生成时间序列数据（通用）
   */
  static getTimeSeriesData(
    days: number = 30, 
    metricName: string = 'value',
    baseValue: number = 50,
    filters?: ChartFilter[]
  ) {
    const data = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const value = baseValue + (Math.random() - 0.5) * baseValue * 0.4;
      
      data.push({
        date: format(date, 'yyyy-MM-dd'),
        [metricName]: Math.round(value * 100) / 100,
        timestamp: date.getTime(),
      });
    }
    
    return this.applyFilters(data, filters);
  }

  /**
   * 根据时间范围生成小时级别数据
   */
  static getHourlyData(timeRange: TimeRange, metricName: string = 'count') {
    const start = new Date(timeRange.startDate);
    const end = new Date(timeRange.endDate);
    const data = [];
    
    let current = new Date(start);
    while (current <= end) {
      const hour = current.getHours();
      const isBusinessHour = hour >= 9 && hour <= 17;
      const baseValue = isBusinessHour ? 15 : 5;
      const value = baseValue + Math.random() * baseValue * 0.5;
      
      data.push({
        datetime: current.toISOString(),
        hour: format(current, 'HH:mm'),
        [metricName]: Math.floor(value),
      });
      
      current = addHours(current, 1);
    }
    
    return data;
  }

  /**
   * 应用筛选条件（简化版）
   */
  private static applyFilters(data: any[], filters?: ChartFilter[]): any[] {
    if (!filters || filters.length === 0) {
      return data;
    }

    return data.filter(item => {
      return filters.every(filter => {
        const fieldValue = item[filter.field];
        
        if (fieldValue === undefined) {
          return true;
        }
        
        switch (filter.operator) {
          case 'equals':
            return fieldValue === filter.value;
          case 'contains':
            return String(fieldValue).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'in':
            return Array.isArray(filter.value) && filter.value.includes(fieldValue);
          case 'range':
            if (Array.isArray(filter.value) && filter.value.length === 2) {
              const numValue = Number(fieldValue);
              return numValue >= Number(filter.value[0]) && numValue <= Number(filter.value[1]);
            }
            return true;
          default:
            return true;
        }
      });
    });
  }

  /**
   * 生成实时更新数据
   */
  static generateRealtimeUpdate(type: 'email-received' | 'analysis-complete' | 'stats-update') {
    const timestamp = new Date().toISOString();
    
    switch (type) {
      case 'email-received':
        return {
          type,
          timestamp,
          data: {
            email: {
              id: `email-${Date.now()}`,
              subject: `New Email ${Math.floor(Math.random() * 1000)}`,
              sender: {
                name: 'John Doe',
                email: 'john@example.com',
              },
              importance: Math.random() > 0.8 ? 'high' : 'normal',
              receivedDateTime: timestamp,
            },
          },
        };
        
      case 'analysis-complete':
        return {
          type,
          timestamp,
          data: {
            analysis: {
              emailCount: Math.floor(Math.random() * 50) + 10,
              sentiment: {
                positive: Math.random(),
                neutral: Math.random(),
                negative: Math.random(),
              },
              completedAt: timestamp,
            },
          },
        };
        
      case 'stats-update':
        return {
          type,
          timestamp,
          data: {
            stats: {
              totalEmails: Math.floor(Math.random() * 1000) + 500,
              unreadEmails: Math.floor(Math.random() * 50) + 10,
              processedToday: Math.floor(Math.random() * 100) + 20,
              lastSyncTime: timestamp,
            },
            emailVolumeData: this.getEmailVolumeData(7),
            sentimentData: this.getSentimentData(),
          },
        };
    }
  }

  /**
   * 批量生成多种数据
   */
  static generateDashboardData(options: {
    days?: number;
    includeRealtime?: boolean;
    filters?: ChartFilter[];
  } = {}) {
    const { days = 30, includeRealtime = false, filters } = options;
    
    const data = {
      emailVolumeData: this.getEmailVolumeData(days, filters),
      sentimentData: this.getSentimentData(filters),
      categoryData: this.getCategoryData(filters),
      priorityHeatmapData: this.getPriorityHeatmapData(filters),
      responseTimeData: this.getResponseTimeData(days, filters),
      topSendersData: this.getTopSendersData(15, filters),
      generatedAt: new Date().toISOString(),
    };

    if (includeRealtime) {
      // 添加实时更新模拟
      setTimeout(() => {
        // 这里可以触发实时数据更新事件
        console.log('Simulated realtime update:', this.generateRealtimeUpdate('stats-update'));
      }, Math.random() * 10000 + 5000);
    }

    return data;
  }
}

export default AdvancedChartMockDataService;