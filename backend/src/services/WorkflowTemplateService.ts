import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/utils/logger';
import { WorkflowDefinition, WorkflowTrigger } from './WorkflowEngine';

/**
 * 工作流模板类型
 */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  isSystem: boolean;
  isFeatured: boolean;
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  templateDefinition: WorkflowDefinition;
  defaultConfig: Record<string, any>;
  templateVariables: TemplateVariable[];
  usageCount: number;
  rating: number;
  ratingCount: number;
  tags: string[];
  keywords: string[];
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 模板变量定义
 */
export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
  };
}

/**
 * 快速操作模板
 */
export interface QuickActionTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  actionType: 'batch_email_operation' | 'workflow_trigger' | 'rule_apply';
  actionConfig: Record<string, any>;
  uiConfig: {
    buttonColor?: string;
    position?: string;
    size?: string;
    confirmationRequired?: boolean;
    confirmationMessage?: string;
  };
  requiredPermissions: string[];
  rateLimitPerHour?: number;
  usageCount: number;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 工作流模板服务
 * 管理工作流模板的创建、查询、使用和评价
 */
export class WorkflowTemplateService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * 获取工作流模板列表
   */
  async getTemplates(options?: {
    category?: string;
    difficultyLevel?: string;
    isFeatured?: boolean;
    isSystem?: boolean;
    tags?: string[];
    search?: string;
    sortBy?: 'name' | 'usageCount' | 'rating' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): Promise<{ templates: WorkflowTemplate[]; total: number }> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100);
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.category) {
      whereClause += ` AND category = $${paramIndex}`;
      params.push(options.category);
      paramIndex++;
    }

    if (options?.difficultyLevel) {
      whereClause += ` AND difficulty_level = $${paramIndex}`;
      params.push(options.difficultyLevel);
      paramIndex++;
    }

    if (options?.isFeatured !== undefined) {
      whereClause += ` AND is_featured = $${paramIndex}`;
      params.push(options.isFeatured);
      paramIndex++;
    }

    if (options?.isSystem !== undefined) {
      whereClause += ` AND is_system = $${paramIndex}`;
      params.push(options.isSystem);
      paramIndex++;
    }

    if (options?.tags && options.tags.length > 0) {
      whereClause += ` AND tags && $${paramIndex}`;
      params.push(options.tags);
      paramIndex++;
    }

    if (options?.search) {
      whereClause += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR keywords && ARRAY[$${paramIndex}])`;
      params.push(`%${options.search}%`);
      paramIndex++;
    }

    // 排序
    let orderClause = 'ORDER BY ';
    switch (options?.sortBy) {
      case 'name':
        orderClause += 'name';
        break;
      case 'usageCount':
        orderClause += 'usage_count';
        break;
      case 'rating':
        orderClause += 'rating';
        break;
      case 'createdAt':
      default:
        orderClause += 'created_at';
        break;
    }
    orderClause += ` ${options?.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;

    // 获取总数
    const countResult = await this.pool.query(`
      SELECT COUNT(*) as total FROM workflow_templates ${whereClause}
    `, params);

    // 获取数据
    const result = await this.pool.query(`
      SELECT * FROM workflow_templates ${whereClause} ${orderClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    return {
      templates: result.rows.map(row => this.mapRowToTemplate(row)),
      total: parseInt(countResult.rows[0].total)
    };
  }

  /**
   * 获取模板详情
   */
  async getTemplate(templateId: string): Promise<WorkflowTemplate | null> {
    const result = await this.pool.query(`
      SELECT * FROM workflow_templates WHERE id = $1
    `, [templateId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTemplate(result.rows[0]);
  }

  /**
   * 创建工作流模板
   */
  async createTemplate(
    templateData: {
      name: string;
      description: string;
      category: string;
      version?: string;
      difficultyLevel?: string;
      templateDefinition: WorkflowDefinition;
      defaultConfig?: Record<string, any>;
      templateVariables?: TemplateVariable[];
      tags?: string[];
      keywords?: string[];
    },
    createdBy?: string
  ): Promise<WorkflowTemplate> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      const templateId = uuidv4();
      const now = new Date();

      const result = await client.query(`
        INSERT INTO workflow_templates (
          id, name, description, category, version, is_system, is_featured,
          difficulty_level, template_definition, default_config, template_variables,
          usage_count, rating, rating_count, tags, keywords, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `, [
        templateId,
        templateData.name,
        templateData.description,
        templateData.category,
        templateData.version || '1.0',
        false, // is_system
        false, // is_featured
        templateData.difficultyLevel || 'beginner',
        JSON.stringify(templateData.templateDefinition),
        JSON.stringify(templateData.defaultConfig || {}),
        JSON.stringify(templateData.templateVariables || []),
        0, // usage_count
        0, // rating
        0, // rating_count
        templateData.tags || [],
        templateData.keywords || [],
        createdBy,
        now,
        now
      ]);

      await client.query('COMMIT');

      const template = this.mapRowToTemplate(result.rows[0]);

      logger.info('Workflow template created', {
        templateId: template.id,
        name: template.name,
        category: template.category,
        createdBy
      });

      return template;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create workflow template', { error, templateData });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 更新工作流模板
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<Pick<WorkflowTemplate, 'name' | 'description' | 'category' | 'difficultyLevel' | 'templateDefinition' | 'defaultConfig' | 'templateVariables' | 'tags' | 'keywords'>>,
    updatedBy?: string
  ): Promise<WorkflowTemplate> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // 验证模板存在且有权限修改
      const existingTemplate = await client.query(`
        SELECT * FROM workflow_templates 
        WHERE id = $1 AND (is_system = false OR created_by = $2)
      `, [templateId, updatedBy]);

      if (existingTemplate.rows.length === 0) {
        throw new Error('Template not found or access denied');
      }

      // 构建更新语句
      const updateFields: string[] = [];
      const updateParams: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramIndex}`);
        updateParams.push(updates.name);
        paramIndex++;
      }

      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramIndex}`);
        updateParams.push(updates.description);
        paramIndex++;
      }

      if (updates.category !== undefined) {
        updateFields.push(`category = $${paramIndex}`);
        updateParams.push(updates.category);
        paramIndex++;
      }

      if (updates.difficultyLevel !== undefined) {
        updateFields.push(`difficulty_level = $${paramIndex}`);
        updateParams.push(updates.difficultyLevel);
        paramIndex++;
      }

      if (updates.templateDefinition !== undefined) {
        updateFields.push(`template_definition = $${paramIndex}`);
        updateParams.push(JSON.stringify(updates.templateDefinition));
        paramIndex++;
      }

      if (updates.defaultConfig !== undefined) {
        updateFields.push(`default_config = $${paramIndex}`);
        updateParams.push(JSON.stringify(updates.defaultConfig));
        paramIndex++;
      }

      if (updates.templateVariables !== undefined) {
        updateFields.push(`template_variables = $${paramIndex}`);
        updateParams.push(JSON.stringify(updates.templateVariables));
        paramIndex++;
      }

      if (updates.tags !== undefined) {
        updateFields.push(`tags = $${paramIndex}`);
        updateParams.push(updates.tags);
        paramIndex++;
      }

      if (updates.keywords !== undefined) {
        updateFields.push(`keywords = $${paramIndex}`);
        updateParams.push(updates.keywords);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        await client.query('COMMIT');
        return this.mapRowToTemplate(existingTemplate.rows[0]);
      }

      updateFields.push(`updated_at = NOW()`);

      const result = await client.query(`
        UPDATE workflow_templates 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, [...updateParams, templateId]);

      await client.query('COMMIT');

      const template = this.mapRowToTemplate(result.rows[0]);

      logger.info('Workflow template updated', { templateId, updates, updatedBy });

      return template;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update workflow template', { error, templateId, updates });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 删除工作流模板
   */
  async deleteTemplate(templateId: string, userId?: string): Promise<void> {
    const result = await this.pool.query(`
      DELETE FROM workflow_templates 
      WHERE id = $1 AND (is_system = false OR created_by = $2)
      RETURNING id
    `, [templateId, userId]);

    if (result.rows.length === 0) {
      throw new Error('Template not found or access denied');
    }

    logger.info('Workflow template deleted', { templateId, userId });
  }

  /**
   * 增加模板使用次数
   */
  async incrementUsageCount(templateId: string): Promise<void> {
    await this.pool.query(`
      UPDATE workflow_templates 
      SET usage_count = usage_count + 1, updated_at = NOW()
      WHERE id = $1
    `, [templateId]);
  }

  /**
   * 模板评分
   */
  async rateTemplate(templateId: string, rating: number, userId: string): Promise<void> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // 检查用户是否已经评分过
      const existingRating = await client.query(`
        SELECT id FROM template_ratings 
        WHERE template_id = $1 AND user_id = $2
      `, [templateId, userId]);

      if (existingRating.rows.length > 0) {
        // 更新评分
        await client.query(`
          UPDATE template_ratings 
          SET rating = $1, updated_at = NOW()
          WHERE template_id = $2 AND user_id = $3
        `, [rating, templateId, userId]);
      } else {
        // 新增评分
        await client.query(`
          INSERT INTO template_ratings (id, template_id, user_id, rating, created_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
        `, [uuidv4(), templateId, userId, rating]);
      }

      // 重新计算平均评分
      const ratingStats = await client.query(`
        SELECT AVG(rating) as avg_rating, COUNT(*) as rating_count
        FROM template_ratings 
        WHERE template_id = $1
      `, [templateId]);

      const avgRating = parseFloat(ratingStats.rows[0].avg_rating) || 0;
      const ratingCount = parseInt(ratingStats.rows[0].rating_count) || 0;

      await client.query(`
        UPDATE workflow_templates 
        SET rating = $1, rating_count = $2, updated_at = NOW()
        WHERE id = $3
      `, [avgRating, ratingCount, templateId]);

      await client.query('COMMIT');

      logger.info('Template rated', { templateId, rating, userId, avgRating, ratingCount });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to rate template', { error, templateId, rating, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取模板分类统计
   */
  async getCategoryStats(): Promise<Array<{
    category: string;
    count: number;
    avgRating: number;
    totalUsage: number;
  }>> {
    const result = await this.pool.query(`
      SELECT 
        category,
        COUNT(*) as count,
        AVG(rating) as avg_rating,
        SUM(usage_count) as total_usage
      FROM workflow_templates 
      GROUP BY category
      ORDER BY count DESC
    `);

    return result.rows.map(row => ({
      category: row.category,
      count: parseInt(row.count),
      avgRating: parseFloat(row.avg_rating) || 0,
      totalUsage: parseInt(row.total_usage) || 0
    }));
  }

  /**
   * 获取快速操作模板列表
   */
  async getQuickActionTemplates(options?: {
    category?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ templates: QuickActionTemplate[]; total: number }> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 50, 200);
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.category) {
      whereClause += ` AND category = $${paramIndex}`;
      params.push(options.category);
      paramIndex++;
    }

    if (options?.isActive !== undefined) {
      whereClause += ` AND is_active = $${paramIndex}`;
      params.push(options.isActive);
      paramIndex++;
    }

    // 获取总数
    const countResult = await this.pool.query(`
      SELECT COUNT(*) as total FROM quick_action_templates ${whereClause}
    `, params);

    // 获取数据
    const result = await this.pool.query(`
      SELECT * FROM quick_action_templates ${whereClause}
      ORDER BY usage_count DESC, name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    return {
      templates: result.rows.map(row => this.mapRowToQuickActionTemplate(row)),
      total: parseInt(countResult.rows[0].total)
    };
  }

  /**
   * 创建快速操作模板
   */
  async createQuickActionTemplate(
    templateData: {
      name: string;
      description: string;
      icon: string;
      category: string;
      actionType: QuickActionTemplate['actionType'];
      actionConfig: Record<string, any>;
      uiConfig?: QuickActionTemplate['uiConfig'];
      requiredPermissions?: string[];
      rateLimitPerHour?: number;
    }
  ): Promise<QuickActionTemplate> {
    const templateId = uuidv4();
    const now = new Date();

    const result = await this.pool.query(`
      INSERT INTO quick_action_templates (
        id, name, description, icon, category, action_type, action_config,
        ui_config, required_permissions, rate_limit_per_hour, usage_count,
        is_system, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      templateId,
      templateData.name,
      templateData.description,
      templateData.icon,
      templateData.category,
      templateData.actionType,
      JSON.stringify(templateData.actionConfig),
      JSON.stringify(templateData.uiConfig || {}),
      templateData.requiredPermissions || [],
      templateData.rateLimitPerHour || null,
      0, // usage_count
      false, // is_system
      true, // is_active
      now,
      now
    ]);

    const template = this.mapRowToQuickActionTemplate(result.rows[0]);

    logger.info('Quick action template created', {
      templateId: template.id,
      name: template.name,
      actionType: template.actionType
    });

    return template;
  }

  /**
   * 增加快速操作使用次数
   */
  async incrementQuickActionUsage(templateId: string): Promise<void> {
    await this.pool.query(`
      UPDATE quick_action_templates 
      SET usage_count = usage_count + 1, updated_at = NOW()
      WHERE id = $1
    `, [templateId]);
  }

  /**
   * 获取推荐模板
   */
  async getRecommendedTemplates(
    userId: string,
    limit = 10
  ): Promise<WorkflowTemplate[]> {
    // 这里可以根据用户的使用历史和偏好推荐模板
    // 暂时返回评分最高和使用最多的模板
    const result = await this.pool.query(`
      SELECT * FROM workflow_templates 
      WHERE is_featured = true OR rating >= 4.0
      ORDER BY (rating * 0.7 + (usage_count / 1000.0) * 0.3) DESC
      LIMIT $1
    `, [limit]);

    return result.rows.map(row => this.mapRowToTemplate(row));
  }

  /**
   * 搜索模板
   */
  async searchTemplates(
    query: string,
    options?: {
      category?: string;
      difficultyLevel?: string;
      limit?: number;
    }
  ): Promise<WorkflowTemplate[]> {
    const limit = Math.min(options?.limit || 20, 100);
    
    let whereClause = `WHERE (
      name ILIKE $1 OR 
      description ILIKE $1 OR 
      $2 = ANY(keywords) OR 
      $2 = ANY(tags)
    )`;
    
    const params: any[] = [`%${query}%`, query];
    let paramIndex = 3;

    if (options?.category) {
      whereClause += ` AND category = $${paramIndex}`;
      params.push(options.category);
      paramIndex++;
    }

    if (options?.difficultyLevel) {
      whereClause += ` AND difficulty_level = $${paramIndex}`;
      params.push(options.difficultyLevel);
      paramIndex++;
    }

    const result = await this.pool.query(`
      SELECT * FROM workflow_templates ${whereClause}
      ORDER BY 
        CASE 
          WHEN name ILIKE $1 THEN 1
          WHEN description ILIKE $1 THEN 2
          WHEN $2 = ANY(keywords) THEN 3
          WHEN $2 = ANY(tags) THEN 4
          ELSE 5
        END,
        rating DESC,
        usage_count DESC
      LIMIT $${paramIndex}
    `, [...params, limit]);

    return result.rows.map(row => this.mapRowToTemplate(row));
  }

  /**
   * 将数据库行映射为WorkflowTemplate对象
   */
  private mapRowToTemplate(row: any): WorkflowTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      version: row.version,
      isSystem: row.is_system,
      isFeatured: row.is_featured,
      difficultyLevel: row.difficulty_level,
      templateDefinition: row.template_definition,
      defaultConfig: row.default_config,
      templateVariables: row.template_variables,
      usageCount: row.usage_count,
      rating: parseFloat(row.rating) || 0,
      ratingCount: row.rating_count,
      tags: row.tags || [],
      keywords: row.keywords || [],
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * 将数据库行映射为QuickActionTemplate对象
   */
  private mapRowToQuickActionTemplate(row: any): QuickActionTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      category: row.category,
      actionType: row.action_type,
      actionConfig: row.action_config,
      uiConfig: row.ui_config,
      requiredPermissions: row.required_permissions || [],
      rateLimitPerHour: row.rate_limit_per_hour,
      usageCount: row.usage_count,
      isSystem: row.is_system,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

