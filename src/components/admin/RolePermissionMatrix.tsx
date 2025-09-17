import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  Chip,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  alpha,
  Collapse
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Save as SaveIcon,
  Undo as UndoIcon,
  MoreVert as MoreVertIcon,
  ContentCopy as ContentCopyIcon,
  Compare as CompareIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'email' | 'reports' | 'admin' | 'settings' | 'workflows';
  level: 'read' | 'write' | 'admin';
  dependencies?: string[];
  conflictsWith?: string[];
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystemRole: boolean;
  userCount: number;
}

interface PermissionChange {
  roleId: string;
  permissionId: string;
  action: 'grant' | 'revoke';
  timestamp: Date;
  reason?: string;
}

interface RoleComparisonData {
  role1: Role;
  role2: Role;
  commonPermissions: string[];
  role1OnlyPermissions: string[];
  role2OnlyPermissions: string[];
}

const RolePermissionMatrix: React.FC = () => {
  const { t: _t } = useTranslation();
  const theme = useTheme();

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PermissionChange[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['email']));

  const [saveDialog, setSaveDialog] = useState(false);
  const [compareDialog, setCompareDialog] = useState(false);
  const [comparisonData, setComparisonData] = useState<RoleComparisonData | null>(null);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // Mock data initialization
  useEffect(() => {
    initializeMockData();
  }, []);

  const initializeMockData = () => {
    const mockPermissions: Permission[] = [
      // Email permissions
      {
        id: 'email_read',
        name: 'Read Emails',
        description: 'View email content and metadata',
        category: 'email',
        level: 'read'
      },
      {
        id: 'email_write',
        name: 'Compose Emails',
        description: 'Create and send emails',
        category: 'email',
        level: 'write',
        dependencies: ['email_read']
      },
      {
        id: 'email_delete',
        name: 'Delete Emails',
        description: 'Delete emails permanently',
        category: 'email',
        level: 'admin',
        dependencies: ['email_read', 'email_write']
      },
      {
        id: 'email_bulk',
        name: 'Bulk Operations',
        description: 'Perform bulk email operations',
        category: 'email',
        level: 'write',
        dependencies: ['email_read']
      },
      {
        id: 'email_archive',
        name: 'Archive Emails',
        description: 'Archive and restore emails',
        category: 'email',
        level: 'write',
        dependencies: ['email_read']
      },
      {
        id: 'email_labels',
        name: 'Manage Labels',
        description: 'Create and assign email labels',
        category: 'email',
        level: 'write',
        dependencies: ['email_read']
      },

      // Reports permissions
      {
        id: 'reports_view',
        name: 'View Reports',
        description: 'View generated reports',
        category: 'reports',
        level: 'read'
      },
      {
        id: 'reports_create',
        name: 'Create Reports',
        description: 'Generate new reports',
        category: 'reports',
        level: 'write',
        dependencies: ['reports_view']
      },
      {
        id: 'reports_schedule',
        name: 'Schedule Reports',
        description: 'Set up automated reports',
        category: 'reports',
        level: 'write',
        dependencies: ['reports_create']
      },
      {
        id: 'reports_manage',
        name: 'Manage Templates',
        description: 'Create and edit report templates',
        category: 'reports',
        level: 'admin',
        dependencies: ['reports_create']
      },
      {
        id: 'reports_export',
        name: 'Export Reports',
        description: 'Export reports in various formats',
        category: 'reports',
        level: 'write',
        dependencies: ['reports_view']
      },

      // Admin permissions
      {
        id: 'admin_users',
        name: 'User Management',
        description: 'Manage user accounts',
        category: 'admin',
        level: 'admin',
        conflictsWith: ['admin_readonly']
      },
      {
        id: 'admin_roles',
        name: 'Role Management',
        description: 'Manage roles and permissions',
        category: 'admin',
        level: 'admin',
        dependencies: ['admin_users']
      },
      {
        id: 'admin_system',
        name: 'System Settings',
        description: 'Access system configuration',
        category: 'admin',
        level: 'admin'
      },
      {
        id: 'admin_audit',
        name: 'Audit Logs',
        description: 'View system audit logs',
        category: 'admin',
        level: 'admin'
      },
      {
        id: 'admin_readonly',
        name: 'Read-Only Admin',
        description: 'View admin interfaces without modification rights',
        category: 'admin',
        level: 'read',
        conflictsWith: ['admin_users', 'admin_roles', 'admin_system']
      },

      // Settings permissions
      {
        id: 'settings_profile',
        name: 'Profile Settings',
        description: 'Modify personal profile',
        category: 'settings',
        level: 'write'
      },
      {
        id: 'settings_notifications',
        name: 'Notification Settings',
        description: 'Configure notifications',
        category: 'settings',
        level: 'write'
      },
      {
        id: 'settings_integration',
        name: 'Integration Settings',
        description: 'Manage third-party integrations',
        category: 'settings',
        level: 'admin'
      },
      {
        id: 'settings_security',
        name: 'Security Settings',
        description: 'Manage security preferences',
        category: 'settings',
        level: 'admin'
      },

      // Workflows permissions
      {
        id: 'workflows_view',
        name: 'View Workflows',
        description: 'View automation workflows',
        category: 'workflows',
        level: 'read'
      },
      {
        id: 'workflows_create',
        name: 'Create Workflows',
        description: 'Create automation workflows',
        category: 'workflows',
        level: 'write',
        dependencies: ['workflows_view']
      },
      {
        id: 'workflows_manage',
        name: 'Manage Workflows',
        description: 'Manage all workflows',
        category: 'workflows',
        level: 'admin',
        dependencies: ['workflows_create']
      },
      {
        id: 'workflows_execute',
        name: 'Execute Workflows',
        description: 'Trigger workflow execution',
        category: 'workflows',
        level: 'write',
        dependencies: ['workflows_view']
      }
    ];

    const mockRoles: Role[] = [
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Full system access with all permissions',
        permissions: mockPermissions.map(p => p.id),
        isSystemRole: true,
        userCount: 2
      },
      {
        id: 'manager',
        name: 'Manager',
        description: 'Management level access with reporting and user oversight',
        permissions: [
          'email_read', 'email_write', 'email_bulk', 'email_archive', 'email_labels',
          'reports_view', 'reports_create', 'reports_schedule', 'reports_manage', 'reports_export',
          'admin_readonly', 'admin_audit',
          'settings_profile', 'settings_notifications', 'settings_integration',
          'workflows_view', 'workflows_create', 'workflows_execute'
        ],
        isSystemRole: true,
        userCount: 5
      },
      {
        id: 'user',
        name: 'Standard User',
        description: 'Basic user access with email and personal settings',
        permissions: [
          'email_read', 'email_write', 'email_archive', 'email_labels',
          'reports_view', 'reports_export',
          'settings_profile', 'settings_notifications',
          'workflows_view'
        ],
        isSystemRole: true,
        userCount: 25
      },
      {
        id: 'viewer',
        name: 'Read-Only User',
        description: 'View-only access with minimal permissions',
        permissions: [
          'email_read',
          'reports_view',
          'workflows_view'
        ],
        isSystemRole: true,
        userCount: 8
      },
      {
        id: 'analyst',
        name: 'Data Analyst',
        description: 'Advanced reporting and analysis capabilities',
        permissions: [
          'email_read',
          'reports_view', 'reports_create', 'reports_schedule', 'reports_export',
          'settings_profile', 'settings_notifications',
          'workflows_view'
        ],
        isSystemRole: false,
        userCount: 3
      }
    ];

    setPermissions(mockPermissions);
    setRoles(mockRoles);
  };

  const hasPermission = (roleId: string, permissionId: string): boolean => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return false;

    const pendingChange = pendingChanges.find(
      c => c.roleId === roleId && c.permissionId === permissionId
    );

    if (pendingChange) {
      return pendingChange.action === 'grant';
    }

    return role.permissions.includes(permissionId);
  };

  const handlePermissionToggle = (roleId: string, permissionId: string, granted: boolean) => {
    const permission = permissions.find(p => p.id === permissionId);
    const role = roles.find(r => r.id === roleId);

    if (!permission || !role || role.isSystemRole) return;

    // Check dependencies and conflicts
    if (granted && permission.dependencies) {
      const missingDependencies = permission.dependencies.filter(
        depId => !hasPermission(roleId, depId)
      );
      if (missingDependencies.length > 0) {
        // Auto-grant dependencies
        missingDependencies.forEach(depId => {
          const existingChange = pendingChanges.find(
            c => c.roleId === roleId && c.permissionId === depId
          );
          if (!existingChange) {
            const newChange: PermissionChange = {
              roleId,
              permissionId: depId,
              action: 'grant',
              timestamp: new Date(),
              reason: `Auto-granted as dependency for ${permission.name}`
            };
            setPendingChanges(prev => [...prev, newChange]);
          }
        });
      }
    }

    if (granted && permission.conflictsWith) {
      // Auto-revoke conflicting permissions
      permission.conflictsWith.forEach(conflictId => {
        if (hasPermission(roleId, conflictId)) {
          const existingChange = pendingChanges.find(
            c => c.roleId === roleId && c.permissionId === conflictId
          );
          if (!existingChange) {
            const _conflictPermission = permissions.find(p => p.id === conflictId);
            const newChange: PermissionChange = {
              roleId,
              permissionId: conflictId,
              action: 'revoke',
              timestamp: new Date(),
              reason: `Auto-revoked due to conflict with ${permission.name}`
            };
            setPendingChanges(prev => [...prev, newChange]);
          }
        }
      });
    }

    // Add main permission change
    const existingChangeIndex = pendingChanges.findIndex(
      c => c.roleId === roleId && c.permissionId === permissionId
    );

    if (existingChangeIndex >= 0) {
      // Remove existing change if it matches current state
      const currentState = role.permissions.includes(permissionId);
      const existingChange = pendingChanges[existingChangeIndex];

      if ((currentState && existingChange.action === 'revoke') ||
          (!currentState && existingChange.action === 'grant')) {
        setPendingChanges(prev => prev.filter((_, index) => index !== existingChangeIndex));
      } else {
        // Update existing change
        setPendingChanges(prev => prev.map((change, index) =>
          index === existingChangeIndex
            ? { ...change, action: granted ? 'grant' : 'revoke', timestamp: new Date() }
            : change
        ));
      }
    } else {
      const currentState = role.permissions.includes(permissionId);
      if (currentState !== granted) {
        const newChange: PermissionChange = {
          roleId,
          permissionId,
          action: granted ? 'grant' : 'revoke',
          timestamp: new Date()
        };
        setPendingChanges(prev => [...prev, newChange]);
      }
    }
  };

  const applyChanges = () => {
    setRoles(prevRoles => prevRoles.map(role => {
      const roleChanges = pendingChanges.filter(c => c.roleId === role.id);
      if (roleChanges.length === 0) return role;

      const newPermissions = [...role.permissions];

      roleChanges.forEach(change => {
        if (change.action === 'grant') {
          if (!newPermissions.includes(change.permissionId)) {
            newPermissions.push(change.permissionId);
          }
        } else {
          const index = newPermissions.indexOf(change.permissionId);
          if (index > -1) {
            newPermissions.splice(index, 1);
          }
        }
      });

      return { ...role, permissions: newPermissions };
    }));

    setPendingChanges([]);
    setSaveDialog(false);
  };

  const discardChanges = () => {
    setPendingChanges([]);
  };

  const compareRoles = (role1Id: string, role2Id: string) => {
    const role1 = roles.find(r => r.id === role1Id);
    const role2 = roles.find(r => r.id === role2Id);

    if (!role1 || !role2) return;

    const role1Permissions = new Set(role1.permissions);
    const role2Permissions = new Set(role2.permissions);

    const commonPermissions = [...role1Permissions].filter(p => role2Permissions.has(p));
    const role1OnlyPermissions = [...role1Permissions].filter(p => !role2Permissions.has(p));
    const role2OnlyPermissions = [...role2Permissions].filter(p => !role1Permissions.has(p));

    setComparisonData({
      role1,
      role2,
      commonPermissions,
      role1OnlyPermissions,
      role2OnlyPermissions
    });
    setCompareDialog(true);
  };

  const duplicateRole = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return;

    const newRole: Role = {
      ...role,
      id: `${role.id}_copy_${Date.now()}`,
      name: `${role.name} (Copy)`,
      isSystemRole: false,
      userCount: 0
    };

    setRoles(prev => [...prev, newRole]);
  };

  const getCategoryColor = (category: Permission['category']) => {
    const colors = {
      email: theme.palette.primary.main,
      reports: theme.palette.secondary.main,
      admin: theme.palette.error.main,
      settings: theme.palette.warning.main,
      workflows: theme.palette.success.main
    };
    return colors[category];
  };

  const toggleCategoryExpansion = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const permissionsByCategory = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const getPendingChangeForPermission = (roleId: string, permissionId: string) => {
    return pendingChanges.find(c => c.roleId === roleId && c.permissionId === permissionId);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">Role-Permission Matrix</Typography>
        <Box display="flex" gap={1}>
          {pendingChanges.length > 0 && (
            <>
              <Button
                variant="outlined"
                startIcon={<UndoIcon />}
                onClick={discardChanges}
              >
                Discard ({pendingChanges.length})
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={() => setSaveDialog(true)}
              >
                Save Changes ({pendingChanges.length})
              </Button>
            </>
          )}
        </Box>
      </Box>

      {pendingChanges.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You have {pendingChanges.length} pending permission changes.
          Save changes to apply them or discard to revert.
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 250, position: 'sticky', left: 0, zIndex: 2, backgroundColor: 'background.paper' }}>
                Permission
              </TableCell>
              {roles.map((role) => (
                <TableCell key={role.id} align="center" sx={{ minWidth: 120 }}>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={500}>
                      {role.name}
                    </Typography>
                    {role.isSystemRole && (
                      <Chip label="System" size="small" color="primary" sx={{ mt: 0.5 }} />
                    )}
                    <IconButton
                      size="small"
                      onClick={(event) => {
                        setAnchorEl(event.currentTarget);
                        setSelectedRole(role.id);
                      }}
                      sx={{ ml: 1 }}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(permissionsByCategory).map(([category, categoryPermissions]) => (
              <React.Fragment key={category}>
                <TableRow>
                  <TableCell
                    sx={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                      backgroundColor: alpha(getCategoryColor(category as Permission['category']), 0.1),
                      borderTop: 2,
                      borderTopColor: getCategoryColor(category as Permission['category'])
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      <IconButton
                        size="small"
                        onClick={() => toggleCategoryExpansion(category)}
                      >
                        {expandedCategories.has(category) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                      <Typography
                        variant="subtitle1"
                        fontWeight={600}
                        sx={{
                          color: getCategoryColor(category as Permission['category']),
                          textTransform: 'capitalize'
                        }}
                      >
                        {category} ({categoryPermissions.length})
                      </Typography>
                    </Box>
                  </TableCell>
                  {roles.map(() => (
                    <TableCell
                      key={`${category}-header`}
                      sx={{
                        backgroundColor: alpha(getCategoryColor(category as Permission['category']), 0.1),
                        borderTop: 2,
                        borderTopColor: getCategoryColor(category as Permission['category'])
                      }}
                    />
                  ))}
                </TableRow>
                <Collapse in={expandedCategories.has(category)} timeout="auto" unmountOnExit>
                  <Box component="tbody">
                    {categoryPermissions.map((permission) => (
                      <TableRow key={permission.id}>
                        <TableCell
                          sx={{
                            position: 'sticky',
                            left: 0,
                            zIndex: 1,
                            backgroundColor: 'background.paper',
                            pl: 6
                          }}
                        >
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              {permission.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {permission.description}
                            </Typography>
                            <Box display="flex" gap={0.5} mt={0.5}>
                              <Chip
                                label={permission.level}
                                size="small"
                                color={
                                  permission.level === 'admin' ? 'error' :
                                  permission.level === 'write' ? 'warning' : 'success'
                                }
                                sx={{ fontSize: '0.65rem', height: 18 }}
                              />
                              {permission.dependencies && (
                                <Chip
                                  label={`Deps: ${permission.dependencies.length}`}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.65rem', height: 18 }}
                                />
                              )}
                              {permission.conflictsWith && (
                                <Chip
                                  label="Conflicts"
                                  size="small"
                                  color="warning"
                                  variant="outlined"
                                  sx={{ fontSize: '0.65rem', height: 18 }}
                                />
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        {roles.map((role) => {
                          const isGranted = hasPermission(role.id, permission.id);
                          const pendingChange = getPendingChangeForPermission(role.id, permission.id);

                          return (
                            <TableCell key={`${role.id}-${permission.id}`} align="center">
                              <Box display="flex" flexDirection="column" alignItems="center" gap={0.5}>
                                <Switch
                                  size="small"
                                  checked={isGranted}
                                  onChange={(_, checked) => handlePermissionToggle(role.id, permission.id, checked)}
                                  disabled={role.isSystemRole}
                                  color={pendingChange ? "warning" : "primary"}
                                />
                                {pendingChange && (
                                  <Tooltip title={`Pending: ${pendingChange.action} ${pendingChange.reason ? `(${pendingChange.reason})` : ''}`}>
                                    <WarningIcon color="warning" sx={{ fontSize: 14 }} />
                                  </Tooltip>
                                )}
                              </Box>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </Box>
                </Collapse>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Role Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => {
          if (selectedRole) duplicateRole(selectedRole);
          setAnchorEl(null);
        }}>
          <ListItemIcon>
            <ContentCopyIcon />
          </ListItemIcon>
          <ListItemText>Duplicate Role</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedRole) {
            const otherRoles = roles.filter(r => r.id !== selectedRole);
            if (otherRoles.length > 0) {
              compareRoles(selectedRole, otherRoles[0].id);
            }
          }
          setAnchorEl(null);
        }}>
          <ListItemIcon>
            <CompareIcon />
          </ListItemIcon>
          <ListItemText>Compare with Another Role</ListItemText>
        </MenuItem>
      </Menu>

      {/* Save Changes Dialog */}
      <Dialog
        open={saveDialog}
        onClose={() => setSaveDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Save Permission Changes</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            You are about to apply {pendingChanges.length} permission changes:
          </Typography>
          <Box maxHeight={300} overflow="auto" mt={2}>
            {pendingChanges.map((change, index) => {
              const role = roles.find(r => r.id === change.roleId);
              const permission = permissions.find(p => p.id === change.permissionId);
              return (
                <Box
                  key={index}
                  display="flex"
                  alignItems="center"
                  gap={1}
                  p={1}
                  sx={{ backgroundColor: change.action === 'grant' ? 'success.light' : 'error.light', borderRadius: 1, mb: 1 }}
                >
                  {change.action === 'grant' ? (
                    <CheckCircleIcon color="success" />
                  ) : (
                    <WarningIcon color="error" />
                  )}
                  <Typography variant="body2">
                    <strong>{change.action.toUpperCase()}</strong> "{permission?.name}"
                    {change.action === 'grant' ? ' to ' : ' from '}
                    "{role?.name}"
                  </Typography>
                </Box>
              );
            })}
          </Box>
          <Alert severity="warning" sx={{ mt: 2 }}>
            These changes will affect all users assigned to the modified roles.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialog(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={applyChanges}>
            Apply Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Role Comparison Dialog */}
      <Dialog
        open={compareDialog}
        onClose={() => setCompareDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Role Comparison</DialogTitle>
        <DialogContent>
          {comparisonData && (
            <Box>
              <Box display="flex" justifyContent="space-between" mb={3}>
                <Box>
                  <Typography variant="h6">{comparisonData.role1.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {comparisonData.role1.permissions.length} permissions
                  </Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="h6">{comparisonData.role2.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {comparisonData.role2.permissions.length} permissions
                  </Typography>
                </Box>
              </Box>

              <Typography variant="subtitle1" gutterBottom color="success.main">
                Common Permissions ({comparisonData.commonPermissions.length})
              </Typography>
              <Box mb={2}>
                {comparisonData.commonPermissions.map(permId => {
                  const perm = permissions.find(p => p.id === permId);
                  return perm ? (
                    <Chip key={permId} label={perm.name} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                  ) : null;
                })}
              </Box>

              <Typography variant="subtitle1" gutterBottom color="primary.main">
                Only in {comparisonData.role1.name} ({comparisonData.role1OnlyPermissions.length})
              </Typography>
              <Box mb={2}>
                {comparisonData.role1OnlyPermissions.map(permId => {
                  const perm = permissions.find(p => p.id === permId);
                  return perm ? (
                    <Chip key={permId} label={perm.name} size="small" color="primary" sx={{ mr: 0.5, mb: 0.5 }} />
                  ) : null;
                })}
              </Box>

              <Typography variant="subtitle1" gutterBottom color="secondary.main">
                Only in {comparisonData.role2.name} ({comparisonData.role2OnlyPermissions.length})
              </Typography>
              <Box mb={2}>
                {comparisonData.role2OnlyPermissions.map(permId => {
                  const perm = permissions.find(p => p.id === permId);
                  return perm ? (
                    <Chip key={permId} label={perm.name} size="small" color="secondary" sx={{ mr: 0.5, mb: 0.5 }} />
                  ) : null;
                })}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompareDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RolePermissionMatrix;