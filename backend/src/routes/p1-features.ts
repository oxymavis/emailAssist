/**
 * P1 Features Routes
 * API routes for all P1 level features
 */

import express from 'express';
import { P1FeaturesController } from '@/controllers/P1FeaturesController';
import { WorkflowManager } from '@/services/WorkflowManager';
import { RealtimeNotificationManager } from '@/services/RealtimeNotificationManager';
import { TeamCollaborationManager } from '@/services/TeamCollaborationManager';
import { NotificationService } from '@/services/NotificationService';
import { authMiddleware } from '@/middleware/auth';
// import { validateRequest } from ../middleware/validation;
import { apiOptimization } from '@/middleware/apiOptimization';

const router = express.Router();

// Initialize services (in a real app, these would be injected via DI container)
const workflowManager = new WorkflowManager();
const teamManager = new TeamCollaborationManager();

// Note: These would be properly initialized in the main app
let notificationManager: RealtimeNotificationManager;
let notificationService: NotificationService;

// Initialize controller
const p1Controller = new P1FeaturesController(
  workflowManager,
  notificationManager,
  teamManager,
  notificationService
);

// Apply middleware to all routes
router.use(authMiddleware);
router.use(apiOptimization);

// ============================================================================
// WORKFLOW MANAGEMENT ROUTES
// ============================================================================

/**
 * @route   POST /api/v1/p1/workflows/rules
 * @desc    Create a new workflow rule
 * @access  Private
 */
router.post('/workflows/rules',
  P1FeaturesController.getValidationRules().createWorkflowRule,
  // validateRequest,
  p1Controller.createWorkflowRule
);

/**
 * @route   GET /api/v1/p1/workflows/rules
 * @desc    Get user's workflow rules
 * @access  Private
 */
router.get('/workflows/rules',
  p1Controller.getWorkflowRules
);

/**
 * @route   PUT /api/v1/p1/workflows/rules/:ruleId
 * @desc    Update a workflow rule
 * @access  Private
 */
router.put('/workflows/rules/:ruleId',
  P1FeaturesController.getValidationRules().updateWorkflowRule,
  // validateRequest,
  p1Controller.updateWorkflowRule
);

/**
 * @route   DELETE /api/v1/p1/workflows/rules/:ruleId
 * @desc    Delete a workflow rule
 * @access  Private
 */
router.delete('/workflows/rules/:ruleId',
  P1FeaturesController.getValidationRules().deleteWorkflowRule,
  // validateRequest,
  p1Controller.deleteWorkflowRule
);

/**
 * @route   POST /api/v1/p1/workflows/rules/:ruleId/test
 * @desc    Test a workflow rule
 * @access  Private
 */
router.post('/workflows/rules/:ruleId/test',
  P1FeaturesController.getValidationRules().testWorkflowRule,
  // validateRequest,
  p1Controller.testWorkflowRule
);

/**
 * @route   GET /api/v1/p1/workflows/stats
 * @desc    Get workflow statistics
 * @access  Private
 */
router.get('/workflows/stats',
  p1Controller.getWorkflowStats
);

// ============================================================================
// INTEGRATION ROUTES
// ============================================================================

/**
 * @route   POST /api/v1/p1/integrations/trello
 * @desc    Configure Trello integration
 * @access  Private
 */
router.post('/integrations/trello',
  P1FeaturesController.getValidationRules().configureTrelloIntegration,
  // validateRequest,
  p1Controller.configureTrelloIntegration
);

/**
 * @route   POST /api/v1/p1/integrations/jira
 * @desc    Configure Jira integration
 * @access  Private
 */
router.post('/integrations/jira',
  P1FeaturesController.getValidationRules().configureJiraIntegration,
  // validateRequest,
  p1Controller.configureJiraIntegration
);

// ============================================================================
// TEAM COLLABORATION ROUTES
// ============================================================================

/**
 * @route   POST /api/v1/p1/teams
 * @desc    Create a new team
 * @access  Private
 */
router.post('/teams',
  P1FeaturesController.getValidationRules().createTeam,
  // validateRequest,
  p1Controller.createTeam
);

/**
 * @route   GET /api/v1/p1/teams
 * @desc    Get user's teams
 * @access  Private
 */
router.get('/teams',
  p1Controller.getUserTeams
);

/**
 * @route   GET /api/v1/p1/teams/:teamId
 * @desc    Get team details
 * @access  Private
 */
router.get('/teams/:teamId',
  p1Controller.getTeam
);

/**
 * @route   POST /api/v1/p1/teams/:teamId/members
 * @desc    Add team member
 * @access  Private
 */
router.post('/teams/:teamId/members',
  P1FeaturesController.getValidationRules().addTeamMember,
  // validateRequest,
  p1Controller.addTeamMember
);

/**
 * @route   GET /api/v1/p1/teams/:teamId/members
 * @desc    Get team members
 * @access  Private
 */
router.get('/teams/:teamId/members',
  p1Controller.getTeamMembers
);

/**
 * @route   POST /api/v1/p1/teams/assign-email
 * @desc    Assign email to team member
 * @access  Private
 */
router.post('/teams/assign-email',
  P1FeaturesController.getValidationRules().assignEmail,
  // validateRequest,
  p1Controller.assignEmail
);

/**
 * @route   POST /api/v1/p1/teams/comments
 * @desc    Add collaboration comment
 * @access  Private
 */
router.post('/teams/comments',
  P1FeaturesController.getValidationRules().addComment,
  // validateRequest,
  p1Controller.addComment
);

/**
 * @route   GET /api/v1/p1/teams/:teamId/emails/:emailId/comments
 * @desc    Get email comments
 * @access  Private
 */
router.get('/teams/:teamId/emails/:emailId/comments',
  p1Controller.getEmailComments
);

/**
 * @route   GET /api/v1/p1/teams/:teamId/activity
 * @desc    Get team activity
 * @access  Private
 */
router.get('/teams/:teamId/activity',
  p1Controller.getTeamActivity
);

// ============================================================================
// REAL-TIME NOTIFICATIONS ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/p1/notifications/status
 * @desc    Get notification connection status
 * @access  Private
 */
router.get('/notifications/status',
  p1Controller.getNotificationStatus
);

/**
 * @route   POST /api/v1/p1/notifications/test
 * @desc    Send test notification
 * @access  Private
 */
router.post('/notifications/test',
  p1Controller.sendTestNotification
);

/**
 * @route   GET /api/v1/p1/system/stats
 * @desc    Get system statistics
 * @access  Private
 */
router.get('/system/stats',
  p1Controller.getSystemStats
);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler for unmatched P1 routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'P1 feature endpoint not found',
    path: req.originalUrl
  });
});

// Error handler for P1 routes
router.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('P1 Features API Error:', error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error in P1 features',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

export default router;