/**
 * 系统预定义模板初始化
 */
export class SystemTemplateInitializer {
  private templateService: WorkflowTemplateService;

  constructor(templateService: WorkflowTemplateService) {
    this.templateService = templateService;
  }

  /**
   * 初始化系统预定义模板
   */
  async initializeSystemTemplates(): Promise<void> {
    const systemTemplates = this.getSystemTemplates();
    
    for (const template of systemTemplates) {
      try {
        // 检查模板是否已存在
        const existing = await this.templateService.getTemplate(template.id);
        if (!existing) {
          // 直接插入到数据库，因为这是系统模板
          await this.createSystemTemplate(template);
          logger.info(`System template initialized: ${template.name}`);
        }
      } catch (error) {
        logger.error(`Failed to initialize system template: ${template.name}`, { error });
      }
    }
  }

  /**
   * 获取系统预定义模板
   */
  private getSystemTemplates(): Array<WorkflowTemplate & { id: string }> {
    return [
      {
        id: 'sys-template-001',
        name: '高优先级邮件自动处理',
        description: '自动识别和处理来自重要联系人或包含紧急关键词的邮件，进行标记、通知和归档',
        category: 'email_automation',
        version: '1.0',
        isSystem: true,
        isFeatured: true,
        difficultyLevel: 'beginner' as const,
        templateDefinition: {
          nodes: [
            {
              id: 'start',
              type: 'start',
              name: '开始',
              config: {},
              position: { x: 100, y: 100 }
            },
            {
              id: 'email_filter',
              type: 'email_filter',
              name: '邮件过滤',
              config: {
                conditions: [
                  { field: 'sender', operator: 'in', value: '${important_senders}', valueType: 'string' },
                  { field: 'subject', operator: 'contains', value: '${urgent_keywords}', valueType: 'string' }
                ],
                logicOperator: 'OR'
              },
              position: { x: 300, y: 100 }
            },
            {
              id: 'add_tags',
              type: 'batch_operation',
              name: '添加标签',
              config: {
                operationType: 'email_bulk_tag',
                parameters: { tags: ['高优先级', '重要'] }
              },
              position: { x: 500, y: 100 }
            },
            {
              id: 'send_notification',
              type: 'notification',
              name: '发送通知',
              config: {
                notificationType: 'high_priority_email',
                channels: ['email', 'push']
              },
              position: { x: 700, y: 100 }
            },
            {
              id: 'end',
              type: 'end',
              name: '结束',
              config: {},
              position: { x: 900, y: 100 }
            }
          ],
          connections: [
            { id: 'c1', from: 'start', to: 'email_filter' },
            { id: 'c2', from: 'email_filter', to: 'add_tags', condition: 'success' },
            { id: 'c3', from: 'add_tags', to: 'send_notification' },
            { id: 'c4', from: 'send_notification', to: 'end' },
            { id: 'c5', from: 'email_filter', to: 'end', condition: 'failure' }
          ],
          variables: {}
        },
        defaultConfig: {
          processingMode: 'realtime',
          notificationEnabled: true,
          autoArchive: false
        },
        templateVariables: [
          {
            name: 'important_senders',
            type: 'string',
            description: '重要发件人邮箱地址（逗号分隔）',
            required: true,
            defaultValue: 'boss@company.com,manager@company.com'
          },
          {
            name: 'urgent_keywords',
            type: 'string',
            description: '紧急关键词（逗号分隔）',
            required: true,
            defaultValue: '紧急,urgent,ASAP,重要'
          }
        ],
        usageCount: 0,
        rating: 0,
        ratingCount: 0,
        tags: ['email', 'automation', 'priority', 'notification'],
        keywords: ['高优先级', '重要邮件', '自动标记', '通知提醒'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'sys-template-002',
        name: '垃圾邮件批量清理',
        description: '自动识别垃圾邮件并批量移动到垃圾箱，保持收件箱整洁',
        category: 'email_automation',
        version: '1.0',
        isSystem: true,
        isFeatured: true,
        difficultyLevel: 'beginner' as const,
        templateDefinition: {
          nodes: [
            {
              id: 'start',
              type: 'start',
              name: '开始',
              config: {},
              position: { x: 100, y: 100 }
            },
            {
              id: 'spam_filter',
              type: 'email_filter',
              name: '垃圾邮件筛选',
              config: {
                conditions: [
                  { field: 'subject', operator: 'contains', value: '${spam_keywords}', valueType: 'string' },
                  { field: 'sender', operator: 'not_in', value: '${whitelist_domains}', valueType: 'string' }
                ],
                logicOperator: 'OR'
              },
              position: { x: 300, y: 100 }
            },
            {
              id: 'batch_move',
              type: 'batch_operation',
              name: '批量移动',
              config: {
                operationType: 'email_bulk_move',
                parameters: { folderId: 'spam' }
              },
              position: { x: 500, y: 100 }
            },
            {
              id: 'add_spam_tag',
              type: 'batch_operation',
              name: '添加垃圾标签',
              config: {
                operationType: 'email_bulk_tag',
                parameters: { tags: ['垃圾邮件', '已处理'] }
              },
              position: { x: 700, y: 100 }
            },
            {
              id: 'end',
              type: 'end',
              name: '结束',
              config: {},
              position: { x: 900, y: 100 }
            }
          ],
          connections: [
            { id: 'c1', from: 'start', to: 'spam_filter' },
            { id: 'c2', from: 'spam_filter', to: 'batch_move', condition: 'success' },
            { id: 'c3', from: 'batch_move', to: 'add_spam_tag' },
            { id: 'c4', from: 'add_spam_tag', to: 'end' },
            { id: 'c5', from: 'spam_filter', to: 'end', condition: 'failure' }
          ],
          variables: {}
        },
        defaultConfig: {
          batchSize: 50,
          processingInterval: 300
        },
        templateVariables: [
          {
            name: 'spam_keywords',
            type: 'string',
            description: '垃圾邮件关键词',
            required: true,
            defaultValue: '中奖,免费,促销,广告'
          },
          {
            name: 'whitelist_domains',
            type: 'string',
            description: '白名单域名',
            required: false,
            defaultValue: 'company.com,trusted-partner.com'
          }
        ],
        usageCount: 0,
        rating: 0,
        ratingCount: 0,
        tags: ['spam', 'cleanup', 'automation', 'batch'],
        keywords: ['垃圾邮件', '批量清理', '自动归档', '收件箱管理'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  /**
   * 创建系统模板
   */
  private async createSystemTemplate(template: WorkflowTemplate & { id: string }): Promise<void> {
    // 这里需要直接插入数据库，因为createTemplate方法不支持指定ID
    // 实际实现中可能需要修改createTemplate方法或创建专门的系统模板创建方法
    logger.info(`Would create system template: ${template.name}`);
  }
}