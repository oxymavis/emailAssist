import { EventEmitter } from 'events';

export interface NotificationData {
  id: string;
  type: 'email' | 'system' | 'workflow' | 'team' | 'security';
  category: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  priority: 'low' | 'normal' | 'high' | 'critical';
  source?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
  expiry?: Date;
  persistent?: boolean;
}

export interface NotificationSubscription {
  id: string;
  types: string[];
  categories: string[];
  priorities: string[];
  callback: (notification: NotificationData) => void;
  active: boolean;
}

export interface NotificationQueue {
  notifications: NotificationData[];
  maxSize: number;
  retentionTime: number; // 毫秒
}

class NotificationService extends EventEmitter {
  private static instance: NotificationService;
  private subscriptions: Map<string, NotificationSubscription> = new Map();
  private queue: NotificationQueue = {
    notifications: [],
    maxSize: 1000,
    retentionTime: 24 * 60 * 60 * 1000, // 24小时
  };
  private websocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.initializeService();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private initializeService() {
    // 连接WebSocket
    this.connectWebSocket();

    // 启动清理任务
    this.startCleanupTask();

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

    // 监听网络状态变化
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  private connectWebSocket() {
    try {
      // 在生产环境中，这应该是真实的WebSocket URL
      const wsUrl = process.env.NODE_ENV === 'production'
        ? 'wss://api.emailassist.com/ws/notifications'
        : 'ws://localhost:3001/ws/notifications';

      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = this.handleWebSocketOpen.bind(this);
      this.websocket.onmessage = this.handleWebSocketMessage.bind(this);
      this.websocket.onclose = this.handleWebSocketClose.bind(this);
      this.websocket.onerror = this.handleWebSocketError.bind(this);

    } catch (error) {
      console.warn('WebSocket connection failed, using fallback polling:', error);
      this.startPollingFallback();
    }
  }

  private handleWebSocketOpen() {
    console.log('Notification WebSocket connected');
    this.reconnectAttempts = 0;
    this.startHeartbeat();
    this.emit('connected');
  }

  private handleWebSocketMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'heartbeat') {
        return; // 忽略心跳消息
      }

