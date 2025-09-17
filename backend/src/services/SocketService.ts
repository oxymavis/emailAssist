import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { verify } from 'jsonwebtoken';
import { Pool } from 'pg';
import { JWTPayload, User, WebSocketNotificationEvent } from '../types';

export interface SocketUser extends User {
  socketId: string;
}

export class SocketService {
  private io: SocketIOServer;
  private db: Pool;
  private jwtSecret: string;
  
  // Store connected users by userId
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private socketUsers: Map<string, SocketUser> = new Map(); // socketId -> user data

  constructor(server: HTTPServer, db: Pool, jwtSecret: string) {
    this.db = db;
    this.jwtSecret = jwtSecret;
    
    // Initialize Socket.IO server with CORS configuration
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupNamespaces();
    this.setupConnectionHandlers();
  }

  /**
   * Setup Socket.IO namespaces
   */
  private setupNamespaces(): void {
    // Main notifications namespace
    const notificationNamespace = this.io.of('/notifications');
    
    notificationNamespace.use(async (socket, next) => {
      try {
        await this.authenticateSocket(socket);
        next();
      } catch (error) {
        console.error('Socket authentication failed:', error);
        next(new Error('Authentication failed'));
      }
    });

    notificationNamespace.on('connection', (socket) => {
      this.handleNotificationConnection(socket);
    });

    // System events namespace (for system-wide notifications)
    const systemNamespace = this.io.of('/system');
    
    systemNamespace.use(async (socket, next) => {
      try {
        await this.authenticateSocket(socket);
        // Only allow admin users in system namespace
        const user = (socket as any).user as User;
        if (user.role !== 'admin') {
          next(new Error('Admin access required'));
          return;
        }
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });

    systemNamespace.on('connection', (socket) => {
      this.handleSystemConnection(socket);
    });
  }

  /**
   * Setup general connection handlers
   */
  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);
      
      socket.on('disconnect', (reason) => {
        console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
        this.handleDisconnection(socket);
      });

