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
  corsOptions
} from '@/middleware';
import { notFoundHandler, errorHandler, setupUncaughtExceptionHandlers } from '@/middleware/errorHandler';
import routes from '@/routes';
import emailRoutes from '@/routes/email';
import p1Routes from '@/routes/p1-features';
import { SocketService } from '@/services/SocketService';
import { createServer, Server as HTTPServer } from 'http';
// import EmailSyncService from '@/services/EmailSyncService';
// import EmailContentProcessor from '@/services/EmailContentProcessor';
// import BatchAnalysisProcessor from '@/services/BatchAnalysisProcessor';

/**
 * Express application setup
 * Configures middleware, routes, and error handling
 */
class App {
  public app: express.Application;
  private httpServer: HTTPServer;
  private socketService?: SocketService;
  private isInitialized = false;
  // private emailSyncService: any;
  // private contentProcessor: any;
  // private batchProcessor: any;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
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
      
      // Mount API routes
      this.app.use(API_CONFIG.BASE_PATH, routes);
      
      // Mount email routes
      this.app.use(`${API_CONFIG.BASE_PATH}/emails`, emailRoutes);

      // Mount P1 features routes
      this.app.use(`${API_CONFIG.BASE_PATH}/p1`, p1Routes);

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
    // Setup uncaught exception handlers
    setupUncaughtExceptionHandlers();
    
    // Handle 404 errors
    this.app.use(notFoundHandler);

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

      // Initialize Socket.IO service
      await this.initializeSocketService();

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

      this.httpServer.listen(port, () => {
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
   * Initialize Socket.IO service
   */
  private async initializeSocketService(): Promise<void> {
    try {
      logger.info('Initializing Socket.IO service...');

      // Initialize Socket.IO with database connection
      const dbInstance = database.getPool();
      const jwtSecret = config.env.JWT_SECRET || 'your-jwt-secret';

      this.socketService = new SocketService(this.httpServer, dbInstance, jwtSecret);

      logger.info('Socket.IO service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Socket.IO service:', error);
      throw error;
    }
  }

  /**
   * Initialize email services
   */
  private async initializeEmailServices(): Promise<void> {
    try {
      logger.info('Initializing email services...');

      // Initialize email sync service
      // this.emailSyncService = EmailSyncService.getInstance();

      // Initialize content processor
      // this.contentProcessor = EmailContentProcessor.getInstance();

      // Initialize batch analysis processor
      // this.batchProcessor = BatchAnalysisProcessor.getInstance();

      // Setup periodic cleanup for completed jobs
      setInterval(async () => {
        try {
          // await this.batchProcessor.cleanupCompletedJobs(24); // Clean jobs older than 24 hours
        } catch (error) {
          logger.error('Error in periodic job cleanup:', error);
        }
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
        // Cleanup batch processor jobs
        // if (this.batchProcessor) {
        //   await this.batchProcessor.cleanupCompletedJobs(0); // Clean all jobs
        // }

        // Close database connections
        await database.close();
        
        // Close Redis connection
        await redis.close();

        // Close Socket.IO service
        if (this.socketService) {
          await this.socketService.close();
        }

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

  /**
   * Get HTTP server instance
   */
  public getHttpServer(): HTTPServer {
    return this.httpServer;
  }

  /**
   * Get Socket.IO service instance
   */
  public getSocketService(): SocketService | undefined {
    return this.socketService;
  }
}

export default App;