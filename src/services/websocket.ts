import React from 'react';
import { io, Socket } from 'socket.io-client';
import { RealtimeUpdate, WebSocketConfig } from '@/types';
import { useAppStore } from '@/store';
import { toast } from 'react-toastify';

export interface NotificationEvent {
  id: string;
  type: 'email' | 'workflow' | 'team' | 'system';
  title: string;
  message: string;
  data?: any;
  timestamp: string;
  read?: boolean;
  userId: string;
}

export interface WorkflowExecutionResult {
  success: boolean;
  ruleId: string;
  actions: Array<{
    type: string;
    status: 'success' | 'error';
    message: string;
  }>;
  timestamp: string;
}

export interface TeamEvent {
  type: 'email_assigned' | 'comment_added' | 'member_joined';
  emailId?: string;
  assigneeId?: string;
  assignedBy?: string;
  teamId: string;
  comment?: any;
  timestamp: string;
}

export class WebSocketService {
  private socket: Socket | null = null;
  private config: WebSocketConfig;
  private listeners: Map<string, ((data: any) => void)[]> = new Map();
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;

  constructor(config: WebSocketConfig) {
    this.config = config;
  }

  // 连接Socket.IO
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting || (this.socket && this.socket.connected)) {
        return;
      }

      if (this.socket && this.socket.connected) {
        resolve();
        return;
      }

      this.isConnecting = true;

      try {
        // 获取服务器URL和用户信息
        const serverUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
        const store = useAppStore.getState();

        this.socket = io(`${serverUrl}/notifications`, {
          transports: ['websocket', 'polling'],
          timeout: 10000,
          auth: {
            token: localStorage.getItem('authToken') || '',
            userId: store.user?.id || 'anonymous',
            userEmail: store.user?.email || 'anonymous@example.com'
          }
        });

        this.socket.on('connect', () => {
          console.log('Socket.IO连接已建立:', this.socket?.id);
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.config.isConnected = true;
          this.authenticate();
          this.setupEventHandlers();
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Socket.IO连接已关闭:', reason);
          this.isConnecting = false;
          this.config.isConnected = false;

          // 如果不是主动关闭，尝试重连
          if (reason === 'io server disconnect' && this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        });

        this.socket.on('connect_error', (error) => {
          console.error('Socket.IO连接错误:', error);
          this.isConnecting = false;
          this.config.isConnected = false;
          this.scheduleReconnect();
          reject(error);
        });

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  // 认证
  private authenticate(): void {
    if (!this.socket || !this.socket.connected) return;

    const store = useAppStore.getState();
    this.socket.emit('authenticate', {
      token: localStorage.getItem('authToken') || '',
      userId: store.user?.id || 'anonymous',
      userEmail: store.user?.email || 'anonymous@example.com'
    });
  }

  // 设置事件处理器
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // 认证事件
    this.socket.on('authenticated', (data) => {
      console.log('✅ Socket.IO认证成功:', data);
      this.startHeartbeat();
    });

    this.socket.on('authentication_error', (error) => {
      console.error('❌ Socket.IO认证失败:', error);
    });

    // 通知事件
    this.socket.on('notification', (notification: NotificationEvent) => {
      console.log('📢 收到通知:', notification);
      this.handleNotification(notification);
    });

    this.socket.on('notification_count', (data) => {
      console.log('🔢 通知计数更新:', data);
      useAppStore.getState().setNotificationCount?.(data.count);
    });

    // 工作流事件
    this.socket.on('workflow:result', (result: WorkflowExecutionResult) => {
      console.log('⚡ 工作流执行结果:', result);
      this.handleWorkflowResult(result);
    });

    this.socket.on('workflow:error', (error) => {
      console.error('❌ 工作流执行错误:', error);
      toast.error(`工作流错误: ${error.error || '执行失败'}`);
    });

    // 团队协作事件
    this.socket.on('team:email_assigned', (data: TeamEvent) => {
      console.log('👥 邮件已分配:', data);
      this.handleTeamEvent(data);
    });

    this.socket.on('team:new_comment', (comment) => {
      console.log('💬 新团队评论:', comment);
      this.handleTeamEvent({
        type: 'comment_added',
        teamId: comment.teamId,
        comment,
        timestamp: comment.timestamp
      });
    });

    // 系统事件
    this.socket.on('system_notification', (notification: NotificationEvent) => {
      console.log('🚨 系统通知:', notification);
      this.handleSystemNotification(notification);
    });

    // 连接健康检查
    this.socket.on('pong', (data) => {
      console.log('🏓 收到Pong:', data.timestamp);
    });
  }

  // 断开连接
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.config.isConnected = false;
    this.reconnectAttempts = 0;
  }

  // 发送消息
  send(message: any): boolean {
    if (!this.socket || !this.socket.connected) {
      console.warn('Socket.IO未连接，无法发送消息');
      return false;
    }

    try {
      this.socket.emit('message', message);
      return true;
    } catch (error) {
      console.error('发送Socket.IO消息失败:', error);
      return false;
    }
  }

  // P1功能：执行工作流
  executeWorkflow(ruleId: string, emailData: any): void {
    if (!this.socket || !this.socket.connected) {
      toast.error('连接未建立，无法执行工作流');
      return;
    }

    this.socket.emit('workflow:execute', {
      ruleId,
      emailData
    });
  }

  // P1功能：分配邮件给团队成员
  assignEmail(emailId: string, assigneeId: string, teamId: string): void {
    if (!this.socket || !this.socket.connected) {
      toast.error('连接未建立，无法分配邮件');
      return;
    }

    this.socket.emit('team:assign_email', {
      emailId,
      assigneeId,
      teamId
    });
  }

  // P1功能：添加团队评论
  addComment(emailId: string, comment: string, teamId: string): void {
    if (!this.socket || !this.socket.connected) {
      toast.error('连接未建立，无法添加评论');
      return;
    }

    this.socket.emit('team:add_comment', {
      emailId,
      comment,
      teamId
    });
  }

  // P1功能：更新通知偏好
  updateNotificationPreferences(preferences: any): void {
    if (!this.socket || !this.socket.connected) {
      toast.error('连接未建立，无法更新通知偏好');
      return;
    }

    this.socket.emit('notifications:update_preferences', {
      preferences
    });
  }

  // P1功能：加入邮件房间
  joinEmailRoom(emailId: string): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('join_email_room', emailId);
  }

  // P1功能：离开邮件房间
  leaveEmailRoom(emailId: string): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('leave_email_room', emailId);
  }

  // P1功能：获取通知计数
  getNotificationCount(): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('get_notification_count');
  }

  // P1功能：标记所有通知为已读
  markAllNotificationsRead(): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('mark_all_read');
  }

  // 处理通知
  private handleNotification(notification: NotificationEvent): void {
    // 显示浏览器通知
    this.showBrowserNotification(notification);

    // 更新store
    const store = useAppStore.getState();
    store.addNotification?.(notification);

    // 显示Toast通知
    const message = `${notification.title}: ${notification.message}`;
    switch (notification.type) {
      case 'system':
        toast.error(message);
        break;
      case 'workflow':
        toast.success(message);
        break;
      default:
        toast.info(message);
    }
  }

  // 处理工作流结果
  private handleWorkflowResult(result: WorkflowExecutionResult): void {
    const message = result.success
      ? `工作流执行成功，完成${result.actions.length}个操作`
      : '工作流执行失败';

    if (result.success) {
      toast.success(message);
    } else {
      toast.error(message);
    }

    // 更新工作流统计
    useAppStore.getState().updateWorkflowStats?.(result);
  }

  // 处理团队事件
  private handleTeamEvent(event: TeamEvent): void {
    let message = '';

    switch (event.type) {
      case 'email_assigned':
        message = `邮件已分配给团队成员`;
        break;
      case 'comment_added':
        message = `邮件收到新评论`;
        break;
      case 'member_joined':
        message = `新成员加入团队`;
        break;
    }

    toast.info(message);

    // 更新团队活动
    useAppStore.getState().updateTeamActivity?.(event);
  }

  // 处理系统通知
  private handleSystemNotification(notification: NotificationEvent): void {
    toast.warning(`系统警告: ${notification.message}`);
  }

  // 显示浏览器通知
  private showBrowserNotification(notification: NotificationEvent): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id
      });
    }
  }

  // 订阅实时更新
  subscribe(type: string, callback: (data: any) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);

    // 发送订阅消息到服务器
    this.send({
      action: 'subscribe',
      type,
      timestamp: new Date().toISOString(),
    });

    // 返回取消订阅的函数
    return () => {
      this.unsubscribe(type, callback);
    };
  }

  // 取消订阅
  unsubscribe(type: string, callback: (data: any) => void) {
    const callbacks = this.listeners.get(type);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
        
        // 如果没有更多监听器，发送取消订阅消息
        if (callbacks.length === 0) {
          this.send({
            action: 'unsubscribe',
            type,
            timestamp: new Date().toISOString(),
          });
          this.listeners.delete(type);
        }
      }
    }
  }

  // 获取连接状态
  getConnectionState(): 'connecting' | 'open' | 'closed' | 'closing' {
    if (!this.socket) return 'closed';

    if (this.socket.connected) {
      return 'open';
    } else if (this.isConnecting) {
      return 'connecting';
    } else {
      return 'closed';
    }
  }

  // 检查连接健康状况
  isConnectionHealthy(): boolean {
    return this.socket?.connected === true;
  }

  // 获取连接信息
  getConnectionInfo(): {
    connected: boolean;
    socketId: string | undefined;
    reconnectAttempts: number;
  } {
    return {
      connected: this.socket?.connected || false,
      socketId: this.socket?.id,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  // 发送ping
  ping(): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('ping');
  }

  // 请求浏览器通知权限
  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.log('浏览器不支持通知');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  // 处理实时更新
  private handleRealtimeUpdate(update: RealtimeUpdate) {
    console.log('收到实时更新:', update);

    const callbacks = this.listeners.get(update.type);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(update.data);
        } catch (error) {
          console.error('处理实时更新回调失败:', error);
        }
      });
    }

    // 处理通用更新
    const allCallbacks = this.listeners.get('*');
    if (allCallbacks) {
      allCallbacks.forEach(callback => {
        try {
          callback(update);
        } catch (error) {
          console.error('处理通用实时更新回调失败:', error);
        }
      });
    }
  }

  // 安排重连
  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000 // 最大30秒
    );

    console.log(`将在 ${delay}ms 后尝试第 ${this.reconnectAttempts} 次重连`);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('重连失败:', error);
      });
    }, delay);
  }

  // 开始心跳
  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.socket.connected) {
        this.socket.emit('ping');
      }
    }, 30000); // 30秒心跳
  }

  // 停止心跳
  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