      socket.on('error', (error) => {
        console.error(`Socket error: ${socket.id}`, error);
      });
    });

    // Handle server shutdown
    process.on('SIGINT', () => {
      console.log('Shutting down Socket.IO server...');
      this.io.close(() => {
        console.log('Socket.IO server closed');
      });
    });
  }

  /**
   * Authenticate socket connection using JWT token
   */
  private async authenticateSocket(socket: Socket): Promise<void> {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error('No authentication token provided');
    }

    try {
      // Verify JWT token
      const decoded = verify(token, this.jwtSecret) as JWTPayload;
      
      // Get user from database
      const user = await this.getUserById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Attach user to socket
      (socket as any).user = user;
      console.log(`Socket ${socket.id} authenticated for user ${user.email}`);
    } catch (error) {
      console.error('Socket authentication error:', error);
      throw new Error('Invalid authentication token');
    }
  }

  /**
   * Handle notification namespace connections
   */
  private handleNotificationConnection(socket: Socket): void {
    const user = (socket as any).user as User;
    const userRoom = `user:${user.id}`;
    
    // Join user to their personal room
    socket.join(userRoom);
    
    // Track connected user
    this.trackConnection(user, socket.id);
    
    console.log(`User ${user.email} connected to notifications (socket: ${socket.id})`);
    
    // Send connection confirmation
    socket.emit('notification_connected', {
      message: 'Connected to notification service',
      userId: user.id,
      timestamp: new Date()
    });

    // Handle user-specific events
    socket.on('get_notification_count', async () => {
      try {
        const count = await this.getUnreadNotificationCount(user.id);
        socket.emit('notification_count', { count, timestamp: new Date() });
      } catch (error) {
        socket.emit('error', { message: 'Failed to get notification count' });
      }
    });

    socket.on('mark_all_read', async () => {
      try {
        await this.markAllNotificationsRead(user.id);
        socket.emit('notifications_marked_read', { timestamp: new Date() });
        
        // Broadcast to all user's connected sockets
        this.io.of('/notifications').to(userRoom).emit('notification_update', {
          type: 'mark_all_read',
          userId: user.id,
          timestamp: new Date()
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to mark notifications as read' });
      }
    });

    socket.on('join_email_room', (emailId: string) => {
      // Join room for specific email notifications
      const emailRoom = `email:${emailId}`;
      socket.join(emailRoom);
      socket.emit('joined_email_room', { emailId, timestamp: new Date() });
    });

    socket.on('leave_email_room', (emailId: string) => {
      const emailRoom = `email:${emailId}`;
      socket.leave(emailRoom);
      socket.emit('left_email_room', { emailId, timestamp: new Date() });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleUserDisconnection(user, socket.id);
    });
  }

  /**
   * Handle system namespace connections
   */
  private handleSystemConnection(socket: Socket): void {
    const user = (socket as any).user as User;
    
    // Join admin room
    socket.join('admin');
    
    console.log(`Admin user ${user.email} connected to system notifications`);
    
    socket.emit('system_connected', {
      message: 'Connected to system notification service',
      userId: user.id,
      timestamp: new Date()
    });

    // Handle system events
    socket.on('get_system_stats', async () => {
      try {
        const stats = await this.getSystemNotificationStats();
        socket.emit('system_stats', stats);
      } catch (error) {
        socket.emit('error', { message: 'Failed to get system stats' });
      }
    });

    socket.on('get_queue_status', async () => {
      try {
        // This would be implemented in the notification service
        socket.emit('queue_status', { 
          pending: 0, 
          processing: 0, 
          failed: 0,
          timestamp: new Date() 
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to get queue status' });
      }
    });
  }

  /**
   * Send notification to user
   */
  async sendNotificationToUser(
    userId: string, 
    notification: WebSocketNotificationEvent
  ): Promise<boolean> {
    try {
      const userRoom = `user:${userId}`;
      const socketsInRoom = await this.io.of('/notifications').in(userRoom).allSockets();
      
      if (socketsInRoom.size === 0) {
        console.log(`No active sockets for user ${userId}`);
        return false;
      }

      // Send notification to all user's connected sockets
      this.io.of('/notifications').to(userRoom).emit('notification', notification);
      
      console.log(`Notification sent to user ${userId} (${socketsInRoom.size} sockets)`);
      return true;
    } catch (error) {
      console.error('Error sending notification to user:', error);
      return false;
    }
  }

  /**
   * Send notification to specific email room
   */
  async sendNotificationToEmailRoom(
    emailId: string,
    notification: WebSocketNotificationEvent
  ): Promise<boolean> {
    try {
      const emailRoom = `email:${emailId}`;
      const socketsInRoom = await this.io.of('/notifications').in(emailRoom).allSockets();
      
      if (socketsInRoom.size === 0) {
        return false;
      }

      this.io.of('/notifications').to(emailRoom).emit('email_notification', notification);
      return true;
    } catch (error) {
      console.error('Error sending notification to email room:', error);
      return false;
    }
  }

  /**
   * Broadcast system notification to all admin users
   */
  async broadcastSystemNotification(notification: WebSocketNotificationEvent): Promise<void> {
    try {
      this.io.of('/system').to('admin').emit('system_notification', notification);
      console.log('System notification broadcasted to all admin users');
    } catch (error) {
      console.error('Error broadcasting system notification:', error);
    }
  }

  /**
   * Send notification to all connected users
   */
  async broadcastToAllUsers(notification: WebSocketNotificationEvent): Promise<void> {
    try {
      this.io.of('/notifications').emit('global_notification', notification);
      console.log('Notification broadcasted to all connected users');
    } catch (error) {
      console.error('Error broadcasting to all users:', error);
    }
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Get connected sockets count
   */
  getConnectedSocketsCount(): number {
    return this.socketUsers.size;
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId) && this.connectedUsers.get(userId)!.size > 0;
  }

  /**
   * Get online users in room
   */
  async getOnlineUsersInRoom(roomName: string): Promise<string[]> {
    try {
      const socketsInRoom = await this.io.of('/notifications').in(roomName).allSockets();
      const userIds: string[] = [];
      
      for (const socketId of socketsInRoom) {
        const socketUser = this.socketUsers.get(socketId);
        if (socketUser && !userIds.includes(socketUser.id)) {
          userIds.push(socketUser.id);
        }
      }
      
      return userIds;
    } catch (error) {
      console.error('Error getting online users in room:', error);
      return [];
    }
  }

  /**
   * Get Socket.IO server instance
   */
  getIOServer(): SocketIOServer {
    return this.io;
  }

  // =============================================
  // Private Helper Methods
  // =============================================

  private trackConnection(user: User, socketId: string): void {
    // Track socket user
    this.socketUsers.set(socketId, {
      ...user,
      socketId
    });

    // Track user connections
    if (!this.connectedUsers.has(user.id)) {
      this.connectedUsers.set(user.id, new Set());
    }
    this.connectedUsers.get(user.id)!.add(socketId);
  }

  private handleDisconnection(socket: Socket): void {
    const socketUser = this.socketUsers.get(socket.id);
    if (socketUser) {
      this.handleUserDisconnection(socketUser, socket.id);
    }
  }

  private handleUserDisconnection(user: User, socketId: string): void {
    // Remove from socket users
    this.socketUsers.delete(socketId);
    
    // Remove from user connections
    const userSockets = this.connectedUsers.get(user.id);
    if (userSockets) {
      userSockets.delete(socketId);
      
      // If no more sockets for this user, remove user
      if (userSockets.size === 0) {
        this.connectedUsers.delete(user.id);
        console.log(`User ${user.email} disconnected completely`);
      } else {
        console.log(`User ${user.email} disconnected (${userSockets.size} sockets remaining)`);
      }
    }
  }

  private async getUserById(userId: string): Promise<User | null> {
    const client = await this.db.connect();
    
    try {
      const query = 'SELECT * FROM users WHERE id = $1';
      const result = await client.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        avatar: row.avatar,
        role: row.role,
        settings: JSON.parse(row.settings || '{}'),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
    } catch (error) {
      console.error('Error getting user by id:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async getUnreadNotificationCount(userId: string): Promise<number> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT COUNT(*) as count 
        FROM notifications 
        WHERE user_id = $1 AND read_at IS NULL AND archived_at IS NULL
      `;
      const result = await client.query(query, [userId]);
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async markAllNotificationsRead(userId: string): Promise<void> {
    const client = await this.db.connect();
    
    try {
      const query = `
        UPDATE notifications 
        SET read_at = NOW() 
        WHERE user_id = $1 AND read_at IS NULL
      `;
      await client.query(query, [userId]);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async getSystemNotificationStats(): Promise<any> {
    // This would be implemented to get system-wide notification statistics
    return {
      totalUsers: this.getConnectedUsersCount(),
      totalSockets: this.getConnectedSocketsCount(),
      queueStatus: {
        pending: 0,
        processing: 0,
        failed: 0
      },
      timestamp: new Date()
    };
  }

  /**
   * Close Socket.IO server
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => {
        console.log('Socket.IO server closed');
        resolve();
      });
    });
  }
}