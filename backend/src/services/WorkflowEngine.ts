import { Pool } from 'pg';
import Bull, { Queue, Job } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import * as cron from 'node-cron';
import logger from '@/utils/logger';
import { EmailBatchOperationService } from './EmailBatchOperationService';
import { RuleEngineService } from './RuleEngineService';
import { CacheManager } from './CacheManager';

/**
 * 工作流触发类型
 */
export type WorkflowTriggerType = 
  | 'manual' 
  | 'scheduled' 
  | 'event' 
  | 'webhook'
  | 'rule_match'
  | 'email_received';

/**
 * 工作流节点类型
 */
export type WorkflowNodeType =
  | 'start'
  | 'end'
  | 'email_filter'
  | 'batch_operation'
  | 'condition'
  | 'action'
  | 'delay'
  | 'notification'
  | 'rule_apply'
  | 'custom_script';

/**
 * 工作流执行状态
 */
export type WorkflowExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

/**
 * 工作流节点定义
 */
export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  name: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

/**
 * 工作流连接定义
 */
export interface WorkflowConnection {
  id: string;
  from: string;
  to: string;
  condition?: string;
  label?: string;
}

/**
 * 工作流定义
 */
export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  variables: Record<string, any>;
}

/**
 * 工作流触发配置
 */
export interface WorkflowTrigger {
  type: WorkflowTriggerType;
  config: Record<string, any>;
  conditions?: Record<string, any>;
}

/**
 * 工作流
 */
