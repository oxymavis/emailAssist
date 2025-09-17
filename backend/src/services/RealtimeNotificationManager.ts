/**
 * Real-time Notification Manager
 * Handles real-time push notifications via WebSocket
 * P1 Feature Implementation
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import logger from '@/utils/logger';
import { NotificationService } from './NotificationService';
import { EmailMessage } from '@/types';

export interface RealtimeNotificationOptions {
  enableBrowserNotifications: boolean;
  enableEmailNotifications: boolean;
  enableSlackNotifications: boolean;
  enableMobileNotifications: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // "22:00"
    end: string;   // "08:00"
    timezone: string;
  };
  priority: {
    high: boolean;
    medium: boolean;
    low: boolean;
  };
  categories: string[];
}

export interface NotificationEvent {
  id: string;
  type: 'urgent_email' | 'priority_change' | 'workflow_completed' | 'analysis_completed' | 'system_alert';
  userId: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  data: any;
  timestamp: Date;
  expiresAt?: Date;
}

export interface UserSession {
  userId: string;
  socketId: string;
  connectedAt: Date;
  userAgent?: string;
  ipAddress?: string;
  lastActivity: Date;
  preferences: RealtimeNotificationOptions;
}

export interface NotificationDeliveryResult {
  userId: string;
  notificationId: string;
  channels: {
    websocket: { delivered: boolean; deliveredAt?: Date; error?: string };
    browser: { delivered: boolean; deliveredAt?: Date; error?: string };
    email: { delivered: boolean; deliveredAt?: Date; error?: string };
    mobile: { delivered: boolean; deliveredAt?: Date; error?: string };
  };
}

export class RealtimeNotificationManager {
  private io: SocketIOServer;
  private notificationService: NotificationService;
  private activeSessions: Map<string, UserSession[]> = new Map(); // userId -> sessions
  private pendingNotifications: Map<string, NotificationEvent[]> = new Map(); // userId -> notifications
  private deliveryQueue: NotificationEvent[] = [];
  private retryQueue: NotificationEvent[] = [];

  constructor(httpServer: HTTPServer, notificationService: NotificationService) {
    this.notificationService = notificationService;

    // Initialize Socket.IO with CORS configuration
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupSocketHandlers();
    this.startDeliveryProcessor();
    this.startRetryProcessor();
    this.startSessionCleanup();

    logger.info('Real-time notification manager initialized');
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      logger.info('New WebSocket connection', { socketId: socket.id });

      // Handle user authentication
      socket.on('authenticate', async (data: { userId: string; token: string }) => {
        try {
          // Verify JWT token (implementation depends on your auth system)
          const isValid = await this.verifyToken(data.token, data.userId);
          if (!isValid) {
            socket.emit('auth_error', { message: 'Invalid authentication token' });
            socket.disconnect();
            return;
          }

          // Store user session
          const session: UserSession = {
            userId: data.userId,
            socketId: socket.id,
            connectedAt: new Date(),
            userAgent: socket.handshake.headers['user-agent'],
            ipAddress: socket.handshake.address,
            lastActivity: new Date(),
            preferences: await this.getUserNotificationPreferences(data.userId)
          };

          this.addUserSession(session);

          socket.emit('authenticated', { success: true, sessionId: session.socketId });

          // Send any pending notifications
          await this.deliverPendingNotifications(data.userId);

          logger.info('User authenticated and connected', {
            userId: data.userId,
            socketId: socket.id
          });
        } catch (error) {
          logger.error('Authentication error', { socketId: socket.id, error });
          socket.emit('auth_error', { message: 'Authentication failed' });
          socket.disconnect();
        }
      });

      // Handle notification preferences update
      socket.on('update_preferences', async (preferences: RealtimeNotificationOptions) => {
        try {
          const session = this.getSessionBySocketId(socket.id);
          if (!session) {
            socket.emit('error', { message: 'Session not found' });
            return;
          }

          session.preferences = preferences;
          await this.saveUserNotificationPreferences(session.userId, preferences);

          socket.emit('preferences_updated', { success: true });
          logger.info('Notification preferences updated', { userId: session.userId });
        } catch (error) {
          logger.error('Error updating preferences', { socketId: socket.id, error });
          socket.emit('error', { message: 'Failed to update preferences' });
        }
      });

      // Handle notification acknowledgment
      socket.on('notification_ack', async (notificationId: string) => {
        try {
          const session = this.getSessionBySocketId(socket.id);
          if (!session) return;

          await this.markNotificationAsRead(notificationId, session.userId);
          logger.debug('Notification acknowledged', { notificationId, userId: session.userId });
        } catch (error) {
          logger.error('Error acknowledging notification', { notificationId, error });
        }
      });

      // Handle notification dismissal
      socket.on('notification_dismiss', async (notificationId: string) => {
        try {
          const session = this.getSessionBySocketId(socket.id);
          if (!session) return;

          await this.dismissNotification(notificationId, session.userId);
          logger.debug('Notification dismissed', { notificationId, userId: session.userId });
        } catch (error) {
          logger.error('Error dismissing notification', { notificationId, error });
        }
      });

      // Handle getting notification history
      socket.on('get_notifications', async (options: { limit?: number; offset?: number }) => {
        try {
          const session = this.getSessionBySocketId(socket.id);
          if (!session) {
            socket.emit('error', { message: 'Session not found' });
            return;
          }

          const result = await this.notificationService.getUserNotifications(session.userId, {
            limit: options.limit || 20,
            offset: options.offset || 0,
            unreadOnly: false
          });

          socket.emit('notifications', result);
        } catch (error) {
          logger.error('Error getting notifications', { socketId: socket.id, error });
          socket.emit('error', { message: 'Failed to get notifications' });
        }
      });

      // Handle ping/pong for connection health
      socket.on('ping', () => {
        const session = this.getSessionBySocketId(socket.id);
        if (session) {
          session.lastActivity = new Date();
        }
        socket.emit('pong');
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.removeUserSession(socket.id);
        logger.info('WebSocket disconnected', { socketId: socket.id, reason });
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error('WebSocket error', { socketId: socket.id, error });
      });
    });
  }

  /**
   * Send real-time notification to user
   */
  async sendRealtimeNotification(notification: NotificationEvent): Promise<NotificationDeliveryResult> {
    const result: NotificationDeliveryResult = {
      userId: notification.userId,
      notificationId: notification.id,
      channels: {
        websocket: { delivered: false },
        browser: { delivered: false },
        email: { delivered: false },
        mobile: { delivered: false }
      }
    };

    try {
      const userSessions = this.activeSessions.get(notification.userId) || [];
      const userPreferences = await this.getUserNotificationPreferences(notification.userId);

      // Check if notifications are allowed
      if (!this.shouldDeliverNotification(notification, userPreferences)) {
        logger.debug('Notification delivery blocked by user preferences', {
          userId: notification.userId,
          notificationId: notification.id
        });
        return result;
      }

      // WebSocket delivery
      if (userSessions.length > 0) {
        result.channels.websocket = await this.deliverViaWebSocket(notification, userSessions);
      } else {
        // User not online, store for later delivery
        this.addPendingNotification(notification);
      }

      // Browser push notification
      if (userPreferences.enableBrowserNotifications) {
        result.channels.browser = await this.deliverViaBrowser(notification);
      }

      // Email notification
      if (userPreferences.enableEmailNotifications) {
        result.channels.email = await this.deliverViaEmail(notification);
      }

      // Mobile push notification
      if (userPreferences.enableMobileNotifications) {
        result.channels.mobile = await this.deliverViaMobile(notification);
      }

      logger.info('Real-time notification sent', {
        userId: notification.userId,
        notificationId: notification.id,
        channels: Object.keys(result.channels).filter(c => result.channels[c].delivered)
      });

      return result;
    } catch (error) {
      logger.error('Error sending real-time notification', {
        userId: notification.userId,
        notificationId: notification.id,
        error
      });

      // Add to retry queue
      this.retryQueue.push(notification);

      return result;
    }
  }

  /**
   * Notify about urgent email
   */
  async notifyUrgentEmail(email: EmailMessage, userId: string): Promise<void> {
    const notification: NotificationEvent = {
      id: this.generateNotificationId(),
      type: 'urgent_email',
      userId,
      priority: 'high',
      title: 'Urgent Email Received',
      message: `New urgent email from ${email.from?.name || email.from?.email}: ${email.subject}`,
      data: {
        emailId: email.id,
        subject: email.subject,
        fromName: email.from?.name,
        fromEmail: email.from?.email,
        receivedAt: email.receivedAt,
        importance: email.importance
      },
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Expires in 24 hours
    };

    await this.sendRealtimeNotification(notification);
  }

  /**
   * Notify about workflow completion
   */
  async notifyWorkflowCompleted(workflowName: string, emailSubject: string, platform: string, userId: string): Promise<void> {
    const notification: NotificationEvent = {
      id: this.generateNotificationId(),
      type: 'workflow_completed',
      userId,
      priority: 'medium',
      title: 'Workflow Completed',
      message: `Workflow "${workflowName}" completed successfully for email "${emailSubject}"`,
      data: {
        workflowName,
        emailSubject,
        platform,
        completedAt: new Date()
      },
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expires in 7 days
    };

    await this.sendRealtimeNotification(notification);
  }

  /**
   * Notify about AI analysis completion
   */
  async notifyAnalysisCompleted(emailId: string, analysisResults: any, userId: string): Promise<void> {
    const notification: NotificationEvent = {
      id: this.generateNotificationId(),
      type: 'analysis_completed',
      userId,
      priority: 'low',
      title: 'AI Analysis Completed',
      message: `Email analysis completed with ${analysisResults.sentiment} sentiment and ${analysisResults.priority} priority`,
      data: {
        emailId,
        results: analysisResults,
        completedAt: new Date()
      },
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // Expires in 3 days
    };

    await this.sendRealtimeNotification(notification);
  }

  /**
   * Get active user sessions count
   */
  getActiveUsersCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Get total active sessions count
   */
  getActiveSessionsCount(): number {
    let total = 0;
    for (const sessions of this.activeSessions.values()) {
      total += sessions.length;
    }
    return total;
  }

  /**
   * Get user session info
   */
  getUserSessions(userId: string): UserSession[] {
    return this.activeSessions.get(userId) || [];
  }

  /**
   * Disconnect all sessions for a user
   */
  disconnectUser(userId: string, reason = 'Server disconnect'): void {
    const sessions = this.activeSessions.get(userId) || [];

    sessions.forEach(session => {
      const socket = this.io.sockets.sockets.get(session.socketId);
      if (socket) {
        socket.emit('force_disconnect', { reason });
        socket.disconnect(true);
      }
    });

    this.activeSessions.delete(userId);
    logger.info('User disconnected', { userId, sessionCount: sessions.length });
  }

  /**
   * Broadcast system alert to all users
   */
  async broadcastSystemAlert(title: string, message: string, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<void> {
    const activeUsers = Array.from(this.activeSessions.keys());

    const notifications = activeUsers.map(userId => ({
      id: this.generateNotificationId(),
      type: 'system_alert' as const,
      userId,
      priority,
      title,
      message,
      data: { broadcast: true },
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }));

    await Promise.all(notifications.map(notification =>
      this.sendRealtimeNotification(notification)
    ));

    logger.info('System alert broadcasted', { userCount: activeUsers.length });
  }

  /**
   * Private helper methods
   */
  private addUserSession(session: UserSession): void {
    if (!this.activeSessions.has(session.userId)) {
      this.activeSessions.set(session.userId, []);
    }

    const userSessions = this.activeSessions.get(session.userId)!;
    userSessions.push(session);
  }

  private removeUserSession(socketId: string): void {
    for (const [userId, sessions] of this.activeSessions) {
      const sessionIndex = sessions.findIndex(s => s.socketId === socketId);
      if (sessionIndex !== -1) {
        sessions.splice(sessionIndex, 1);
        if (sessions.length === 0) {
          this.activeSessions.delete(userId);
        }
        break;
      }
    }
  }

  private getSessionBySocketId(socketId: string): UserSession | null {
    for (const sessions of this.activeSessions.values()) {
      const session = sessions.find(s => s.socketId === socketId);
      if (session) {
        return session;
      }
    }
    return null;
  }

  private async verifyToken(token: string, userId: string): Promise<boolean> {
    // Implement JWT token verification
    // This is a placeholder - implement according to your auth system
    try {
      // Example: verify JWT token and check if userId matches
      return true; // Placeholder
    } catch (error) {
      return false;
    }
  }

  private async getUserNotificationPreferences(userId: string): Promise<RealtimeNotificationOptions> {
    // Get user's notification preferences from database or return defaults
    return {
      enableBrowserNotifications: true,
      enableEmailNotifications: false,
      enableSlackNotifications: false,
      enableMobileNotifications: false,
      quietHours: {
        enabled: true,
        start: '22:00',
        end: '08:00',
        timezone: 'Asia/Shanghai'
      },
      priority: {
        high: true,
        medium: true,
        low: false
      },
      categories: ['urgent_email', 'workflow_completed', 'system_alert']
    };
  }

  private async saveUserNotificationPreferences(userId: string, preferences: RealtimeNotificationOptions): Promise<void> {
    // Save preferences to database
    logger.debug('Saving notification preferences', { userId });
  }

  private shouldDeliverNotification(notification: NotificationEvent, preferences: RealtimeNotificationOptions): boolean {
    // Check priority filter
    if (!preferences.priority[notification.priority]) {
      return false;
    }

    // Check category filter
    if (preferences.categories.length > 0 && !preferences.categories.includes(notification.type)) {
      return false;
    }

    // Check quiet hours
    if (preferences.quietHours.enabled) {
      const now = new Date();
      const currentTime = now.toLocaleTimeString('en-US', {
        hour12: false,
        timeZone: preferences.quietHours.timezone
      }).substr(0, 5);

      const startTime = preferences.quietHours.start;
      const endTime = preferences.quietHours.end;

      if (this.isInQuietHours(currentTime, startTime, endTime)) {
        // Only allow high priority notifications during quiet hours
        return notification.priority === 'high';
      }
    }

    return true;
  }

  private isInQuietHours(currentTime: string, startTime: string, endTime: string): boolean {
    // Handle time comparison considering overnight periods
    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  private async deliverViaWebSocket(
    notification: NotificationEvent,
    sessions: UserSession[]
  ): Promise<{ delivered: boolean; deliveredAt?: Date; error?: string }> {
    try {
      const payload = {
        id: notification.id,
        type: notification.type,
        priority: notification.priority,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        timestamp: notification.timestamp,
        expiresAt: notification.expiresAt
      };

      let delivered = false;
      const deliveredAt = new Date();

      for (const session of sessions) {
        const socket = this.io.sockets.sockets.get(session.socketId);
        if (socket && socket.connected) {
          socket.emit('notification', payload);
          delivered = true;
        }
      }

      return { delivered, deliveredAt: delivered ? deliveredAt : undefined };
    } catch (error) {
      return { delivered: false, error: error.message };
    }
  }

  private async deliverViaBrowser(notification: NotificationEvent): Promise<{ delivered: boolean; deliveredAt?: Date; error?: string }> {
    // Implement browser push notification via Web Push API
    try {
      // This would integrate with Web Push Protocol
      // For now, return success as placeholder
      return { delivered: true, deliveredAt: new Date() };
    } catch (error) {
      return { delivered: false, error: error.message };
    }
  }

  private async deliverViaEmail(notification: NotificationEvent): Promise<{ delivered: boolean; deliveredAt?: Date; error?: string }> {
    try {
      await this.notificationService.createNotification({
        userId: notification.userId,
        ruleId: null,
        templateId: 'email-notification-template', // You would have this template
        channelId: 'email-channel', // You would have this channel
        priority: this.mapPriorityToNumber(notification.priority),
        status: 'pending',
        title: notification.title,
        message: notification.message,
        data: notification.data,
        metadata: {
          sourceType: 'realtime',
          sourceId: notification.id,
          triggeredBy: notification.userId,
          retryCount: 0
        },
        deliveryResults: []
      });

      return { delivered: true, deliveredAt: new Date() };
    } catch (error) {
      return { delivered: false, error: error.message };
    }
  }

  private async deliverViaMobile(notification: NotificationEvent): Promise<{ delivered: boolean; deliveredAt?: Date; error?: string }> {
    // Implement mobile push notification via FCM/APNS
    try {
      // This would integrate with Firebase Cloud Messaging or Apple Push Notification Service
      // For now, return success as placeholder
      return { delivered: true, deliveredAt: new Date() };
    } catch (error) {
      return { delivered: false, error: error.message };
    }
  }

  private addPendingNotification(notification: NotificationEvent): void {
    if (!this.pendingNotifications.has(notification.userId)) {
      this.pendingNotifications.set(notification.userId, []);
    }

    const userNotifications = this.pendingNotifications.get(notification.userId)!;
    userNotifications.push(notification);

    // Limit pending notifications per user
    if (userNotifications.length > 100) {
      userNotifications.shift();
    }
  }

  private async deliverPendingNotifications(userId: string): Promise<void> {
    const pendingNotifications = this.pendingNotifications.get(userId) || [];

    if (pendingNotifications.length === 0) {
      return;
    }

    logger.info('Delivering pending notifications', {
      userId,
      count: pendingNotifications.length
    });

    const sessions = this.activeSessions.get(userId) || [];

    for (const notification of pendingNotifications) {
      // Check if notification is still valid (not expired)
      if (notification.expiresAt && notification.expiresAt < new Date()) {
        continue;
      }

      await this.deliverViaWebSocket(notification, sessions);
    }

    // Clear pending notifications after delivery
    this.pendingNotifications.delete(userId);
  }

  private async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    await this.notificationService.markAsRead(notificationId, userId);
  }

  private async dismissNotification(notificationId: string, userId: string): Promise<void> {
    // Implement notification dismissal logic
    logger.debug('Notification dismissed', { notificationId, userId });
  }

  private mapPriorityToNumber(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high': return 5;
      case 'medium': return 3;
      case 'low': return 1;
      default: return 3;
    }
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Background processors
   */
  private startDeliveryProcessor(): void {
    setInterval(() => {
      if (this.deliveryQueue.length > 0) {
        const notification = this.deliveryQueue.shift()!;
        this.sendRealtimeNotification(notification).catch(error => {
          logger.error('Error in delivery processor', {
            notificationId: notification.id,
            error
          });
        });
      }
    }, 1000); // Process every second
  }

  private startRetryProcessor(): void {
    setInterval(() => {
      if (this.retryQueue.length > 0) {
        const notification = this.retryQueue.shift()!;
        // Add delay before retry
        setTimeout(() => {
          this.sendRealtimeNotification(notification).catch(error => {
            logger.error('Error in retry processor', {
              notificationId: notification.id,
              error
            });
          });
        }, 30000); // Retry after 30 seconds
      }
    }, 60000); // Check every minute
  }

  private startSessionCleanup(): void {
    setInterval(() => {
      const now = new Date();
      const maxInactivityTime = 30 * 60 * 1000; // 30 minutes

      for (const [userId, sessions] of this.activeSessions) {
        const activeSessions = sessions.filter(session => {
          const inactiveTime = now.getTime() - session.lastActivity.getTime();
          return inactiveTime < maxInactivityTime;
        });

        if (activeSessions.length !== sessions.length) {
          if (activeSessions.length === 0) {
            this.activeSessions.delete(userId);
          } else {
            this.activeSessions.set(userId, activeSessions);
          }
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down real-time notification manager');

    // Disconnect all clients
    this.io.emit('server_shutdown', { message: 'Server is shutting down' });

    // Close Socket.IO server
    this.io.close();

    logger.info('Real-time notification manager shut down complete');
  }
}

export default RealtimeNotificationManager;