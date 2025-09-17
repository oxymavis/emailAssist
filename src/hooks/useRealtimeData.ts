import { useEffect, useCallback } from 'react';
import { RealtimeUpdate } from '@/types';
import {
  useChartData,
  useDashboardStats,
  useEmails,
  useNotifications,
  useDashboardFilters,
} from '@/store';
import useWebSocket from './useWebSocket';

interface UseRealtimeDataOptions {
  enabled?: boolean;
  wsUrl?: string;
}

interface UseRealtimeDataReturn {
  isConnected: boolean;
  isConnecting: boolean;
  connectionAttempts: number;
  connect: () => void;
  disconnect: () => void;
}

const useRealtimeData = (options: UseRealtimeDataOptions = {}): UseRealtimeDataReturn => {
  const {
    enabled = true,
    wsUrl = process.env.VITE_WS_URL || 'ws://localhost:3001/ws',
  } = options;

  // Store hooks
  const {
    setEmailVolumeData,
    setSentimentData,
    setCategoryData,
    setPriorityHeatmapData,
    setResponseTimeData,
    setTopSendersData,
  } = useChartData();
  
  const { setStats } = useDashboardStats();
  const { addEmail, setEmails } = useEmails();
  const { addNotification } = useNotifications();
  const { refreshInterval } = useDashboardFilters();

  // 处理实时消息
  const handleRealtimeMessage = useCallback((update: RealtimeUpdate) => {
    console.log('Processing realtime update:', update);

    switch (update.type) {
      case 'email-received':
        // 新邮件接收
        if (update.data.email) {
          addEmail(update.data.email);
          addNotification({
            type: 'info',
            title: 'New Email Received',
            message: `From: ${update.data.email.sender.name}`,
          });
        }
        break;

      case 'analysis-complete':
        // 分析完成
        if (update.data.analysis) {
          addNotification({
            type: 'success',
            title: 'Email Analysis Complete',
            message: `Analysis completed for ${update.data.emailCount} emails`,
          });
        }
        break;

      case 'stats-update':
        // 统计数据更新
        if (update.data.stats) {
          setStats(update.data.stats);
        }

        // 更新图表数据
        if (update.data.emailVolumeData) {
          setEmailVolumeData(update.data.emailVolumeData);
        }
        if (update.data.sentimentData) {
          setSentimentData(update.data.sentimentData);
        }
        if (update.data.categoryData) {
          setCategoryData(update.data.categoryData);
        }
        if (update.data.priorityHeatmapData) {
          setPriorityHeatmapData(update.data.priorityHeatmapData);
        }
        if (update.data.responseTimeData) {
          setResponseTimeData(update.data.responseTimeData);
        }
        if (update.data.topSendersData) {
          setTopSendersData(update.data.topSendersData);
        }
        break;

      default:
        console.warn('Unknown realtime update type:', update.type);
    }
  }, [
    addEmail,
    setStats,
    setEmailVolumeData,
    setSentimentData,
    setCategoryData,
    setPriorityHeatmapData,
    setResponseTimeData,
    setTopSendersData,
    addNotification,
  ]);

  // 连接建立时的回调
  const handleConnect = useCallback(() => {
    console.log('Realtime connection established');
    
    // 发送初始化消息，请求当前数据
    sendMessage({
      type: 'subscribe',
      channels: ['email-updates', 'analysis-updates', 'stats-updates'],
      refreshInterval,
    });

    addNotification({
      type: 'success',
      title: 'Real-time Updates Active',
      message: 'Dashboard will now receive live updates',
    });
  }, [refreshInterval, addNotification]);

  // 连接断开时的回调
  const handleDisconnect = useCallback(() => {
    console.log('Realtime connection lost');
    
    addNotification({
      type: 'warning',
      title: 'Real-time Updates Disabled',
      message: 'Connection lost. Attempting to reconnect...',
    });
  }, [addNotification]);

  // 错误处理
  const handleError = useCallback((error: Event) => {
    console.error('Realtime connection error:', error);
    
    addNotification({
      type: 'error',
      title: 'Connection Error',
      message: 'Failed to connect to real-time data service',
    });
  }, [addNotification]);

  // WebSocket连接
  const {
    isConnected,
    isConnecting,
    connectionAttempts,
    connect,
    disconnect,
    sendMessage,
  } = useWebSocket({
    url: wsUrl,
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
    onMessage: handleRealtimeMessage,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onError: handleError,
    autoConnect: enabled,
  });

  // 模拟实时数据更新（开发模式）
  useEffect(() => {
    if (!enabled || process.env.NODE_ENV !== 'development') return;

    // 模拟定期数据更新
    const simulateUpdates = () => {
      const mockUpdate: RealtimeUpdate = {
        type: 'stats-update',
        timestamp: new Date().toISOString(),
        data: {
          stats: {
            totalEmails: Math.floor(Math.random() * 1000) + 500,
            unreadEmails: Math.floor(Math.random() * 50) + 10,
            processedToday: Math.floor(Math.random() * 100) + 20,
            avgResponseTime: Math.random() * 3 + 1,
            sentimentScore: Math.random() * 5 + 5,
            urgentEmails: Math.floor(Math.random() * 15) + 2,
            automationSavings: Math.floor(Math.random() * 10) + 5,
            lastSyncTime: new Date().toISOString(),
          },
          emailVolumeData: generateMockVolumeData(),
          sentimentData: generateMockSentimentData(),
        },
      };

      handleRealtimeMessage(mockUpdate);
    };

    // 每30秒模拟一次更新
    const interval = setInterval(simulateUpdates, 30000);

    return () => clearInterval(interval);
  }, [enabled, handleRealtimeMessage]);

  // 定期心跳检测
  useEffect(() => {
    if (!isConnected) return;

    const heartbeat = () => {
      sendMessage({ type: 'ping', timestamp: new Date().toISOString() });
    };

    // 每60秒发送一次心跳
    const interval = setInterval(heartbeat, 60000);

    return () => clearInterval(interval);
  }, [isConnected, sendMessage]);

  return {
    isConnected,
    isConnecting,
    connectionAttempts,
    connect,
    disconnect,
  };
};

// 生成模拟邮件量数据
function generateMockVolumeData() {
  const data = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    data.push({
      date: date.toISOString().split('T')[0],
      total: Math.floor(Math.random() * 50) + 20,
      received: Math.floor(Math.random() * 40) + 15,
      sent: Math.floor(Math.random() * 20) + 5,
      unread: Math.floor(Math.random() * 10) + 2,
      processed: Math.floor(Math.random() * 35) + 10,
    });
  }
  return data;
}

// 生成模拟情感数据
function generateMockSentimentData() {
  return [
    {
      sentiment: 'positive' as const,
      count: Math.floor(Math.random() * 100) + 50,
      percentage: Math.floor(Math.random() * 30) + 50,
      trend: Math.random() * 20 - 10,
      color: '#4CAF50',
    },
    {
      sentiment: 'neutral' as const,
      count: Math.floor(Math.random() * 80) + 30,
      percentage: Math.floor(Math.random() * 25) + 25,
      trend: Math.random() * 10 - 5,
      color: '#FF9800',
    },
    {
      sentiment: 'negative' as const,
      count: Math.floor(Math.random() * 30) + 5,
      percentage: Math.floor(Math.random() * 15) + 5,
      trend: Math.random() * 15 - 7.5,
      color: '#F44336',
    },
  ];
}

export default useRealtimeData;