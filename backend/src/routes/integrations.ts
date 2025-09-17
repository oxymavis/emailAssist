import { Router } from 'express';
import { IntegrationsController } from '../controllers/IntegrationsController';
import { authenticateToken } from '../middleware/auth';
// import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

/**
 * Integrations routes
 * 第三方工具集成路由
 *
 * 所有路由都需要认证
 * 支持 Trello、Jira、Asana 集成管理
 */

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/integrations
 * Get all integrations for current user
 */
router.get('/',
  [
    query('status').optional().isIn(['active', 'error', 'disabled'])
  ],
  // validateRequest,
  IntegrationsController.getIntegrations
);

/**
 * GET /api/integrations/schema/:type
 * Get configuration schema for integration type
 */
router.get('/schema/:type',
  [
    param('type').isIn(['trello', 'jira', 'asana']).withMessage('Invalid integration type')
  ],
  // validateRequest,
  IntegrationsController.getConfigurationSchema
);

/**
 * GET /api/integrations/:id
 * Get single integration details
 */
router.get('/:id',
  [
    param('id').isUUID().withMessage('Invalid integration ID')
  ],
  // validateRequest,
  IntegrationsController.getIntegration
);

/**
 * POST /api/integrations/connect
 * Connect to third-party service
 */
router.post('/connect',
  [
    body('type')
      .isIn(['trello', 'jira', 'asana'])
      .withMessage('Invalid integration type'),
    body('name')
      .isLength({ min: 1, max: 255 })
      .withMessage('Name must be between 1 and 255 characters'),
    body('credentials')
      .isObject()
      .withMessage('Credentials must be an object')
      .custom((value, { req }) => {
        const type = req.body.type;

        switch (type) {
          case 'trello':
            if (!value.apiKey || !value.accessToken) {
              throw new Error('Trello requires apiKey and accessToken');
            }
            break;
          case 'jira':
            if (!value.apiUrl || (!value.accessToken && !value.apiKey)) {
              throw new Error('Jira requires apiUrl and either accessToken or apiKey');
            }
            break;
          case 'asana':
            if (!value.accessToken) {
              throw new Error('Asana requires accessToken');
            }
            break;
        }
        return true;
      }),
    body('configuration')
      .optional()
      .isObject()
      .withMessage('Configuration must be an object')
  ],
  // validateRequest,
  IntegrationsController.connectIntegration
);

/**
 * PUT /api/integrations/:id
 * Update integration configuration
 */
router.put('/:id',
  [
    param('id').isUUID().withMessage('Invalid integration ID'),
    body('name')
      .optional()
      .isLength({ min: 1, max: 255 })
      .withMessage('Name must be between 1 and 255 characters'),
    body('credentials')
      .optional()
      .isObject()
      .withMessage('Credentials must be an object'),
    body('configuration')
      .optional()
      .isObject()
      .withMessage('Configuration must be an object')
  ],
  // validateRequest,
  IntegrationsController.updateIntegration
);

/**
 * DELETE /api/integrations/:id
 * Delete integration
 */
router.delete('/:id',
  [
    param('id').isUUID().withMessage('Invalid integration ID')
  ],
  // validateRequest,
  IntegrationsController.deleteIntegration
);

/**
 * POST /api/integrations/:id/test
 * Test integration connection
 */
router.post('/:id/test',
  [
    param('id').isUUID().withMessage('Invalid integration ID')
  ],
  // validateRequest,
  IntegrationsController.testConnection
);

/**
 * POST /api/integrations/:id/sync
 * Manual sync trigger for integration
 */
router.post('/:id/sync',
  [
    param('id').isUUID().withMessage('Invalid integration ID')
  ],
  // validateRequest,
  IntegrationsController.syncIntegration
);

export default router;