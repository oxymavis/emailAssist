// import { DataTypes, Model, Optional } from 'sequelize';
import DatabaseManager from '../config/database';

// 定义Optional类型
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Integration model attributes interface
 * 第三方工具集成模型属性接口
 */
export interface IntegrationAttributes {
  id: string;
  userId: string;
  type: 'asana' | 'jira' | 'trello';
  name: string;
  isConnected: boolean;
  credentials: {
    apiKey?: string | null;
    accessToken?: string | null;
    refreshToken?: string | null;
    expiresAt?: Date | null;
    apiUrl?: string | null; // For custom Jira instances
    boardId?: string | null; // For Trello boards
    projectId?: string | null; // For Asana/Jira projects
  };
  configuration: {
    defaultProject?: string | null;
    defaultAssignee?: string | null;
    taskTemplate?: string;
    defaultLabels?: string[];
    defaultPriority?: string;
    autoSync?: boolean;
    syncInterval?: number; // in minutes
    priorityField?: string;
    defaultIssueType?: string;
  };
  lastSyncAt: Date | null;
  status: 'active' | 'error' | 'disabled';
  errorMessage: string | null;
  statistics: {
    totalTasksCreated: number;
    totalTasksUpdated: number;
    lastActivity: Date | null;
    syncErrors: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Integration creation attributes interface
 * 集成创建属性接口
 */
export interface IntegrationCreationAttributes extends Optional<IntegrationAttributes, 'id' | 'createdAt' | 'updatedAt' | 'lastSyncAt' | 'status' | 'errorMessage'> {}

/**
 * Integration model class
 * 第三方工具集成数据模型
 *
 * 支持多种第三方工具集成：
 * - Asana: 任务和项目管理
 * - Jira: 问题跟踪和项目管理
 * - Trello: 看板式任务管理
 *
 * Features:
 * - OAuth2 认证支持
 * - 自动同步配置
 * - 错误处理和重试机制
 * - 统计信息跟踪
 */
export class Integration {
  // 添加save方法
  async save(): Promise<void> {
    // 实现保存逻辑
  }

  // 添加静态方法
  static async findOne(options: any): Promise<Integration | null> {
    // 实现查找逻辑
    return null;
  }

  static async findAll(options: any): Promise<Integration[]> {
    // 实现查找逻辑
    return [];
  }
  public id!: string;
  public userId!: string;
  public type!: 'asana' | 'jira' | 'trello';
  public name!: string;
  public isConnected!: boolean;
  public credentials!: {
    apiKey?: string | null;
    accessToken?: string | null;
    refreshToken?: string | null;
    expiresAt?: Date | null;
    apiUrl?: string | null;
    boardId?: string | null;
    projectId?: string | null;
  };
  public configuration!: {
    defaultProject?: string | null;
    defaultAssignee?: string | null;
    taskTemplate?: string;
    defaultLabels?: string[];
    defaultPriority?: string;
    autoSync?: boolean;
    syncInterval?: number;
  };
  public lastSyncAt!: Date | null;
  public status!: 'active' | 'error' | 'disabled';
  public errorMessage!: string | null;
  public statistics!: {
    totalTasksCreated: number;
    totalTasksUpdated: number;
    lastActivity: Date | null;
    syncErrors: number;
  };
  public createdAt!: Date;
  public updatedAt!: Date;

  /**
   * Check if integration is ready for use
   * 检查集成是否准备就绪
   */
  public isReady(): boolean {
    return this.isConnected && this.status === 'active' && this.hasValidCredentials();
  }

  /**
   * Check if credentials are valid and not expired
   * 检查凭证是否有效且未过期
   */
  public hasValidCredentials(): boolean {
    const { credentials } = this;

    if (!credentials) return false;

    // Check if token is expired
    if (credentials.expiresAt && credentials.expiresAt < new Date()) {
      return false;
    }

    // Different validation for different types
    switch (this.type) {
      case 'trello':
        return !!(credentials.apiKey && credentials.accessToken);
      case 'jira':
        return !!(credentials.apiUrl && (credentials.accessToken || credentials.apiKey));
      case 'asana':
        return !!(credentials.accessToken);
      default:
        return false;
    }
  }

  /**
   * Update sync statistics
   * 更新同步统计信息
   */
  public async updateStatistics(stats: Partial<IntegrationAttributes['statistics']>): Promise<void> {
    const currentStats = this.statistics || {
      totalTasksCreated: 0,
      totalTasksUpdated: 0,
      lastActivity: null,
      syncErrors: 0
    };

    this.statistics = {
      ...currentStats,
      ...stats,
      lastActivity: new Date()
    };

    await this.save();
  }

  /**
   * Mark integration as having an error
   * 标记集成发生错误
   */
  public async markError(errorMessage: string): Promise<void> {
    this.status = 'error';
    this.errorMessage = errorMessage;
    this.statistics.syncErrors += 1;
    await this.save();
  }

  /**
   * Clear error status
   * 清除错误状态
   */
  public async clearError(): Promise<void> {
    this.status = 'active';
    this.errorMessage = null;
    await this.save();
  }

  /**
   * Get display configuration for UI
   * 获取用于UI显示的配置信息
   */
  public getDisplayConfig() {
    const safeCredentials = { ...this.credentials };

    // Mask sensitive data for frontend
    if (safeCredentials.apiKey) {
      safeCredentials.apiKey = `***${safeCredentials.apiKey.slice(-4)}`;
    }
    if (safeCredentials.accessToken) {
      safeCredentials.accessToken = `***${safeCredentials.accessToken.slice(-4)}`;
    }
    delete safeCredentials.refreshToken;

    return {
      id: this.id,
      type: this.type,
      name: this.name,
      isConnected: this.isConnected,
      status: this.status,
      isReady: this.isReady(),
      configuration: this.configuration,
      credentials: safeCredentials,
      statistics: this.statistics,
      lastSyncAt: this.lastSyncAt,
      errorMessage: this.errorMessage,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Initialize Integration model
 * 初始化集成模型
 */
// 注释掉Sequelize初始化
/*
Integration.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    comment: '集成ID'
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '用户ID',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('asana', 'jira', 'trello'),
    allowNull: false,
    comment: '集成类型'
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '集成名称'
  },
  isConnected: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否已连接'
  },
  credentials: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
    comment: '认证凭证信息'
  },
  configuration: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: '集成配置信息'
  },
  lastSyncAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '最后同步时间'
  },
  status: {
    type: DataTypes.ENUM('active', 'error', 'disabled'),
    defaultValue: 'active',
    comment: '集成状态'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '错误信息'
  },
  statistics: {
    type: DataTypes.JSONB,
    defaultValue: {
      totalTasksCreated: 0,
      totalTasksUpdated: 0,
      lastActivity: null,
      syncErrors: 0
    },
    comment: '统计信息'
  }
}, {
  // sequelize,
  modelName: 'Integration',
  tableName: 'integrations',
  timestamps: true,
  paranoid: false,
  indexes: [
    {
      fields: ['userId', 'type'],
      unique: true,
      name: 'idx_integrations_user_type'
    },
    {
      fields: ['userId', 'isConnected']
    },
    {
      fields: ['type', 'status']
    },
    {
      fields: ['lastSyncAt'],
      where: {
        lastSyncAt: {
          [DataTypes.Op.ne]: null
        }
      }
    }
  ],
  hooks: {
    beforeValidate: (integration: Integration) => {
      // Ensure default statistics structure
      if (!integration.statistics) {
        integration.statistics = {
          totalTasksCreated: 0,
          totalTasksUpdated: 0,
          lastActivity: null,
          syncErrors: 0
        };
      }

      // Ensure default configuration structure
      if (!integration.configuration) {
        integration.configuration = {};
      }

      // Set default configuration based on type
      if (!integration.configuration.autoSync) {
        integration.configuration.autoSync = true;
      }
      if (!integration.configuration.syncInterval) {
        integration.configuration.syncInterval = 30; // 30 minutes default
      }
    },
    afterUpdate: (integration: Integration) => {
      // Auto-update lastSyncAt when statistics change
      if (integration.changed('statistics') && integration.status === 'active') {
        integration.lastSyncAt = new Date();
      }
    }
  }
});
*/

export default Integration;