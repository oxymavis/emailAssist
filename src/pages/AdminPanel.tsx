import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Paper,
  Alert,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  alpha
} from '@mui/material';
import {
  AdminPanelSettings as AdminIcon,
  Security as SecurityIcon,
  People as PeopleIcon,
  VpnKey as VpnKeyIcon,
  Shield as ShieldIcon,
  Assessment as AssessmentIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Timeline as TimelineIcon,
  Storage as StorageIcon,
  NetworkCheck as NetworkIcon,
  Backup as BackupIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

import UserPermissionManager from '@/components/admin/UserPermissionManager';
import RolePermissionMatrix from '@/components/admin/RolePermissionMatrix';
import SecurityPolicyManager from '@/components/admin/SecurityPolicyManager';

interface SystemMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  description: string;
}

interface SecurityAlert {
  id: string;
  type: 'security' | 'compliance' | 'system' | 'access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  timestamp: Date;
  resolved: boolean;
  assignedTo?: string;
}

interface AuditActivity {
  id: string;
  user: string;
  action: string;
  target: string;
  timestamp: Date;
  result: 'success' | 'failure' | 'warning';
  ipAddress: string;
  userAgent: string;
}

const AdminPanel: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();

  const [activeTab, setActiveTab] = useState(0);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetric[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [auditActivities, setAuditActivities] = useState<AuditActivity[]>([]);
  const [alertDialog, setAlertDialog] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);

  useEffect(() => {
    initializeDashboardData();
  }, []);

  const initializeDashboardData = () => {
    // Initialize system metrics
    const mockMetrics: SystemMetric[] = [
      {
        id: 'users_active',
        name: 'Active Users',
        value: 42,
        unit: 'users',
        status: 'good',
        trend: 'up',
        description: 'Users active in the last 24 hours'
      },
      {
        id: 'failed_logins',
        name: 'Failed Login Attempts',
        value: 3,
        unit: 'attempts',
        status: 'good',
        trend: 'down',
        description: 'Failed login attempts in the last hour'
      },
      {
        id: 'security_score',
        name: 'Security Score',
        value: 87,
        unit: '%',
        status: 'good',
        trend: 'stable',
        description: 'Overall system security health score'
      },
      {
        id: 'compliance_score',
        name: 'Compliance Score',
        value: 94,
        unit: '%',
        status: 'good',
        trend: 'up',
        description: 'Compliance with enabled standards'
      },
      {
        id: 'data_usage',
        name: 'Storage Usage',
        value: 68,
        unit: '%',
        status: 'warning',
        trend: 'up',
        description: 'Current storage utilization'
      },
      {
        id: 'api_calls',
        name: 'API Calls',
        value: 15420,
        unit: 'calls/hour',
        status: 'good',
        trend: 'stable',
        description: 'API requests in the current hour'
      }
    ];

    // Initialize security alerts
    const mockAlerts: SecurityAlert[] = [
      {
        id: 'alert1',
        type: 'security',
        severity: 'medium',
        title: 'Unusual Login Pattern Detected',
        description: 'Multiple login attempts from new IP address 203.0.113.42',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        resolved: false,
        assignedTo: 'Security Team'
      },
      {
        id: 'alert2',
        type: 'compliance',
        severity: 'low',
        title: 'Data Retention Policy Reminder',
        description: '127 emails are approaching the 7-year retention limit',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
        resolved: false
      },
      {
        id: 'alert3',
        type: 'system',
        severity: 'high',
        title: 'Storage Capacity Warning',
        description: 'Email storage is at 68% capacity. Consider archiving old emails.',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
        resolved: false,
        assignedTo: 'System Admin'
      },
      {
        id: 'alert4',
        type: 'access',
        severity: 'critical',
        title: 'Privileged Account Compromise Attempt',
        description: 'Failed admin login attempts detected from unknown location',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
        resolved: true,
        assignedTo: 'Incident Response'
      }
    ];

    // Initialize audit activities
    const mockActivities: AuditActivity[] = [
      {
        id: 'audit1',
        user: 'alice.chen@company.com',
        action: 'Permission Modified',
        target: 'Bob Johnson - Reports Management',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        result: 'success',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      },
      {
        id: 'audit2',
        user: 'system@company.com',
        action: 'Security Rule Triggered',
        target: 'Bulk Email Access - Rule: Data Exfiltration Prevention',
        timestamp: new Date(Date.now() - 45 * 60 * 1000),
        result: 'warning',
        ipAddress: '203.0.113.42',
        userAgent: 'Python-requests/2.28.0'
      },
      {
        id: 'audit3',
        user: 'carol.williams@company.com',
        action: 'Data Export',
        target: 'Email Analytics Report - Q1 2024',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
        result: 'success',
        ipAddress: '192.168.1.150',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      {
        id: 'audit4',
        user: 'unknown@external.com',
        action: 'Login Attempt',
        target: 'Admin Panel Access',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        result: 'failure',
        ipAddress: '203.0.113.42',
        userAgent: 'curl/7.68.0'
      },
      {
        id: 'audit5',
        user: 'alice.chen@company.com',
        action: 'Role Created',
        target: 'New Role: Data Analyst',
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
        result: 'success',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      }
    ];

    setSystemMetrics(mockMetrics);
    setSecurityAlerts(mockAlerts);
    setAuditActivities(mockActivities);
  };

  const getStatusIcon = (status: SystemMetric['status']) => {
    switch (status) {
      case 'good': return <CheckCircleIcon color="success" />;
      case 'warning': return <WarningIcon color="warning" />;
      case 'critical': return <ErrorIcon color="error" />;
      default: return <InfoIcon color="info" />;
    }
  };

  const getSeverityColor = (severity: SecurityAlert['severity']) => {
    switch (severity) {
      case 'critical': return theme.palette.error.main;
      case 'high': return theme.palette.warning.main;
      case 'medium': return theme.palette.info.main;
      case 'low': return theme.palette.success.main;
      default: return theme.palette.grey[500];
    }
  };

  const getResultColor = (result: AuditActivity['result']) => {
    switch (result) {
      case 'success': return 'success';
      case 'failure': return 'error';
      case 'warning': return 'warning';
      default: return 'default';
    }
  };

  const handleAlertClick = (alert: SecurityAlert) => {
    setSelectedAlert(alert);
    setAlertDialog(true);
  };

  const resolveAlert = (alertId: string) => {
    setSecurityAlerts(prev => prev.map(alert =>
      alert.id === alertId ? { ...alert, resolved: true } : alert
    ));
    setAlertDialog(false);
  };

  const renderDashboardTab = () => (
    <Box>
      <Typography variant="h5" gutterBottom>
        System Overview
      </Typography>

      {/* System Metrics */}
      <Grid container spacing={3} mb={3}>
        {systemMetrics.map((metric) => (
          <Grid item xs={12} sm={6} md={4} key={metric.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box flex={1}>
                    <Typography variant="h4" component="div" gutterBottom>
                      {metric.value}
                      <Typography component="span" variant="body2" color="text.secondary" ml={1}>
                        {metric.unit}
                      </Typography>
                    </Typography>
                    <Typography variant="body1" fontWeight={500} gutterBottom>
                      {metric.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {metric.description}
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    {getStatusIcon(metric.status)}
                    <TimelineIcon
                      color={
                        metric.trend === 'up' ? 'success' :
                        metric.trend === 'down' ? 'error' : 'action'
                      }
                    />
                  </Box>
                </Box>
                {metric.unit === '%' && (
                  <LinearProgress
                    variant="determinate"
                    value={metric.value}
                    sx={{
                      mt: 1,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: alpha(getSeverityColor(
                        metric.value > 90 ? 'critical' :
                        metric.value > 70 ? 'high' :
                        metric.value > 50 ? 'medium' : 'low'
                      ), 0.2)
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Security Alerts */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" display="flex" alignItems="center" gap={1}>
              <WarningIcon color="warning" />
              Recent Security Alerts
            </Typography>
            <Chip
              label={`${securityAlerts.filter(a => !a.resolved).length} Active`}
              color="warning"
              size="small"
            />
          </Box>

          <List>
            {securityAlerts.slice(0, 5).map((alert, index) => (
              <React.Fragment key={alert.id}>
                <ListItem
                  button
                  onClick={() => handleAlertClick(alert)}
                  sx={{
                    backgroundColor: alert.resolved ? 'transparent' : alpha(getSeverityColor(alert.severity), 0.1),
                    borderRadius: 1,
                    mb: 1
                  }}
                >
                  <ListItemIcon>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: getSeverityColor(alert.severity),
                        opacity: alert.resolved ? 0.5 : 1
                      }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography
                          variant="body2"
                          fontWeight={500}
                          sx={{ opacity: alert.resolved ? 0.6 : 1 }}
                        >
                          {alert.title}
                        </Typography>
                        <Chip
                          label={alert.type}
                          size="small"
                          variant="outlined"
                          sx={{ textTransform: 'capitalize', opacity: alert.resolved ? 0.6 : 1 }}
                        />
                        {alert.resolved && (
                          <Chip label="Resolved" size="small" color="success" />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ opacity: alert.resolved ? 0.6 : 1 }}>
                          {alert.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {alert.timestamp.toLocaleString()}
                          {alert.assignedTo && ` • Assigned to: ${alert.assignedTo}`}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
                {index < securityAlerts.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* Recent Audit Activities */}
      <Card>
        <CardContent>
          <Typography variant="h6" display="flex" alignItems="center" gap={1} mb={2}>
            <AssessmentIcon color="primary" />
            Recent Audit Activities
          </Typography>

          <List>
            {auditActivities.slice(0, 8).map((activity, index) => (
              <React.Fragment key={activity.id}>
                <ListItem>
                  <ListItemIcon>
                    <Chip
                      label={activity.result}
                      size="small"
                      color={getResultColor(activity.result)}
                      sx={{ minWidth: 70, textTransform: 'capitalize' }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2">
                        <strong>{activity.user}</strong> performed <strong>{activity.action}</strong>
                      </Typography>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Target: {activity.target}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {activity.timestamp.toLocaleString()} • IP: {activity.ipAddress}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
                {index < auditActivities.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>
    </Box>
  );

  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <AdminIcon fontSize="large" color="primary" />
        <Typography variant="h4" component="h1">
          Administration Panel
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Welcome to the Email Assist administration panel. Monitor system health, manage user permissions,
        and configure security policies from this central location.
      </Alert>

      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            icon={<AssessmentIcon />}
            label="Dashboard"
            iconPosition="start"
          />
          <Tab
            icon={<PeopleIcon />}
            label="User Management"
            iconPosition="start"
          />
          <Tab
            icon={<VpnKeyIcon />}
            label="Role & Permissions"
            iconPosition="start"
          />
          <Tab
            icon={<ShieldIcon />}
            label="Security Policies"
            iconPosition="start"
          />
        </Tabs>

        <Box p={3}>
          {activeTab === 0 && renderDashboardTab()}
          {activeTab === 1 && <UserPermissionManager />}
          {activeTab === 2 && <RolePermissionMatrix />}
          {activeTab === 3 && <SecurityPolicyManager />}
        </Box>
      </Paper>

      {/* Alert Details Dialog */}
      <Dialog
        open={alertDialog}
        onClose={() => setAlertDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Security Alert Details
        </DialogTitle>
        <DialogContent>
          {selectedAlert && (
            <Box>
              <Grid container spacing={2} mb={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Type</Typography>
                  <Chip
                    label={selectedAlert.type}
                    size="small"
                    sx={{ textTransform: 'capitalize' }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Severity</Typography>
                  <Chip
                    label={selectedAlert.severity}
                    size="small"
                    sx={{
                      backgroundColor: alpha(getSeverityColor(selectedAlert.severity), 0.1),
                      color: getSeverityColor(selectedAlert.severity),
                      textTransform: 'capitalize'
                    }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Timestamp</Typography>
                  <Typography variant="body2">
                    {selectedAlert.timestamp.toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Assigned To</Typography>
                  <Typography variant="body2">
                    {selectedAlert.assignedTo || 'Unassigned'}
                  </Typography>
                </Grid>
              </Grid>

              <Typography variant="h6" gutterBottom>
                {selectedAlert.title}
              </Typography>
              <Typography variant="body1" paragraph>
                {selectedAlert.description}
              </Typography>

              {!selectedAlert.resolved && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  This alert requires attention and has not been resolved yet.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAlertDialog(false)}>
            Close
          </Button>
          {selectedAlert && !selectedAlert.resolved && (
            <Button
              variant="contained"
              onClick={() => resolveAlert(selectedAlert.id)}
            >
              Mark as Resolved
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminPanel;