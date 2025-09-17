import { createClient, RedisClientType } from 'redis';
import config from '@/config';
import logger from '@/utils/logger';

/**
 * Redis client manager
 * Handles Redis connection and provides caching utilities
 */
class RedisManager {
  private static instance: RedisManager;
  private client: RedisClientType | null = null;
  private isConnected = false;

  private constructor() {
    // Initialize will be called explicitly
  }

  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  /**
   * Initialize Redis connection
   */
  public async initialize(): Promise<void> {
    try {
      const redisConfig = config.redisConfig;
      
      this.client = createClient({
        url: config.env.REDIS_URL,
        socket: {
          host: redisConfig.host,
          port: redisConfig.port,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Redis reconnection failed after 10 attempts');
              return new Error('Redis connection failed');
            }
            return Math.min(retries * 50, 1000);
          }
        },
        password: redisConfig.password,
        database: redisConfig.db
      });

      // Set up event listeners
      this.client.on('connect', () => {
        logger.info('Redis client connecting...');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        logger.info('Redis client ready and connected');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        logger.error('Redis client error:', err);
      });

      this.client.on('end', () => {
        this.isConnected = false;
        logger.info('Redis client connection closed');
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis client reconnecting...');
      });

      // Connect to Redis
      await this.client.connect();
      
