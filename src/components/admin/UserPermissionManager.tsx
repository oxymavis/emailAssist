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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Chip,
  Avatar,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Alert,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import {
  Edit as EditIcon,
  PersonAdd as PersonAddIcon,
  Security as SecurityIcon,
  VpnKey as VpnKeyIcon,
  Group as GroupIcon,
  History as HistoryIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Block as BlockIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'email' | 'reports' | 'admin' | 'settings' | 'workflows';
  level: 'read' | 'write' | 'admin';
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystemRole: boolean;
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  status: 'active' | 'inactive' | 'suspended';
  lastLogin: Date;
  permissions: string[];
  createdAt: Date;
}

interface PermissionAuditLog {
  id: string;
  userId: string;
  userName: string;
  action: 'granted' | 'revoked' | 'role_assigned' | 'role_removed';
  targetPermission?: string;
  targetRole?: string;
  timestamp: Date;
  adminUser: string;
  reason?: string;
}

const UserPermissionManager: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();

  const [activeTab, setActiveTab] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [auditLogs, setAuditLogs] = useState<PermissionAuditLog[]>([]);

  const [editUserDialog, setEditUserDialog] = useState(false);
  const [editRoleDialog, setEditRoleDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  // Mock data initialization
  useEffect(() => {
    initializeMockData();
  }, []);

  const initializeMockData = () => {
    // Initialize permissions
    const mockPermissions: Permission[] = [
      // Email permissions
      { id: 'email_read', name: 'Read Emails', description: 'View email content and metadata', category: 'email', level: 'read' },
      { id: 'email_write', name: 'Compose Emails', description: 'Create and send emails', category: 'email', level: 'write' },
      { id: 'email_delete', name: 'Delete Emails', description: 'Delete emails permanently', category: 'email', level: 'admin' },
      { id: 'email_bulk', name: 'Bulk Operations', description: 'Perform bulk email operations', category: 'email', level: 'write' },

      // Reports permissions
      { id: 'reports_view', name: 'View Reports', description: 'View generated reports', category: 'reports', level: 'read' },
      { id: 'reports_create', name: 'Create Reports', description: 'Generate new reports', category: 'reports', level: 'write' },
      { id: 'reports_schedule', name: 'Schedule Reports', description: 'Set up automated reports', category: 'reports', level: 'write' },
      { id: 'reports_manage', name: 'Manage Templates', description: 'Create and edit report templates', category: 'reports', level: 'admin' },

      // Admin permissions
      { id: 'admin_users', name: 'User Management', description: 'Manage user accounts', category: 'admin', level: 'admin' },
      { id: 'admin_roles', name: 'Role Management', description: 'Manage roles and permissions', category: 'admin', level: 'admin' },
      { id: 'admin_system', name: 'System Settings', description: 'Access system configuration', category: 'admin', level: 'admin' },
      { id: 'admin_audit', name: 'Audit Logs', description: 'View system audit logs', category: 'admin', level: 'admin' },

      // Settings permissions
      { id: 'settings_profile', name: 'Profile Settings', description: 'Modify personal profile', category: 'settings', level: 'write' },
      { id: 'settings_notifications', name: 'Notification Settings', description: 'Configure notifications', category: 'settings', level: 'write' },
      { id: 'settings_integration', name: 'Integration Settings', description: 'Manage third-party integrations', category: 'settings', level: 'admin' },

      // Workflows permissions
      { id: 'workflows_view', name: 'View Workflows', description: 'View automation workflows', category: 'workflows', level: 'read' },
      { id: 'workflows_create', name: 'Create Workflows', description: 'Create automation workflows', category: 'workflows', level: 'write' },
      { id: 'workflows_manage', name: 'Manage Workflows', description: 'Manage all workflows', category: 'workflows', level: 'admin' },
    ];

    // Initialize roles
    const mockRoles: Role[] = [
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Full system access with all permissions',
        permissions: mockPermissions.map(p => p.id),
        isSystemRole: true,
        userCount: 2,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      },
      {
        id: 'manager',
        name: 'Manager',
        description: 'Management level access with reporting and user oversight',
        permissions: [
          'email_read', 'email_write', 'email_bulk',
          'reports_view', 'reports_create', 'reports_schedule', 'reports_manage',
          'settings_profile', 'settings_notifications',
          'workflows_view', 'workflows_create'
        ],
        isSystemRole: true,
        userCount: 5,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-02-15')
      },
      {
        id: 'user',
        name: 'Standard User',
        description: 'Basic user access with email and personal settings',
        permissions: [
          'email_read', 'email_write',
          'reports_view',
          'settings_profile', 'settings_notifications',
          'workflows_view'
        ],
        isSystemRole: true,
        userCount: 25,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-03-01')
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
        userCount: 8,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15')
      }
    ];

    // Initialize users
    const mockUsers: User[] = [
      {
        id: 'user1',
        name: 'Alice Chen',
        email: 'alice.chen@company.com',
        avatar: '/avatars/alice.jpg',
        role: 'admin',
        status: 'active',
        lastLogin: new Date('2024-03-10T09:30:00'),
        permissions: [],
        createdAt: new Date('2024-01-01')
      },
      {
        id: 'user2',
        name: 'Bob Johnson',
        email: 'bob.johnson@company.com',
        avatar: '/avatars/bob.jpg',
        role: 'manager',
        status: 'active',
        lastLogin: new Date('2024-03-09T14:20:00'),
        permissions: ['admin_audit'], // Additional permission
        createdAt: new Date('2024-01-15')
      },
      {
        id: 'user3',
        name: 'Carol Williams',
        email: 'carol.williams@company.com',
        role: 'user',
        status: 'active',
        lastLogin: new Date('2024-03-08T11:45:00'),
        permissions: [],
        createdAt: new Date('2024-02-01')
      },
      {
        id: 'user4',
        name: 'David Brown',
        email: 'david.brown@company.com',
        role: 'viewer',
        status: 'inactive',
        lastLogin: new Date('2024-02-28T16:10:00'),
        permissions: [],
        createdAt: new Date('2024-02-15')
      },
      {
        id: 'user5',
        name: 'Eva Martinez',
        email: 'eva.martinez@company.com',
        role: 'user',
        status: 'suspended',
        lastLogin: new Date('2024-03-05T08:15:00'),
        permissions: [],
        createdAt: new Date('2024-02-20')
      }
    ];

    // Initialize audit logs
    const mockAuditLogs: PermissionAuditLog[] = [
      {
        id: 'log1',
        userId: 'user2',
        userName: 'Bob Johnson',
        action: 'granted',
        targetPermission: 'admin_audit',
        timestamp: new Date('2024-03-08T10:30:00'),
        adminUser: 'Alice Chen',
        reason: 'Temporary access for compliance audit'
      },
      {
        id: 'log2',
        userId: 'user5',
        userName: 'Eva Martinez',
        action: 'role_assigned',
        targetRole: 'user',
        timestamp: new Date('2024-02-20T09:00:00'),
        adminUser: 'Alice Chen'
      },
      {
        id: 'log3',
        userId: 'user4',
        userName: 'David Brown',
        action: 'role_assigned',
        targetRole: 'viewer',
        timestamp: new Date('2024-02-15T14:20:00'),
        adminUser: 'Alice Chen'
      }
    ];

    setPermissions(mockPermissions);
    setRoles(mockRoles);
    setUsers(mockUsers);
    setAuditLogs(mockAuditLogs);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditUserDialog(true);
  };

  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setEditRoleDialog(true);
  };

  const handleUserStatusToggle = (userId: string, newStatus: User['status']) => {
    setUsers(prev => prev.map(user =>
      user.id === userId ? { ...user, status: newStatus } : user
    ));

    // Add audit log
    const user = users.find(u => u.id === userId);
    if (user) {
      const newLog: PermissionAuditLog = {
        id: `log_${Date.now()}`,
        userId,
        userName: user.name,
        action: newStatus === 'suspended' ? 'role_removed' : 'role_assigned',
        timestamp: new Date(),
        adminUser: 'Current User',
        reason: `User status changed to ${newStatus}`
      };
      setAuditLogs(prev => [newLog, ...prev]);
    }
  };

  const getUserPermissions = (user: User): Permission[] => {
    const role = roles.find(r => r.id === user.role);
    const rolePermissions = role ? role.permissions : [];
    const allPermissionIds = [...new Set([...rolePermissions, ...user.permissions])];
    return permissions.filter(p => allPermissionIds.includes(p.id));
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

  const getStatusIcon = (status: User['status']) => {
    switch (status) {
      case 'active': return <CheckCircleIcon color="success" />;
      case 'inactive': return <WarningIcon color="warning" />;
      case 'suspended': return <BlockIcon color="error" />;
      default: return null;
    }
  };

  const renderUsersTab = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">{t('admin.users.title')}</Typography>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={() => {
            setSelectedUser(null);
            setEditUserDialog(true);
          }}
        >
          {t('admin.users.addUser')}
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('admin.users.user')}</TableCell>
              <TableCell>{t('admin.users.role')}</TableCell>
              <TableCell>{t('admin.users.status')}</TableCell>
              <TableCell>{t('admin.users.permissions')}</TableCell>
              <TableCell>{t('admin.users.lastLogin')}</TableCell>
              <TableCell align="right">{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => {
              const userPermissions = getUserPermissions(user);
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Avatar src={user.avatar} sx={{ width: 32, height: 32 }}>
                        {user.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {user.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user.email}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={roles.find(r => r.id === user.role)?.name || user.role}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getStatusIcon(user.status)}
                      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                        {user.status}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {userPermissions.length} {t('admin.permissions.title').toLowerCase()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {user.lastLogin.toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('common.edit')}>
                      <IconButton size="small" onClick={() => handleEditUser(user)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={user.status === 'suspended' ? t('admin.users.activate') : t('admin.users.suspend')}>
                      <IconButton
                        size="small"
                        onClick={() => handleUserStatusToggle(
                          user.id,
                          user.status === 'suspended' ? 'active' : 'suspended'
                        )}
                      >
                        {user.status === 'suspended' ? <CheckCircleIcon /> : <BlockIcon />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderRolesTab = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">{t('admin.roles.title')}</Typography>
        <Button
          variant="contained"
          startIcon={<GroupIcon />}
          onClick={() => {
            setSelectedRole(null);
            setEditRoleDialog(true);
          }}
        >
          {t('admin.roles.addRole')}
        </Button>
      </Box>

      <Grid container spacing={3}>
        {roles.map((role) => (
          <Grid item xs={12} md={6} key={role.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      {role.name}
                      {role.isSystemRole && (
                        <Chip
                          label="System"
                          size="small"
                          color="primary"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {role.description}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => handleEditRole(role)}
                    disabled={role.isSystemRole}
                  >
                    <EditIcon />
                  </IconButton>
                </Box>

                <Box mb={2}>
                  <Typography variant="body2" fontWeight={500} gutterBottom>
                    {t('admin.permissions.title')} ({role.permissions.length})
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {role.permissions.slice(0, 6).map(permissionId => {
                      const permission = permissions.find(p => p.id === permissionId);
                      return permission ? (
                        <Chip
                          key={permissionId}
                          label={permission.name}
                          size="small"
                          sx={{
                            backgroundColor: alpha(getCategoryColor(permission.category), 0.1),
                            color: getCategoryColor(permission.category)
                          }}
                        />
                      ) : null;
                    })}
                    {role.permissions.length > 6 && (
                      <Chip
                        label={`+${role.permissions.length - 6} more`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </Box>

                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    {role.userCount} {t('admin.users.title').toLowerCase()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('admin.roles.updated')}: {role.updatedAt.toLocaleDateString()}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderPermissionsTab = () => {
    const permissionsByCategory = permissions.reduce((acc, permission) => {
      if (!acc[permission.category]) {
        acc[permission.category] = [];
      }
      acc[permission.category].push(permission);
      return acc;
    }, {} as Record<string, Permission[]>);

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          {t('admin.permissions.title')}
        </Typography>

        {Object.entries(permissionsByCategory).map(([category, categoryPermissions]) => (
          <Card key={category} sx={{ mb: 2 }}>
            <CardContent>
              <Typography
                variant="h6"
                gutterBottom
                sx={{
                  color: getCategoryColor(category as Permission['category']),
                  textTransform: 'capitalize'
                }}
              >
                {category} {t('admin.permissions.title')}
              </Typography>
              <Grid container spacing={2}>
                {categoryPermissions.map(permission => (
                  <Grid item xs={12} md={6} key={permission.id}>
                    <Box
                      sx={{
                        p: 2,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        backgroundColor: alpha(getCategoryColor(permission.category), 0.05)
                      }}
                    >
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box flex={1}>
                          <Typography variant="subtitle2" fontWeight={500}>
                            {permission.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            {permission.description}
                          </Typography>
                        </Box>
                        <Chip
                          label={permission.level}
                          size="small"
                          color={
                            permission.level === 'admin' ? 'error' :
                            permission.level === 'write' ? 'warning' : 'success'
                          }
                        />
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  };

  const renderAuditTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('admin.audit.title')}
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('admin.audit.user')}</TableCell>
              <TableCell>{t('admin.audit.action')}</TableCell>
              <TableCell>{t('admin.audit.target')}</TableCell>
              <TableCell>{t('admin.audit.timestamp')}</TableCell>
              <TableCell>{t('admin.audit.admin')}</TableCell>
              <TableCell>{t('admin.audit.reason')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {auditLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{log.userName}</TableCell>
                <TableCell>
                  <Chip
                    label={log.action.replace('_', ' ')}
                    size="small"
                    color={
                      log.action === 'granted' || log.action === 'role_assigned' ? 'success' : 'error'
                    }
                    sx={{ textTransform: 'capitalize' }}
                  />
                </TableCell>
                <TableCell>
                  {log.targetPermission && (
                    <Chip label={permissions.find(p => p.id === log.targetPermission)?.name || log.targetPermission} size="small" />
                  )}
                  {log.targetRole && (
                    <Chip label={roles.find(r => r.id === log.targetRole)?.name || log.targetRole} size="small" />
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {log.timestamp.toLocaleString()}
                  </Typography>
                </TableCell>
                <TableCell>{log.adminUser}</TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {log.reason || '-'}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  return (
    <Box p={3}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <SecurityIcon fontSize="large" color="primary" />
        <Typography variant="h4" component="h1">
          {t('admin.title')}
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        {t('admin.description')}
      </Alert>

      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            icon={<GroupIcon />}
            label={t('admin.tabs.users')}
            iconPosition="start"
          />
          <Tab
            icon={<VpnKeyIcon />}
            label={t('admin.tabs.roles')}
            iconPosition="start"
          />
          <Tab
            icon={<SecurityIcon />}
            label={t('admin.tabs.permissions')}
            iconPosition="start"
          />
          <Tab
            icon={<HistoryIcon />}
            label={t('admin.tabs.audit')}
            iconPosition="start"
          />
        </Tabs>

        <Box p={3}>
          {activeTab === 0 && renderUsersTab()}
          {activeTab === 1 && renderRolesTab()}
          {activeTab === 2 && renderPermissionsTab()}
          {activeTab === 3 && renderAuditTab()}
        </Box>
      </Paper>

      {/* User Edit Dialog */}
      <Dialog
        open={editUserDialog}
        onClose={() => setEditUserDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedUser ? t('admin.users.editUser') : t('admin.users.addUser')}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            <TextField
              label={t('admin.users.name')}
              defaultValue={selectedUser?.name}
              fullWidth
            />
            <TextField
              label={t('admin.users.email')}
              type="email"
              defaultValue={selectedUser?.email}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>{t('admin.users.role')}</InputLabel>
              <Select defaultValue={selectedUser?.role || 'user'}>
                {roles.map(role => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>{t('admin.users.status')}</InputLabel>
              <Select defaultValue={selectedUser?.status || 'active'}>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="suspended">Suspended</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditUserDialog(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={() => setEditUserDialog(false)}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Role Edit Dialog */}
      <Dialog
        open={editRoleDialog}
        onClose={() => setEditRoleDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedRole ? t('admin.roles.editRole') : t('admin.roles.addRole')}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            <TextField
              label={t('admin.roles.name')}
              defaultValue={selectedRole?.name}
              fullWidth
            />
            <TextField
              label={t('admin.roles.description')}
              defaultValue={selectedRole?.description}
              fullWidth
              multiline
              rows={2}
            />
            <Typography variant="subtitle1" gutterBottom>
              {t('admin.permissions.title')}
            </Typography>
            <Box maxHeight={300} overflow="auto">
              {Object.entries(
                permissions.reduce((acc, permission) => {
                  if (!acc[permission.category]) {
                    acc[permission.category] = [];
                  }
                  acc[permission.category].push(permission);
                  return acc;
                }, {} as Record<string, Permission[]>)
              ).map(([category, categoryPermissions]) => (
                <Box key={category} mb={2}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      color: getCategoryColor(category as Permission['category']),
                      textTransform: 'capitalize',
                      mb: 1
                    }}
                  >
                    {category}
                  </Typography>
                  {categoryPermissions.map(permission => (
                    <Box key={permission.id} display="flex" alignItems="center" gap={1} ml={2}>
                      <Switch
                        size="small"
                        defaultChecked={selectedRole?.permissions.includes(permission.id)}
                      />
                      <Typography variant="body2">{permission.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        ({permission.level})
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditRoleDialog(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={() => setEditRoleDialog(false)}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserPermissionManager;