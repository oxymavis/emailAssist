import { Request, Response } from 'express';
import { 
  ApiResponse,
  CreateNotificationTemplateRequest,
  UpdateNotificationTemplateRequest,
  CreateNotificationRuleRequest,
  UpdateNotificationRuleRequest,
  CreateNotificationChannelRequest,
  UpdateNotificationChannelRequest,
  TriggerNotificationRequest,
  UpdateNotificationPreferencesRequest,
  AuthRequest
} from '../types';
import { NotificationService } from '../services/NotificationService';
import { body, query, param, validationResult } from 'express-validator';

export class NotificationController {
  private notificationService: NotificationService;

  constructor(notificationService: NotificationService) {
    this.notificationService = notificationService;
  }

  // =============================================
  // Template Management Endpoints
  // =============================================

  /**
   * Create notification template
   * POST /api/notifications/templates
   */
  async createTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: errors.array()
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0',
            requestId: req.requestId || ''
          }
        } as ApiResponse);
        return;
      }

      const templateData = req.body as CreateNotificationTemplateRequest;
      const template = await this.notificationService.createTemplate({
        ...templateData,
        createdBy: req.user!.id,
        isSystem: false
      });

      const response: ApiResponse = {
        success: true,
        data: template,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating notification template:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create notification template'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      } as ApiResponse);
    }
  }

  /**
   * Get notification templates
   * GET /api/notifications/templates
   */
  async getTemplates(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { category } = req.query;
      
      const templates = await this.notificationService.getTemplates(
        category as any
      );

      const response: ApiResponse = {
        success: true,
        data: templates,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting notification templates:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get notification templates'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      } as ApiResponse);
    }
  }

  /**
   * Get notification template by ID
   * GET /api/notifications/templates/:id
   */
  async getTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const template = await this.notificationService.getTemplate(id);

      if (!template) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Notification template not found'
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0',
            requestId: req.requestId || ''
          }
        } as ApiResponse);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: template,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting notification template:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get notification template'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      } as ApiResponse);
    }
  }

  /**
   * Update notification template
   * PUT /api/notifications/templates/:id
   */
  async updateTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: errors.array()
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0',
            requestId: req.requestId || ''
          }
        } as ApiResponse);
        return;
      }

      const { id } = req.params;
      const updates = req.body as UpdateNotificationTemplateRequest;
      
      const template = await this.notificationService.updateTemplate(id, updates);

      const response: ApiResponse = {
        success: true,
        data: template,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error updating notification template:', error);
      const statusCode = error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          message: error.message
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      } as ApiResponse);
    }
  }

  /**
   * Delete notification template
   * DELETE /api/notifications/templates/:id
   */
  async deleteTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.notificationService.deleteTemplate(id);

      const response: ApiResponse = {
        success: true,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error deleting notification template:', error);
      const statusCode = error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          message: error.message
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      } as ApiResponse);
    }
  }

  // =============================================
  // Rule Management Endpoints
  // =============================================

  /**
   * Create notification rule
   * POST /api/notifications/rules
   */
  async createRule(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: errors.array()
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0',
            requestId: req.requestId || ''
          }
        } as ApiResponse);
        return;
      }

      const ruleData = req.body as CreateNotificationRuleRequest;
      const rule = await this.notificationService.createRule({
        ...ruleData,
        userId: req.user!.id,
        isEnabled: ruleData.isEnabled !== undefined ? ruleData.isEnabled : true
      });

      const response: ApiResponse = {
        success: true,
        data: rule,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating notification rule:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create notification rule'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      } as ApiResponse);
    }
  }

  /**
   * Get user notification rules
   * GET /api/notifications/rules
   */
  async getRules(req: AuthRequest, res: Response): Promise<void> {
    try {
      const rules = await this.notificationService.getUserRules(req.user!.id);

      const response: ApiResponse = {
        success: true,
        data: rules,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting notification rules:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get notification rules'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      } as ApiResponse);
    }
  }

  /**
   * Update notification rule
   * PUT /api/notifications/rules/:id
   */
  async updateRule(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body as UpdateNotificationRuleRequest;
      
      const rule = await this.notificationService.updateRule(id, updates);

      const response: ApiResponse = {
        success: true,
        data: rule,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error updating notification rule:', error);
      const statusCode = error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          message: error.message
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      } as ApiResponse);
    }
  }

  /**
   * Delete notification rule
   * DELETE /api/notifications/rules/:id
   */
  async deleteRule(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.notificationService.deleteRule(id);

      const response: ApiResponse = {
        success: true,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error deleting notification rule:', error);
      const statusCode = error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          message: error.message
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      } as ApiResponse);
    }
  }

  // =============================================
  // Channel Management Endpoints
  // =============================================

  /**
   * Create notification channel
   * POST /api/notifications/channels
   */
  async createChannel(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Only admin users can create channels
      if (req.user!.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only administrators can create notification channels'
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0',
            requestId: req.requestId || ''
          }
        } as ApiResponse);
        return;
      }

      const channelData = req.body as CreateNotificationChannelRequest;
      const channel = await this.notificationService.createChannel({
        ...channelData,
        isEnabled: channelData.isEnabled !== undefined ? channelData.isEnabled : true,
        retryConfig: channelData.retryConfig || {
          maxAttempts: 3,
          retryDelay: 60,
          backoffMultiplier: 2
        }
      });

      const response: ApiResponse = {
        success: true,
        data: channel,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating notification channel:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create notification channel'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      } as ApiResponse);
    }
  }

  /**
   * Get notification channels
   * GET /api/notifications/channels
   */
  async getChannels(req: AuthRequest, res: Response): Promise<void> {
    try {
      const channels = await this.notificationService.getChannels();

      const response: ApiResponse = {
        success: true,
        data: channels,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting notification channels:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get notification channels'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      } as ApiResponse);
    }
  }

  // =============================================
  // Notification Operations
  // =============================================

  /**
   * Trigger notification
   * POST /api/notifications/trigger
   */
  async triggerNotification(req: AuthRequest, res: Response): Promise<void> {
    try {
      const triggerData = req.body as TriggerNotificationRequest;
      const notifications = await this.notificationService.triggerNotification({
        ...triggerData,
        userId: req.user!.id
      });

      const response: ApiResponse = {
        success: true,
        data: {
          triggeredNotifications: notifications.length,
          notifications
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error triggering notification:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to trigger notification'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      } as ApiResponse);
    }
  }

  /**
   * Get user notifications
   * GET /api/notifications
   */
  async getUserNotifications(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { 
        limit = '50', 
        offset = '0', 
        status, 
        unreadOnly = 'false' 
      } = req.query;

      const result = await this.notificationService.getUserNotifications(
        req.user!.id,
        {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          status: status as any,
          unreadOnly: unreadOnly === 'true'
        }
      );

      const response: ApiResponse = {
        success: true,
        data: result.notifications,
        pagination: {
          page: Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1,
          limit: parseInt(limit as string),
          total: result.total,
          hasNext: parseInt(offset as string) + parseInt(limit as string) < result.total
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting user notifications:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get user notifications'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      } as ApiResponse);
    }
  }

  /**
   * Mark notification as read
   * POST /api/notifications/:id/read
   */
  async markAsRead(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.notificationService.markAsRead(id, req.user!.id);

      const response: ApiResponse = {
        success: true,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to mark notification as read'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      } as ApiResponse);
    }
  }

  /**
   * Archive notification
   * POST /api/notifications/:id/archive
   */
  async archiveNotification(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.notificationService.archiveNotification(id, req.user!.id);

      const response: ApiResponse = {
        success: true,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error archiving notification:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to archive notification'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      } as ApiResponse);
    }
  }

  // =============================================
  // User Preferences
  // =============================================

  /**
   * Get user notification preferences
   * GET /api/notifications/preferences
   */
  async getUserPreferences(req: AuthRequest, res: Response): Promise<void> {
    try {
      const preferences = await this.notificationService.getUserPreferences(req.user!.id);

      const response: ApiResponse = {
        success: true,
        data: preferences,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting user preferences:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get user preferences'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      } as ApiResponse);
    }
  }

  /**
   * Update user notification preferences
   * PUT /api/notifications/preferences
   */
  async updateUserPreferences(req: AuthRequest, res: Response): Promise<void> {
    try {
      const preferencesData = req.body as UpdateNotificationPreferencesRequest;
      const preferences = await this.notificationService.updateUserPreferences(
        req.user!.id,
        preferencesData
      );

      const response: ApiResponse = {
        success: true,
        data: preferences,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error updating user preferences:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update user preferences'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      } as ApiResponse);
    }
  }

  // =============================================
  // Analytics and Statistics
  // =============================================

  /**
   * Get notification statistics
   * GET /api/notifications/stats
   */
  async getNotificationStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      
      let timeRange: { start: Date; end: Date } | undefined;
      if (startDate && endDate) {
        timeRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
      }

      const stats = await this.notificationService.getNotificationStats(
        req.user!.id,
        timeRange
      );

      const response: ApiResponse = {
        success: true,
        data: stats,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting notification stats:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get notification stats'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      } as ApiResponse);
    }
  }

  /**
   * Get queue status
   * GET /api/notifications/queue/status
   */
  async getQueueStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Only admin users can view queue status
      if (req.user!.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only administrators can view queue status'
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0',
            requestId: req.requestId || ''
          }
        } as ApiResponse);
        return;
      }

      const queueStatus = await this.notificationService.getQueueStatus();

      const response: ApiResponse = {
        success: true,
        data: queueStatus,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting queue status:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get queue status'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: req.requestId || ''
        }
      } as ApiResponse);
    }
  }

  // =============================================
  // Validation Middleware
  // =============================================

  static getValidationRules() {
    return {
      createTemplate: [
        body('name').isString().isLength({ min: 1, max: 255 }).withMessage('Name is required and must be 1-255 characters'),
        body('category').isIn(['email_alert', 'priority_email', 'ai_analysis', 'system_alert', 'custom']).withMessage('Invalid category'),
        body('channels').isArray({ min: 1 }).withMessage('At least one channel is required'),
        body('channels.*.channelId').isUUID().withMessage('Invalid channel ID'),
        body('channels.*.isEnabled').isBoolean().optional(),
        body('description').isString().optional(),
        body('variables').isArray().optional()
      ],
      
      updateTemplate: [
        body('name').isString().isLength({ min: 1, max: 255 }).optional(),
        body('description').isString().optional(),
        body('channels').isArray().optional(),
        body('variables').isArray().optional()
      ],

      createRule: [
        body('name').isString().isLength({ min: 1, max: 255 }).withMessage('Name is required and must be 1-255 characters'),
        body('triggers').isArray({ min: 1 }).withMessage('At least one trigger is required'),
        body('actions').isArray({ min: 1 }).withMessage('At least one action is required'),
        body('priority').isInt({ min: 1, max: 10 }).optional(),
        body('description').isString().optional(),
        body('isEnabled').isBoolean().optional()
      ],

      createChannel: [
        body('name').isString().isLength({ min: 1, max: 255 }).withMessage('Name is required'),
        body('type').isIn(['websocket', 'email', 'webhook', 'sms']).withMessage('Invalid channel type'),
        body('config').isObject().withMessage('Config is required'),
        body('isEnabled').isBoolean().optional(),
        body('retryConfig').isObject().optional()
      ],

      triggerNotification: [
        body('type').isString().isLength({ min: 1 }).withMessage('Type is required'),
        body('data').isObject().withMessage('Data is required'),
        body('sourceId').isString().optional(),
        body('priority').isInt({ min: 1, max: 10 }).optional()
      ],

      updatePreferences: [
        body('globalSettings').isObject().optional(),
        body('channelPreferences').isArray().optional(),
        body('categoryPreferences').isArray().optional()
      ]
    };
  }
}