import { Pool } from 'pg';
import { Server as HTTPServer } from 'http';
import { Router } from 'express';
import { NotificationService } from './NotificationService';
import { NotificationController } from '../controllers/NotificationController';
import { TemplateEngine } from './TemplateEngine';
import { NotificationQueue } from './NotificationQueue';
import { NotificationChannelManager } from './NotificationChannelManager';
import { NotificationRuleEngine } from './NotificationRuleEngine';
import { NotificationTemplateManager } from './NotificationTemplateManager';
import { SocketService } from './SocketService';
import { UnifiedCacheManager } from './UnifiedCacheManager';
import { createNotificationRoutes } from '../routes/notifications';
import { v4 as uuidv4 } from 'uuid';

export interface NotificationSystemConfig {
  db: Pool;
  server: HTTPServer;
  cache: UnifiedCacheManager;
  jwtSecret: string;
  redisConfig?: any;
}

export class NotificationSystemInitializer {
  private config: NotificationSystemConfig;
  private services: {
    notificationService?: NotificationService;
    templateEngine?: TemplateEngine;
    queue?: NotificationQueue;
    channelManager?: NotificationChannelManager;
    ruleEngine?: NotificationRuleEngine;
    templateManager?: NotificationTemplateManager;
    socketService?: SocketService;
  } = {};
  private isInitialized = false;

  constructor(config: NotificationSystemConfig) {
    this.config = config;
  }

  /**
   * Initialize the complete notification system
   */
  async initialize(): Promise<{
    notificationService: NotificationService;
    notificationRoutes: Router;
    socketService: SocketService;
  }> {
    if (this.isInitialized) {
      throw new Error('Notification system is already initialized');
    }

    try {
      console.log('🔔 Initializing notification system...');
      
      // Step 1: Initialize core services
      await this.initializeCoreServices();
      
      // Step 2: Initialize default channels
      await this.initializeDefaultChannels();
      
      // Step 3: Initialize system templates
      await this.initializeSystemTemplates();
      
      // Step 4: Setup notification queue processing
      await this.setupQueueProcessing();
      
      // Step 5: Initialize rule engine
      await this.initializeRuleEngine();
      
      // Step 6: Create notification routes
      const notificationRoutes = this.createNotificationRoutes();
      
      console.log('✅ Notification system initialized successfully');
      this.isInitialized = true;
      
      return {
        notificationService: this.services.notificationService!,
        notificationRoutes,
        socketService: this.services.socketService!
      };
    } catch (error) {
      console.error('❌ Failed to initialize notification system:', error);
      throw error;
    }
  }

  /**
   * Initialize core notification services
   */
  private async initializeCoreServices(): Promise<void> {
    console.log('📦 Initializing core notification services...');
    
    // Initialize SocketService first
    this.services.socketService = new SocketService(
      this.config.server,
      this.config.db,
      this.config.jwtSecret
    );
    
    // Initialize TemplateEngine
    this.services.templateEngine = new TemplateEngine();
    
    // Initialize NotificationQueue
    this.services.queue = new NotificationQueue(
      this.config.db,
      this.config.cache,
      this.config.redisConfig
    );
    
    // Initialize NotificationChannelManager
    this.services.channelManager = new NotificationChannelManager(
      this.services.templateEngine,
      this.services.socketService.getIOServer()
    );
    
    // Initialize NotificationService
    this.services.notificationService = new NotificationService(
      this.config.db,
      this.config.cache,
      this.services.templateEngine,
      this.services.queue,
      this.services.channelManager
    );
    
    // Initialize NotificationTemplateManager
    this.services.templateManager = new NotificationTemplateManager(
      this.config.db
    );
    
    console.log('✅ Core notification services initialized');
  }

