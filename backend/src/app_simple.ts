import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import config from '@/config';
import logger from '@/utils/logger';

/**
 * Simplified Express application
 * Basic HTTP server with minimal routes for testing
 */
class SimpleApp {
  public app: express.Application;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Basic middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: config.corsOrigins,
      credentials: true
    }));
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    if (config.isDevelopment) {
      this.app.use(morgan('dev'));
    }
  }

  private setupRoutes(): void {
    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        success: true,
        message: 'Email Assist Backend API is running',
        version: config.env.API_VERSION,
        environment: config.env.NODE_ENV,
        timestamp: new Date().toISOString()
      });
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // API info
    this.app.get('/api/v1', (req, res) => {
      res.json({
        success: true,
        message: 'Email Assist API v1',
        endpoints: {
          health: '/health',
          api: '/api/v1'
        },
        timestamp: new Date().toISOString()
      });
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found'
        }
      });
    });

    // Error handler
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error', error);

      res.status(error.status || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message || 'Internal server error'
        }
      });
    });
  }

  public async start(): Promise<void> {
    const port = config.env.PORT;

    this.app.listen(port, () => {
      logger.info(`Simple server started successfully`, {
        port,
        environment: config.env.NODE_ENV,
        apiVersion: config.env.API_VERSION
      });

      logger.info('Available endpoints:', {
        root: `http://localhost:${port}/`,
        health: `http://localhost:${port}/health`,
        api: `http://localhost:${port}/api/v1`
      });
    });
  }
}

export default SimpleApp;