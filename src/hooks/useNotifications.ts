import { useState, useEffect, useCallback, useRef } from 'react';
import NotificationService, { NotificationData } from '@/services/notificationService';

export interface UseNotificationsOptions {
  types?: string[];
  categories?: string[];
  priorities?: string[];
  autoSubscribe?: boolean;
  maxNotifications?: number;
  enableSound?: boolean;
  enableDesktop?: boolean;
}

export interface UseNotificationsReturn {
  notifications: NotificationData[];
  unreadCount: number;
  isConnected: boolean;
  isOnline: boolean;
  stats: any;
  subscribe: () => string | null;
  unsubscribe: () => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  sendTestNotification: () => void;
  requestNotificationPermission: () => Promise<NotificationPermission>;
  playNotificationSound: () => void;
}

const useNotifications = (options: UseNotificationsOptions = {}): UseNotificationsReturn => {
  const {
    types = [],
    categories = [],
    priorities = [],
    autoSubscribe = true,
    maxNotifications = 50,
    enableSound = true,
    enableDesktop = true,
  } = options;

  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [stats, setStats] = useState<any>({});

  const subscriptionIdRef = useRef<string | null>(null);
  const notificationServiceRef = useRef<NotificationService | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 初始化通知服务
  useEffect(() => {
    notificationServiceRef.current = NotificationService.getInstance();

    // 初始化音频
    if (enableSound) {
      audioRef.current = new Audio('/notification-sound.mp3');
      audioRef.current.preload = 'auto';
    }

    // 加载初始通知
    const initialNotifications = notificationServiceRef.current.getNotifications(maxNotifications);
    setNotifications(initialNotifications);

    // 获取统计信息
    setStats(notificationServiceRef.current.getStats());

    // 监听连接状态
    const handleConnected = () => setIsConnected(true);
    const handleDisconnected = () => setIsConnected(false);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    notificationServiceRef.current.on('connected', handleConnected);
    notificationServiceRef.current.on('disconnected', handleDisconnected);
    notificationServiceRef.current.on('online', handleOnline);
    notificationServiceRef.current.on('offline', handleOffline);

    // 监听网络状态
    const handleNetworkOnline = () => setIsOnline(true);
    const handleNetworkOffline = () => setIsOnline(false);

    window.addEventListener('online', handleNetworkOnline);
    window.addEventListener('offline', handleNetworkOffline);

    return () => {
      notificationServiceRef.current?.off('connected', handleConnected);
      notificationServiceRef.current?.off('disconnected', handleDisconnected);
      notificationServiceRef.current?.off('online', handleOnline);
      notificationServiceRef.current?.off('offline', handleOffline);

      window.removeEventListener('online', handleNetworkOnline);
      window.removeEventListener('offline', handleNetworkOffline);
    };
  }, [maxNotifications, enableSound]);

  // 处理新通知
  const handleNotification = useCallback((notification: NotificationData) => {
    setNotifications(prev => {
      const filtered = prev.filter(n => n.id !== notification.id);
      const updated = [notification, ...filtered].slice(0, maxNotifications);
      return updated;
    });

    // 播放声音
    if (enableSound && audioRef.current) {
      audioRef.current.play().catch(() => {
        // 忽略自动播放限制错误
      });
    }

    // 显示桌面通知
    if (enableDesktop && 'Notification' in window && Notification.permission === 'granted') {
      const desktopNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: notification.id,
        requireInteraction: notification.priority === 'critical',
        timestamp: notification.timestamp.getTime(),
      });

      // 处理点击事件
      desktopNotification.onclick = () => {
        window.focus();
        if (notification.actionUrl) {
          window.open(notification.actionUrl, '_blank');
        }
        desktopNotification.close();
      };

      // 自动关闭非关键通知
      if (notification.priority !== 'critical') {
        setTimeout(() => {
          desktopNotification.close();
        }, 5000);
      }
    }

    // 更新统计信息
    setStats(notificationServiceRef.current?.getStats() || {});
  }, [maxNotifications, enableSound, enableDesktop]);

  // 订阅通知
  const subscribe = useCallback(() => {
    if (!notificationServiceRef.current || subscriptionIdRef.current) {
      return subscriptionIdRef.current;
    }

    subscriptionIdRef.current = notificationServiceRef.current.subscribe(
      types,
      categories,
      priorities,
      handleNotification
    );

    return subscriptionIdRef.current;
  }, [types, categories, priorities, handleNotification]);

  // 取消订阅
  const unsubscribe = useCallback(() => {
    if (notificationServiceRef.current && subscriptionIdRef.current) {
      notificationServiceRef.current.unsubscribe(subscriptionIdRef.current);
      subscriptionIdRef.current = null;
    }
  }, []);

  // 自动订阅
  useEffect(() => {
    if (autoSubscribe) {
      subscribe();
    }

    return () => {
      if (autoSubscribe) {
        unsubscribe();
      }
    };
  }, [autoSubscribe, subscribe, unsubscribe]);

  // 删除通知
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    setReadNotifications(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });

    notificationServiceRef.current?.removeNotification(id);
  }, []);

  // 清除所有通知
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setReadNotifications(new Set());
    notificationServiceRef.current?.clearAllNotifications();
  }, []);

  // 标记为已读
  const markAsRead = useCallback((id: string) => {
    setReadNotifications(prev => new Set([...prev, id]));
    notificationServiceRef.current?.markAsRead(id);
  }, []);

  // 标记所有为已读
  const markAllAsRead = useCallback(() => {
    const allIds = new Set(notifications.map(n => n.id));
    setReadNotifications(allIds);

    notifications.forEach(n => {
      notificationServiceRef.current?.markAsRead(n.id);
    });
  }, [notifications]);

  // 发送测试通知
  const sendTestNotification = useCallback(() => {
    notificationServiceRef.current?.sendTestNotification();
  }, []);

  // 请求通知权限
  const requestNotificationPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    return permission;
  }, []);

  // 播放通知声音
  const playNotificationSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        console.warn('Failed to play notification sound');
      });
    }
  }, []);

  // 计算未读数量
  const unreadCount = notifications.filter(n => !readNotifications.has(n.id)).length;

  return {
    notifications,
    unreadCount,
    isConnected,
    isOnline,
    stats,
    subscribe,
    unsubscribe,
    removeNotification,
    clearAllNotifications,
    markAsRead,
    markAllAsRead,
    sendTestNotification,
    requestNotificationPermission,
    playNotificationSound,
  };
};

export default useNotifications;