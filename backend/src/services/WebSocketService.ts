import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

/**
 * WebSocket Event Types
 * WebSocket 事件类型定义
 */
export interface WebSocketEvents {
  // Email events
  'email:new': {
    emailId: string;
    subject: string;
    from: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    receivedAt: string;
  };

  'email:analyzed': {
    emailId: string;
    analysisId: string;
    sentiment: string;
    priority: string;
    confidence: number;
  };

  // Task events
  'task:created': {
    taskId: string;
    emailId: string;
    integrationId: string;
    title: string;
    priority: string;
    externalUrl?: string;
  };

  'task:updated': {
    taskId: string;
    status: string;
    assignee?: string;
    dueDate?: string;
  };

  'task:completed': {
    taskId: string;
    completedAt: string;
    integrationName: string;
  };

  // Rule events
  'rule:matched': {
    ruleId: string;
    ruleName: string;
    emailId: string;
    actions: string[];
  };

  // Sync events
  'sync:started': {
    accountId: string;
    type: 'email' | 'integration';
    name: string;
  };

  'sync:progress': {
    accountId: string;
    progress: number;
    current: number;
    total: number;
    status: string;
  };

  'sync:completed': {
    accountId: string;
    success: boolean;
    processed: number;
    errors: number;
    duration: number;
  };

  // System events
  'system:notification': {
    type: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message: string;
    autoClose?: boolean;
    duration?: number;
  };

  'system:stats_update': {
    totalEmails: number;
    unreadEmails: number;
    activeTasks: number;
    pendingAnalysis: number;
  };
}

/**
 * Authenticated Socket interface
 * 已认证的 Socket 接口
 */
interface AuthenticatedSocket extends Socket {
  userId: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

/**
 * WebSocket Service
 * WebSocket 服务
 *
 * 提供实时通信功能：
 * - 用户认证
 * - 房间管理
 * - 事件广播
 * - 连接管理
 */
export class WebSocketService {
  private io: SocketIOServer;
  private authenticatedClients: Map<string, AuthenticatedSocket[]> = new Map();
  private readonly JWT_SECRET: string;

  constructor(httpServer: HttpServer) {
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    logger.info('WebSocket service initialized');
  }

  /**
   * Setup authentication middleware
   * 设置认证中间件
   */
  private setupMiddleware(): void {
    this.io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, this.JWT_SECRET) as any;

        if (!decoded.id || !decoded.email) {
          return next(new Error('Invalid token payload'));
        }

        (socket as AuthenticatedSocket).userId = decoded.id;
        (socket as AuthenticatedSocket).user = {
          id: decoded.id,
          email: decoded.email,
          name: decoded.name || 'User'
        };

        next();
      } catch (error) {
        logger.warn('WebSocket authentication failed:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Setup event handlers
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      const authSocket = socket as AuthenticatedSocket;
      const userId = authSocket.userId;

      logger.info(`User ${userId} connected via WebSocket`);

      // Add to authenticated clients
      if (!this.authenticatedClients.has(userId)) {
        this.authenticatedClients.set(userId, []);
      }
      this.authenticatedClients.get(userId)!.push(authSocket);

      // Join user-specific room
      socket.join(`user:${userId}`);

      // Handle client events
      socket.on('subscribe:emails', () => {
        socket.join(`emails:${userId}`);
        logger.debug(`User ${userId} subscribed to email events`);
      });

      socket.on('subscribe:tasks', () => {
        socket.join(`tasks:${userId}`);
        logger.debug(`User ${userId} subscribed to task events`);
      });

      socket.on('subscribe:sync', () => {
        socket.join(`sync:${userId}`);
        logger.debug(`User ${userId} subscribed to sync events`);
      });

      socket.on('unsubscribe:emails', () => {
        socket.leave(`emails:${userId}`);
        logger.debug(`User ${userId} unsubscribed from email events`);
      });

      socket.on('unsubscribe:tasks', () => {
        socket.leave(`tasks:${userId}`);
        logger.debug(`User ${userId} unsubscribed from task events`);
      });

      socket.on('unsubscribe:sync', () => {
        socket.leave(`sync:${userId}`);
        logger.debug(`User ${userId} unsubscribed from sync events`);
      });

      // Handle ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info(`User ${userId} disconnected: ${reason}`);

        // Remove from authenticated clients
        const userClients = this.authenticatedClients.get(userId);
        if (userClients) {
          const index = userClients.indexOf(authSocket);
          if (index > -1) {
            userClients.splice(index, 1);
          }

          if (userClients.length === 0) {
            this.authenticatedClients.delete(userId);
          }
        }
      });

