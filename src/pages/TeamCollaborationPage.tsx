import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Avatar,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Group as GroupIcon,
  Security as SecurityIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

// Team and permission types
enum TeamRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MANAGER = 'manager',
  MEMBER = 'member',
  VIEWER = 'viewer'
}

enum Permission {
  EMAIL_READ = 'email:read',
  EMAIL_WRITE = 'email:write',
  EMAIL_DELETE = 'email:delete',
  EMAIL_SHARE = 'email:share',
  TASK_READ = 'task:read',
  TASK_CREATE = 'task:create',
  TASK_UPDATE = 'task:update',
  TASK_DELETE = 'task:delete',
  TASK_ASSIGN = 'task:assign',
  INTEGRATION_READ = 'integration:read',
  INTEGRATION_MANAGE = 'integration:manage',
  INTEGRATION_DELETE = 'integration:delete',
  REPORT_READ = 'report:read',
  REPORT_CREATE = 'report:create',
  REPORT_DELETE = 'report:delete',
  TEAM_READ = 'team:read',
  TEAM_INVITE = 'team:invite',
  TEAM_REMOVE = 'team:remove',
  TEAM_MANAGE_ROLES = 'team:manage_roles',
  SYSTEM_ADMIN = 'system:admin',
  SYSTEM_SETTINGS = 'system:settings'
}

interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  role: TeamRole;
  permissions: Permission[];
  joinedAt: Date;
  invitedBy?: string;
  status: 'active' | 'pending' | 'suspended';
  lastActivity?: Date;
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
  };
}

interface Team {
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
  members: TeamMember[];
  stats: {
    totalMembers: number;
    activeMembers: number;
    pendingInvites: number;
  };
}

interface ActivityLog {
  id: string;
  userId: string;
  teamId: string;
  action: string;
  resourceType: 'email' | 'task' | 'integration' | 'report' | 'team';
  resourceId?: string;
  metadata?: any;
  timestamp: Date;
  userName: string;
}

