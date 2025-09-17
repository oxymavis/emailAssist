/**
 * P1 Features Controller
 * Unified API endpoints for all P1 level features
 * Handles workflow management, real-time notifications, and team collaboration
 */

import { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import logger from '@/utils/logger';
import { WorkflowManager } from '@/services/WorkflowManager';
import { RealtimeNotificationManager } from '@/services/RealtimeNotificationManager';
import { TeamCollaborationManager } from '@/services/TeamCollaborationManager';
import { NotificationService } from '@/services/NotificationService';
import { TrelloIntegration, TrelloConfig } from '@/services/integrations/TrelloIntegration';
import { JiraIntegration, JiraConfig } from '@/services/integrations/JiraIntegration';
import { successResponse, errorResponse } from '@/utils/response';

export class P1FeaturesController {
  private workflowManager: WorkflowManager;
  private notificationManager: RealtimeNotificationManager;
  private teamManager: TeamCollaborationManager;
  private notificationService: NotificationService;

  constructor(
    workflowManager: WorkflowManager,
    notificationManager: RealtimeNotificationManager,
    teamManager: TeamCollaborationManager,
    notificationService: NotificationService
  ) {
    this.workflowManager = workflowManager;
    this.notificationManager = notificationManager;
    this.teamManager = teamManager;
    this.notificationService = notificationService;
  }

  // ============================================================================
  // WORKFLOW MANAGEMENT ENDPOINTS
  // ============================================================================

  /**
   * Create workflow rule
   */
  createWorkflowRule = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(errorResponse('Validation failed', errors.array()));
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      const rule = await this.workflowManager.createWorkflowRule({
        ...req.body,
        userId
      });

      logger.info('Workflow rule created', { ruleId: rule.id, userId });
      res.status(201).json(successResponse(rule, 'Workflow rule created successfully'));
    } catch (error) {
      logger.error('Failed to create workflow rule', error);
      res.status(500).json(errorResponse('Failed to create workflow rule'));
    }
  };

  /**
   * Get user workflow rules
   */
  getWorkflowRules = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      const rules = await this.workflowManager.getUserWorkflowRules(userId);
      res.json(successResponse(rules));
    } catch (error) {
      logger.error('Failed to get workflow rules', error);
      res.status(500).json(errorResponse('Failed to get workflow rules'));
    }
  };

  /**
   * Update workflow rule
   */
  updateWorkflowRule = async (req: Request, res: Response): Promise<void> => {
    try {
      const { ruleId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      const rule = await this.workflowManager.updateWorkflowRule(ruleId, {
        ...req.body,
        userId
      });

      logger.info('Workflow rule updated', { ruleId, userId });
      res.json(successResponse(rule, 'Workflow rule updated successfully'));
    } catch (error) {
      logger.error('Failed to update workflow rule', { ruleId: req.params.ruleId, error });
      res.status(500).json(errorResponse('Failed to update workflow rule'));
    }
  };

  /**
   * Delete workflow rule
   */
  deleteWorkflowRule = async (req: Request, res: Response): Promise<void> => {
    try {
      const { ruleId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      const success = await this.workflowManager.deleteWorkflowRule(userId, ruleId);

      if (success) {
        logger.info('Workflow rule deleted', { ruleId, userId });
        res.json(successResponse(null, 'Workflow rule deleted successfully'));
      } else {
        res.status(404).json(errorResponse('Workflow rule not found'));
      }
    } catch (error) {
      logger.error('Failed to delete workflow rule', { ruleId: req.params.ruleId, error });
      res.status(500).json(errorResponse('Failed to delete workflow rule'));
    }
  };

  /**
   * Test workflow rule
   */
  testWorkflowRule = async (req: Request, res: Response): Promise<void> => {
    try {
      const { ruleId } = req.params;
      const { emailData } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      const rules = await this.workflowManager.getUserWorkflowRules(userId);
      const rule = rules.find(r => r.id === ruleId);

      if (!rule) {
        res.status(404).json(errorResponse('Workflow rule not found'));
        return;
      }

      const testResult = await this.workflowManager.testWorkflowRule(rule, emailData);

      res.json(successResponse(testResult));
    } catch (error) {
      logger.error('Failed to test workflow rule', { ruleId: req.params.ruleId, error });
      res.status(500).json(errorResponse('Failed to test workflow rule'));
    }
  };

  /**
   * Get workflow statistics
   */
  getWorkflowStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { days } = req.query;

      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      const stats = await this.workflowManager.getWorkflowStats(
        userId,
        days ? parseInt(days as string) : 30
      );

      res.json(successResponse(stats));
    } catch (error) {
      logger.error('Failed to get workflow stats', error);
      res.status(500).json(errorResponse('Failed to get workflow stats'));
    }
  };

  // ============================================================================
  // INTEGRATION MANAGEMENT ENDPOINTS
  // ============================================================================

  /**
   * Configure Trello integration
   */
  configureTrelloIntegration = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      const config: TrelloConfig = req.body;
      const success = await this.workflowManager.configureTrelloIntegration(userId, config);

      if (success) {
        logger.info('Trello integration configured', { userId });
        res.json(successResponse(null, 'Trello integration configured successfully'));
      } else {
        res.status(400).json(errorResponse('Failed to configure Trello integration'));
      }
    } catch (error) {
      logger.error('Failed to configure Trello integration', error);
      res.status(500).json(errorResponse('Failed to configure Trello integration'));
    }
  };

  /**
   * Configure Jira integration
   */
  configureJiraIntegration = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      const config: JiraConfig = req.body;
      const success = await this.workflowManager.configureJiraIntegration(userId, config);

      if (success) {
        logger.info('Jira integration configured', { userId });
        res.json(successResponse(null, 'Jira integration configured successfully'));
      } else {
        res.status(400).json(errorResponse('Failed to configure Jira integration'));
      }
    } catch (error) {
      logger.error('Failed to configure Jira integration', error);
      res.status(500).json(errorResponse('Failed to configure Jira integration'));
    }
  };

  // ============================================================================
  // TEAM COLLABORATION ENDPOINTS
  // ============================================================================

  /**
   * Create team
   */
  createTeam = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      const team = await this.teamManager.createTeam({
        ...req.body,
        createdBy: userId,
        status: 'active'
      });

      logger.info('Team created', { teamId: team.id, userId });
      res.status(201).json(successResponse(team, 'Team created successfully'));
    } catch (error) {
      logger.error('Failed to create team', error);
      res.status(500).json(errorResponse('Failed to create team'));
    }
  };

  /**
   * Get user teams
   */
  getUserTeams = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      const teams = await this.teamManager.getUserTeams(userId);
      res.json(successResponse(teams));
    } catch (error) {
      logger.error('Failed to get user teams', error);
      res.status(500).json(errorResponse('Failed to get user teams'));
    }
  };

  /**
   * Get team details
   */
  getTeam = async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      // Check if user is team member
      const member = await this.teamManager.getTeamMember(teamId, userId);
      if (!member) {
        res.status(403).json(errorResponse('Access denied'));
        return;
      }

      const team = await this.teamManager.getTeam(teamId);
      if (!team) {
        res.status(404).json(errorResponse('Team not found'));
        return;
      }

      res.json(successResponse(team));
    } catch (error) {
      logger.error('Failed to get team', { teamId: req.params.teamId, error });
      res.status(500).json(errorResponse('Failed to get team'));
    }
  };

  /**
   * Add team member
   */
  addTeamMember = async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      // Check permissions
      const hasPermission = await this.teamManager.hasPermission(
        userId,
        teamId,
        'team',
        'inviteMembers'
      );

      if (!hasPermission) {
        res.status(403).json(errorResponse('Insufficient permissions'));
        return;
      }

      const member = await this.teamManager.addTeamMember(teamId, {
        ...req.body,
        invitedBy: userId
      });

      logger.info('Team member added', { teamId, memberId: member.id });
      res.status(201).json(successResponse(member, 'Team member added successfully'));
    } catch (error) {
      logger.error('Failed to add team member', { teamId: req.params.teamId, error });
      res.status(500).json(errorResponse('Failed to add team member'));
    }
  };

  /**
   * Get team members
   */
  getTeamMembers = async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      // Check permissions
      const hasPermission = await this.teamManager.hasPermission(
        userId,
        teamId,
        'team',
        'viewMembers'
      );

      if (!hasPermission) {
        res.status(403).json(errorResponse('Insufficient permissions'));
        return;
      }

      const members = await this.teamManager.getTeamMembers(teamId);
      res.json(successResponse(members));
    } catch (error) {
      logger.error('Failed to get team members', { teamId: req.params.teamId, error });
      res.status(500).json(errorResponse('Failed to get team members'));
    }
  };

  /**
   * Assign email to team member
   */
  assignEmail = async (req: Request, res: Response): Promise<void> => {
    try {
      const { emailId, teamId, assignedTo } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      const assignment = await this.teamManager.assignEmail(
        emailId,
        teamId,
        assignedTo,
        userId,
        req.body.options
      );

      logger.info('Email assigned', { emailId, teamId, assignedTo, assignedBy: userId });
      res.status(201).json(successResponse(assignment, 'Email assigned successfully'));
    } catch (error) {
      logger.error('Failed to assign email', error);
      res.status(500).json(errorResponse('Failed to assign email'));
    }
  };

  /**
   * Add collaboration comment
   */
  addComment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { emailId, teamId, content } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      const comment = await this.teamManager.addComment(
        emailId,
        teamId,
        userId,
        content,
        req.body.options
      );

      logger.info('Comment added', { emailId, teamId, authorId: userId });
      res.status(201).json(successResponse(comment, 'Comment added successfully'));
    } catch (error) {
      logger.error('Failed to add comment', error);
      res.status(500).json(errorResponse('Failed to add comment'));
    }
  };

  /**
   * Get email comments
   */
  getEmailComments = async (req: Request, res: Response): Promise<void> => {
    try {
      const { emailId, teamId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      const comments = await this.teamManager.getEmailComments(emailId, teamId, userId);
      res.json(successResponse(comments));
    } catch (error) {
      logger.error('Failed to get email comments', error);
      res.status(500).json(errorResponse('Failed to get email comments'));
    }
  };

  /**
   * Get team activity
   */
  getTeamActivity = async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId } = req.params;
      const userId = req.user?.id;
      const { limit, since, type } = req.query;

      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      // Check permissions
      const hasPermission = await this.teamManager.hasPermission(
        userId,
        teamId,
        'team',
        'viewMembers'
      );

      if (!hasPermission) {
        res.status(403).json(errorResponse('Insufficient permissions'));
        return;
      }

      const options: any = {};
      if (limit) options.limit = parseInt(limit as string);
      if (since) options.since = new Date(since as string);
      if (type) options.type = type as string;

      const activity = await this.teamManager.getTeamActivity(teamId, options);
      res.json(successResponse(activity));
    } catch (error) {
      logger.error('Failed to get team activity', error);
      res.status(500).json(errorResponse('Failed to get team activity'));
    }
  };

  // ============================================================================
  // REAL-TIME NOTIFICATIONS ENDPOINTS
  // ============================================================================

  /**
   * Get notification connection status
   */
  getNotificationStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      const sessions = this.notificationManager.getUserSessions(userId);
      const status = {
        isConnected: sessions.length > 0,
        sessionCount: sessions.length,
        lastActivity: sessions.length > 0 ? sessions[0].lastActivity : null
      };

      res.json(successResponse(status));
    } catch (error) {
      logger.error('Failed to get notification status', error);
      res.status(500).json(errorResponse('Failed to get notification status'));
    }
  };

  /**
   * Send test notification
   */
  sendTestNotification = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      await this.notificationManager.notifyAnalysisCompleted(
        'test-email-id',
        { sentiment: 'positive', priority: 'medium' },
        userId
      );

      res.json(successResponse(null, 'Test notification sent successfully'));
    } catch (error) {
      logger.error('Failed to send test notification', error);
      res.status(500).json(errorResponse('Failed to send test notification'));
    }
  };

  /**
   * Get system statistics
   */
  getSystemStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = {
        activeUsers: this.notificationManager.getActiveUsersCount(),
        activeSessions: this.notificationManager.getActiveSessionsCount(),
        queueStatus: await this.notificationService.getQueueStatus()
      };

      res.json(successResponse(stats));
    } catch (error) {
      logger.error('Failed to get system stats', error);
      res.status(500).json(errorResponse('Failed to get system stats'));
    }
  };

  // ============================================================================
  // VALIDATION MIDDLEWARE
  // ============================================================================

  static getValidationRules() {
    return {
      createWorkflowRule: [
        body('name').notEmpty().withMessage('Rule name is required'),
        body('description').optional().isString(),
        body('actions.platform').isIn(['trello', 'jira', 'internal']).withMessage('Invalid platform'),
        body('conditions').isObject().withMessage('Conditions must be an object')
      ],

      updateWorkflowRule: [
        param('ruleId').notEmpty().withMessage('Rule ID is required'),
        body('name').optional().isString(),
        body('description').optional().isString(),
        body('enabled').optional().isBoolean()
      ],

      deleteWorkflowRule: [
        param('ruleId').notEmpty().withMessage('Rule ID is required')
      ],

      testWorkflowRule: [
        param('ruleId').notEmpty().withMessage('Rule ID is required'),
        body('emailData').isObject().withMessage('Email data is required')
      ],

      configureTrelloIntegration: [
        body('apiKey').notEmpty().withMessage('API key is required'),
        body('apiToken').notEmpty().withMessage('API token is required'),
        body('boardId').optional().isString(),
        body('defaultListId').optional().isString()
      ],

      configureJiraIntegration: [
        body('host').notEmpty().withMessage('Host is required'),
        body('email').isEmail().withMessage('Valid email is required'),
        body('apiToken').notEmpty().withMessage('API token is required'),
        body('projectKey').notEmpty().withMessage('Project key is required')
      ],

      createTeam: [
        body('name').notEmpty().withMessage('Team name is required'),
        body('description').optional().isString(),
        body('settings').isObject().withMessage('Settings must be an object')
      ],

      addTeamMember: [
        param('teamId').notEmpty().withMessage('Team ID is required'),
        body('userId').notEmpty().withMessage('User ID is required'),
        body('role').isIn(['owner', 'admin', 'member', 'viewer']).withMessage('Invalid role'),
        body('permissions').isObject().withMessage('Permissions must be an object')
      ],

      assignEmail: [
        body('emailId').notEmpty().withMessage('Email ID is required'),
        body('teamId').notEmpty().withMessage('Team ID is required'),
        body('assignedTo').notEmpty().withMessage('Assigned to user ID is required')
      ],

      addComment: [
        body('emailId').notEmpty().withMessage('Email ID is required'),
        body('teamId').notEmpty().withMessage('Team ID is required'),
        body('content').notEmpty().withMessage('Comment content is required')
      ]
    };
  }
}

export default P1FeaturesController;