import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import config, { API_CONFIG } from '@/config';
import database, { createTables } from '@/config/database';
import redis from '@/config/redis';
import logger from '@/utils/logger';
import {
  requestId,
  requestLogger,
  securityHeaders,
  globalRateLimit,
  notFound,
  errorHandler,
  corsOptions
} from '@/middleware';
import routes, { createRoutes } from '@/routes';
import { EmailServiceFactory } from './services/email/EmailServiceFactory';
import { EmailSyncService } from './services/email/EmailSyncService';
import { EmailServiceMonitor } from './services/monitoring/EmailServiceMonitor';
import { DatabaseService } from './services/database/DatabaseService';

/**
 * Express application setup
 * Configures middleware, routes, and error handling
 */
class App {
  public app: express.Application;
  private isInitialized = false;
  private emailServiceFactory: EmailServiceFactory;
  private emailSyncService: EmailSyncService;
  private emailServiceMonitor: EmailServiceMonitor;
  private databaseService: DatabaseService;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupBasicRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https://graph.microsoft.com", "https://login.microsoftonline.com"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false // Disable for Graph API compatibility
    }));

    // CORS configuration
    this.app.use(cors(corsOptions));

    // Request processing middleware
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request tracking and logging
    this.app.use(requestId);
    this.app.use(securityHeaders);

    // HTTP request logging
    if (config.isDevelopment) {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined', {
        stream: {
          write: (message: string) => {
            logger.info(message.trim());
          }
        }
      }));
    }

    this.app.use(requestLogger);

    // Rate limiting
    this.app.use(globalRateLimit);

    // Trust proxy for accurate IP addresses
    this.app.set('trust proxy', 1);
  }

  /**
   * Setup basic API routes that don't require database connections
   */
  private setupBasicRoutes(): void {
    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        success: true,
        data: {
          name: 'Email Assist Backend API',
          version: config.env.API_VERSION,
          environment: config.env.NODE_ENV,
          status: 'running',
          timestamp: new Date().toISOString(),
          documentation: `${API_CONFIG.BASE_PATH}/`
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: res.locals.requestId
        }
      });
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: config.env.NODE_ENV,
          version: config.env.API_VERSION
        }
      });
    });
  }

  /**
   * Setup API routes that require database connections
   */
  private setupDatabaseRoutes(): void {
    try {
      logger.info('Setting up database routes...');
      // Mount API routes with database connections
      const apiRoutes = createRoutes(database.getPool(), redis);
      this.app.use(API_CONFIG.BASE_PATH, apiRoutes);
      logger.info(`API routes mounted at ${API_CONFIG.BASE_PATH}`);
    } catch (error) {
      logger.error('Failed to setup database routes', error);
      throw error;
    }
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // Handle 404 errors
    this.app.use(notFound);

    // Global error handler (must be last)
    this.app.use(errorHandler);
  }

  /**
   * Initialize database and Redis connections
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('App already initialized');
      return;
    }

    try {
      logger.info('Initializing application...');

      // Initialize database connection
      await database.initialize();
      
      // Create database tables if they don't exist
      await createTables();

      // Initialize Redis connection
      await redis.initialize();

      // Initialize email services
      await this.initializeEmailServices();

      // Setup database routes after initialization
      this.setupDatabaseRoutes();

      this.isInitialized = true;
      logger.info('Application initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize application', error);
      throw error;
    }
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    try {
      // Initialize connections first
      if (!this.isInitialized) {
        await this.initialize();
      }

      const port = config.env.PORT;
      
      this.app.listen(port, () => {
        logger.info(`Server started successfully`, {
          port,
          environment: config.env.NODE_ENV,
          apiVersion: config.env.API_VERSION,
          baseUrl: `http://localhost:${port}${API_CONFIG.BASE_PATH}`
        });

        // Log available endpoints
        logger.info('Available endpoints:', {
          root: `http://localhost:${port}/`,
          api: `http://localhost:${port}${API_CONFIG.BASE_PATH}/`,
          health: `http://localhost:${port}/health`,
          auth: `http://localhost:${port}${API_CONFIG.BASE_PATH}/auth`,
          email: `http://localhost:${port}${API_CONFIG.BASE_PATH}/email`
        });
      });

      // Handle graceful shutdown
      this.setupGracefulShutdown();
    } catch (error) {
      logger.error('Failed to start server', error);
      throw error;
    }
  }

  /**
   * Initialize email services
   */
  private async initializeEmailServices(): Promise<void> {
    try {
      logger.info('Initializing email services...');

      // Initialize database service
      this.databaseService = DatabaseService.getInstance();

      // Initialize email service factory
      this.emailServiceFactory = EmailServiceFactory.getInstance();

      // Initialize email sync service
      this.emailSyncService = EmailSyncService.getInstance();

      // Initialize email service monitor
      this.emailServiceMonitor = EmailServiceMonitor.getInstance();

      // Setup periodic sync for all accounts
      setInterval(async () => {
        try {
          await this.emailSyncService.schedulePeriodicSync();
        } catch (error) {
          logger.error('Error in periodic sync:', error);
        }
      }, 5 * 60 * 1000); // Every 5 minutes

      // Setup periodic cleanup
      setInterval(() => {
        this.emailSyncService.cleanupCompletedOperations();
      }, 60 * 60 * 1000); // Every hour

      logger.info('Email services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email services:', error);
      throw error;
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      try {
        // Shutdown email services
        if (this.emailSyncService) {
          await this.emailSyncService.shutdown();
        }
        if (this.emailServiceFactory) {
          await this.emailServiceFactory.cleanup();
        }
        if (this.emailServiceMonitor) {
          this.emailServiceMonitor.shutdown();
        }
        if (this.databaseService) {
          await this.databaseService.shutdown();
        }

        // Close database connections
        await database.close();
        
        // Close Redis connection
        await redis.close();
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', error);
        process.exit(1);
      }
    };

    // Handle different shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      process.exit(1);
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', { promise, reason });
      process.exit(1);
    });
  }

  /**
   * Get Express app instance
   */
  public getApp(): express.Application {
    return this.app;
  }
}

export default App;