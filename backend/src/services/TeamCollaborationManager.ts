import logger from '../utils/logger';
import DatabaseManager from '../config/database';
// import User from '../models/User';
import WebSocketService from './WebSocketService';

/**
 * Team Role Types
 * 团队角色类型
 */
export enum TeamRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MANAGER = 'manager',
  MEMBER = 'member',
  VIEWER = 'viewer'
}

/**
 * Permission Types
 * 权限类型
 */
export enum Permission {
  // Email permissions
  EMAIL_READ = 'email:read',
  EMAIL_WRITE = 'email:write',
  EMAIL_DELETE = 'email:delete',
  EMAIL_SHARE = 'email:share',

  // Task permissions
  TASK_READ = 'task:read',
  TASK_CREATE = 'task:create',
  TASK_UPDATE = 'task:update',
  TASK_DELETE = 'task:delete',
  TASK_ASSIGN = 'task:assign',

  // Integration permissions
  INTEGRATION_READ = 'integration:read',
  INTEGRATION_MANAGE = 'integration:manage',
  INTEGRATION_DELETE = 'integration:delete',

  // Report permissions
  REPORT_READ = 'report:read',
  REPORT_CREATE = 'report:create',
  REPORT_DELETE = 'report:delete',

  // Team management permissions
  TEAM_READ = 'team:read',
  TEAM_INVITE = 'team:invite',
  TEAM_REMOVE = 'team:remove',
  TEAM_MANAGE_ROLES = 'team:manage_roles',

  // System permissions
  SYSTEM_ADMIN = 'system:admin',
  SYSTEM_SETTINGS = 'system:settings'
}

/**
 * Team Member Interface
 */
export interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  role: TeamRole;
  permissions: Permission[];
  joinedAt: Date;
  invitedBy?: string;
  status: 'active' | 'pending' | 'suspended';
  lastActivity?: Date;
  user?: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
  };
}

/**
 * Team Interface
 */
export interface Team {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  isDefault: boolean;
  settings: {
    emailSharing: boolean;
    taskSharing: boolean;
    integrationSharing: boolean;
    reportSharing: boolean;
    memberCanInvite: boolean;
    requireApproval: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
  members?: TeamMember[];
  stats?: {
    totalMembers: number;
    activeMembers: number;
    pendingInvites: number;
  };
}

/**
 * Team Collaboration Manager
 * 团队协作管理器
 */
export class TeamCollaborationManager {
  private webSocketService?: WebSocketService;

  constructor(webSocketService?: WebSocketService) {
    this.webSocketService = webSocketService;
  }

  /**
   * Role permission mapping
   */
  private static ROLE_PERMISSIONS: Record<TeamRole, Permission[]> = {
    [TeamRole.OWNER]: [
      Permission.EMAIL_READ, Permission.EMAIL_WRITE, Permission.EMAIL_DELETE, Permission.EMAIL_SHARE,
      Permission.TASK_READ, Permission.TASK_CREATE, Permission.TASK_UPDATE, Permission.TASK_DELETE, Permission.TASK_ASSIGN,
      Permission.INTEGRATION_READ, Permission.INTEGRATION_MANAGE, Permission.INTEGRATION_DELETE,
      Permission.REPORT_READ, Permission.REPORT_CREATE, Permission.REPORT_DELETE,
      Permission.TEAM_READ, Permission.TEAM_INVITE, Permission.TEAM_REMOVE, Permission.TEAM_MANAGE_ROLES,
      Permission.SYSTEM_ADMIN, Permission.SYSTEM_SETTINGS
    ],
    [TeamRole.ADMIN]: [
      Permission.EMAIL_READ, Permission.EMAIL_WRITE, Permission.EMAIL_DELETE, Permission.EMAIL_SHARE,
      Permission.TASK_READ, Permission.TASK_CREATE, Permission.TASK_UPDATE, Permission.TASK_DELETE, Permission.TASK_ASSIGN,
      Permission.INTEGRATION_READ, Permission.INTEGRATION_MANAGE,
      Permission.REPORT_READ, Permission.REPORT_CREATE, Permission.REPORT_DELETE,
      Permission.TEAM_READ, Permission.TEAM_INVITE, Permission.TEAM_REMOVE,
      Permission.SYSTEM_SETTINGS
    ],
    [TeamRole.MANAGER]: [
      Permission.EMAIL_READ, Permission.EMAIL_WRITE, Permission.EMAIL_SHARE,
      Permission.TASK_READ, Permission.TASK_CREATE, Permission.TASK_UPDATE, Permission.TASK_ASSIGN,
      Permission.INTEGRATION_READ,
      Permission.REPORT_READ, Permission.REPORT_CREATE,
      Permission.TEAM_READ, Permission.TEAM_INVITE
    ],
    [TeamRole.MEMBER]: [
      Permission.EMAIL_READ, Permission.EMAIL_WRITE,
      Permission.TASK_READ, Permission.TASK_CREATE, Permission.TASK_UPDATE,
      Permission.INTEGRATION_READ,
      Permission.REPORT_READ,
      Permission.TEAM_READ
    ],
    [TeamRole.VIEWER]: [
      Permission.EMAIL_READ,
      Permission.TASK_READ,
      Permission.INTEGRATION_READ,
      Permission.REPORT_READ,
      Permission.TEAM_READ
    ]
  };

  /**
   * Check if user has permission
   */
  async hasPermission(userId: string, teamId: string, permission: Permission): Promise<boolean> {
    try {
      const [results] = await DatabaseManager.query(
        'SELECT role FROM team_members WHERE team_id = :teamId AND user_id = :userId AND status = :status',
        { replacements: { teamId, userId, status: 'active' } }
      );

      if (!results.length) {
        return false;
      }

      const memberRole = (results[0] as any).role as TeamRole;
      const rolePermissions = TeamCollaborationManager.ROLE_PERMISSIONS[memberRole] || [];

      return rolePermissions.includes(permission);
    } catch (error) {
      logger.error('Failed to check permission:', error);
      return false;
    }
  }

  /**
   * Get user permissions for team
   */
  async getUserPermissions(userId: string, teamId: string): Promise<Permission[]> {
    try {
      const [results] = await DatabaseManager.query(
        'SELECT role FROM team_members WHERE team_id = :teamId AND user_id = :userId AND status = :status',
        { replacements: { teamId, userId, status: 'active' } }
      );

      if (!results.length) {
        return [];
      }

      const memberRole = (results[0] as any).role as TeamRole;
      return TeamCollaborationManager.ROLE_PERMISSIONS[memberRole] || [];
    } catch (error) {
      logger.error('Failed to get user permissions:', error);
      return [];
    }
  }

  /**
   * Create team collaboration middleware
   */
  createPermissionMiddleware(permission: Permission) {
    return async (req: any, res: any, next: any) => {
      try {
        const userId = req.user?.id;
        const teamId = req.params.teamId || req.body.teamId || req.query.teamId;

        if (!userId) {
          return res.status(401).json({ error: 'User not authenticated' });
        }

        if (!teamId) {
          return res.status(400).json({ error: 'Team ID is required' });
        }

        const hasPermission = await this.hasPermission(userId, teamId, permission);

        if (!hasPermission) {
          return res.status(403).json({
            error: 'Insufficient permissions',
            required: permission
          });
        }

        req.userPermissions = await this.getUserPermissions(userId, teamId);
        next();
      } catch (error) {
        logger.error('Permission middleware error:', error);
        res.status(500).json({ error: 'Permission check failed' });
      }
    };
  }
}

export default TeamCollaborationManager;