  /**
   * Initialize default notification channels
   */
  private async initializeDefaultChannels(): Promise<void> {
    console.log('📡 Initializing default notification channels...');
    
    try {
      // Check if default channels already exist
      const existingChannels = await this.services.notificationService!.getChannels();
      const channelTypes = existingChannels.map(c => c.type);
      
      const defaultChannels = [];
      
      // WebSocket channel
      if (!channelTypes.includes('websocket')) {
        defaultChannels.push({
          name: 'WebSocket实时通知',
          type: 'websocket' as const,
          isEnabled: true,
          config: {
            socketNamespace: '/notifications'
          },
          retryConfig: {
            maxAttempts: 3,
            retryDelay: 5,
            backoffMultiplier: 1.5
          }
        });
      }
      
      // Email channel
      if (!channelTypes.includes('email')) {
        defaultChannels.push({
          name: '邮件通知',
          type: 'email' as const,
          isEnabled: false, // Disabled by default until SMTP is configured
          config: {
            smtpSettings: {
              host: process.env.SMTP_HOST || 'smtp.gmail.com',
              port: parseInt(process.env.SMTP_PORT || '587'),
              secure: false,
              auth: {
                user: process.env.SMTP_USER || '',
                pass: process.env.SMTP_PASS || ''
              }
            }
          },
          retryConfig: {
            maxAttempts: 3,
            retryDelay: 60,
            backoffMultiplier: 2
          }
        });
      }
      
      // Webhook channel
      if (!channelTypes.includes('webhook')) {
        defaultChannels.push({
          name: 'Webhook集成',
          type: 'webhook' as const,
          isEnabled: false, // Disabled by default until webhook URL is configured
          config: {
            webhookUrl: '',
            webhookSecret: '',
            webhookHeaders: {
              'Content-Type': 'application/json',
              'User-Agent': 'EmailAssist-Notification-Service/1.0'
            }
          },
          retryConfig: {
            maxAttempts: 3,
            retryDelay: 30,
            backoffMultiplier: 2
          }
        });
      }
      
      // Create default channels
      for (const channelData of defaultChannels) {
        try {
          await this.services.notificationService!.createChannel(channelData);
          console.log(`Created default ${channelData.type} channel`);
        } catch (error) {
          console.error(`Failed to create ${channelData.type} channel:`, error);
        }
      }
      
      console.log('✅ Default notification channels initialized');
    } catch (error) {
      console.error('❌ Failed to initialize default channels:', error);
      throw error;
    }
  }

  /**
   * Initialize system templates
   */
  private async initializeSystemTemplates(): Promise<void> {
    console.log('📄 Initializing system notification templates...');
    
    try {
      // Get all channels to pass to template manager
      const channels = await this.services.notificationService!.getChannels();
      
      // Initialize system templates
      await this.services.templateManager!.initializeSystemTemplates(channels);
      
      console.log('✅ System notification templates initialized');
    } catch (error) {
      console.error('❌ Failed to initialize system templates:', error);
      throw error;
    }
  }

  /**
   * Setup notification queue processing
   */
  private async setupQueueProcessing(): Promise<void> {
    console.log('⚡ Setting up notification queue processing...');
    
    try {
      // Register the main notification processor
      this.services.queue!.registerProcessor('notification-processor', async (job) => {
        const notification = job.data;
        
        try {
          await this.services.notificationService!.processNotification(notification.id);
        } catch (error) {
          console.error(`Error processing notification ${notification.id}:`, error);
          throw error;
        }
      });
      
      console.log('✅ Notification queue processing setup complete');
    } catch (error) {
      console.error('❌ Failed to setup queue processing:', error);
      throw error;
    }
  }

  /**
   * Initialize notification rule engine
   */
  private async initializeRuleEngine(): Promise<void> {
    console.log('🧠 Initializing notification rule engine...');
    
    try {
      this.services.ruleEngine = new NotificationRuleEngine(
        this.config.db,
        this.config.cache,
        this.services.notificationService!
      );
      
      console.log('✅ Notification rule engine initialized');
    } catch (error) {
      console.error('❌ Failed to initialize rule engine:', error);
      throw error;
    }
  }

  /**
   * Create notification routes
   */
  private createNotificationRoutes(): Router {
    console.log('🛣️ Creating notification routes...');
    
    const notificationController = new NotificationController(
      this.services.notificationService!
    );
    
    const routes = createNotificationRoutes(notificationController);
    
    console.log('✅ Notification routes created');
    return routes;
  }

  /**
   * Get notification services
   */
  getServices() {
    if (!this.isInitialized) {
      throw new Error('Notification system is not initialized');
    }
    
    return {
      notificationService: this.services.notificationService!,
      templateEngine: this.services.templateEngine!,
      queue: this.services.queue!,
      channelManager: this.services.channelManager!,
      ruleEngine: this.services.ruleEngine!,
      templateManager: this.services.templateManager!,
      socketService: this.services.socketService!
    };
  }

  /**
   * Get rule engine for external integration
   */
  getRuleEngine(): NotificationRuleEngine {
    if (!this.services.ruleEngine) {
      throw new Error('Rule engine is not initialized');
    }
    return this.services.ruleEngine;
  }