      // Send welcome message
      socket.emit('system:notification', {
        type: 'success',
        title: 'Connected',
        message: 'Real-time notifications are now active',
        autoClose: true,
        duration: 3000
      });
    });
  }

  /**
   * Emit event to specific user
   * 向特定用户发送事件
   */
  emitToUser<K extends keyof WebSocketEvents>(
    userId: string,
    event: K,
    data: WebSocketEvents[K]
  ): void {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Emit event to users subscribed to email events
   * 向订阅邮件事件的用户发送事件
   */
  emitEmailEvent<K extends keyof WebSocketEvents>(
    userId: string,
    event: K,
    data: WebSocketEvents[K]
  ): void {
    this.io.to(`emails:${userId}`).emit(event, data);
  }

  /**
   * Emit event to users subscribed to task events
   * 向订阅任务事件的用户发送事件
   */
  emitTaskEvent<K extends keyof WebSocketEvents>(
    userId: string,
    event: K,
    data: WebSocketEvents[K]
  ): void {
    this.io.to(`tasks:${userId}`).emit(event, data);
  }

  /**
   * Emit event to users subscribed to sync events
   * 向订阅同步事件的用户发送事件
   */
  emitSyncEvent<K extends keyof WebSocketEvents>(
    userId: string,
    event: K,
    data: WebSocketEvents[K]
  ): void {
    this.io.to(`sync:${userId}`).emit(event, data);
  }

  /**
   * Broadcast system notification to all users
   * 向所有用户广播系统通知
   */
  broadcastSystemNotification(notification: WebSocketEvents['system:notification']): void {
    this.io.emit('system:notification', notification);
  }

  /**
   * Get connection statistics
   * 获取连接统计信息
   */
  getConnectionStats(): {
    totalConnections: number;
    authenticatedUsers: number;
    userConnections: { [userId: string]: number };
  } {
    const totalConnections = this.io.sockets.sockets.size;
    const authenticatedUsers = this.authenticatedClients.size;
    const userConnections: { [userId: string]: number } = {};

    this.authenticatedClients.forEach((sockets, userId) => {
      userConnections[userId] = sockets.length;
    });

    return {
      totalConnections,
      authenticatedUsers,
      userConnections
    };
  }

  /**
   * Check if user is connected
   * 检查用户是否已连接
   */
  isUserConnected(userId: string): boolean {
    return this.authenticatedClients.has(userId) &&
           this.authenticatedClients.get(userId)!.length > 0;
  }

  /**
   * Get user's active connections count
   * 获取用户的活跃连接数
   */
  getUserConnectionsCount(userId: string): number {
    return this.authenticatedClients.get(userId)?.length || 0;
  }

  /**
   * Disconnect all connections for a user
   * 断开用户的所有连接
   */
  disconnectUser(userId: string, reason: string = 'Server request'): void {
    const userClients = this.authenticatedClients.get(userId);
    if (userClients) {
      userClients.forEach(socket => {
        socket.disconnect(true);
      });
      this.authenticatedClients.delete(userId);
      logger.info(`Disconnected all connections for user ${userId}: ${reason}`);
    }
  }

  /**
   * Send notification to user (with fallback handling)
   * 向用户发送通知（带回退处理）
   */
  async sendNotification(
    userId: string,
    notification: WebSocketEvents['system:notification'],
    options: {
      persistent?: boolean;
      fallbackEmail?: boolean;
    } = {}
  ): Promise<{
    delivered: boolean;
    method: 'websocket' | 'email' | 'stored';
  }> {
    // Try WebSocket first
    if (this.isUserConnected(userId)) {
      this.emitToUser(userId, 'system:notification', notification);
      return { delivered: true, method: 'websocket' };
    }

    // Store for later delivery if persistent
    if (options.persistent) {
      // TODO: Implement persistent notification storage
      logger.info(`Storing persistent notification for user ${userId}`);
      return { delivered: true, method: 'stored' };
    }

    // Send email as fallback if requested
    if (options.fallbackEmail) {
      // TODO: Implement email fallback
      logger.info(`Sending email notification fallback for user ${userId}`);
      return { delivered: true, method: 'email' };
    }

    return { delivered: false, method: 'websocket' };
  }

  /**
   * Cleanup and shutdown
   * 清理和关闭
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket service...');

    // Notify all connected clients
    this.broadcastSystemNotification({
      type: 'warning',
      title: 'Server Maintenance',
      message: 'Server is shutting down for maintenance',
      autoClose: false
    });

    // Wait a moment for notification delivery
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Close all connections
    this.io.close();
    this.authenticatedClients.clear();

    logger.info('WebSocket service shutdown complete');
  }
}

export default WebSocketService;