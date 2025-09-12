// Register module aliases for runtime path resolution
import * as moduleAlias from 'module-alias';
import path from 'path';

// Setup aliases for the compiled JS files
// In production mode, files are in dist/ directory
// Map @/ to dist/ directory for compiled JS files
const distPath = path.resolve(__dirname);

moduleAlias.addAliases({
  '@': distPath,
  '@/config': path.resolve(distPath, 'config'),
  '@/controllers': path.resolve(distPath, 'controllers'), 
  '@/services': path.resolve(distPath, 'services'),
  '@/models': path.resolve(distPath, 'models'),
  '@/middleware': path.resolve(distPath, 'middleware'),
  '@/routes': path.resolve(distPath, 'routes'),
  '@/utils': path.resolve(distPath, 'utils'),
  '@/types': path.resolve(distPath, 'types')
});

import App from './app';
import logger from '@/utils/logger';

/**
 * Server entry point
 * Starts the Express application
 */
async function startServer(): Promise<void> {
  try {
    const app = new App();
    await app.start();
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Start the server
startServer();