      if (data.type === 'notification') {
        this.processNotification(data.payload);
      }

    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private handleWebSocketClose() {
    console.log('Notification WebSocket disconnected');
    this.stopHeartbeat();
    this.emit('disconnected');

    // 尝试重连
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

      setTimeout(() => {
        console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connectWebSocket();
      }, delay);
    } else {
      console.warn('Max reconnection attempts reached, switching to polling');
      this.startPollingFallback();
    }
  }

  private handleWebSocketError(error: Event) {
    console.error('WebSocket error:', error);
    this.emit('error', error);
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.websocket?.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
      }
    }, 30000); // 30秒心跳
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private startPollingFallback() {
    // 使用轮询作为WebSocket的后备方案
    setInterval(async () => {
      try {
        const response = await fetch('/api/notifications/poll', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const notifications = await response.json();
          notifications.forEach((notification: NotificationData) => {
            this.processNotification(notification);
          });
        }
      } catch (error) {
        console.error('Polling failed:', error);
      }
    }, 10000); // 10秒轮询
  }

  private processNotification(notificationData: NotificationData) {
    const notification: NotificationData = {
      ...notificationData,
      timestamp: new Date(notificationData.timestamp),
      expiry: notificationData.expiry ? new Date(notificationData.expiry) : undefined,
    };

    // 添加到队列
    this.addToQueue(notification);

    // 分发给订阅者
    this.distributeNotification(notification);

    // 触发事件
    this.emit('notification', notification);

    // 处理持久化通知
    if (notification.persistent) {
      this.savePersistentNotification(notification);
    }
  }

  private addToQueue(notification: NotificationData) {
    this.queue.notifications.unshift(notification);

    // 保持队列大小限制
    if (this.queue.notifications.length > this.queue.maxSize) {
      this.queue.notifications = this.queue.notifications.slice(0, this.queue.maxSize);
    }
  }

  private distributeNotification(notification: NotificationData) {
    this.subscriptions.forEach((subscription) => {
      if (!subscription.active) return;

      // 检查类型过滤
      if (subscription.types.length > 0 && !subscription.types.includes(notification.type)) {
        return;
      }

      // 检查分类过滤
      if (subscription.categories.length > 0 && !subscription.categories.includes(notification.category)) {
        return;
      }

      // 检查优先级过滤
      if (subscription.priorities.length > 0 && !subscription.priorities.includes(notification.priority)) {
        return;
      }

      // 执行回调
      try {
        subscription.callback(notification);
      } catch (error) {
        console.error('Notification callback error:', error);
      }
    });
  }

  private savePersistentNotification(notification: NotificationData) {
    try {
      const stored = localStorage.getItem('persistentNotifications');
      const notifications = stored ? JSON.parse(stored) : [];

      notifications.unshift({
        ...notification,
        timestamp: notification.timestamp.toISOString(),
        expiry: notification.expiry?.toISOString(),
      });

      // 保持最多100个持久化通知
      const limited = notifications.slice(0, 100);
      localStorage.setItem('persistentNotifications', JSON.stringify(limited));
    } catch (error) {
      console.error('Failed to save persistent notification:', error);
    }
  }

  private startCleanupTask() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const retentionTime = this.queue.retentionTime;

      // 清理过期通知
      this.queue.notifications = this.queue.notifications.filter(notification => {
        const age = now - notification.timestamp.getTime();
        const expired = notification.expiry && now > notification.expiry.getTime();

        return age < retentionTime && !expired;
      });

      // 清理过期的持久化通知
      this.cleanupPersistentNotifications();

    }, 60000); // 每分钟清理一次
  }

  private cleanupPersistentNotifications() {
    try {
      const stored = localStorage.getItem('persistentNotifications');
      if (!stored) return;

      const notifications = JSON.parse(stored);
      const now = Date.now();

      const valid = notifications.filter((notification: any) => {
        const expiry = notification.expiry ? new Date(notification.expiry).getTime() : null;
        const age = now - new Date(notification.timestamp).getTime();

        return age < this.queue.retentionTime && (!expiry || now < expiry);
      });

      localStorage.setItem('persistentNotifications', JSON.stringify(valid));
    } catch (error) {
      console.error('Failed to cleanup persistent notifications:', error);
    }
  }

  private handleVisibilityChange() {
    if (document.hidden) {
      // 页面隐藏时减少活动
      this.emit('backgroundMode');
    } else {
      // 页面可见时恢复正常
      this.emit('foregroundMode');
      this.syncMissedNotifications();
    }
  }

  private handleOnline() {
    console.log('Network connection restored');
    this.emit('online');
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      this.connectWebSocket();
    }
  }

  private handleOffline() {
    console.log('Network connection lost');
    this.emit('offline');
  }

  private async syncMissedNotifications() {
    try {
      const lastSync = localStorage.getItem('lastNotificationSync');
      const since = lastSync ? new Date(lastSync) : new Date(Date.now() - 60000); // 默认1分钟前

      const response = await fetch(`/api/notifications/sync?since=${since.toISOString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const missedNotifications = await response.json();
        missedNotifications.forEach((notification: NotificationData) => {
          this.processNotification(notification);
        });

        localStorage.setItem('lastNotificationSync', new Date().toISOString());
      }
    } catch (error) {
      console.error('Failed to sync missed notifications:', error);
    }
  }

  // 公共API方法

  public subscribe(
    types: string[] = [],
    categories: string[] = [],
    priorities: string[] = [],
    callback: (notification: NotificationData) => void
  ): string {
    const id = Math.random().toString(36).substr(2, 9);

    this.subscriptions.set(id, {
      id,
      types,
      categories,
      priorities,
      callback,
      active: true,
    });

    return id;
  }

  public unsubscribe(subscriptionId: string) {
    this.subscriptions.delete(subscriptionId);
  }

  public pauseSubscription(subscriptionId: string) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.active = false;
    }
  }

  public resumeSubscription(subscriptionId: string) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.active = true;
    }
  }

  public getNotifications(limit = 50): NotificationData[] {
    return this.queue.notifications.slice(0, limit);
  }

  public getNotificationById(id: string): NotificationData | undefined {
    return this.queue.notifications.find(n => n.id === id);
  }

  public removeNotification(id: string) {
    this.queue.notifications = this.queue.notifications.filter(n => n.id !== id);
    this.emit('notificationRemoved', id);
  }

  public clearAllNotifications() {
    this.queue.notifications = [];
    this.emit('notificationsCleared');
  }

  public markAsRead(id: string) {
    const notification = this.queue.notifications.find(n => n.id === id);
    if (notification) {
      // 这里可以添加标记已读的逻辑
      this.emit('notificationRead', id);
    }
  }

  public sendTestNotification() {
    const testNotification: NotificationData = {
      id: Date.now().toString(),
      type: 'system',
      category: 'info',
      title: '测试通知',
      message: '这是一个测试通知消息',
      timestamp: new Date(),
      priority: 'normal',
      source: 'Test Service',
    };

    this.processNotification(testNotification);
  }

  public getStats() {
    return {
      totalNotifications: this.queue.notifications.length,
      subscriptions: this.subscriptions.size,
      connected: this.websocket?.readyState === WebSocket.OPEN,
      queueSize: this.queue.maxSize,
      retentionTime: this.queue.retentionTime,
    };
  }

  public destroy() {
    // 清理资源
    if (this.websocket) {
      this.websocket.close();
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.subscriptions.clear();
    this.queue.notifications = [];
    this.removeAllListeners();

    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }
}

export default NotificationService;