// 创建单例实例
let websocketService: WebSocketService | null = null;

export const getWebSocketService = (config?: WebSocketConfig): WebSocketService => {
  if (!websocketService && config) {
    websocketService = new WebSocketService(config);
  }
  return websocketService!;
};

// React Hook for WebSocket
export const useWebSocket = (config: WebSocketConfig) => {
  const [isConnected, setIsConnected] = React.useState(false);
  const [connectionState, setConnectionState] = React.useState<'connecting' | 'open' | 'closed' | 'closing'>('closed');
  const wsService = React.useRef<WebSocketService | null>(null);

  React.useEffect(() => {
    wsService.current = getWebSocketService(config);
    
    // 监听连接状态变化
    const checkConnection = () => {
      if (wsService.current) {
        const state = wsService.current.getConnectionState();
        setConnectionState(state);
        setIsConnected(state === 'open');
      }
    };

    const interval = setInterval(checkConnection, 1000);

    // 初始连接
    if (wsService.current) {
      wsService.current.connect().catch(console.error);
    }

    return () => {
      clearInterval(interval);
      if (wsService.current) {
        wsService.current.disconnect();
      }
    };
  }, [config.url, config.reconnectInterval, config.maxReconnectAttempts]);

  const subscribe = React.useCallback((type: string, callback: (data: any) => void) => {
    return wsService.current?.subscribe(type, callback);
  }, []);

  const send = React.useCallback((message: any) => {
    return wsService.current?.send(message) ?? false;
  }, []);

  const disconnect = React.useCallback(() => {
    wsService.current?.disconnect();
  }, []);

  const reconnect = React.useCallback(() => {
    wsService.current?.connect().catch(console.error);
  }, []);

  return {
    isConnected,
    connectionState,
    subscribe,
    send,
    disconnect,
    reconnect,
  };
};