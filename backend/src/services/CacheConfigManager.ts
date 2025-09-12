/**
 * 缓存配置管理中心
 * 提供动态配置管理、配置热更新、配置验证、配置模板管理
 */

import RedisManager from '@/config/redis';
import logger from '@/utils/logger';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import Joi from 'joi';

export interface CacheConfiguration {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  
  // 全局配置
  global: {
    defaultTTL: number;
    maxMemoryUsage: number;
    compressionEnabled: boolean;
    compressionThreshold: number;
    monitoringEnabled: boolean;
    debugMode: boolean;
  };
  
  // 层级配置
  layers: {
    l1: LayerConfig;
    l2: LayerConfig;
    l3: LayerConfig;
  };
  
  // 策略配置
  strategies: {
    smart: SmartStrategyConfig;
    performance: PerformanceStrategyConfig;
    business: BusinessStrategyConfig;
  };
  
  // 监控配置
  monitoring: {
    enabled: boolean;
    sampleRate: number;
    alertThresholds: AlertThresholds;
    reportInterval: number;
    metricsRetention: number;
  };
  
  // 环境特定配置
  environments: {
    development: Partial<CacheConfiguration>;
    staging: Partial<CacheConfiguration>;
    production: Partial<CacheConfiguration>;
  };
}

export interface LayerConfig {
  enabled: boolean;
  maxSize: number;
  ttl: number;
  evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'random';
  compressionEnabled: boolean;
  syncEnabled: boolean;
  batchSize: number;
}

export interface SmartStrategyConfig {
  enabled: boolean;
  patternAnalysisWindow: number;
  hotDataThreshold: number;
  predictionAccuracy: number;
  maxUserProfiles: number;
  patternUpdateInterval: number;
  preloadLeadTime: number;
}

export interface PerformanceStrategyConfig {
  nullCacheEnabled: boolean;
  nullCacheTtl: number;
  bloomFilterEnabled: boolean;
  mutexEnabled: boolean;
  mutexTimeout: number;
  refreshAheadEnabled: boolean;
  refreshThreshold: number;
  ttlJitterEnabled: boolean;
  ttlJitterRange: number;
  circuitBreakerEnabled: boolean;
}

export interface BusinessStrategyConfig {
  emailCaching: {
    listTTL: number;
    contentTTL: number;
    attachmentTTL: number;
    threadTTL: number;
    compressionEnabled: boolean;
  };
  analysisCaching: {
    resultTTL: number;
    modelVersionTTL: number;
    batchResultTTL: number;
    precomputeEnabled: boolean;
    incrementalUpdate: boolean;
  };
  userPreferenceCaching: {
    settingsTTL: number;
    filterRulesTTL: number;
    dashboardTTL: number;
    themeTTL: number;
    persistentCache: boolean;
  };
  searchCaching: {
    queryTTL: number;
    resultTTL: number;
    suggestionTTL: number;
    facetTTL: number;
    popularQueriesEnabled: boolean;
  };
}

export interface AlertThresholds {
  hitRateMin: number;
  responseTimeMax: number;
  errorRateMax: number;
  memoryUsageMax: number;
  throughputMin: number;
}

export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  category: 'development' | 'production' | 'high-performance' | 'memory-optimized' | 'custom';
  config: Partial<CacheConfiguration>;
  tags: string[];
  createdAt: number;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
    value: any;
  }>;
  warnings: Array<{
    path: string;
    message: string;
    value: any;
  }>;
}

export interface ConfigChangeLog {
  id: string;
  configId: string;
  action: 'created' | 'updated' | 'deleted' | 'enabled' | 'disabled';
  changes: Array<{
    path: string;
    oldValue: any;
    newValue: any;
  }>;
  user: string;
  timestamp: number;
  reason?: string;
}

export class CacheConfigManager extends EventEmitter {
  private redis = RedisManager;
  private configurations = new Map<string, CacheConfiguration>();
  private templates = new Map<string, ConfigTemplate>();
  private changeLogs: ConfigChangeLog[] = [];
  private currentConfigId: string | null = null;
  