  /**
   * Get socket service for external integration
   */
  getSocketService(): SocketService {
    if (!this.services.socketService) {
      throw new Error('Socket service is not initialized');
    }
    return this.services.socketService;
  }

  /**
   * Trigger notification from external systems
   */
  async triggerNotification(trigger: {
    type: 'email_analysis' | 'filter_rule' | 'system_event' | 'api_trigger';
    userId: string;
    data: Record<string, any>;
    sourceId?: string;
    priority?: number;
  }): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Notification system is not initialized');
    }

    try {
      await this.services.notificationService!.triggerNotification(trigger);
    } catch (error) {
      console.error('Error triggering notification:', error);
      throw error;
    }
  }

  /**
   * Integration method for email analysis system
   */
  async onEmailAnalyzed(
    userId: string,
    emailMessage: any,
    analysisResult: any
  ): Promise<void> {
    if (!this.services.ruleEngine) {
      console.log('Rule engine not initialized, skipping email analysis notification');
      return;
    }

    try {
      await this.services.ruleEngine.evaluateEmailAnalysisRules(
        userId,
        emailMessage,
        analysisResult
      );
    } catch (error) {
      console.error('Error evaluating email analysis rules:', error);
    }
  }

  /**
   * Integration method for filter rule system
   */
  async onFilterRuleExecuted(
    userId: string,
    ruleId: string,
    emailMessage: any,
    executionResult: any
  ): Promise<void> {
    if (!this.services.ruleEngine) {
      console.log('Rule engine not initialized, skipping filter rule notification');
      return;
    }

    try {
      await this.services.ruleEngine.evaluateFilterRuleRules(
        userId,
        ruleId,
        emailMessage,
        executionResult
      );
    } catch (error) {
      console.error('Error evaluating filter rule rules:', error);
    }
  }

  /**
   * Integration method for system events
   */
  async onSystemEvent(
    eventType: string,
    eventData: any,
    affectedUserId?: string
  ): Promise<void> {
    if (!this.services.ruleEngine) {
      console.log('Rule engine not initialized, skipping system event notification');
      return;
    }

    try {
      await this.services.ruleEngine.evaluateSystemEventRules(
        eventType,
        eventData,
        affectedUserId
      );
    } catch (error) {
      console.error('Error evaluating system event rules:', error);
    }
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, boolean>;
    queueStatus?: any;
    connectedUsers?: number;
  }> {
    const serviceStatus: Record<string, boolean> = {};
    
    try {
      // Check core services
      serviceStatus.notificationService = !!this.services.notificationService;
      serviceStatus.templateEngine = !!this.services.templateEngine;
      serviceStatus.queue = !!this.services.queue;
      serviceStatus.channelManager = !!this.services.channelManager;
      serviceStatus.ruleEngine = !!this.services.ruleEngine;
      serviceStatus.socketService = !!this.services.socketService;
      
      // Check queue health
      let queueStatus;
      if (this.services.queue) {
        queueStatus = await this.services.queue.getHealthStatus();
      }
      
      // Check connected users
      let connectedUsers = 0;
      if (this.services.socketService) {
        connectedUsers = this.services.socketService.getConnectedUsersCount();
      }
      
      // Determine overall status
      const healthyServices = Object.values(serviceStatus).filter(Boolean).length;
      const totalServices = Object.keys(serviceStatus).length;
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (healthyServices === totalServices) {
        status = queueStatus?.status === 'unhealthy' ? 'degraded' : 'healthy';
      } else if (healthyServices >= totalServices * 0.7) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }
      
      return {
        status,
        services: serviceStatus,
        queueStatus,
        connectedUsers
      };
    } catch (error) {
      console.error('Error getting health status:', error);
      return {
        status: 'unhealthy',
        services: serviceStatus
      };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up notification system...');
    
    try {
      if (this.services.ruleEngine) {
        await this.services.ruleEngine.cleanup();
      }
      
      if (this.services.queue) {
        await this.services.queue.close();
      }
      
      if (this.services.channelManager) {
        await this.services.channelManager.close();
      }
      
      if (this.services.socketService) {
        await this.services.socketService.close();
      }
      
      console.log('✅ Notification system cleanup complete');
    } catch (error) {
      console.error('❌ Error during notification system cleanup:', error);
      throw error;
    }
  }
}