// Register module aliases for runtime path resolution
import * as moduleAlias from 'module-alias';
import path from 'path';

// Setup aliases for the compiled JS files
const distPath = path.resolve(__dirname);

moduleAlias.addAliases({
  '@': distPath,
  '@/config': path.resolve(distPath, 'config'),
  '@/utils': path.resolve(distPath, 'utils')
});

import SimpleApp from './app_simple';
import logger from '@/utils/logger';

/**
 * Simple server entry point
 * Starts basic HTTP server for testing
 */
async function startServer(): Promise<void> {
  try {
    const app = new SimpleApp();
    await app.start();
  } catch (error) {
    logger.error('Failed to start simple server', error);
    process.exit(1);
  }
}

// Start the server
startServer();