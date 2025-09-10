import { FilterRule, FilterRuleCondition, FilterRuleAction, CreateFilterRuleRequest, UpdateFilterRuleRequest } from '@/types';
import database from '@/config/database';
import logger from '@/utils/logger';
import { DatabaseError, NotFoundError, ValidationError } from '@/utils/errors';
import { v4 as uuidv4 } from 'uuid';

/**
 * 过滤规则模型类
 * 处理所有与过滤规则相关的数据库操作
 */
export class FilterRuleModel {
  /**
   * 创建新的过滤规则
   */
  static async create(ruleData: CreateFilterRuleRequest, userId: string): Promise<FilterRule> {
    const client = await database.getPool().connect();
    
    try {
      await client.query('BEGIN');
      
      const ruleId = uuidv4();
      
      // 验证规则数据
      this.validateRuleData(ruleData);
      
      // 获取用户的最大优先级，新规则优先级+1
      const maxPriorityQuery = `
        SELECT COALESCE(MAX(priority), 0) as max_priority
        FROM filter_rules
        WHERE user_id = $1 AND deleted_at IS NULL
      `;
      const maxPriorityResult = await client.query(maxPriorityQuery, [userId]);
      const nextPriority = maxPriorityResult.rows[0].max_priority + 1;
      
      // 插入规则基本信息
      const ruleQuery = `
        INSERT INTO filter_rules (
          id, user_id, name, description, is_active, priority, logic_operator, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      
      const ruleValues = [
        ruleId,
        userId,
        ruleData.name,
        ruleData.description || null,
        ruleData.isActive !== false, // 默认为true
        ruleData.priority || nextPriority,
        ruleData.logicOperator || 'AND',
        userId
      ];
      
      const ruleResult = await client.query(ruleQuery, ruleValues);
      
      // 插入规则条件
      if (ruleData.conditions && ruleData.conditions.length > 0) {
        for (const condition of ruleData.conditions) {
          const conditionQuery = `
            INSERT INTO filter_rule_conditions (
              id, rule_id, field, operator, value, value_type
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `;
          
          await client.query(conditionQuery, [
            uuidv4(),
            ruleId,
            condition.field,
            condition.operator,
            condition.value,
            condition.valueType || 'string'
          ]);
        }
      }
      
      // 插入规则动作
      if (ruleData.actions && ruleData.actions.length > 0) {
        for (const action of ruleData.actions) {
          const actionQuery = `
            INSERT INTO filter_rule_actions (
              id, rule_id, type, parameters
            ) VALUES ($1, $2, $3, $4)
          `;
          
          await client.query(actionQuery, [
            uuidv4(),
            ruleId,
            action.type,
            JSON.stringify(action.parameters || {})
          ]);
        }
      }
      
      await client.query('COMMIT');
      
      // 获取完整的规则信息
      const rule = await this.findById(ruleId, userId);
      if (!rule) {
        throw new DatabaseError('Failed to retrieve created rule');
      }
      
      logger.info('Filter rule created successfully', { ruleId, userId, name: rule.name });
      return rule;
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create filter rule', { error, userId, ruleData });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to create filter rule');
    } finally {
      client.release();
    }
  }
  
  /**
   * 根据ID查找规则
   */
  static async findById(ruleId: string, userId: string): Promise<FilterRule | null> {
    try {
      const query = `
        SELECT fr.*, 
               array_agg(DISTINCT jsonb_build_object(
                 'id', frc.id,
                 'field', frc.field,
                 'operator', frc.operator,
                 'value', frc.value,
                 'valueType', frc.value_type
               )) FILTER (WHERE frc.id IS NOT NULL) as conditions,
               array_agg(DISTINCT jsonb_build_object(
                 'id', fra.id,
                 'type', fra.type,
                 'parameters', fra.parameters
               )) FILTER (WHERE fra.id IS NOT NULL) as actions
        FROM filter_rules fr
        LEFT JOIN filter_rule_conditions frc ON fr.id = frc.rule_id
        LEFT JOIN filter_rule_actions fra ON fr.id = fra.rule_id
        WHERE fr.id = $1 AND fr.user_id = $2 AND fr.deleted_at IS NULL
        GROUP BY fr.id
      `;
      
      const result = await database.query(query, [ruleId, userId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToFilterRule(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find filter rule by ID', { ruleId, userId, error });
      throw new DatabaseError('Failed to find filter rule');
    }
  }
  
  /**
   * 获取用户的所有规则列表
   */
  static async list(userId: string, options: {
    page?: number;
    limit?: number;
    active?: boolean;
    search?: string;
  } = {}): Promise<{
    rules: FilterRule[];
    total: number;
  }> {
    try {
      const page = options.page || 1;
      const limit = Math.min(options.limit || 20, 100);
      const offset = (page - 1) * limit;
      
      let whereConditions = ['fr.user_id = $1', 'fr.deleted_at IS NULL'];
      const values: any[] = [userId];
      let paramIndex = 2;
      
      if (options.active !== undefined) {
        whereConditions.push(`fr.is_active = $${paramIndex++}`);
        values.push(options.active);
      }
      
      if (options.search) {
        whereConditions.push(`(fr.name ILIKE $${paramIndex++} OR fr.description ILIKE $${paramIndex++})`);
        values.push(`%${options.search}%`, `%${options.search}%`);
      }
      
      const whereClause = whereConditions.join(' AND ');
      
      const query = `
        SELECT fr.*, 
               array_agg(DISTINCT jsonb_build_object(
                 'id', frc.id,
                 'field', frc.field,
                 'operator', frc.operator,
                 'value', frc.value,
                 'valueType', frc.value_type
               )) FILTER (WHERE frc.id IS NOT NULL) as conditions,
               array_agg(DISTINCT jsonb_build_object(
                 'id', fra.id,
                 'type', fra.type,
                 'parameters', fra.parameters
               )) FILTER (WHERE fra.id IS NOT NULL) as actions
        FROM filter_rules fr
        LEFT JOIN filter_rule_conditions frc ON fr.id = frc.rule_id
        LEFT JOIN filter_rule_actions fra ON fr.id = fra.rule_id
        WHERE ${whereClause}
        GROUP BY fr.id
        ORDER BY fr.priority ASC, fr.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      
      values.push(limit, offset);
      
      const countQuery = `
        SELECT COUNT(*) as total
        FROM filter_rules fr
        WHERE ${whereClause}
      `;
      
      const [rulesResult, countResult] = await Promise.all([
        database.query(query, values),
        database.query(countQuery, values.slice(0, -2))
      ]);
      
      const rules = rulesResult.rows.map((row: any) => this.mapRowToFilterRule(row));
      const total = parseInt(countResult.rows[0].total, 10);
      
      return { rules, total };
    } catch (error) {
      logger.error('Failed to list filter rules', { userId, error });
      throw new DatabaseError('Failed to list filter rules');
    }
  }
  
  /**
   * 更新规则
   */
  static async update(ruleId: string, userId: string, updateData: UpdateFilterRuleRequest): Promise<FilterRule> {
    const client = await database.getPool().connect();
    
    try {
      await client.query('BEGIN');
      
      // 检查规则是否存在且属于用户
      const existingRule = await this.findById(ruleId, userId);
      if (!existingRule) {
        throw new NotFoundError('Filter rule');
      }
      
      // 更新规则基本信息
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      if (updateData.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(updateData.name);
      }
      
      if (updateData.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(updateData.description);
      }
      
      if (updateData.isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(updateData.isActive);
      }
      
      if (updateData.priority !== undefined) {
        updates.push(`priority = $${paramIndex++}`);
        values.push(updateData.priority);
      }
      
      if (updateData.logicOperator !== undefined) {
        updates.push(`logic_operator = $${paramIndex++}`);
        values.push(updateData.logicOperator);
      }
      
      if (updates.length > 0) {
        values.push(ruleId, userId);
        
        const updateQuery = `
          UPDATE filter_rules
          SET ${updates.join(', ')}, updated_at = NOW()
          WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
        `;
        
        await client.query(updateQuery, values);
      }
      
      // 更新条件（如果提供）
      if (updateData.conditions !== undefined) {
        // 删除现有条件
        await client.query('DELETE FROM filter_rule_conditions WHERE rule_id = $1', [ruleId]);
        
        // 插入新条件
        if (updateData.conditions.length > 0) {
          for (const condition of updateData.conditions) {
            const conditionQuery = `
              INSERT INTO filter_rule_conditions (
                id, rule_id, field, operator, value, value_type
              ) VALUES ($1, $2, $3, $4, $5, $6)
            `;
            
            await client.query(conditionQuery, [
              uuidv4(),
              ruleId,
              condition.field,
              condition.operator,
              condition.value,
              condition.valueType || 'string'
            ]);
          }
        }
      }
      
      // 更新动作（如果提供）
      if (updateData.actions !== undefined) {
        // 删除现有动作
        await client.query('DELETE FROM filter_rule_actions WHERE rule_id = $1', [ruleId]);
        
        // 插入新动作
        if (updateData.actions.length > 0) {
          for (const action of updateData.actions) {
            const actionQuery = `
              INSERT INTO filter_rule_actions (
                id, rule_id, type, parameters
              ) VALUES ($1, $2, $3, $4)
            `;
            
            await client.query(actionQuery, [
              uuidv4(),
              ruleId,
              action.type,
              JSON.stringify(action.parameters || {})
            ]);
          }
        }
      }
      
      await client.query('COMMIT');
      
      // 获取更新后的规则
      const updatedRule = await this.findById(ruleId, userId);
      if (!updatedRule) {
        throw new DatabaseError('Failed to retrieve updated rule');
      }
      
      logger.info('Filter rule updated successfully', { ruleId, userId });
      return updatedRule;
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update filter rule', { error, ruleId, userId });
      
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to update filter rule');
    } finally {
      client.release();
    }
  }
  
  /**
   * 删除规则（软删除）
   */
  static async delete(ruleId: string, userId: string): Promise<void> {
    try {
      const query = `
        UPDATE filter_rules
        SET deleted_at = NOW()
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
      `;
      
      const result = await database.query(query, [ruleId, userId]);
      
      if (result.rowCount === 0) {
        throw new NotFoundError('Filter rule');
      }
      
      logger.info('Filter rule deleted successfully', { ruleId, userId });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      logger.error('Failed to delete filter rule', { ruleId, userId, error });
      throw new DatabaseError('Failed to delete filter rule');
    }
  }
  
  /**
   * 切换规则启用状态
   */
  static async toggle(ruleId: string, userId: string): Promise<FilterRule> {
    try {
      const query = `
        UPDATE filter_rules
        SET is_active = NOT is_active, updated_at = NOW()
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        RETURNING is_active
      `;
      
      const result = await database.query(query, [ruleId, userId]);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Filter rule');
      }
      
      const updatedRule = await this.findById(ruleId, userId);
      if (!updatedRule) {
        throw new DatabaseError('Failed to retrieve updated rule');
      }
      
      logger.info('Filter rule status toggled', { 
        ruleId, 
        userId, 
        newStatus: result.rows[0].is_active 
      });
      
      return updatedRule;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      logger.error('Failed to toggle filter rule', { ruleId, userId, error });
      throw new DatabaseError('Failed to toggle filter rule');
    }
  }
  