export interface Workflow {
  id: string;
  userId: string;
  name: string;
  description?: string;
  category: string;
  version: number;
  isActive: boolean;
  isTemplate: boolean;
  priority: number;
  triggerConfig: WorkflowTrigger;
  workflowDefinition: WorkflowDefinition;
  executionConfig: {
    timeoutSeconds: number;
    maxConcurrentExecutions: number;
    retryCount: number;
    retryDelay: number;
  };
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  lastExecutionAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 工作流执行
 */
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  userId: string;
  executionId: string;
  status: WorkflowExecutionStatus;
  priority: number;
  triggerType: WorkflowTriggerType;
  triggerData: Record<string, any>;
  startedAt?: Date;
  completedAt?: Date;
  timeoutAt?: Date;
  executionResults: Record<string, any>;
  errorDetails: any[];
  outputData: Record<string, any>;
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  executionDurationMs?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 节点执行上下文
 */
export interface NodeExecutionContext {
  workflowId: string;
  executionId: string;
  nodeId: string;
  inputData: Record<string, any>;
  variables: Record<string, any>;
  previousResults: Record<string, any>;
}

/**
 * 节点执行结果
 */
export interface NodeExecutionResult {
  success: boolean;
  outputData: Record<string, any>;
  error?: string;
  nextNodes?: string[];
}

/**
 * 工作流引擎
 * 负责工作流的创建、执行、监控和管理
 */
export class WorkflowEngine {
  private pool: Pool;
  private workflowQueue: Queue;
  private batchOperationService: EmailBatchOperationService;
  private cacheManager: CacheManager;
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor(
    pool: Pool, 
    redisConfig: any, 
    batchOperationService: EmailBatchOperationService
  ) {
    this.pool = pool;
    this.batchOperationService = batchOperationService;
    this.cacheManager = new CacheManager(redisConfig);

    // 初始化工作流队列
    this.workflowQueue = new Bull('workflow-executions', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 100,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000
        }
      }
    });

    this.setupQueueProcessors();
    this.initializeScheduledWorkflows();
  }

  /**
   * 创建工作流
   */
  async createWorkflow(
    userId: string,
    workflowData: {
      name: string;
      description?: string;
      category: string;
      triggerConfig: WorkflowTrigger;
      workflowDefinition: WorkflowDefinition;
      executionConfig?: Partial<Workflow['executionConfig']>;
      isActive?: boolean;
      priority?: number;
    }
  ): Promise<Workflow> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      const workflowId = uuidv4();
      const now = new Date();

      // 验证工作流定义
      this.validateWorkflowDefinition(workflowData.workflowDefinition);

      const executionConfig = {
        timeoutSeconds: 3600,
        maxConcurrentExecutions: 1,
        retryCount: 3,
        retryDelay: 5000,
        ...workflowData.executionConfig
      };

      // 插入工作流记录
      const result = await client.query(`
        INSERT INTO workflows (
          id, user_id, name, description, category, version, is_active, is_template,
          priority, trigger_config, workflow_definition, execution_config,
          timeout_seconds, max_concurrent_executions, total_executions,
          successful_executions, failed_executions, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *
      `, [
        workflowId,
        userId,
        workflowData.name,
        workflowData.description || '',
        workflowData.category,
        1,
        workflowData.isActive !== false,
        false,
        workflowData.priority || 5,
        JSON.stringify(workflowData.triggerConfig),
        JSON.stringify(workflowData.workflowDefinition),
        JSON.stringify(executionConfig),
        executionConfig.timeoutSeconds,
        executionConfig.maxConcurrentExecutions,
        0,
        0,
        0,
        userId,
        now,
        now
      ]);

      await client.query('COMMIT');

      const workflow = this.mapRowToWorkflow(result.rows[0]);

      // 如果是调度触发的工作流，设置定时任务
      if (workflow.triggerConfig.type === 'scheduled' && workflow.isActive) {
        await this.setupScheduledWorkflow(workflow);
      }

      logger.info('Workflow created', {
        workflowId: workflow.id,
        userId,
        name: workflow.name,
        triggerType: workflow.triggerConfig.type
      });

      return workflow;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create workflow', { error, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 执行工作流
   */
  async executeWorkflow(
    workflowId: string,
    triggerData: Record<string, any> = {},
    options?: {
      priority?: number;
      triggerType?: WorkflowTriggerType;
      delay?: number;
    }
  ): Promise<WorkflowExecution> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    if (!workflow.isActive) {
      throw new Error('Workflow is not active');
    }

    // 检查并发限制
    const runningExecutions = await this.getRunningExecutionCount(workflowId);
    if (runningExecutions >= workflow.executionConfig.maxConcurrentExecutions) {
      throw new Error('Maximum concurrent executions reached');
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      const executionId = uuidv4();
      const uniqueExecutionId = `${workflowId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();

      // 创建执行记录
      const result = await client.query(`
        INSERT INTO workflow_executions (
          id, workflow_id, user_id, execution_id, status, priority,
          trigger_type, trigger_data, timeout_at, execution_results,
          error_details, output_data, total_nodes, completed_nodes,
          failed_nodes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
      `, [
        executionId,
        workflowId,
        workflow.userId,
        uniqueExecutionId,
        'pending',
        options?.priority || workflow.priority,
        options?.triggerType || 'manual',
        JSON.stringify(triggerData),
        new Date(Date.now() + workflow.executionConfig.timeoutSeconds * 1000),
        JSON.stringify({}),
        JSON.stringify([]),
        JSON.stringify({}),
        workflow.workflowDefinition.nodes.length,
        0,
        0,
        now,
        now
      ]);

      await client.query('COMMIT');

      const execution = this.mapRowToWorkflowExecution(result.rows[0]);

      // 加入执行队列
      const jobOptions: any = {
        priority: -execution.priority,
        delay: options?.delay || 0
      };

      await this.workflowQueue.add('execute-workflow', {
        executionId: execution.id,
        workflowId,
        triggerData
      }, jobOptions);

      logger.info('Workflow execution created and queued', {
        executionId: execution.id,
        workflowId,
        triggerType: execution.triggerType
      });

      return execution;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create workflow execution', { error, workflowId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取工作流详情
   */
  async getWorkflow(workflowId: string): Promise<Workflow | null> {
    const result = await this.pool.query(`
      SELECT * FROM workflows WHERE id = $1
    `, [workflowId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToWorkflow(result.rows[0]);
  }

  /**
   * 获取用户工作流列表
   */
  async getUserWorkflows(
    userId: string,
    options?: {
      category?: string;
      isActive?: boolean;
      isTemplate?: boolean;
      page?: number;
      limit?: number;
    }
  ): Promise<{ workflows: Workflow[]; total: number }> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100);
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

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

    if (options?.isTemplate !== undefined) {
      whereClause += ` AND is_template = $${paramIndex}`;
      params.push(options.isTemplate);
      paramIndex++;
    }

    // 获取总数
    const countResult = await this.pool.query(`
      SELECT COUNT(*) as total FROM workflows ${whereClause}
    `, params);

    // 获取数据
    const result = await this.pool.query(`
      SELECT * FROM workflows ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    return {
      workflows: result.rows.map(row => this.mapRowToWorkflow(row)),
      total: parseInt(countResult.rows[0].total)
    };
  }

  /**
   * 更新工作流
   */
  async updateWorkflow(
    workflowId: string,
    userId: string,
    updates: Partial<Pick<Workflow, 'name' | 'description' | 'isActive' | 'priority' | 'triggerConfig' | 'workflowDefinition' | 'executionConfig'>>
  ): Promise<Workflow> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // 验证权限
      const existingWorkflow = await client.query(`
        SELECT * FROM workflows WHERE id = $1 AND user_id = $2
      `, [workflowId, userId]);

      if (existingWorkflow.rows.length === 0) {
        throw new Error('Workflow not found');
      }

      const workflow = this.mapRowToWorkflow(existingWorkflow.rows[0]);

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

      if (updates.isActive !== undefined) {
        updateFields.push(`is_active = $${paramIndex}`);
        updateParams.push(updates.isActive);
        paramIndex++;
      }

      if (updates.priority !== undefined) {
        updateFields.push(`priority = $${paramIndex}`);
        updateParams.push(updates.priority);
        paramIndex++;
      }

      if (updates.triggerConfig !== undefined) {
        updateFields.push(`trigger_config = $${paramIndex}`);
        updateParams.push(JSON.stringify(updates.triggerConfig));
        paramIndex++;
      }

      if (updates.workflowDefinition !== undefined) {
        this.validateWorkflowDefinition(updates.workflowDefinition);
        updateFields.push(`workflow_definition = $${paramIndex}`);
        updateParams.push(JSON.stringify(updates.workflowDefinition));
        paramIndex++;
      }

      if (updates.executionConfig !== undefined) {
        const mergedConfig = { ...workflow.executionConfig, ...updates.executionConfig };
        updateFields.push(`execution_config = $${paramIndex}`);
        updateParams.push(JSON.stringify(mergedConfig));
        paramIndex++;
        updateFields.push(`timeout_seconds = $${paramIndex}`);
        updateParams.push(mergedConfig.timeoutSeconds);
        paramIndex++;
        updateFields.push(`max_concurrent_executions = $${paramIndex}`);
        updateParams.push(mergedConfig.maxConcurrentExecutions);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        await client.query('COMMIT');
        return workflow;
      }

      updateFields.push(`version = version + 1`);
      updateFields.push(`updated_at = NOW()`);

      const result = await client.query(`
        UPDATE workflows 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
        RETURNING *
      `, [...updateParams, workflowId, userId]);

      await client.query('COMMIT');

      const updatedWorkflow = this.mapRowToWorkflow(result.rows[0]);

      // 更新定时任务
      if (updates.triggerConfig || updates.isActive !== undefined) {
        await this.updateScheduledWorkflow(updatedWorkflow);
      }

      logger.info('Workflow updated', { workflowId, userId, updates });

      return updatedWorkflow;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update workflow', { error, workflowId, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 删除工作流
   */
  async deleteWorkflow(workflowId: string, userId: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // 取消正在运行的执行
      await client.query(`
        UPDATE workflow_executions 
        SET status = 'cancelled', updated_at = NOW()
        WHERE workflow_id = $1 AND status IN ('pending', 'running')
      `, [workflowId]);

      // 删除工作流
      const result = await client.query(`
        DELETE FROM workflows WHERE id = $1 AND user_id = $2
        RETURNING id
      `, [workflowId, userId]);

      if (result.rows.length === 0) {
        throw new Error('Workflow not found');
      }

      await client.query('COMMIT');

      // 清理定时任务
      await this.removeScheduledWorkflow(workflowId);

      logger.info('Workflow deleted', { workflowId, userId });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to delete workflow', { error, workflowId, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取工作流执行历史
   */
  async getWorkflowExecutions(
    workflowId: string,
    userId: string,
    options?: {
      status?: WorkflowExecutionStatus;
      page?: number;
      limit?: number;
    }
  ): Promise<{ executions: WorkflowExecution[]; total: number }> {
    // 验证权限
    const workflowResult = await this.pool.query(`
      SELECT id FROM workflows WHERE id = $1 AND user_id = $2
    `, [workflowId, userId]);

    if (workflowResult.rows.length === 0) {
      throw new Error('Workflow not found');
    }

    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100);
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE workflow_id = $1';
    const params: any[] = [workflowId];
    let paramIndex = 2;

    if (options?.status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    // 获取总数
    const countResult = await this.pool.query(`
      SELECT COUNT(*) as total FROM workflow_executions ${whereClause}
    `, params);

    // 获取数据
    const result = await this.pool.query(`
      SELECT * FROM workflow_executions ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    return {
      executions: result.rows.map(row => this.mapRowToWorkflowExecution(row)),
      total: parseInt(countResult.rows[0].total)
    };
  }

  /**
   * 设置队列处理器
   */
  private setupQueueProcessors(): void {
    // 工作流执行处理器
    this.workflowQueue.process('execute-workflow', 10, async (job: Job) => {
      const { executionId, workflowId, triggerData } = job.data;
      await this.processWorkflowExecution(executionId, workflowId, triggerData);
    });

    // 队列事件监听
    this.workflowQueue.on('completed', (job: Job) => {
      logger.info('Workflow execution job completed', { 
        jobId: job.id, 
        executionId: job.data.executionId 
      });
    });

    this.workflowQueue.on('failed', (job: Job, err: Error) => {
      logger.error('Workflow execution job failed', { 
        jobId: job.id, 
        executionId: job.data.executionId, 
        error: err.message 
      });
    });
  }

  /**
   * 处理工作流执行
   */
  private async processWorkflowExecution(
    executionId: string,
    workflowId: string,
    triggerData: Record<string, any>
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // 获取执行和工作流信息
      const executionResult = await client.query(`
        SELECT * FROM workflow_executions WHERE id = $1
      `, [executionId]);

      if (executionResult.rows.length === 0) {
        throw new Error('Workflow execution not found');
      }

      const execution = this.mapRowToWorkflowExecution(executionResult.rows[0]);
      
      if (execution.status === 'cancelled') {
        logger.info('Workflow execution was cancelled', { executionId });
        return;
      }

      const workflow = await this.getWorkflow(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      // 更新执行状态为运行中
      await client.query(`
        UPDATE workflow_executions 
        SET status = 'running', started_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [executionId]);

      logger.info('Starting workflow execution', {
        executionId,
        workflowId,
        workflowName: workflow.name
      });

      // 执行工作流
      await this.executeWorkflowNodes(execution, workflow, triggerData);

      // 更新成功统计
      await client.query(`
        UPDATE workflows 
        SET 
          total_executions = total_executions + 1,
          successful_executions = successful_executions + 1,
          last_execution_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `, [workflowId]);

    } catch (error) {
      logger.error('Workflow execution failed', { error, executionId, workflowId });
      
      // 标记执行失败
      await this.failWorkflowExecution(executionId, error.message);
      
      // 更新失败统计
      await client.query(`
        UPDATE workflows 
        SET 
          total_executions = total_executions + 1,
          failed_executions = failed_executions + 1,
          last_execution_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `, [workflowId]);

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 执行工作流节点
   */
  private async executeWorkflowNodes(
    execution: WorkflowExecution,
    workflow: Workflow,
    triggerData: Record<string, any>
  ): Promise<void> {
    const { nodes, connections } = workflow.workflowDefinition;
    
    // 查找开始节点
    const startNode = nodes.find(node => node.type === 'start');
    if (!startNode) {
      throw new Error('Workflow must have a start node');
    }

    // 执行上下文
    const context = {
      workflowId: workflow.id,
      executionId: execution.id,
      variables: { ...workflow.workflowDefinition.variables, ...triggerData },
      nodeResults: new Map<string, any>()
    };

    // 从开始节点开始执行
    await this.executeNodeChain(startNode.id, nodes, connections, context);

    // 标记执行完成
    await this.completeWorkflowExecution(execution.id, context);
  }

  /**
   * 递归执行节点链
   */
  private async executeNodeChain(
    nodeId: string,
    nodes: WorkflowNode[],
    connections: WorkflowConnection[],
    context: any
  ): Promise<void> {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // 执行当前节点
    const result = await this.executeNode(node, context);
    context.nodeResults.set(nodeId, result);

    // 如果是结束节点，停止执行
    if (node.type === 'end') {
      return;
    }

    // 查找下一个要执行的节点
    const nextConnections = connections.filter(conn => conn.from === nodeId);
    
    for (const connection of nextConnections) {
      // 检查连接条件
      if (await this.evaluateConnectionCondition(connection, result, context)) {
        await this.executeNodeChain(connection.to, nodes, connections, context);
      }
    }
  }

  /**
   * 执行单个节点
   */
  private async executeNode(
    node: WorkflowNode,
    context: any
  ): Promise<NodeExecutionResult> {
    const client = await this.pool.connect();
    
    try {
      // 记录节点开始执行
      await client.query(`
        INSERT INTO workflow_node_executions (
          id, execution_id, node_id, node_type, status, input_data, started_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW())
      `, [
        uuidv4(),
        context.executionId,
        node.id,
        node.type,
        'running',
        JSON.stringify(context.variables)
      ]);

      const startTime = Date.now();
      let result: NodeExecutionResult;

      // 根据节点类型执行相应逻辑
      switch (node.type) {
        case 'start':
          result = await this.executeStartNode(node, context);
          break;
        case 'end':
          result = await this.executeEndNode(node, context);
          break;
        case 'email_filter':
          result = await this.executeEmailFilterNode(node, context);
          break;
        case 'batch_operation':
          result = await this.executeBatchOperationNode(node, context);
          break;
        case 'condition':
          result = await this.executeConditionNode(node, context);
          break;
        case 'action':
          result = await this.executeActionNode(node, context);
          break;
        case 'delay':
          result = await this.executeDelayNode(node, context);
          break;
        case 'notification':
          result = await this.executeNotificationNode(node, context);
          break;
        case 'rule_apply':
          result = await this.executeRuleApplyNode(node, context);
          break;
        case 'custom_script':
          result = await this.executeCustomScriptNode(node, context);
          break;
        default:
          throw new Error(`Unsupported node type: ${node.type}`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 更新节点执行结果
      await client.query(`
        UPDATE workflow_node_executions 
        SET 
          status = $1,
          completed_at = NOW(),
          execution_duration_ms = $2,
          output_data = $3,
          result_status = $4,
          error_message = $5,
          updated_at = NOW()
        WHERE execution_id = $6 AND node_id = $7
      `, [
        result.success ? 'completed' : 'failed',
        duration,
        JSON.stringify(result.outputData),
        result.success ? 'success' : 'error',
        result.error || null,
        context.executionId,
        node.id
      ]);

      logger.debug('Node execution completed', {
        nodeId: node.id,
        nodeType: node.type,
        success: result.success,
        duration
      });

      return result;

    } catch (error) {
      // 标记节点执行失败
      await client.query(`
        UPDATE workflow_node_executions 
        SET 
          status = 'failed',
          completed_at = NOW(),
          result_status = 'error',
          error_message = $1,
          updated_at = NOW()
        WHERE execution_id = $2 AND node_id = $3
      `, [error.message, context.executionId, node.id]);

      logger.error('Node execution failed', {
        nodeId: node.id,
        nodeType: node.type,
        error: error.message
      });

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 执行开始节点
   */
  private async executeStartNode(node: WorkflowNode, context: any): Promise<NodeExecutionResult> {
    return {
      success: true,
      outputData: context.variables
    };
  }

  /**
   * 执行结束节点
   */
  private async executeEndNode(node: WorkflowNode, context: any): Promise<NodeExecutionResult> {
    return {
      success: true,
      outputData: { completed: true }
    };
  }

  /**
   * 执行邮件过滤节点
   */
  private async executeEmailFilterNode(node: WorkflowNode, context: any): Promise<NodeExecutionResult> {
    const { config } = node;
    
    // 这里应该实现邮件过滤逻辑
    // 暂时返回模拟结果
    const filteredEmails = []; // 过滤后的邮件列表
    
    return {
      success: true,
      outputData: {
        filteredEmails,
        matchedCount: filteredEmails.length
      }
    };
  }

  /**
   * 执行批量操作节点
   */
  private async executeBatchOperationNode(node: WorkflowNode, context: any): Promise<NodeExecutionResult> {
    const { config } = node;
    
    try {
      // 调用批量操作服务
      const batchOperation = await this.batchOperationService.createBatchOperation(
        context.workflowId, // 使用 workflowId 作为 userId，实际应该从上下文获取
        `Workflow Batch Operation - ${node.name}`,
        config.operationType,
        config.targetItems || [],
        config
      );

      return {
        success: true,
        outputData: {
          batchOperationId: batchOperation.id,
          status: batchOperation.status
        }
      };
    } catch (error) {
      return {
        success: false,
        outputData: {},
        error: error.message
      };
    }
  }

  /**
   * 执行条件节点
   */
  private async executeConditionNode(node: WorkflowNode, context: any): Promise<NodeExecutionResult> {
    const { config } = node;
    
    // 评估条件表达式
    const conditionResult = await this.evaluateCondition(config.condition, context);
    
    return {
      success: true,
      outputData: {
        conditionResult,
        path: conditionResult ? 'true' : 'false'
      }
    };
  }

  /**
   * 执行动作节点
   */
  private async executeActionNode(node: WorkflowNode, context: any): Promise<NodeExecutionResult> {
    const { config } = node;
    
    // 这里实现各种动作逻辑
    return {
      success: true,
      outputData: {
        actionType: config.actionType,
        result: 'Action executed successfully'
      }
    };
  }

  /**
   * 执行延迟节点
   */
  private async executeDelayNode(node: WorkflowNode, context: any): Promise<NodeExecutionResult> {
    const { config } = node;
    const delayMs = config.delayMs || 1000;
    
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    return {
      success: true,
      outputData: {
        delayMs,
        resumedAt: new Date().toISOString()
      }
    };
  }

  /**
   * 执行通知节点
   */
  private async executeNotificationNode(node: WorkflowNode, context: any): Promise<NodeExecutionResult> {
    const { config } = node;
    
    // 这里应该调用通知服务
    return {
      success: true,
      outputData: {
        notificationType: config.notificationType,
        sent: true
      }
    };
  }

  /**
   * 执行规则应用节点
   */
  private async executeRuleApplyNode(node: WorkflowNode, context: any): Promise<NodeExecutionResult> {
    const { config } = node;
    
    // 这里应该调用规则引擎服务
    return {
      success: true,
      outputData: {
        appliedRules: config.ruleIds || [],
        processedEmails: 0
      }
    };
  }

  /**
   * 执行自定义脚本节点
   */
  private async executeCustomScriptNode(node: WorkflowNode, context: any): Promise<NodeExecutionResult> {
    const { config } = node;
    
    try {
      // 这里可以执行用户自定义的JavaScript代码
      // 注意安全性，实际应用中需要沙箱环境
      const script = config.script || 'return { success: true };';
      
      // 简单的函数执行，实际应该使用vm模块或其他安全执行环境
      const func = new Function('context', `return (${script})(context);`);
      const result = func(context);
      
      return {
        success: true,
        outputData: result || {}
      };
    } catch (error) {
      return {
        success: false,
        outputData: {},
        error: error.message
      };
    }
  }

  /**
   * 评估连接条件
   */
  private async evaluateConnectionCondition(
    connection: WorkflowConnection,
    nodeResult: NodeExecutionResult,
    context: any
  ): Promise<boolean> {
    if (!connection.condition) {
      return true; // 无条件，总是执行
    }

    // 简单的条件评估
    if (connection.condition === 'success') {
      return nodeResult.success;
    }

    if (connection.condition === 'failure') {
      return !nodeResult.success;
    }

    // 可以扩展更复杂的条件评估逻辑
    return true;
  }

  /**
   * 评估条件表达式
   */
  private async evaluateCondition(condition: string, context: any): Promise<boolean> {
    // 这里应该实现条件表达式的安全评估
    // 暂时返回随机结果
    return Math.random() > 0.5;
  }

  /**
   * 完成工作流执行
   */
  private async completeWorkflowExecution(executionId: string, context: any): Promise<void> {
    await this.pool.query(`
      UPDATE workflow_executions 
      SET 
        status = 'completed',
        completed_at = NOW(),
        execution_results = $1,
        output_data = $2,
        execution_duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
        updated_at = NOW()
      WHERE id = $3
    `, [
      JSON.stringify({ success: true, completedAt: new Date() }),
      JSON.stringify(context.variables),
      executionId
    ]);

    logger.info('Workflow execution completed', { executionId });
  }

  /**
   * 标记工作流执行失败
   */
  private async failWorkflowExecution(executionId: string, errorMessage: string): Promise<void> {
    await this.pool.query(`
      UPDATE workflow_executions 
      SET 
        status = 'failed',
        completed_at = NOW(),
        error_details = jsonb_set(
          COALESCE(error_details, '[]'::jsonb),
          '{-1}',
          jsonb_build_object(
            'error', $2,
            'timestamp', to_jsonb(NOW())
          )
        ),
        execution_duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
        updated_at = NOW()
      WHERE id = $1
    `, [executionId, errorMessage]);
  }

  /**
   * 获取正在运行的执行数量
   */
  private async getRunningExecutionCount(workflowId: string): Promise<number> {
    const result = await this.pool.query(`
      SELECT COUNT(*) as count 
      FROM workflow_executions 
      WHERE workflow_id = $1 AND status IN ('pending', 'running')
    `, [workflowId]);

    return parseInt(result.rows[0].count);
  }

  /**
   * 验证工作流定义
   */
  private validateWorkflowDefinition(definition: WorkflowDefinition): void {
    const { nodes, connections } = definition;

    if (!nodes || nodes.length === 0) {
      throw new Error('Workflow must have at least one node');
    }

    const hasStart = nodes.some(node => node.type === 'start');
    if (!hasStart) {
      throw new Error('Workflow must have a start node');
    }

    const hasEnd = nodes.some(node => node.type === 'end');
    if (!hasEnd) {
      throw new Error('Workflow must have an end node');
    }

    // 验证连接的有效性
    for (const connection of connections) {
      const fromNode = nodes.find(n => n.id === connection.from);
      const toNode = nodes.find(n => n.id === connection.to);
      
      if (!fromNode) {
        throw new Error(`Connection references unknown from node: ${connection.from}`);
      }
      
      if (!toNode) {
        throw new Error(`Connection references unknown to node: ${connection.to}`);
      }
    }
  }

  /**
   * 初始化定时工作流
   */
  private async initializeScheduledWorkflows(): Promise<void> {
    try {
      const result = await this.pool.query(`
        SELECT * FROM workflows 
        WHERE is_active = true 
        AND trigger_config->>'type' = 'scheduled'
      `);

      for (const row of result.rows) {
        const workflow = this.mapRowToWorkflow(row);
        await this.setupScheduledWorkflow(workflow);
      }

      logger.info('Initialized scheduled workflows', { count: result.rows.length });
    } catch (error) {
      logger.error('Failed to initialize scheduled workflows', { error });
    }
  }

  /**
   * 设置定时工作流
   */
  private async setupScheduledWorkflow(workflow: Workflow): Promise<void> {
    if (workflow.triggerConfig.type !== 'scheduled') {
      return;
    }

    const { schedule } = workflow.triggerConfig.config;
    if (!schedule) {
      logger.warn('Scheduled workflow missing schedule config', { workflowId: workflow.id });
      return;
    }

    try {
      // 移除旧的定时任务
      const existingJob = this.cronJobs.get(workflow.id);
      if (existingJob) {
        existingJob.destroy();
      }

      // 创建新的定时任务
      const task = cron.schedule(schedule, async () => {
        try {
          await this.executeWorkflow(workflow.id, {}, {
            triggerType: 'scheduled'
          });
        } catch (error) {
          logger.error('Scheduled workflow execution failed', {
            workflowId: workflow.id,
            error: error.message
          });
        }
      }, {
        scheduled: workflow.isActive,
        timezone: workflow.triggerConfig.config.timezone || 'UTC'
      });

      this.cronJobs.set(workflow.id, task);

      logger.info('Scheduled workflow setup', {
        workflowId: workflow.id,
        schedule,
        isActive: workflow.isActive
      });

    } catch (error) {
      logger.error('Failed to setup scheduled workflow', {
        workflowId: workflow.id,
        error: error.message
      });
    }
  }

  /**
   * 更新定时工作流
   */
  private async updateScheduledWorkflow(workflow: Workflow): Promise<void> {
    if (workflow.triggerConfig.type === 'scheduled') {
      await this.setupScheduledWorkflow(workflow);
    } else {
      // 如果不再是定时触发，移除定时任务
      await this.removeScheduledWorkflow(workflow.id);
    }
  }

  /**
   * 移除定时工作流
   */
  private async removeScheduledWorkflow(workflowId: string): Promise<void> {
    const existingJob = this.cronJobs.get(workflowId);
    if (existingJob) {
      existingJob.destroy();
      this.cronJobs.delete(workflowId);
      logger.info('Scheduled workflow removed', { workflowId });
    }
  }

  /**
   * 将数据库行映射为Workflow对象
   */
  private mapRowToWorkflow(row: any): Workflow {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      category: row.category,
      version: row.version,
      isActive: row.is_active,
      isTemplate: row.is_template,
      priority: row.priority,
      triggerConfig: row.trigger_config,
      workflowDefinition: row.workflow_definition,
      executionConfig: row.execution_config,
      totalExecutions: row.total_executions,
      successfulExecutions: row.successful_executions,
      failedExecutions: row.failed_executions,
      lastExecutionAt: row.last_execution_at,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * 将数据库行映射为WorkflowExecution对象
   */
  private mapRowToWorkflowExecution(row: any): WorkflowExecution {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      userId: row.user_id,
      executionId: row.execution_id,
      status: row.status,
      priority: row.priority,
      triggerType: row.trigger_type,
      triggerData: row.trigger_data,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      timeoutAt: row.timeout_at,
      executionResults: row.execution_results,
      errorDetails: row.error_details,
      outputData: row.output_data,
      totalNodes: row.total_nodes,
      completedNodes: row.completed_nodes,
      failedNodes: row.failed_nodes,
      executionDurationMs: row.execution_duration_ms,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * 获取工作流统计信息
   */
  async getWorkflowStats(userId: string): Promise<{
    totalWorkflows: number;
    activeWorkflows: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageSuccessRate: number;
    workflowsByCategory: Record<string, number>;
  }> {
    const result = await this.pool.query(`
      SELECT 
        COUNT(*) as total_workflows,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_workflows,
        SUM(total_executions) as total_executions,
        SUM(successful_executions) as successful_executions,
        SUM(failed_executions) as failed_executions,
        category
      FROM workflows 
      WHERE user_id = $1 
      GROUP BY ROLLUP(category)
    `, [userId]);

    const stats = result.rows[result.rows.length - 1]; // 汇总行
    const categoryStats: Record<string, number> = {};
    
    result.rows.slice(0, -1).forEach(row => {
      if (row.category) {
        categoryStats[row.category] = parseInt(row.total_workflows);
      }
    });

    const totalExecs = parseInt(stats.total_executions || '0');
    const successfulExecs = parseInt(stats.successful_executions || '0');

    return {
      totalWorkflows: parseInt(stats.total_workflows),
      activeWorkflows: parseInt(stats.active_workflows),
      totalExecutions: totalExecs,
      successfulExecutions: successfulExecs,
      failedExecutions: parseInt(stats.failed_executions || '0'),
      averageSuccessRate: totalExecs > 0 ? (successfulExecs / totalExecs) * 100 : 0,
      workflowsByCategory: categoryStats
    };
  }
}