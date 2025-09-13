/**
 * WebSocket Service
 * Real-time notification and communication service
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '@/utils/logger';
import config from '@/config';
import { User } from '@/types';
import { UserModel } from '@/models/User';
import database from '@/config/database';

export enum NotificationType {
  EMAIL_RECEIVED = 'email_received',
  EMAIL_ANALYZED = 'email_analyzed',
  FILTER_TRIGGERED = 'filter_triggered',
  REPORT_READY = 'report_ready',
  SYNC_COMPLETED = 'sync_completed',
  SYNC_ERROR = 'sync_error',
  WORKFLOW_TRIGGERED = 'workflow_triggered',
  SYSTEM_ALERT = 'system_alert',
  USER_MESSAGE = 'user_message'
}

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  timestamp: Date;
  actions?: Array<{
    label: string;
    action: string;
    data?: any;
  }>;
}

export interface SocketClient {
  userId: string;
  socketId: string;
  connectedAt: Date;
  lastActivity: Date;
  subscriptions: Set<string>;
}

export class WebSocketService {
  private io: SocketIOServer;
  private clients: Map<string, SocketClient> = new Map();
  private userSockets: Map<string, Set<string>> = new Map();
  
  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true
      },
      transports: ['websocket', 'polling']
    });
    
    this.setupMiddleware();
    this.setupEventHandlers();
    this.startHeartbeat();
    
    logger.info('WebSocket service initialized');
  }
  
  /**
   * Setup authentication middleware
   */
  private setupMiddleware(): void {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          return next(new Error('Authentication required'));
        }
        
        // Verify JWT token
        const decoded = jwt.verify(token, config.env.JWT_SECRET as string) as any;
        const user = await UserModel.findById(decoded.userId);
        
        if (!user) {
          return next(new Error('User not found'));
        }
        
        // Attach user to socket
        (socket as any).userId = user.id;
        (socket as any).user = user;
        
        next();
      } catch (error) {
        logger.error('WebSocket authentication failed', error);
        next(new Error('Authentication failed'));
      }
    });
  }
  
  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      const userId = (socket as any).userId;
      const user = (socket as any).user;
      
      logger.info('WebSocket client connected', { 
        userId,
        socketId: socket.id 
      });
      
      // Register client
      this.registerClient(userId, socket.id);
      
      // Send connection confirmation
      socket.emit('connected', {
        socketId: socket.id,
        userId,
        timestamp: new Date()
      });
      
      // Handle subscriptions
      socket.on('subscribe', (channels: string[]) => {
        this.handleSubscribe(socket, channels);
      });
      
      socket.on('unsubscribe', (channels: string[]) => {
        this.handleUnsubscribe(socket, channels);
      });
      
      // Handle real-time events
      socket.on('mark_email_read', (data) => {
        this.handleMarkEmailRead(socket, data);
      });
      
      socket.on('request_sync', (data) => {
        this.handleRequestSync(socket, data);
      });
      
      socket.on('filter_execute', (data) => {
        this.handleFilterExecute(socket, data);
      });
      
      // Handle typing indicators
      socket.on('typing_start', (data) => {
        this.handleTypingStart(socket, data);
      });
      
      socket.on('typing_stop', (data) => {
        this.handleTypingStop(socket, data);
      });
      
      // Handle presence
      socket.on('presence_update', (data) => {
        this.handlePresenceUpdate(socket, data);
      });
      
      // Handle ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date() });
        this.updateClientActivity(socket.id);
      });
      
      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info('WebSocket client disconnected', { 
          userId,
          socketId: socket.id,
          reason 
        });
        
        this.unregisterClient(userId, socket.id);
      });
      
      // Handle errors
      socket.on('error', (error) => {
        logger.error('WebSocket error', { 
          userId,
          socketId: socket.id,
          error 
        });
      });
    });
  }
  
  /**
   * Register client connection
   */
  private registerClient(userId: string, socketId: string): void {
    const client: SocketClient = {
      userId,
      socketId,
      connectedAt: new Date(),
      lastActivity: new Date(),
      subscriptions: new Set()
    };
    
    this.clients.set(socketId, client);
    
    // Track user's sockets
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)?.add(socketId);
    
    // Update user online status
    this.updateUserPresence(userId, 'online');
  }
  
  /**
   * Unregister client connection
   */
  private unregisterClient(userId: string, socketId: string): void {
    this.clients.delete(socketId);
    
    // Remove from user's sockets
    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(socketId);
      
      // If user has no more connections, update presence
      if (userSocketSet.size === 0) {
        this.userSockets.delete(userId);
        this.updateUserPresence(userId, 'offline');
      }
    }
  }
  
  /**
   * Update client activity timestamp
   */
  private updateClientActivity(socketId: string): void {
    const client = this.clients.get(socketId);
    if (client) {
      client.lastActivity = new Date();
    }
  }
  
  /**
   * Handle channel subscriptions
   */
  private handleSubscribe(socket: Socket, channels: string[]): void {
    const client = this.clients.get(socket.id);
    if (!client) return;
    
    channels.forEach(channel => {
      socket.join(channel);
      client.subscriptions.add(channel);
    });
    
    logger.debug('Client subscribed to channels', { 
      socketId: socket.id,
      channels 
    });
    
    socket.emit('subscribed', { channels });
  }
  
  /**
   * Handle channel unsubscriptions
   */
  private handleUnsubscribe(socket: Socket, channels: string[]): void {
    const client = this.clients.get(socket.id);
    if (!client) return;
    
    channels.forEach(channel => {
      socket.leave(channel);
      client.subscriptions.delete(channel);
    });
    
    logger.debug('Client unsubscribed from channels', { 
      socketId: socket.id,
      channels 
    });
    
    socket.emit('unsubscribed', { channels });
  }
  
  /**
   * Send notification to user
   */
  async sendToUser(userId: string, notification: NotificationPayload): Promise<void> {
    try {
      const socketIds = this.userSockets.get(userId);
      
      if (!socketIds || socketIds.size === 0) {
        // User is offline, save notification for later
        await this.saveOfflineNotification(userId, notification);
        return;
      }
      
      // Send to all user's connected sockets
      socketIds.forEach(socketId => {
        this.io.to(socketId).emit('notification', notification);
      });
      
      // Save notification to database
      await this.saveNotification(userId, notification);
      
      logger.info('Notification sent to user', { 
        userId,
        type: notification.type 
      });
    } catch (error) {
      logger.error('Failed to send notification to user', { 
        userId,
        error 
      });
    }
  }
  
  /**
   * Broadcast to channel
   */
  broadcastToChannel(channel: string, event: string, data: any): void {
    this.io.to(channel).emit(event, data);
    
    logger.debug('Broadcast to channel', { 
      channel,
      event 
    });
  }
  
  /**
   * Send email received notification
   */
  async notifyEmailReceived(userId: string, email: any): Promise<void> {
    const notification: NotificationPayload = {
      type: NotificationType.EMAIL_RECEIVED,
      title: 'New Email Received',
      message: `New email from ${email.from?.name || email.from?.email || 'Unknown'}`,
      data: {
        emailId: email.id,
        subject: email.subject,
        from: email.from,
        preview: email.body?.substring(0, 100)
      },
      priority: email.importance === 'high' ? 'high' : 'normal',
      timestamp: new Date(),
      actions: [
        {
          label: 'View',
          action: 'view_email',
          data: { emailId: email.id }
        },
        {
          label: 'Mark as Read',
          action: 'mark_read',
          data: { emailId: email.id }
        }
      ]
    };
    
    await this.sendToUser(userId, notification);
  }
  
  /**
   * Send email analysis completed notification
   */
  async notifyAnalysisCompleted(userId: string, analysis: any): Promise<void> {
    const notification: NotificationPayload = {
      type: NotificationType.EMAIL_ANALYZED,
      title: 'Email Analysis Completed',
      message: `Analysis completed for email: ${analysis.subject}`,
      data: {
        emailId: analysis.emailId,
        sentiment: analysis.sentiment,
        urgency: analysis.urgency,
        category: analysis.category,
        actionRequired: analysis.actionRequired
      },
      priority: analysis.urgency === 'critical' ? 'urgent' : 'normal',
      timestamp: new Date()
    };
    
    await this.sendToUser(userId, notification);
  }
  
  /**
   * Send filter triggered notification
   */
  async notifyFilterTriggered(userId: string, filter: any, email: any): Promise<void> {
    const notification: NotificationPayload = {
      type: NotificationType.FILTER_TRIGGERED,
      title: 'Filter Rule Applied',
      message: `Filter "${filter.name}" was triggered for email from ${email.from?.email}`,
      data: {
        filterId: filter.id,
        filterName: filter.name,
        emailId: email.id,
        actions: filter.actions
      },
      priority: 'low',
      timestamp: new Date()
    };
    
    await this.sendToUser(userId, notification);
  }
  
  /**
   * Send report ready notification
   */
  async notifyReportReady(userId: string, report: any): Promise<void> {
    const notification: NotificationPayload = {
      type: NotificationType.REPORT_READY,
      title: 'Report Generated',
      message: `Your ${report.type} report is ready`,
      data: {
        reportId: report.id,
        reportType: report.type,
        downloadUrl: report.fileUrl
      },
      priority: 'normal',
      timestamp: new Date(),
      actions: [
        {
          label: 'Download',
          action: 'download_report',
          data: { reportId: report.id }
        },
        {
          label: 'View',
          action: 'view_report',
          data: { reportId: report.id }
        }
      ]
    };
    
    await this.sendToUser(userId, notification);
  }
  
  /**
   * Handle mark email read event
   */
  private async handleMarkEmailRead(socket: Socket, data: any): Promise<void> {
    const userId = (socket as any).userId;
    
    try {
      // Update email status in database
      await database.query(
        'UPDATE emails SET is_read = true WHERE id = $1',
        [data.emailId]
      );
      
      // Broadcast to all user's sockets
      this.broadcastToUser(userId, 'email_status_changed', {
        emailId: data.emailId,
        status: 'read'
      });
      
      socket.emit('email_marked_read', { 
        success: true,
        emailId: data.emailId 
      });
    } catch (error) {
      socket.emit('error', { 
        message: 'Failed to mark email as read',
        error 
      });
    }
  }
  
  /**
   * Handle sync request
   */
  private async handleRequestSync(socket: Socket, data: any): Promise<void> {
    const userId = (socket as any).userId;
    
    socket.emit('sync_started', { 
      accountId: data.accountId,
      timestamp: new Date() 
    });
    
    // Trigger sync process (would call EmailSyncService)
    // This is a placeholder
    setTimeout(() => {
      this.sendToUser(userId, {
        type: NotificationType.SYNC_COMPLETED,
        title: 'Sync Completed',
        message: 'Email synchronization completed successfully',
        data: { 
          accountId: data.accountId,
          newEmails: 5 
        },
        priority: 'low',
        timestamp: new Date()
      });
    }, 3000);
  }
  
  /**
   * Handle filter execute
   */
  private async handleFilterExecute(socket: Socket, data: any): Promise<void> {
    const userId = (socket as any).userId;
    
    socket.emit('filter_execution_started', { 
      filterId: data.filterId,
      timestamp: new Date() 
    });
    
    // Execute filter (would call FilterRuleEngine)
    // This is a placeholder
  }
  
  /**
   * Handle typing start
   */
  private handleTypingStart(socket: Socket, data: any): void {
    const userId = (socket as any).userId;
    
    // Broadcast to channel or recipient
    if (data.channel) {
      socket.to(data.channel).emit('user_typing', {
        userId,
        channel: data.channel,
        isTyping: true
      });
    }
  }
  
  /**
   * Handle typing stop
   */
  private handleTypingStop(socket: Socket, data: any): void {
    const userId = (socket as any).userId;
    
    // Broadcast to channel or recipient
    if (data.channel) {
      socket.to(data.channel).emit('user_typing', {
        userId,
        channel: data.channel,
        isTyping: false
      });
    }
  }
  
  /**
   * Handle presence update
   */
  private handlePresenceUpdate(socket: Socket, data: any): void {
    const userId = (socket as any).userId;
    
    this.updateUserPresence(userId, data.status);
  }
  
  /**
   * Update user presence
   */
  private updateUserPresence(userId: string, status: string): void {
    // Broadcast presence change to relevant users
    this.io.emit('presence_changed', {
      userId,
      status,
      timestamp: new Date()
    });
  }
  
  /**
   * Broadcast to all user's sockets
   */
  private broadcastToUser(userId: string, event: string, data: any): void {
    const socketIds = this.userSockets.get(userId);
    
    if (socketIds) {
      socketIds.forEach(socketId => {
        this.io.to(socketId).emit(event, data);
      });
    }
  }
  
  /**
   * Save notification to database
   */
  private async saveNotification(userId: string, notification: NotificationPayload): Promise<void> {
    try {
      await database.query(
        `INSERT INTO notifications (
          user_id, type, title, message, data, priority, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          notification.type,
          notification.title,
          notification.message,
          JSON.stringify(notification.data),
          notification.priority || 'normal',
          notification.timestamp
        ]
      );
    } catch (error) {
      logger.error('Failed to save notification', { userId, error });
    }
  }
  
  /**
   * Save offline notification
   */
  private async saveOfflineNotification(userId: string, notification: NotificationPayload): Promise<void> {
    await this.saveNotification(userId, notification);
    logger.info('Offline notification saved', { userId, type: notification.type });
  }
  
  /**
   * Get offline notifications for user
   */
  async getOfflineNotifications(userId: string): Promise<NotificationPayload[]> {
    try {
      const result = await database.query(
        `SELECT * FROM notifications 
         WHERE user_id = $1 AND is_read = false 
         ORDER BY created_at DESC 
         LIMIT 50`,
        [userId]
      );
      
      return result.rows.map(row => ({
        type: row.type,
        title: row.title,
        message: row.message,
        data: row.data,
        priority: row.priority,
        timestamp: row.created_at
      }));
    } catch (error) {
      logger.error('Failed to get offline notifications', { userId, error });
      return [];
    }
  }
  
  /**
   * Start heartbeat to detect stale connections
   */
  private startHeartbeat(): void {
    setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 1 minute
      
      this.clients.forEach((client, socketId) => {
        const lastActivity = client.lastActivity.getTime();
        
        if (now - lastActivity > timeout) {
          const socket = this.io.sockets.sockets.get(socketId);
          if (socket) {
            socket.disconnect(true);
          }
          
          logger.info('Disconnected stale client', { socketId });
        }
      });
    }, 30000); // Check every 30 seconds
  }
  
  /**
   * Get connection statistics
   */
  getStats(): any {
    return {
      totalConnections: this.clients.size,
      uniqueUsers: this.userSockets.size,
      clients: Array.from(this.clients.values()).map(c => ({
        userId: c.userId,
        connectedAt: c.connectedAt,
        lastActivity: c.lastActivity,
        subscriptions: Array.from(c.subscriptions)
      }))
    };
  }
  
  /**
   * Shutdown WebSocket service
   */
  shutdown(): void {
    this.io.disconnectSockets(true);
    this.io.close();
    logger.info('WebSocket service shut down');
  }
}