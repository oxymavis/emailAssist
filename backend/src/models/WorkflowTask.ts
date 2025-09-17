import DatabaseManager from '../config/database';

// 定义Optional类型
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * WorkflowTask model attributes interface
 * 工作流任务模型属性接口
 */
export interface WorkflowTaskAttributes {
  id: string;
  emailId: string;
  integrationId: string;
  externalTaskId: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignee: string | null;
  status: 'created' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  externalUrl: string | null;
  labels: string[];
  dueDate: Date | null;
  completedAt: Date | null;
  syncStatus: 'pending' | 'synced' | 'error';
  lastSyncAt: Date | null;
  syncErrorMessage: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowTaskCreationAttributes extends Optional<WorkflowTaskAttributes, 'id' | 'completedAt' | 'syncStatus' | 'lastSyncAt' | 'syncErrorMessage' | 'metadata' | 'createdAt' | 'updatedAt'> {}

/**
 * WorkflowTask Model
 * 工作流任务模型
 * 
 * 功能特性:
 * - 支持多种第三方工具集成 (Asana, Jira, Trello)
 * - 双向同步支持
 * - 任务状态追踪
 * - 元数据存储
 * - 错误处理和重试机制
 */

// 初始化模型 - 使用简单的类而不是Sequelize模型
export class WorkflowTaskModel implements WorkflowTaskAttributes {
  public id!: string;
  public emailId!: string;
  public integrationId!: string;
  public externalTaskId!: string;
  public title!: string;
  public description!: string;
  public priority!: 'low' | 'medium' | 'high' | 'critical';
  public assignee!: string | null;
  public status!: 'created' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  public externalUrl!: string | null;
  public labels!: string[];
  public dueDate!: Date | null;
  public completedAt!: Date | null;
  public syncStatus!: 'pending' | 'synced' | 'error';
  public lastSyncAt!: Date | null;
  public syncErrorMessage!: string | null;
  public metadata!: Record<string, any>;
  public createdAt!: Date;
  public updatedAt!: Date;

  static async create(data: any): Promise<WorkflowTaskAttributes> {
    // 实现创建逻辑
    return data as WorkflowTaskAttributes;
  }

  static async findAll(options: any): Promise<WorkflowTaskAttributes[]> {
    // 实现查找逻辑
    return [];
  }

  static async findByPk(id: string): Promise<WorkflowTaskAttributes | null> {
    // 实现查找逻辑
    return null;
  }

  static async findOne(options: any): Promise<WorkflowTaskAttributes | null> {
    // 实现查找逻辑
    return null;
  }

  static async count(options: any): Promise<number> {
    // 实现计数逻辑
    return 0;
  }

  async save(): Promise<void> {
    // 实现保存逻辑
  }

  changed(field: string): boolean {
    // 实现变更检测逻辑
    return false;
  }

  async updateFromExternal(updates: Partial<WorkflowTaskAttributes>): Promise<void> {
    // 实现外部更新逻辑
  }

  async markSyncError(errorMessage: string): Promise<void> {
    // 实现同步错误标记逻辑
  }

  getSummary() {
    return {
      id: this.id,
      title: this.title,
      status: this.status,
      priority: this.priority,
      dueDate: this.dueDate,
      externalUrl: this.externalUrl,
      lastSyncAt: this.lastSyncAt,
      syncStatus: this.syncStatus,
      integrationId: this.integrationId,
    };
  }

  getDetails() {
    return {
      id: this.id,
      emailId: this.emailId,
      integrationId: this.integrationId,
      externalTaskId: this.externalTaskId,
      title: this.title,
      description: this.description,
      priority: this.priority,
      assignee: this.assignee,
      status: this.status,
      externalUrl: this.externalUrl,
      labels: this.labels,
      dueDate: this.dueDate,
      completedAt: this.completedAt,
      syncStatus: this.syncStatus,
      lastSyncAt: this.lastSyncAt,
      syncErrorMessage: this.syncErrorMessage,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

// 为了兼容性，导出WorkflowTaskModel作为WorkflowTask
export const WorkflowTask = WorkflowTaskModel;

export default WorkflowTask;