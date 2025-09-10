import { RuleExecutionLog, CreateRuleExecutionLogRequest } from '@/types';
import database from '@/config/database';
import logger from '@/utils/logger';
import { DatabaseError } from '@/utils/errors';
import { v4 as uuidv4 } from 'uuid';

/**
 * 规则执行日志模型类
 * 处理所有与规则执行日志相关的数据库操作
 */
export class RuleExecutionLogModel {
  /**
   * 创建规则执行日志
   */
  static async create(logData: CreateRuleExecutionLogRequest): Promise<RuleExecutionLog> {
    try {
      const logId = uuidv4();
      
      const query = `
        INSERT INTO rule_execution_logs (
          id, rule_id, user_id, email_message_id, execution_time, 
          status, actions_executed, error_message, execution_duration_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      
      const values = [
        logId,
        logData.ruleId,
        logData.userId,
        logData.emailMessageId,
        logData.executionTime,
        logData.status,
        JSON.stringify(logData.actionsExecuted || []),
        logData.errorMessage || null,
        logData.executionDurationMs || null
      ];
      
      const result = await database.query(query, values);
      
      if (result.rows.length === 0) {
        throw new DatabaseError('Failed to create rule execution log');
      }
      
      return this.mapRowToRuleExecutionLog(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create rule execution log', { error, logData });
      throw new DatabaseError('Failed to create rule execution log');
    }
  }
  
  /**
   * 批量创建规则执行日志
   */
  static async createBatch(logsData: CreateRuleExecutionLogRequest[]): Promise<RuleExecutionLog[]> {
    if (logsData.length === 0) {
      return [];
    }
    
    const client = await database.getPool().connect();
    
    try {
      await client.query('BEGIN');
      
      const logs: RuleExecutionLog[] = [];
      
      for (const logData of logsData) {
        const logId = uuidv4();
        
        const query = `
          INSERT INTO rule_execution_logs (
            id, rule_id, user_id, email_message_id, execution_time, 
            status, actions_executed, error_message, execution_duration_ms
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `;
        
        const values = [
          logId,
          logData.ruleId,
          logData.userId,
          logData.emailMessageId,
          logData.executionTime,
          logData.status,
          JSON.stringify(logData.actionsExecuted || []),
          logData.errorMessage || null,
          logData.executionDurationMs || null
        ];
        
        const result = await client.query(query, values);
        
        if (result.rows.length > 0) {
          logs.push(this.mapRowToRuleExecutionLog(result.rows[0]));
        }
      }
      
      await client.query('COMMIT');
      
      logger.info('Batch rule execution logs created', { count: logs.length });
      return logs;
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create batch rule execution logs', { error });
      throw new DatabaseError('Failed to create batch rule execution logs');
    } finally {
      client.release();
    }
  }
  
  /**
   * 获取规则的执行日志
   */
  static async getByRuleId(ruleId: string, userId: string, options: {
    page?: number;
    limit?: number;
    status?: 'success' | 'error' | 'skipped';
    dateFrom?: Date;
    dateTo?: Date;
  } = {}): Promise<{
    logs: RuleExecutionLog[];
    total: number;
  }> {
    try {
      const page = options.page || 1;
      const limit = Math.min(options.limit || 20, 100);
      const offset = (page - 1) * limit;
      
      let whereConditions = ['rule_id = $1', 'user_id = $2'];
      const values: any[] = [ruleId, userId];
      let paramIndex = 3;
      
      if (options.status) {
        whereConditions.push(`status = $${paramIndex++}`);
        values.push(options.status);
      }
      
      if (options.dateFrom) {
        whereConditions.push(`execution_time >= $${paramIndex++}`);
        values.push(options.dateFrom);
      }
      
      if (options.dateTo) {
        whereConditions.push(`execution_time <= $${paramIndex++}`);
        values.push(options.dateTo);
      }
      
      const whereClause = whereConditions.join(' AND ');
      
      const query = `
        SELECT *
        FROM rule_execution_logs
        WHERE ${whereClause}
        ORDER BY execution_time DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      
      values.push(limit, offset);
      
      const countQuery = `
        SELECT COUNT(*) as total
        FROM rule_execution_logs
        WHERE ${whereClause}
      `;
      
      const [logsResult, countResult] = await Promise.all([
        database.query(query, values),
        database.query(countQuery, values.slice(0, -2))
      ]);
      
      const logs = logsResult.rows.map((row: any) => this.mapRowToRuleExecutionLog(row));
      const total = parseInt(countResult.rows[0].total, 10);
      
      return { logs, total };
    } catch (error) {
      logger.error('Failed to get rule execution logs', { ruleId, userId, error });
      throw new DatabaseError('Failed to get rule execution logs');
    }
  }
  
  /**
   * 获取用户的执行日志统计
   */
  static async getStatistics(userId: string, options: {
    ruleId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  } = {}): Promise<{
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    skippedExecutions: number;
    averageExecutionTime: number;
    executionsByRule: Array<{
      ruleId: string;
      ruleName: string;
      executionCount: number;
      successCount: number;
      errorCount: number;
    }>;
    executionsByDate: Array<{
      date: string;
      executionCount: number;
      successCount: number;
      errorCount: number;
    }>;
  }> {
    try {
      let whereConditions = ['rel.user_id = $1'];
      const values: any[] = [userId];
      let paramIndex = 2;
      
      if (options.ruleId) {
        whereConditions.push(`rel.rule_id = $${paramIndex++}`);
        values.push(options.ruleId);
      }
      
      if (options.dateFrom) {
        whereConditions.push(`rel.execution_time >= $${paramIndex++}`);
        values.push(options.dateFrom);
      }
      
      if (options.dateTo) {
        whereConditions.push(`rel.execution_time <= $${paramIndex++}`);
        values.push(options.dateTo);
      }
      
      const whereClause = whereConditions.join(' AND ');
      
      // 获取总体统计
      const overallStatsQuery = `
        SELECT 
          COUNT(*) as total_executions,
          COUNT(*) FILTER (WHERE status = 'success') as successful_executions,
          COUNT(*) FILTER (WHERE status = 'error') as failed_executions,
          COUNT(*) FILTER (WHERE status = 'skipped') as skipped_executions,
          AVG(execution_duration_ms) as average_execution_time
        FROM rule_execution_logs rel
        WHERE ${whereClause}
      `;
      
      // 按规则统计
      const ruleStatsQuery = `
        SELECT 
          rel.rule_id,
          fr.name as rule_name,
          COUNT(*) as execution_count,
          COUNT(*) FILTER (WHERE rel.status = 'success') as success_count,
          COUNT(*) FILTER (WHERE rel.status = 'error') as error_count
        FROM rule_execution_logs rel
        LEFT JOIN filter_rules fr ON rel.rule_id = fr.id
        WHERE ${whereClause}
        GROUP BY rel.rule_id, fr.name
        ORDER BY execution_count DESC
      `;
      
      // 按日期统计
      const dateStatsQuery = `
        SELECT 
          DATE(rel.execution_time) as date,
          COUNT(*) as execution_count,
          COUNT(*) FILTER (WHERE rel.status = 'success') as success_count,
          COUNT(*) FILTER (WHERE rel.status = 'error') as error_count
        FROM rule_execution_logs rel
        WHERE ${whereClause}
        GROUP BY DATE(rel.execution_time)
        ORDER BY date DESC
        LIMIT 30
      `;
      
      const [overallResult, ruleResult, dateResult] = await Promise.all([
        database.query(overallStatsQuery, values),
        database.query(ruleStatsQuery, values),
        database.query(dateStatsQuery, values)
      ]);
      
      const overallStats = overallResult.rows[0];
      
      return {
        totalExecutions: parseInt(overallStats.total_executions, 10),
        successfulExecutions: parseInt(overallStats.successful_executions, 10),
        failedExecutions: parseInt(overallStats.failed_executions, 10),
        skippedExecutions: parseInt(overallStats.skipped_executions, 10),
        averageExecutionTime: parseFloat(overallStats.average_execution_time) || 0,
        executionsByRule: ruleResult.rows.map((row: any) => ({
          ruleId: row.rule_id,
          ruleName: row.rule_name || 'Unknown Rule',
          executionCount: parseInt(row.execution_count, 10),
          successCount: parseInt(row.success_count, 10),
          errorCount: parseInt(row.error_count, 10)
        })),
        executionsByDate: dateResult.rows.map((row: any) => ({
          date: row.date,
          executionCount: parseInt(row.execution_count, 10),
          successCount: parseInt(row.success_count, 10),
          errorCount: parseInt(row.error_count, 10)
        }))
      };
    } catch (error) {
      logger.error('Failed to get rule execution statistics', { userId, error });
      throw new DatabaseError('Failed to get rule execution statistics');
    }
  }
  
  /**
   * 清理旧的执行日志（保留指定天数）
   */
  static async cleanup(retentionDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      const query = `
        DELETE FROM rule_execution_logs
        WHERE execution_time < $1
      `;
      
      const result = await database.query(query, [cutoffDate]);
      
      logger.info('Rule execution logs cleanup completed', { 
        deletedCount: result.rowCount, 
        cutoffDate 
      });
      
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Failed to cleanup rule execution logs', { error });
      throw new DatabaseError('Failed to cleanup rule execution logs');
    }
  }
  
