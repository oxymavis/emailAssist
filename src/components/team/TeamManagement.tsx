import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Avatar,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Autocomplete,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Tab,
  Tabs,
  Badge,
  Alert,
  LinearProgress,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  People as PeopleIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  Settings as SettingsIcon,
  Shield as ShieldIcon,
  Work as WorkIcon,
  Star as StarIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  Schedule as ScheduleIcon,
  Notifications as NotificationsIcon,
  Security as SecurityIcon,
  AdminPanelSettings as Admin,
} from '@mui/icons-material';
import { useTeams } from '@/hooks/useTeams';

interface Team {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
  memberCount: number;
  status: 'active' | 'inactive' | 'archived';
  visibility: 'public' | 'private' | 'restricted';
  settings: TeamSettings;
}

interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'pending' | 'inactive';
  joinedAt: Date;
  lastActive: Date;
  permissions: string[];
  department?: string;
  position?: string;
}

interface TeamSettings {
  notifications: {
    email: boolean;
    push: boolean;
    digest: boolean;
  };
  permissions: {
    inviteMembers: boolean;
    manageRoles: boolean;
    deleteTeam: boolean;
    editSettings: boolean;
  };
  collaboration: {
    allowGuestAccess: boolean;
    requireApproval: boolean;
    autoArchive: boolean;
  };
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`team-tabpanel-${index}`}
    aria-labelledby={`team-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

const TeamManagement: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  const {
    teams,
    members,
    loading,
    createTeam,
    updateTeam,
    deleteTeam,
    inviteMember,
    removeMember,
    updateMemberRole,
    getTeamMembers,
  } = useTeams();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    visibility: 'private' as const,
  });

  const [inviteData, setInviteData] = useState({
    email: '',
    role: 'member' as const,
    message: '',
  });

  useEffect(() => {
    if (selectedTeam) {
      getTeamMembers(selectedTeam.id);
    }
  }, [selectedTeam, getTeamMembers]);

  const handleCreateTeam = async () => {
    try {
      await createTeam(formData);
      setDialogOpen(false);
      setFormData({ name: '', description: '', visibility: 'private' });
    } catch (error) {
      console.error('Failed to create team:', error);
    }
  };

  const handleInviteMember = async () => {
    if (!selectedTeam) return;

    try {
      await inviteMember(selectedTeam.id, inviteData);
      setInviteDialogOpen(false);
      setInviteData({ email: '', role: 'member', message: '' });
    } catch (error) {
      console.error('Failed to invite member:', error);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (!selectedTeam) return;

    try {
      await updateMemberRole(selectedTeam.id, memberId, newRole);
    } catch (error) {
      console.error('Failed to update member role:', error);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedTeam) return;

    try {
      await removeMember(selectedTeam.id, memberId);
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'error';
      case 'admin':
        return 'warning';
      case 'member':
        return 'primary';
      case 'viewer':
        return 'default';
      default:
        return 'default';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <StarIcon />;
      case 'admin':
        return <ShieldIcon />;
      case 'member':
        return <WorkIcon />;
      case 'viewer':
        return <PeopleIcon />;
      default:
        return <PeopleIcon />;
    }
  };

  const renderTeamsList = () => (
    <Grid container spacing={3}>
      {teams.map((team) => (
        <Grid item xs={12} sm={6} md={4} key={team.id}>
          <Card
            sx={{
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: theme.shadows[4],
              },
              border: selectedTeam?.id === team.id ? `2px solid ${theme.palette.primary.main}` : 'none',
            }}
            onClick={() => setSelectedTeam(team)}
          >
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar
                    src={team.avatar}
                    sx={{
                      bgcolor: theme.palette.primary.main,
                      width: 48,
                      height: 48,
                    }}
                  >
                    {team.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      {team.name}
                    </Typography>
                    <Chip
                      label={t(`team.status.${team.status}`)}
                      color={team.status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                </Box>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAnchorEl(e.currentTarget);
                  }}
                >
                  <MoreVertIcon />
                </IconButton>
              </Box>

              <Typography variant="body2" color="text.secondary" mb={2}>
                {team.description}
              </Typography>

              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box display="flex" alignItems="center" gap={1}>
                  <PeopleIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {team.memberCount} {t('team.members')}
                  </Typography>
                </Box>
                <Chip
                  label={t(`team.visibility.${team.visibility}`)}
                  variant="outlined"
                  size="small"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}

      {/* 添加新团队卡片 */}
      <Grid item xs={12} sm={6} md={4}>
        <Card
          sx={{
            cursor: 'pointer',
            border: `2px dashed ${theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 200,
            '&:hover': {
              borderColor: theme.palette.primary.main,
              bgcolor: theme.palette.action.hover,
            },
          }}
          onClick={() => setDialogOpen(true)}
        >
          <Box textAlign="center">
            <AddIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="h6" color="text.secondary">
              {t('team.createNew')}
            </Typography>
          </Box>
        </Card>
      </Grid>
    </Grid>
  );

  const renderTeamMembers = () => {
    if (!selectedTeam) {
      return (
        <Alert severity="info">
          {t('team.selectTeamToViewMembers')}
        </Alert>
      );
    }

    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">
            {selectedTeam.name} - {t('team.members')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setInviteDialogOpen(true)}
          >
            {t('team.inviteMember')}
          </Button>
        </Box>

        <List>
          {members.map((member, index) => (
            <React.Fragment key={member.id}>
              <ListItem>
                <ListItemAvatar>
                  <Badge
                    overlap="circular"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    badgeContent={
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: member.status === 'active' ? 'success.main' : 'grey.400',
                          border: `2px solid ${theme.palette.background.paper}`,
                        }}
                      />
                    }
                  >
                    <Avatar src={member.avatar}>
                      {member.name.charAt(0).toUpperCase()}
                    </Avatar>
                  </Badge>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="subtitle1">{member.name}</Typography>
                      <Chip
                        icon={getRoleIcon(member.role)}
                        label={t(`team.role.${member.role}`)}
                        color={getRoleColor(member.role) as any}
                        size="small"
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {member.email}
                      </Typography>
                      {member.department && (
                        <Typography variant="caption" color="text.secondary">
                          {member.department} • {member.position}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t('team.lastActive')}: {new Date(member.lastActive).toLocaleDateString()}
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Box display="flex" gap={1}>
                    <IconButton size="small">
                      <EmailIcon />
                    </IconButton>
                    {member.role !== 'owner' && (
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
              {index < members.length - 1 && <Divider variant="inset" component="li" />}
            </React.Fragment>
          ))}
        </List>
      </Box>
    );
  };

  const renderTeamSettings = () => {
    if (!selectedTeam) {
      return (
        <Alert severity="info">
          {t('team.selectTeamToManageSettings')}
        </Alert>
      );
    }

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          {selectedTeam.name} - {t('team.settings')}
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <NotificationsIcon color="primary" />
                  <Typography variant="h6">
                    {t('team.notificationSettings')}
                  </Typography>
                </Box>
                {/* 通知设置内容 */}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <SecurityIcon color="primary" />
                  <Typography variant="h6">
                    {t('team.securitySettings')}
                  </Typography>
                </Box>
                {/* 安全设置内容 */}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          {t('team.management')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          {t('team.createTeam')}
        </Button>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          aria-label="team management tabs"
        >
          <Tab label={t('team.overview')} />
          <Tab label={t('team.members')} />
          <Tab label={t('team.settings')} />
        </Tabs>
      </Box>

      <TabPanel value={activeTab} index={0}>
        {renderTeamsList()}
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {renderTeamMembers()}
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        {renderTeamSettings()}
      </TabPanel>

      {/* 创建团队对话框 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('team.createTeam')}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label={t('team.name')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label={t('team.description')}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            multiline
            rows={3}
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>{t('team.visibility.title')}</InputLabel>
            <Select
              value={formData.visibility}
              onChange={(e) => setFormData({ ...formData, visibility: e.target.value as any })}
            >
              <MenuItem value="public">{t('team.visibility.public')}</MenuItem>
              <MenuItem value="private">{t('team.visibility.private')}</MenuItem>
              <MenuItem value="restricted">{t('team.visibility.restricted')}</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleCreateTeam} variant="contained">
            {t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 邀请成员对话框 */}
      <Dialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('team.inviteMember')}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label={t('team.memberEmail')}
            value={inviteData.email}
            onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>{t('team.role.title')}</InputLabel>
            <Select
              value={inviteData.role}
              onChange={(e) => setInviteData({ ...inviteData, role: e.target.value as any })}
            >
              <MenuItem value="viewer">{t('team.role.viewer')}</MenuItem>
              <MenuItem value="member">{t('team.role.member')}</MenuItem>
              <MenuItem value="admin">{t('team.role.admin')}</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label={t('team.inviteMessage')}
            value={inviteData.message}
            onChange={(e) => setInviteData({ ...inviteData, message: e.target.value })}
            multiline
            rows={3}
            margin="normal"
            placeholder={t('team.inviteMessagePlaceholder')}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleInviteMember} variant="contained">
            {t('team.sendInvite')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 团队操作菜单 */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => setSettingsDialogOpen(true)}>
          <SettingsIcon sx={{ mr: 1 }} />
          {t('team.settings')}
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>
          <EditIcon sx={{ mr: 1 }} />
          {t('common.edit')}
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => setAnchorEl(null)} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} />
          {t('common.delete')}
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default TeamManagement;