      // Test connection
      await this.client.ping();
      logger.info('Redis connection established successfully');

    } catch (error) {
      logger.error('Failed to initialize Redis connection', error);
      // Don't throw error - the app should work without Redis
      logger.warn('Application will continue without Redis caching');
    }
  }

  /**
   * Get Redis client
   */
  public getClient(): RedisClientType | null {
    return this.client;
  }

  /**
   * Check if Redis is connected
   */
  public isRedisConnected(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Set a key-value pair with TTL (legacy method name)
   */
  public async setex(key: string, ttlSeconds: number, value: string | object): Promise<boolean> {
    return this.set(key, value, ttlSeconds);
  }

  /**
   * Set a key-value pair with TTL
   */
  public async set(key: string, value: string | object, ttlSeconds?: number): Promise<boolean> {
    if (!this.isRedisConnected()) {
      logger.debug('Redis not connected, skipping set operation');
      return false;
    }

    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (ttlSeconds) {
        await this.client!.setEx(key, ttlSeconds, serializedValue);
      } else {
        await this.client!.set(key, serializedValue);
      }
      
      return true;
    } catch (error) {
      logger.error('Redis set operation failed', { key, error });
      return false;
    }
  }

  /**
   * Get value by key
   */
  public async get(key: string): Promise<string | null> {
    if (!this.isRedisConnected()) {
      logger.debug('Redis not connected, skipping get operation');
      return null;
    }

    try {
      const value = await this.client!.get(key);
      return typeof value === 'string' ? value : null;
    } catch (error) {
      logger.error('Redis get operation failed', { key, error });
      return null;
    }
  }

  /**
   * Get and parse JSON value
   */
  public async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Failed to parse JSON from Redis', { key, error });
      return null;
    }
  }

  /**
   * Delete a key
   */
  public async delete(key: string): Promise<boolean> {
    if (!this.isRedisConnected()) {
      logger.debug('Redis not connected, skipping delete operation');
      return false;
    }

    try {
      const result = await this.client!.del(key);
      return result > 0;
    } catch (error) {
      logger.error('Redis delete operation failed', { key, error });
      return false;
    }
  }

  /**
   * Check if key exists
   */
  public async exists(key: string): Promise<boolean> {
    if (!this.isRedisConnected()) {
      return false;
    }

    try {
      const result = await this.client!.exists(key);
      return result > 0;
    } catch (error) {
      logger.error('Redis exists operation failed', { key, error });
      return false;
    }
  }

  /**
   * Set TTL for existing key
   */
  public async expire(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.isRedisConnected()) {
      return false;
    }

    try {
      const result = await this.client!.expire(key, ttlSeconds);
      return Boolean(result);
    } catch (error) {
      logger.error('Redis expire operation failed', { key, error });
      return false;
    }
  }

  /**
   * Increment a numeric value
   */
  public async increment(key: string, increment = 1): Promise<number | null> {
    if (!this.isRedisConnected()) {
      return null;
    }

    try {
      if (increment === 1) {
        return await this.client!.incr(key);
      } else {
        return await this.client!.incrBy(key, increment);
      }
    } catch (error) {
      logger.error('Redis increment operation failed', { key, error });
      return null;
    }
  }

  /**
   * Get multiple keys with pattern matching
   */
  public async keys(pattern: string): Promise<string[]> {
    if (!this.isRedisConnected()) {
      return [];
    }

    try {
      return await this.client!.keys(pattern);
    } catch (error) {
      logger.error('Redis keys operation failed', { pattern, error });
      return [];
    }
  }

  /**
   * Delete multiple keys with pattern matching
   */
  public async deletePattern(pattern: string): Promise<number> {
    if (!this.isRedisConnected()) {
      return 0;
    }

    try {
      const keys = await this.keys(pattern);
      if (keys.length === 0) return 0;
      
      return await this.client!.del(keys);
    } catch (error) {
      logger.error('Redis delete pattern operation failed', { pattern, error });
      return 0;
    }
  }

  /**
   * Close Redis connection
   */
  public async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        logger.info('Redis connection closed');
      } catch (error) {
        logger.error('Error closing Redis connection', error);
      }
    }
  }

  /**
   * Health check for Redis connectivity
   */
  public async healthCheck(): Promise<boolean> {
    if (!this.isRedisConnected()) {
      return false;
    }

    try {
      await this.client!.ping();
      return true;
    } catch (error) {
      logger.error('Redis health check failed', error);
      return false;
    }
  }

  /**
   * Create Redis pipeline for batch operations
   */
  public pipeline(): any {
    if (!this.isRedisConnected()) {
      return null;
    }
    return this.client!.multi();
  }

  /**
   * Delete key (alias for delete method)
   */
  public async del(key: string | string[]): Promise<number> {
    if (!this.isRedisConnected()) {
      return 0;
    }

    try {
      if (Array.isArray(key)) {
        return await this.client!.del(key);
      } else {
        return await this.client!.del(key);
      }
    } catch (error) {
      logger.error('Redis del operation failed', { key, error });
      return 0;
    }
  }

  /**
   * Get Redis server info
   */
  public async info(section?: string): Promise<string> {
    if (!this.isRedisConnected()) {
      return '';
    }

    try {
      return await this.client!.info(section);
    } catch (error) {
      logger.error('Redis info operation failed', { section, error });
      return '';
    }
  }

  /**
   * Get TTL for a key
   */
  public async ttl(key: string): Promise<number> {
    if (!this.isRedisConnected()) {
      return -1;
    }

    try {
      return await this.client!.ttl(key);
    } catch (error) {
      logger.error('Redis ttl operation failed', { key, error });
      return -1;
    }
  }

  /**
   * Increment key (alias for increment method)
   */
  public async incr(key: string): Promise<number | null> {
    return this.increment(key, 1);
  }

  /**
   * Get multiple keys at once
   */
  public async mget(keys: string[]): Promise<(string | null)[]> {
    if (!this.isRedisConnected()) {
      return keys.map(() => null);
    }

    try {
      const results = await this.client!.mGet(keys);
      // Ensure we return string | null array, not RedisCommandRawReply
      return results.map(result => typeof result === 'string' ? result : null);
    } catch (error) {
      logger.error('Redis mget operation failed', { keys, error });
      return keys.map(() => null);
    }
  }

  /**
   * Ping Redis server
   */
  public async ping(): Promise<string | null> {
    if (!this.isRedisConnected()) {
      return null;
    }

    try {
      return await this.client!.ping();
    } catch (error) {
      logger.error('Redis ping operation failed', error);
      return null;
    }
  }

  /**
   * Add members to a set
   */
  public async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.isRedisConnected()) {
      return 0;
    }

    try {
      return await this.client!.sAdd(key, members);
    } catch (error) {
      logger.error('Redis sadd operation failed', { key, members, error });
      return 0;
    }
  }

  /**
   * Get all members of a set
   */
  public async smembers(key: string): Promise<string[]> {
    if (!this.isRedisConnected()) {
      return [];
    }

    try {
      return await this.client!.sMembers(key);
    } catch (error) {
      logger.error('Redis smembers operation failed', { key, error });
      return [];
    }
  }

  /**
   * Remove members from a set
   */
  public async srem(key: string, ...members: string[]): Promise<number> {
    if (!this.isRedisConnected()) {
      return 0;
    }

    try {
      return await this.client!.sRem(key, members);
    } catch (error) {
      logger.error('Redis srem operation failed', { key, members, error });
      return 0;
    }
  }
}

// Export singleton instance
export default RedisManager.getInstance();