  /**
   * 获取最近的执行日志
   */
  static async getRecent(userId: string, limit: number = 10): Promise<RuleExecutionLog[]> {
    try {
      const query = `
        SELECT rel.*, fr.name as rule_name
        FROM rule_execution_logs rel
        LEFT JOIN filter_rules fr ON rel.rule_id = fr.id
        WHERE rel.user_id = $1
        ORDER BY rel.execution_time DESC
        LIMIT $2
      `;
      
      const result = await database.query(query, [userId, limit]);
      return result.rows.map((row: any) => {
        const log = this.mapRowToRuleExecutionLog(row);
        // 添加规则名称到额外信息中
        if (row.rule_name) {
          (log as any).ruleName = row.rule_name;
        }
        return log;
      });
    } catch (error) {
      logger.error('Failed to get recent rule execution logs', { userId, error });
      throw new DatabaseError('Failed to get recent rule execution logs');
    }
  }
  
  /**
   * 将数据库行映射为RuleExecutionLog对象
   */
  private static mapRowToRuleExecutionLog(row: any): RuleExecutionLog {
    return {
      id: row.id,
      ruleId: row.rule_id,
      userId: row.user_id,
      emailMessageId: row.email_message_id,
      executionTime: new Date(row.execution_time),
      status: row.status as 'success' | 'error' | 'skipped',
      actionsExecuted: row.actions_executed ? JSON.parse(row.actions_executed) : [],
      errorMessage: row.error_message,
      executionDurationMs: row.execution_duration_ms,
      createdAt: new Date(row.created_at)
    };
  }
}