  private configPath = path.join(process.cwd(), 'config', 'cache');
  private backupPath = path.join(process.cwd(), 'config', 'cache', 'backups');
  
  // 配置验证模式
  private configSchema = Joi.object({
    id: Joi.string().required(),
    name: Joi.string().min(3).max(100).required(),
    description: Joi.string().max(500),
    version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).required(),
    enabled: Joi.boolean().required(),
    
    global: Joi.object({
      defaultTTL: Joi.number().min(1).max(86400).required(),
      maxMemoryUsage: Joi.number().min(0).max(100).required(),
      compressionEnabled: Joi.boolean().required(),
      compressionThreshold: Joi.number().min(0).required(),
      monitoringEnabled: Joi.boolean().required(),
      debugMode: Joi.boolean().required()
    }).required(),
    
    layers: Joi.object({
      l1: this.layerConfigSchema(),
      l2: this.layerConfigSchema(),
      l3: this.layerConfigSchema()
    }).required(),
    
    strategies: Joi.object({
      smart: this.smartStrategySchema(),
      performance: this.performanceStrategySchema(),
      business: this.businessStrategySchema()
    }).required(),
    
    monitoring: Joi.object({
      enabled: Joi.boolean().required(),
      sampleRate: Joi.number().min(0).max(1).required(),
      alertThresholds: this.alertThresholdsSchema(),
      reportInterval: Joi.number().min(1000).required(),
      metricsRetention: Joi.number().min(1).max(365).required()
    }).required()
  });

  constructor() {
    super();
    this.initialize();
  }

  /**
   * 初始化配置管理器
   */
  private async initialize(): Promise<void> {
    try {
      await this.ensureConfigDirectories();
      await this.loadBuiltinTemplates();
      await this.loadConfigurations();
      await this.loadCurrentConfiguration();
      
      logger.info('CacheConfigManager initialized', {
        configurations: this.configurations.size,
        templates: this.templates.size,
        currentConfig: this.currentConfigId
      });
      
    } catch (error) {
      logger.error('Failed to initialize CacheConfigManager', error);
      throw error;
    }
  }

  /**
   * 创建新的缓存配置
   */
  async createConfiguration(
    name: string,
    description: string,
    baseConfig?: Partial<CacheConfiguration>,
    templateId?: string
  ): Promise<CacheConfiguration> {
    try {
      const configId = this.generateConfigId();
      
      let config: CacheConfiguration;
      
      if (templateId && this.templates.has(templateId)) {
        // 基于模板创建
        const template = this.templates.get(templateId)!;
        config = this.mergeConfigurations(this.getDefaultConfiguration(), template.config as CacheConfiguration);
        config.id = configId;
        config.name = name;
        config.description = description;
      } else if (baseConfig) {
        // 基于现有配置创建
        config = this.mergeConfigurations(this.getDefaultConfiguration(), baseConfig as CacheConfiguration);
        config.id = configId;
        config.name = name;
        config.description = description;
      } else {
        // 创建默认配置
        config = this.getDefaultConfiguration();
        config.id = configId;
        config.name = name;
        config.description = description;
      }
      
      config.createdAt = Date.now();
      config.updatedAt = Date.now();
      config.version = '1.0.0';
      config.enabled = false; // 新创建的配置默认禁用
      
      // 验证配置
      const validation = await this.validateConfiguration(config);
      if (!validation.valid) {
        throw new Error(`Configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }
      
      // 保存配置
      this.configurations.set(configId, config);
      await this.saveConfiguration(config);
      
      // 记录变更日志
      await this.logConfigChange(configId, 'created', [], 'system', 'Configuration created');
      
      // 触发事件
      this.emit('configuration-created', config);
      
      logger.info('Cache configuration created', {
        id: configId,
        name,
        templateId,
        validation: validation.warnings.length
      });
      
      return config;
      
    } catch (error) {
      logger.error('Failed to create configuration', { name, error });
      throw error;
    }
  }

  /**
   * 更新缓存配置
   */
  async updateConfiguration(
    configId: string,
    updates: Partial<CacheConfiguration>,
    user = 'system',
    reason?: string
  ): Promise<CacheConfiguration> {
    try {
      if (!this.configurations.has(configId)) {
        throw new Error(`Configuration not found: ${configId}`);
      }
      
      const currentConfig = this.configurations.get(configId)!;
      const updatedConfig = this.mergeConfigurations(currentConfig, updates);
      updatedConfig.updatedAt = Date.now();
      updatedConfig.version = this.incrementVersion(currentConfig.version);
      
      // 验证更新后的配置
      const validation = await this.validateConfiguration(updatedConfig);
      if (!validation.valid) {
        throw new Error(`Configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }
      
      // 计算变更
      const changes = this.calculateConfigChanges(currentConfig, updatedConfig);
      
      // 备份当前配置
      await this.backupConfiguration(currentConfig);
      
      // 更新配置
      this.configurations.set(configId, updatedConfig);
      await this.saveConfiguration(updatedConfig);
      
      // 记录变更日志
      await this.logConfigChange(configId, 'updated', changes, user, reason);
      
      // 如果这是当前活跃的配置，触发热更新
      if (this.currentConfigId === configId && updatedConfig.enabled) {
        await this.hotReloadConfiguration(updatedConfig);
      }
      
      // 触发事件
      this.emit('configuration-updated', updatedConfig, changes);
      
      logger.info('Cache configuration updated', {
        id: configId,
        changes: changes.length,
        user,
        hotReload: this.currentConfigId === configId
      });
      
      return updatedConfig;
      
    } catch (error) {
      logger.error('Failed to update configuration', { configId, error });
      throw error;
    }
  }

  /**
   * 启用配置
   */
  async enableConfiguration(configId: string, user = 'system'): Promise<void> {
    try {
      if (!this.configurations.has(configId)) {
        throw new Error(`Configuration not found: ${configId}`);
      }
      
      // 禁用当前配置
      if (this.currentConfigId && this.configurations.has(this.currentConfigId)) {
        const currentConfig = this.configurations.get(this.currentConfigId)!;
        currentConfig.enabled = false;
        await this.saveConfiguration(currentConfig);
      }
      
      // 启用新配置
      const config = this.configurations.get(configId)!;
      config.enabled = true;
      config.updatedAt = Date.now();
      
      await this.saveConfiguration(config);
      await this.setCurrentConfiguration(configId);
      
      // 热更新配置
      await this.hotReloadConfiguration(config);
      
      // 记录变更日志
      await this.logConfigChange(configId, 'enabled', [], user, 'Configuration enabled and applied');
      
      // 触发事件
      this.emit('configuration-enabled', config);
      
      logger.info('Cache configuration enabled', { id: configId, user });
      
    } catch (error) {
      logger.error('Failed to enable configuration', { configId, error });
      throw error;
    }
  }

  /**
   * 禁用配置
   */
  async disableConfiguration(configId: string, user = 'system'): Promise<void> {
    try {
      if (!this.configurations.has(configId)) {
        throw new Error(`Configuration not found: ${configId}`);
      }
      
      const config = this.configurations.get(configId)!;
      config.enabled = false;
      config.updatedAt = Date.now();
      
      await this.saveConfiguration(config);
      
      // 如果这是当前配置，切换到默认配置
      if (this.currentConfigId === configId) {
        await this.loadDefaultConfiguration();
      }
      
      // 记录变更日志
      await this.logConfigChange(configId, 'disabled', [], user, 'Configuration disabled');
      
      // 触发事件
      this.emit('configuration-disabled', config);
      
      logger.info('Cache configuration disabled', { id: configId, user });
      
    } catch (error) {
      logger.error('Failed to disable configuration', { configId, error });
      throw error;
    }
  }

  /**
   * 删除配置
   */
  async deleteConfiguration(configId: string, user = 'system'): Promise<void> {
    try {
      if (!this.configurations.has(configId)) {
        throw new Error(`Configuration not found: ${configId}`);
      }
      
      const config = this.configurations.get(configId)!;
      
      // 不能删除当前活跃的配置
      if (this.currentConfigId === configId) {
        throw new Error('Cannot delete active configuration');
      }
      
      // 备份配置
      await this.backupConfiguration(config);
      
      // 删除配置文件
      const configFilePath = path.join(this.configPath, `${configId}.json`);
      try {
        await fs.unlink(configFilePath);
      } catch (fileError) {
        logger.warn('Failed to delete configuration file', { configId, error: fileError });
      }
      
      // 从内存中删除
      this.configurations.delete(configId);
      
      // 记录变更日志
      await this.logConfigChange(configId, 'deleted', [], user, 'Configuration deleted');
      
      // 触发事件
      this.emit('configuration-deleted', config);
      
      logger.info('Cache configuration deleted', { id: configId, name: config.name, user });
      
    } catch (error) {
      logger.error('Failed to delete configuration', { configId, error });
      throw error;
    }
  }

  /**
   * 验证配置
   */
  async validateConfiguration(config: CacheConfiguration): Promise<ConfigValidationResult> {
    const result: ConfigValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    try {
      // Joi 验证
      const { error } = this.configSchema.validate(config, { abortEarly: false });
      
      if (error) {
        result.valid = false;
        result.errors = error.details.map(detail => ({
          path: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));
      }
      
      // 业务逻辑验证
      await this.performBusinessValidation(config, result);
      
      // 性能验证
      await this.performPerformanceValidation(config, result);
      
      // 兼容性验证
      await this.performCompatibilityValidation(config, result);
      
    } catch (validationError) {
      result.valid = false;
      result.errors.push({
        path: 'root',
        message: `Validation error: ${validationError.message}`,
        value: config
      });
    }
    
    return result;
  }

  /**
   * 获取配置
   */
  getConfiguration(configId: string): CacheConfiguration | null {
    return this.configurations.get(configId) || null;
  }

  /**
   * 获取当前配置
   */
  getCurrentConfiguration(): CacheConfiguration | null {
    if (!this.currentConfigId) return null;
    return this.configurations.get(this.currentConfigId) || null;
  }

  /**
   * 获取所有配置
   */
  getAllConfigurations(): CacheConfiguration[] {
    return Array.from(this.configurations.values());
  }

  /**
   * 获取配置模板
   */
  getTemplate(templateId: string): ConfigTemplate | null {
    return this.templates.get(templateId) || null;
  }

  /**
   * 获取所有模板
   */
  getAllTemplates(): ConfigTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 创建配置模板
   */
  async createTemplate(
    name: string,
    description: string,
    category: ConfigTemplate['category'],
    config: Partial<CacheConfiguration>,
    tags: string[] = []
  ): Promise<ConfigTemplate> {
    const templateId = `template_${Date.now()}`;
    
    const template: ConfigTemplate = {
      id: templateId,
      name,
      description,
      category,
      config,
      tags,
      createdAt: Date.now()
    };
    
    this.templates.set(templateId, template);
    await this.saveTemplate(template);
    
    this.emit('template-created', template);
    
    logger.info('Configuration template created', { id: templateId, name, category });
    
    return template;
  }

  /**
   * 获取变更日志
   */
  getChangeLog(configId?: string, limit = 100): ConfigChangeLog[] {
    let logs = this.changeLogs;
    
    if (configId) {
      logs = logs.filter(log => log.configId === configId);
    }
    
    return logs
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * 导出配置
   */
  async exportConfiguration(configId: string): Promise<string> {
    const config = this.configurations.get(configId);
    if (!config) {
      throw new Error(`Configuration not found: ${configId}`);
    }
    
    return JSON.stringify(config, null, 2);
  }

  /**
   * 导入配置
   */
  async importConfiguration(configJson: string, user = 'system'): Promise<CacheConfiguration> {
    try {
      const config: CacheConfiguration = JSON.parse(configJson);
      
      // 生成新的ID
      config.id = this.generateConfigId();
      config.createdAt = Date.now();
      config.updatedAt = Date.now();
      config.enabled = false;
      
      // 验证配置
      const validation = await this.validateConfiguration(config);
      if (!validation.valid) {
        throw new Error(`Imported configuration is invalid: ${validation.errors.map(e => e.message).join(', ')}`);
      }
      
      // 保存配置
      this.configurations.set(config.id, config);
      await this.saveConfiguration(config);
      
      // 记录变更日志
      await this.logConfigChange(config.id, 'created', [], user, 'Configuration imported');
      
      this.emit('configuration-imported', config);
      
      logger.info('Configuration imported', { id: config.id, name: config.name, user });
      
      return config;
      
    } catch (error) {
      logger.error('Failed to import configuration', error);
      throw error;
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 确保配置目录存在
   */
  private async ensureConfigDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.configPath, { recursive: true });
      await fs.mkdir(this.backupPath, { recursive: true });
      await fs.mkdir(path.join(this.configPath, 'templates'), { recursive: true });
    } catch (error) {
      logger.error('Failed to create config directories', error);
    }
  }

  /**
   * 加载内置模板
   */
  private async loadBuiltinTemplates(): Promise<void> {
    const templates = [
      {
        id: 'development',
        name: 'Development Template',
        description: '开发环境优化配置，启用调试模式，较短的TTL',
        category: 'development' as const,
        config: {
          global: {
            defaultTTL: 60,
            debugMode: true,
            monitoringEnabled: true
          },
          strategies: {
            performance: {
              refreshAheadEnabled: false,
              circuitBreakerEnabled: false
            }
          }
        },
        tags: ['development', 'debug']
      },
      {
        id: 'production',
        name: 'Production Template',
        description: '生产环境优化配置，高性能和稳定性',
        category: 'production' as const,
        config: {
          global: {
            defaultTTL: 600,
            debugMode: false,
            monitoringEnabled: true
          },
          strategies: {
            performance: {
              refreshAheadEnabled: true,
              circuitBreakerEnabled: true
            }
          }
        },
        tags: ['production', 'performance']
      },
      {
        id: 'high-performance',
        name: 'High Performance Template',
        description: '高性能配置，优化响应时间',
        category: 'high-performance' as const,
        config: {
          layers: {
            l1: {
              maxSize: 10000,
              evictionPolicy: 'lru'
            }
          },
          strategies: {
            smart: {
              preloadLeadTime: 300000 // 5分钟
            }
          }
        },
        tags: ['performance', 'speed']
      }
    ];
    
    for (const template of templates) {
      this.templates.set(template.id, {
        ...template,
        createdAt: Date.now()
      });
    }
  }

  /**
   * 加载所有配置
   */
  private async loadConfigurations(): Promise<void> {
    try {
      const files = await fs.readdir(this.configPath);
      const configFiles = files.filter(file => file.endsWith('.json') && file !== 'current.json');
      
      for (const file of configFiles) {
        try {
          const filePath = path.join(this.configPath, file);
          const content = await fs.readFile(filePath, 'utf8');
          const config: CacheConfiguration = JSON.parse(content);
          
          this.configurations.set(config.id, config);
        } catch (error) {
          logger.warn('Failed to load configuration file', { file, error });
        }
      }
    } catch (error) {
      logger.error('Failed to load configurations', error);
    }
  }

  /**
   * 加载当前配置
   */
  private async loadCurrentConfiguration(): Promise<void> {
    try {
      const currentFilePath = path.join(this.configPath, 'current.json');
      const content = await fs.readFile(currentFilePath, 'utf8');
      const { configId } = JSON.parse(content);
      
      if (this.configurations.has(configId)) {
        this.currentConfigId = configId;
      } else {
        logger.warn('Current configuration not found, loading default');
        await this.loadDefaultConfiguration();
      }
    } catch (error) {
      logger.info('No current configuration found, loading default');
      await this.loadDefaultConfiguration();
    }
  }

  /**
   * 加载默认配置
   */
  private async loadDefaultConfiguration(): Promise<void> {
    const defaultConfig = this.getDefaultConfiguration();
    defaultConfig.enabled = true;
    
    this.configurations.set(defaultConfig.id, defaultConfig);
    await this.saveConfiguration(defaultConfig);
    await this.setCurrentConfiguration(defaultConfig.id);
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfiguration(): CacheConfiguration {
    return {
      id: 'default',
      name: 'Default Configuration',
      description: '默认缓存配置',
      version: '1.0.0',
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      
      global: {
        defaultTTL: 300,
        maxMemoryUsage: 80,
        compressionEnabled: true,
        compressionThreshold: 1024,
        monitoringEnabled: true,
        debugMode: false
      },
      
      layers: {
        l1: {
          enabled: true,
          maxSize: 1000,
          ttl: 300,
          evictionPolicy: 'lru',
          compressionEnabled: false,
          syncEnabled: true,
          batchSize: 100
        },
        l2: {
          enabled: true,
          maxSize: 10000,
          ttl: 1800,
          evictionPolicy: 'lru',
          compressionEnabled: true,
          syncEnabled: true,
          batchSize: 200
        },
        l3: {
          enabled: false,
          maxSize: 100000,
          ttl: 3600,
          evictionPolicy: 'lfu',
          compressionEnabled: true,
          syncEnabled: false,
          batchSize: 500
        }
      },
      
      strategies: {
        smart: {
          enabled: true,
          patternAnalysisWindow: 604800000, // 7天
          hotDataThreshold: 10,
          predictionAccuracy: 0.8,
          maxUserProfiles: 10000,
          patternUpdateInterval: 300000, // 5分钟
          preloadLeadTime: 1800000 // 30分钟
        },
        performance: {
          nullCacheEnabled: true,
          nullCacheTtl: 60,
          bloomFilterEnabled: true,
          mutexEnabled: true,
          mutexTimeout: 10000,
          refreshAheadEnabled: true,
          refreshThreshold: 0.2,
          ttlJitterEnabled: true,
          ttlJitterRange: 0.1,
          circuitBreakerEnabled: true
        },
        business: {
          emailCaching: {
            listTTL: 300,
            contentTTL: 1800,
            attachmentTTL: 3600,
            threadTTL: 900,
            compressionEnabled: true
          },
          analysisCaching: {
            resultTTL: 3600,
            modelVersionTTL: 86400,
            batchResultTTL: 1800,
            precomputeEnabled: true,
            incrementalUpdate: true
          },
          userPreferenceCaching: {
            settingsTTL: 3600,
            filterRulesTTL: 1800,
            dashboardTTL: 900,
            themeTTL: 86400,
            persistentCache: true
          },
          searchCaching: {
            queryTTL: 1800,
            resultTTL: 900,
            suggestionTTL: 3600,
            facetTTL: 1800,
            popularQueriesEnabled: true
          }
        }
      },
      
      monitoring: {
        enabled: true,
        sampleRate: 1.0,
        alertThresholds: {
          hitRateMin: 80,
          responseTimeMax: 100,
          errorRateMax: 1,
          memoryUsageMax: 85,
          throughputMin: 100
        },
        reportInterval: 60000,
        metricsRetention: 30
      },
      
      environments: {
        development: {},
        staging: {},
        production: {}
      }
    };
  }

  /**
   * 生成配置ID
   */
  private generateConfigId(): string {
    return `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 合并配置
   */
  private mergeConfigurations(base: CacheConfiguration, override: Partial<CacheConfiguration>): CacheConfiguration {
    return {
      ...base,
      ...override,
      global: { ...base.global, ...override.global },
      layers: {
        l1: { ...base.layers.l1, ...override.layers?.l1 },
        l2: { ...base.layers.l2, ...override.layers?.l2 },
        l3: { ...base.layers.l3, ...override.layers?.l3 }
      },
      strategies: {
        smart: { ...base.strategies.smart, ...override.strategies?.smart },
        performance: { ...base.strategies.performance, ...override.strategies?.performance },
        business: {
          emailCaching: { ...base.strategies.business.emailCaching, ...override.strategies?.business?.emailCaching },
          analysisCaching: { ...base.strategies.business.analysisCaching, ...override.strategies?.business?.analysisCaching },
          userPreferenceCaching: { ...base.strategies.business.userPreferenceCaching, ...override.strategies?.business?.userPreferenceCaching },
          searchCaching: { ...base.strategies.business.searchCaching, ...override.strategies?.business?.searchCaching }
        }
      },
      monitoring: { ...base.monitoring, ...override.monitoring }
    };
  }

  /**
   * 计算配置变更
   */
  private calculateConfigChanges(
    oldConfig: CacheConfiguration,
    newConfig: CacheConfiguration
  ): Array<{ path: string; oldValue: any; newValue: any }> {
    const changes: Array<{ path: string; oldValue: any; newValue: any }> = [];
    
    const compare = (obj1: any, obj2: any, path: string) => {
      for (const key in obj2) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (obj1[key] !== obj2[key]) {
          if (typeof obj2[key] === 'object' && obj2[key] !== null && !Array.isArray(obj2[key])) {
            compare(obj1[key] || {}, obj2[key], currentPath);
          } else {
            changes.push({
              path: currentPath,
              oldValue: obj1[key],
              newValue: obj2[key]
            });
          }
        }
      }
    };
    
    compare(oldConfig, newConfig, '');
    
    return changes;
  }

  /**
   * 递增版本号
   */
  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[2]++; // 递增补丁版本
    return parts.join('.');
  }

  /**
   * 保存配置
   */
  private async saveConfiguration(config: CacheConfiguration): Promise<void> {
    const filePath = path.join(this.configPath, `${config.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
  }

  /**
   * 保存模板
   */
  private async saveTemplate(template: ConfigTemplate): Promise<void> {
    const filePath = path.join(this.configPath, 'templates', `${template.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(template, null, 2), 'utf8');
  }

  /**
   * 设置当前配置
   */
  private async setCurrentConfiguration(configId: string): Promise<void> {
    this.currentConfigId = configId;
    const currentFilePath = path.join(this.configPath, 'current.json');
    await fs.writeFile(currentFilePath, JSON.stringify({ configId }), 'utf8');
  }

  /**
   * 备份配置
   */
  private async backupConfiguration(config: CacheConfiguration): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${config.id}_${timestamp}.json`;
    const backupFilePath = path.join(this.backupPath, backupFileName);
    
    await fs.writeFile(backupFilePath, JSON.stringify(config, null, 2), 'utf8');
  }

  /**
   * 热更新配置
   */
  private async hotReloadConfiguration(config: CacheConfiguration): Promise<void> {
    try {
      // 触发配置热更新事件
      this.emit('configuration-hot-reload', config);
      
      logger.info('Configuration hot reloaded', {
        id: config.id,
        name: config.name,
        version: config.version
      });
      
    } catch (error) {
      logger.error('Failed to hot reload configuration', { configId: config.id, error });
      throw error;
    }
  }

  /**
   * 记录配置变更日志
   */
  private async logConfigChange(
    configId: string,
    action: ConfigChangeLog['action'],
    changes: Array<{ path: string; oldValue: any; newValue: any }>,
    user: string,
    reason?: string
  ): Promise<void> {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const changeLog: ConfigChangeLog = {
      id: logId,
      configId,
      action,
      changes,
      user,
      timestamp: Date.now(),
      reason
    };
    
    this.changeLogs.push(changeLog);
    
    // 限制日志数量
    if (this.changeLogs.length > 10000) {
      this.changeLogs = this.changeLogs.slice(-5000);
    }
    
    // 持久化日志
    try {
      const logFilePath = path.join(this.configPath, 'changes.log');
      const logLine = JSON.stringify(changeLog) + '\n';
      await fs.appendFile(logFilePath, logLine, 'utf8');
    } catch (error) {
      logger.warn('Failed to persist change log', error);
    }
  }

  // 验证模式方法
  private layerConfigSchema() {
    return Joi.object({
      enabled: Joi.boolean().required(),
      maxSize: Joi.number().min(1).required(),
      ttl: Joi.number().min(1).required(),
      evictionPolicy: Joi.string().valid('lru', 'lfu', 'fifo', 'random').required(),
      compressionEnabled: Joi.boolean().required(),
      syncEnabled: Joi.boolean().required(),
      batchSize: Joi.number().min(1).required()
    });
  }

  private smartStrategySchema() {
    return Joi.object({
      enabled: Joi.boolean().required(),
      patternAnalysisWindow: Joi.number().min(1000).required(),
      hotDataThreshold: Joi.number().min(1).required(),
      predictionAccuracy: Joi.number().min(0).max(1).required(),
      maxUserProfiles: Joi.number().min(1).required(),
      patternUpdateInterval: Joi.number().min(1000).required(),
      preloadLeadTime: Joi.number().min(1000).required()
    });
  }

  private performanceStrategySchema() {
    return Joi.object({
      nullCacheEnabled: Joi.boolean().required(),
      nullCacheTtl: Joi.number().min(1).required(),
      bloomFilterEnabled: Joi.boolean().required(),
      mutexEnabled: Joi.boolean().required(),
      mutexTimeout: Joi.number().min(100).required(),
      refreshAheadEnabled: Joi.boolean().required(),
      refreshThreshold: Joi.number().min(0).max(1).required(),
      ttlJitterEnabled: Joi.boolean().required(),
      ttlJitterRange: Joi.number().min(0).max(1).required(),
      circuitBreakerEnabled: Joi.boolean().required()
    });
  }

  private businessStrategySchema() {
    return Joi.object({
      emailCaching: Joi.object({
        listTTL: Joi.number().min(1).required(),
        contentTTL: Joi.number().min(1).required(),
        attachmentTTL: Joi.number().min(1).required(),
        threadTTL: Joi.number().min(1).required(),
        compressionEnabled: Joi.boolean().required()
      }).required(),
      analysisCaching: Joi.object({
        resultTTL: Joi.number().min(1).required(),
        modelVersionTTL: Joi.number().min(1).required(),
        batchResultTTL: Joi.number().min(1).required(),
        precomputeEnabled: Joi.boolean().required(),
        incrementalUpdate: Joi.boolean().required()
      }).required(),
      userPreferenceCaching: Joi.object({
        settingsTTL: Joi.number().min(1).required(),
        filterRulesTTL: Joi.number().min(1).required(),
        dashboardTTL: Joi.number().min(1).required(),
        themeTTL: Joi.number().min(1).required(),
        persistentCache: Joi.boolean().required()
      }).required(),
      searchCaching: Joi.object({
        queryTTL: Joi.number().min(1).required(),
        resultTTL: Joi.number().min(1).required(),
        suggestionTTL: Joi.number().min(1).required(),
        facetTTL: Joi.number().min(1).required(),
        popularQueriesEnabled: Joi.boolean().required()
      }).required()
    });
  }

  private alertThresholdsSchema() {
    return Joi.object({
      hitRateMin: Joi.number().min(0).max(100).required(),
      responseTimeMax: Joi.number().min(1).required(),
      errorRateMax: Joi.number().min(0).max(100).required(),
      memoryUsageMax: Joi.number().min(0).max(100).required(),
      throughputMin: Joi.number().min(0).required()
    });
  }

  private async performBusinessValidation(
    config: CacheConfiguration,
    result: ConfigValidationResult
  ): Promise<void> {
    // 业务逻辑验证...
  }

  private async performPerformanceValidation(
    config: CacheConfiguration,
    result: ConfigValidationResult
  ): Promise<void> {
    // 性能验证...
  }

  private async performCompatibilityValidation(
    config: CacheConfiguration,
    result: ConfigValidationResult
  ): Promise<void> {
    // 兼容性验证...
  }
}

// 导出单例实例
export default new CacheConfigManager();