const TeamCollaborationPage: React.FC = () => {
  const { t } = useTranslation();
  const [tabValue, setTabValue] = useState(0);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  // Form states
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>(TeamRole.MEMBER);

  // Load teams and related data
  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      loadActivityLogs(selectedTeam.id);
    }
  }, [selectedTeam]);

  const loadTeams = async () => {
    try {
      setLoading(true);
      // Mock data for demonstration
      const mockTeams: Team[] = [
        {
          id: '1',
          name: 'Marketing Team',
          description: 'Email marketing and campaigns',
          ownerId: 'user1',
          isDefault: true,
          settings: {
            emailSharing: true,
            taskSharing: true,
            integrationSharing: false,
            reportSharing: true,
            memberCanInvite: true,
            requireApproval: false
          },
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-15'),
          members: [
            {
              id: 'm1',
              userId: 'user1',
              teamId: '1',
              role: TeamRole.OWNER,
              permissions: Object.values(Permission),
              joinedAt: new Date('2024-01-01'),
              status: 'active',
              lastActivity: new Date('2024-01-15T10:30:00Z'),
              user: {
                id: 'user1',
                email: 'john@company.com',
                name: 'John Smith',
                avatar: '/avatars/john.jpg'
              }
            },
            {
              id: 'm2',
              userId: 'user2',
              teamId: '1',
              role: TeamRole.ADMIN,
              permissions: [Permission.EMAIL_READ, Permission.EMAIL_WRITE, Permission.TASK_READ],
              joinedAt: new Date('2024-01-05'),
              status: 'active',
              lastActivity: new Date('2024-01-14T15:20:00Z'),
              user: {
                id: 'user2',
                email: 'sarah@company.com',
                name: 'Sarah Johnson'
              }
            },
            {
              id: 'm3',
              userId: 'user3',
              teamId: '1',
              role: TeamRole.MEMBER,
              permissions: [Permission.EMAIL_READ, Permission.TASK_READ],
              joinedAt: new Date('2024-01-10'),
              status: 'pending',
              user: {
                id: 'user3',
                email: 'mike@company.com',
                name: 'Mike Wilson'
              }
            }
          ],
          stats: {
            totalMembers: 3,
            activeMembers: 2,
            pendingInvites: 1
          }
        }
      ];

      setTeams(mockTeams);
      if (mockTeams.length > 0) {
        setSelectedTeam(mockTeams[0]);
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadActivityLogs = async (teamId: string) => {
    try {
      // Mock activity logs
      const mockLogs: ActivityLog[] = [
        {
          id: '1',
          userId: 'user1',
          teamId,
          action: 'member_invited',
          resourceType: 'team',
          metadata: { inviteeEmail: 'mike@company.com', role: 'member' },
          timestamp: new Date('2024-01-10T14:30:00Z'),
          userName: 'John Smith'
        },
        {
          id: '2',
          userId: 'user2',
          teamId,
          action: 'task_created',
          resourceType: 'task',
          resourceId: 'task1',
          metadata: { taskTitle: 'Review email campaign' },
          timestamp: new Date('2024-01-12T09:15:00Z'),
          userName: 'Sarah Johnson'
        }
      ];
      setActivityLogs(mockLogs);
    } catch (error) {
      console.error('Failed to load activity logs:', error);
    }
  };

  const handleInviteMember = async () => {
    try {
      if (!selectedTeam || !inviteEmail) return;

      // TODO: Implement API call
      console.log('Inviting member:', { email: inviteEmail, role: inviteRole });

      setInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole(TeamRole.MEMBER);

      // Reload team data
      await loadTeams();
    } catch (error) {
      console.error('Failed to invite member:', error);
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    if (!selectedTeam) return;

    if (window.confirm(t('team.confirmRemoveMember', { name: member.user.name }))) {
      try {
        // TODO: Implement API call
        console.log('Removing member:', member.id);
        await loadTeams();
      } catch (error) {
        console.error('Failed to remove member:', error);
      }
    }
  };

  const handleUpdateRole = async (member: TeamMember, newRole: TeamRole) => {
    try {
      // TODO: Implement API call
      console.log('Updating role:', { memberId: member.id, newRole });
      await loadTeams();
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const getRoleColor = (role: TeamRole) => {
    switch (role) {
      case TeamRole.OWNER:
        return 'primary';
      case TeamRole.ADMIN:
        return 'secondary';
      case TeamRole.MANAGER:
        return 'info';
      case TeamRole.MEMBER:
        return 'default';
      case TeamRole.VIEWER:
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircleIcon color="success" />;
      case 'pending':
        return <PendingIcon color="warning" />;
      case 'suspended':
        return <ErrorIcon color="error" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          {t('team.title')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setSettingsDialogOpen(true)}
            disabled={!selectedTeam}
          >
            {t('team.settings')}
          </Button>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setInviteDialogOpen(true)}
            disabled={!selectedTeam}
          >
            {t('team.inviteMember')}
          </Button>
        </Box>
      </Box>

      {/* Team Selection */}
      {teams.length > 1 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {teams.map((team) => (
            <Grid item xs={12} md={6} lg={4} key={team.id}>
              <Card
                sx={{
                  cursor: 'pointer',
                  border: selectedTeam?.id === team.id ? 2 : 1,
                  borderColor: selectedTeam?.id === team.id ? 'primary.main' : 'divider'
                }}
                onClick={() => setSelectedTeam(team)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <GroupIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">
                      {team.name}
                    </Typography>
                    {team.isDefault && (
                      <Chip label={t('team.default')} size="small" sx={{ ml: 1 }} />
                    )}
                  </Box>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    {team.description}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">
                      {t('team.members')}: {team.stats.activeMembers}/{team.stats.totalMembers}
                    </Typography>
                    {team.stats.pendingInvites > 0 && (
                      <Typography variant="body2" color="warning.main">
                        {t('team.pendingInvites')}: {team.stats.pendingInvites}
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {selectedTeam && (
        <>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
            <Tab label={t('team.members')} />
            <Tab label={t('team.permissions')} />
            <Tab label={t('team.activity')} />
          </Tabs>

          {/* Members Tab */}
          {tabValue === 0 && (
            <Card>
              <CardContent>
                <List>
                  {selectedTeam.members.map((member) => (
                    <ListItem key={member.id}>
                      <ListItemAvatar>
                        <Avatar src={member.user.avatar} alt={member.user.name}>
                          {member.user.name.charAt(0).toUpperCase()}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle1">
                              {member.user.name}
                            </Typography>
                            <Chip
                              label={member.role}
                              size="small"
                              color={getRoleColor(member.role) as any}
                            />
                            {getStatusIcon(member.status)}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="textSecondary">
                              {member.user.email}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              {t('team.joinedAt')}: {member.joinedAt.toLocaleDateString()}
                            </Typography>
                            {member.lastActivity && (
                              <Typography variant="body2" color="textSecondary">
                                {t('team.lastActivity')}: {member.lastActivity.toLocaleString()}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {member.role !== TeamRole.OWNER && (
                            <>
                              <FormControl size="small" sx={{ minWidth: 120 }}>
                                <Select
                                  value={member.role}
                                  onChange={(e) => handleUpdateRole(member, e.target.value as TeamRole)}
                                >
                                  <MenuItem value={TeamRole.ADMIN}>Admin</MenuItem>
                                  <MenuItem value={TeamRole.MANAGER}>Manager</MenuItem>
                                  <MenuItem value={TeamRole.MEMBER}>Member</MenuItem>
                                  <MenuItem value={TeamRole.VIEWER}>Viewer</MenuItem>
                                </Select>
                              </FormControl>
                              <IconButton
                                color="error"
                                onClick={() => handleRemoveMember(member)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </>
                          )}
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}

          {/* Permissions Tab */}
          {tabValue === 1 && (
            <Card>
              <CardContent>
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('team.permission')}</TableCell>
                        <TableCell>{TeamRole.OWNER}</TableCell>
                        <TableCell>{TeamRole.ADMIN}</TableCell>
                        <TableCell>{TeamRole.MANAGER}</TableCell>
                        <TableCell>{TeamRole.MEMBER}</TableCell>
                        <TableCell>{TeamRole.VIEWER}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.values(Permission).map((permission) => (
                        <TableRow key={permission}>
                          <TableCell component="th" scope="row">
                            {permission.replace(':', ' ').replace('_', ' ')}
                          </TableCell>
                          <TableCell><CheckCircleIcon color="success" /></TableCell>
                          <TableCell>
                            {[Permission.EMAIL_READ, Permission.EMAIL_WRITE, Permission.TASK_READ, Permission.TEAM_READ].includes(permission) ?
                              <CheckCircleIcon color="success" /> :
                              permission.includes('system') ? '' : <CheckCircleIcon color="success" />
                            }
                          </TableCell>
                          <TableCell>
                            {[Permission.EMAIL_READ, Permission.TASK_READ, Permission.TEAM_READ, Permission.REPORT_READ].includes(permission) ?
                              <CheckCircleIcon color="success" /> : ''
                            }
                          </TableCell>
                          <TableCell>
                            {[Permission.EMAIL_READ, Permission.TASK_READ, Permission.TEAM_READ].includes(permission) ?
                              <CheckCircleIcon color="success" /> : ''
                            }
                          </TableCell>
                          <TableCell>
                            {[Permission.EMAIL_READ, Permission.TASK_READ, Permission.TEAM_READ].includes(permission) ?
                              <CheckCircleIcon color="success" /> : ''
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}

          {/* Activity Tab */}
          {tabValue === 2 && (
            <Card>
              <CardContent>
                <List>
                  {activityLogs.map((log) => (
                    <ListItem key={log.id}>
                      <ListItemAvatar>
                        <Avatar>
                          <HistoryIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography variant="subtitle1">
                            {log.action.replace('_', ' ')} by {log.userName}
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="textSecondary">
                              {log.resourceType} • {log.timestamp.toLocaleString()}
                            </Typography>
                            {log.metadata && (
                              <Typography variant="body2" color="textSecondary">
                                {JSON.stringify(log.metadata)}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Invite Member Dialog */}
      <Dialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('team.inviteMember')}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label={t('team.email')}
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />
          <FormControl fullWidth>
            <InputLabel>{t('team.role')}</InputLabel>
            <Select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as TeamRole)}
            >
              <MenuItem value={TeamRole.ADMIN}>Admin</MenuItem>
              <MenuItem value={TeamRole.MANAGER}>Manager</MenuItem>
              <MenuItem value={TeamRole.MEMBER}>Member</MenuItem>
              <MenuItem value={TeamRole.VIEWER}>Viewer</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleInviteMember} variant="contained">
            {t('team.sendInvite')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Team Settings Dialog */}
      <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('team.settings')}</DialogTitle>
        <DialogContent>
          {selectedTeam && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('team.name')}
                  value={selectedTeam.name}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('team.description')}
                  value={selectedTeam.description || ''}
                  multiline
                  rows={3}
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  {t('team.sharingSettings')}
                </Typography>
                {/* Add sharing settings switches here */}
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained">
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TeamCollaborationPage;