  /**
   * 获取用户的活动规则（用于规则执行）
   */
  static async getActiveRules(userId: string): Promise<FilterRule[]> {
    try {
      const query = `
        SELECT fr.*, 
               array_agg(DISTINCT jsonb_build_object(
                 'id', frc.id,
                 'field', frc.field,
                 'operator', frc.operator,
                 'value', frc.value,
                 'valueType', frc.value_type
               )) FILTER (WHERE frc.id IS NOT NULL) as conditions,
               array_agg(DISTINCT jsonb_build_object(
                 'id', fra.id,
                 'type', fra.type,
                 'parameters', fra.parameters
               )) FILTER (WHERE fra.id IS NOT NULL) as actions
        FROM filter_rules fr
        LEFT JOIN filter_rule_conditions frc ON fr.id = frc.rule_id
        LEFT JOIN filter_rule_actions fra ON fr.id = fra.rule_id
        WHERE fr.user_id = $1 AND fr.is_active = true AND fr.deleted_at IS NULL
        GROUP BY fr.id
        ORDER BY fr.priority ASC, fr.created_at ASC
      `;
      
      const result = await database.query(query, [userId]);
      return result.rows.map((row: any) => this.mapRowToFilterRule(row));
    } catch (error) {
      logger.error('Failed to get active filter rules', { userId, error });
      throw new DatabaseError('Failed to get active filter rules');
    }
  }
  
  /**
   * 更新规则优先级
   */
  static async updatePriorities(userId: string, ruleIds: string[]): Promise<void> {
    const client = await database.getPool().connect();
    
    try {
      await client.query('BEGIN');
      
      // 为每个规则设置新的优先级（基于数组顺序）
      for (let i = 0; i < ruleIds.length; i++) {
        const query = `
          UPDATE filter_rules
          SET priority = $1, updated_at = NOW()
          WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL
        `;
        
        await client.query(query, [i + 1, ruleIds[i], userId]);
      }
      
      await client.query('COMMIT');
      logger.info('Filter rule priorities updated', { userId, ruleCount: ruleIds.length });
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update rule priorities', { userId, error });
      throw new DatabaseError('Failed to update rule priorities');
    } finally {
      client.release();
    }
  }
  
  /**
   * 验证规则数据
   */
  private static validateRuleData(ruleData: CreateFilterRuleRequest | UpdateFilterRuleRequest): void {
    if ('name' in ruleData && (!ruleData.name || ruleData.name.trim().length === 0)) {
      throw new ValidationError('Rule name is required');
    }
    
    if ('name' in ruleData && ruleData.name && ruleData.name.length > 100) {
      throw new ValidationError('Rule name cannot exceed 100 characters');
    }
    
    if (ruleData.description && ruleData.description.length > 500) {
      throw new ValidationError('Rule description cannot exceed 500 characters');
    }
    
    if (ruleData.logicOperator && !['AND', 'OR'].includes(ruleData.logicOperator)) {
      throw new ValidationError('Logic operator must be AND or OR');
    }
    
    if (ruleData.conditions) {
      if (ruleData.conditions.length === 0) {
        throw new ValidationError('At least one condition is required');
      }
      
      for (const condition of ruleData.conditions) {
        if (!condition.field || !condition.operator || condition.value === undefined) {
          throw new ValidationError('Each condition must have field, operator, and value');
        }
      }
    }
    
    if (ruleData.actions) {
      if (ruleData.actions.length === 0) {
        throw new ValidationError('At least one action is required');
      }
      
      for (const action of ruleData.actions) {
        if (!action.type) {
          throw new ValidationError('Each action must have a type');
        }
      }
    }
  }
  
  /**
   * 将数据库行映射为FilterRule对象
   */
  private static mapRowToFilterRule(row: any): FilterRule {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      isActive: row.is_active,
      priority: row.priority,
      logicOperator: row.logic_operator as 'AND' | 'OR',
      conditions: row.conditions || [],
      actions: row.actions || [],
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}