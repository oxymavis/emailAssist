import { Router } from 'express';
import { NotificationController } from '../controllers/NotificationController';
import { authMiddleware } from '../middleware';

export function createNotificationRoutes(notificationController: NotificationController): Router {
  const router = Router();
  const validationRules = NotificationController.getValidationRules();

  // Apply authentication middleware to all notification routes
  router.use(authMiddleware);

  // =============================================
  // Template Management Routes
  // =============================================

  /**
   * @swagger
   * /api/notifications/templates:
   *   post:
   *     summary: Create a new notification template
   *     tags: [Notification Templates]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - category
   *               - channels
   *             properties:
   *               name:
   *                 type: string
   *                 example: "High Priority Email Alert"
   *               description:
   *                 type: string
   *                 example: "Template for high priority email notifications"
   *               category:
   *                 type: string
   *                 enum: [email_alert, priority_email, ai_analysis, system_alert, custom]
   *                 example: "email_alert"
   *               channels:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     channelId:
   *                       type: string
   *                       format: uuid
   *                     isEnabled:
   *                       type: boolean
   *                     templateContent:
   *                       type: object
   *               variables:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     name:
   *                       type: string
   *                     type:
   *                       type: string
   *                       enum: [string, number, boolean, date]
   *                     required:
   *                       type: boolean
   *                     defaultValue:
   *                       type: string
   *     responses:
   *       201:
   *         description: Template created successfully
   *       400:
   *         description: Invalid request data
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  router.post('/templates', validationRules.createTemplate, (req, res) => 
    notificationController.createTemplate(req as any, res)
  );

  /**
   * @swagger
   * /api/notifications/templates:
   *   get:
   *     summary: Get notification templates
   *     tags: [Notification Templates]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *           enum: [email_alert, priority_email, ai_analysis, system_alert, custom]
   *         description: Filter templates by category
   *     responses:
   *       200:
   *         description: Templates retrieved successfully
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  router.get('/templates', (req, res) => 
    notificationController.getTemplates(req as any, res)
  );

  /**
   * @swagger
   * /api/notifications/templates/{id}:
   *   get:
   *     summary: Get notification template by ID
   *     tags: [Notification Templates]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Template retrieved successfully
   *       404:
   *         description: Template not found
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  router.get('/templates/:id', (req, res) => 
    notificationController.getTemplate(req as any, res)
  );

  /**
   * @swagger
   * /api/notifications/templates/{id}:
   *   put:
   *     summary: Update notification template
   *     tags: [Notification Templates]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *               channels:
   *                 type: array
   *               variables:
   *                 type: array
   *     responses:
   *       200:
   *         description: Template updated successfully
   *       400:
   *         description: Invalid request data
   *       404:
   *         description: Template not found
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  router.put('/templates/:id', validationRules.updateTemplate, (req, res) => 
    notificationController.updateTemplate(req as any, res)
  );

  /**
   * @swagger
   * /api/notifications/templates/{id}:
   *   delete:
   *     summary: Delete notification template
   *     tags: [Notification Templates]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Template deleted successfully
   *       404:
   *         description: Template not found
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  router.delete('/templates/:id', (req, res) => 
    notificationController.deleteTemplate(req as any, res)
  );

  // =============================================
  // Rule Management Routes
  // =============================================

  /**
   * @swagger
   * /api/notifications/rules:
   *   post:
   *     summary: Create a new notification rule
   *     tags: [Notification Rules]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - triggers
   *               - actions
   *             properties:
   *               name:
   *                 type: string
   *                 example: "High Priority Email Rule"
   *               description:
   *                 type: string
   *               priority:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 10
   *               triggers:
   *                 type: array
   *                 items:
   *                   type: object
   *               actions:
   *                 type: array
   *                 items:
   *                   type: object
   *     responses:
   *       201:
   *         description: Rule created successfully
   *       400:
   *         description: Invalid request data
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  router.post('/rules', validationRules.createRule, (req, res) => 
    notificationController.createRule(req as any, res)
  );

  /**
   * @swagger
   * /api/notifications/rules:
   *   get:
   *     summary: Get user notification rules
   *     tags: [Notification Rules]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Rules retrieved successfully
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  router.get('/rules', (req, res) => 
    notificationController.getRules(req as any, res)
  );

  /**
   * @swagger
   * /api/notifications/rules/{id}:
   *   put:
   *     summary: Update notification rule
   *     tags: [Notification Rules]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Rule updated successfully
   *       404:
   *         description: Rule not found
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  router.put('/rules/:id', (req, res) => 
    notificationController.updateRule(req as any, res)
  );

  /**
   * @swagger
   * /api/notifications/rules/{id}:
   *   delete:
   *     summary: Delete notification rule
   *     tags: [Notification Rules]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Rule deleted successfully
   *       404:
   *         description: Rule not found
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  router.delete('/rules/:id', (req, res) => 
    notificationController.deleteRule(req as any, res)
  );

  // =============================================
  // Channel Management Routes
  // =============================================

  /**
   * @swagger
   * /api/notifications/channels:
   *   post:
   *     summary: Create notification channel (Admin only)
   *     tags: [Notification Channels]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - type
   *               - config
   *             properties:
   *               name:
   *                 type: string
   *               type:
   *                 type: string
   *                 enum: [websocket, email, webhook, sms]
   *               config:
   *                 type: object
   *     responses:
   *       201:
   *         description: Channel created successfully
   *       403:
   *         description: Forbidden - Admin access required
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  router.post('/channels', validationRules.createChannel, (req, res) => 
    notificationController.createChannel(req as any, res)
  );

  /**
   * @swagger
   * /api/notifications/channels:
   *   get:
   *     summary: Get notification channels
   *     tags: [Notification Channels]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Channels retrieved successfully
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  router.get('/channels', (req, res) => 
    notificationController.getChannels(req as any, res)
  );

  // =============================================
  // Notification Operations Routes
  // =============================================

  /**
   * @swagger
   * /api/notifications/trigger:
   *   post:
   *     summary: Trigger notification
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - type
   *               - data
   *             properties:
   *               type:
   *                 type: string
   *                 enum: [email_analysis, filter_rule, time_based, system_event, api_trigger]
   *               data:
   *                 type: object
   *               sourceId:
   *                 type: string
   *               priority:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 10
   *     responses:
   *       201:
   *         description: Notification triggered successfully
   *       400:
   *         description: Invalid request data
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  router.post('/trigger', validationRules.triggerNotification, (req, res) => 
    notificationController.triggerNotification(req as any, res)
  );

  /**
   * @swagger
   * /api/notifications:
   *   get:
   *     summary: Get user notifications
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 50
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [pending, processing, sent, failed, cancelled]
   *       - in: query
   *         name: unreadOnly
   *         schema:
   *           type: boolean
   *           default: false
   *     responses:
   *       200:
   *         description: Notifications retrieved successfully
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  router.get('/', (req, res) => 
    notificationController.getUserNotifications(req as any, res)
  );

  /**
   * @swagger
   * /api/notifications/{id}/read:
   *   post:
   *     summary: Mark notification as read
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Notification marked as read
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  router.post('/:id/read', (req, res) => 
    notificationController.markAsRead(req as any, res)
  );

  /**
   * @swagger
   * /api/notifications/{id}/archive:
   *   post:
   *     summary: Archive notification
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Notification archived
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  router.post('/:id/archive', (req, res) => 
    notificationController.archiveNotification(req as any, res)
  );

  // =============================================
  // User Preferences Routes
  // =============================================

  /**
   * @swagger
   * /api/notifications/preferences:
   *   get:
   *     summary: Get user notification preferences
   *     tags: [Notification Preferences]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Preferences retrieved successfully
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  router.get('/preferences', (req, res) => 
    notificationController.getUserPreferences(req as any, res)
  );

  /**
   * @swagger
   * /api/notifications/preferences:
   *   put:
   *     summary: Update user notification preferences
   *     tags: [Notification Preferences]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               globalSettings:
   *                 type: object
   *               channelPreferences:
   *                 type: array
   *               categoryPreferences:
   *                 type: array
   *     responses:
   *       200:
   *         description: Preferences updated successfully
   *       400:
   *         description: Invalid request data
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  router.put('/preferences', validationRules.updatePreferences, (req, res) => 
    notificationController.updateUserPreferences(req as any, res)
  );

  // =============================================
  // Analytics and Statistics Routes
  // =============================================

  /**
   * @swagger
   * /api/notifications/stats:
   *   get:
   *     summary: Get notification statistics
   *     tags: [Notification Analytics]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date-time
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date-time
   *     responses:
   *       200:
   *         description: Statistics retrieved successfully
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  router.get('/stats', (req, res) => 
    notificationController.getNotificationStats(req as any, res)
  );

  /**
   * @swagger
   * /api/notifications/queue/status:
   *   get:
   *     summary: Get notification queue status (Admin only)
   *     tags: [Notification Analytics]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Queue status retrieved successfully
   *       403:
   *         description: Forbidden - Admin access required
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  router.get('/queue/status', (req, res) => 
    notificationController.getQueueStatus(req as any, res)
  );

  return router;
}