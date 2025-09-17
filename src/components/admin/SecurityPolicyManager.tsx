import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControl,
  FormControlLabel,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  Button,
  Alert,
  Card,
  CardContent,
  Grid,
  Slider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  useTheme,
  alpha
} from '@mui/material';
import {
  Shield as ShieldIcon,
  Lock as LockIcon,
  Security as SecurityIcon,
  Warning as WarningIcon,
  VpnKey as VpnKeyIcon,
  AccessTime as AccessTimeIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  AdminPanelSettings as AdminIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventReuse: number;
  expirationDays: number;
}

interface SessionPolicy {
  maxDuration: number; // in hours
  idleTimeout: number; // in minutes
  maxConcurrentSessions: number;
  requireReauthentication: boolean;
  reauthenticationInterval: number; // in hours
}

interface AccessPolicy {
  allowedIpRanges: string[];
  blockedIpRanges: string[];
  allowedCountries: string[];
  blockedCountries: string[];
  requireMFA: boolean;
  allowedMFAMethods: string[];
  maxFailedAttempts: number;
  lockoutDuration: number; // in minutes
}

interface AuditPolicy {
  enabled: boolean;
  retentionDays: number;
  logLevels: string[];
  realTimeAlerts: boolean;
  alertThreshold: number;
  exportEnabled: boolean;
  compressionEnabled: boolean;
}

interface CompliancePolicy {
  gdprCompliance: boolean;
  hipaaCompliance: boolean;
  sox404Compliance: boolean;
  dataRetentionDays: number;
  automaticDeletion: boolean;
  encryptionRequired: boolean;
  backupEncryption: boolean;
}

interface SecurityRule {
  id: string;
  name: string;
  description: string;
  type: 'access' | 'behavior' | 'data' | 'network';
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  conditions: any;
  actions: string[];
  createdAt: Date;
  updatedAt: Date;
}

const SecurityPolicyManager: React.FC = () => {
  const { t: _t } = useTranslation();
  const theme = useTheme();

  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy>({
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventReuse: 5,
    expirationDays: 90
  });

  const [sessionPolicy, setSessionPolicy] = useState<SessionPolicy>({
    maxDuration: 8,
    idleTimeout: 30,
    maxConcurrentSessions: 3,
    requireReauthentication: true,
    reauthenticationInterval: 4
  });

  const [accessPolicy, setAccessPolicy] = useState<AccessPolicy>({
    allowedIpRanges: ['192.168.1.0/24', '10.0.0.0/8'],
    blockedIpRanges: [],
    allowedCountries: ['US', 'CA', 'GB'],
    blockedCountries: ['CN', 'RU'],
    requireMFA: true,
    allowedMFAMethods: ['totp', 'sms', 'email'],
    maxFailedAttempts: 5,
    lockoutDuration: 15
  });

  const [_auditPolicy, _setAuditPolicy] = useState<AuditPolicy>({
    enabled: true,
    retentionDays: 90,
    logLevels: ['info', 'warn', 'error'],
    realTimeAlerts: true,
    alertThreshold: 10,
    exportEnabled: true,
    compressionEnabled: true
  });

  const [compliancePolicy, setCompliancePolicy] = useState<CompliancePolicy>({
    gdprCompliance: true,
    hipaaCompliance: false,
    sox404Compliance: false,
    dataRetentionDays: 2555, // 7 years
    automaticDeletion: true,
    encryptionRequired: true,
    backupEncryption: true
  });

  const [securityRules, setSecurityRules] = useState<SecurityRule[]>([]);
  const [editRuleDialog, setEditRuleDialog] = useState(false);
  const [selectedRule, setSelectedRule] = useState<SecurityRule | null>(null);
  const [showSensitiveData, setShowSensitiveData] = useState(false);

  useEffect(() => {
    initializeSecurityRules();
  }, []);

  const initializeSecurityRules = () => {
    const mockRules: SecurityRule[] = [
      {
        id: 'rule1',
        name: 'Suspicious Login Pattern',
        description: 'Detect multiple failed login attempts from same IP',
        type: 'access',
        severity: 'high',
        enabled: true,
        conditions: {
          failedAttempts: 5,
          timeWindow: '5 minutes',
          sameIP: true
        },
        actions: ['block_ip', 'alert_admin', 'log_incident'],
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-02-01')
      },
      {
        id: 'rule2',
        name: 'Unusual Data Access',
        description: 'Alert when user accesses more than 100 emails per minute',
        type: 'behavior',
        severity: 'medium',
        enabled: true,
        conditions: {
          emailsAccessed: 100,
          timeWindow: '1 minute'
        },
        actions: ['alert_admin', 'log_incident', 'require_mfa'],
        createdAt: new Date('2024-01-20'),
        updatedAt: new Date('2024-01-20')
      },
      {
        id: 'rule3',
        name: 'Data Exfiltration Prevention',
        description: 'Block bulk email exports exceeding limits',
        type: 'data',
        severity: 'critical',
        enabled: true,
        conditions: {
          exportSize: '10MB',
          timeWindow: '1 hour'
        },
        actions: ['block_action', 'alert_admin', 'log_incident', 'notify_compliance'],
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-02-01')
      },
      {
        id: 'rule4',
        name: 'Off-Hours Access',
        description: 'Monitor access outside business hours',
        type: 'access',
        severity: 'low',
        enabled: false,
        conditions: {
          businessHours: '9:00-17:00',
          timezone: 'UTC',
          weekdaysOnly: true
        },
        actions: ['alert_admin', 'log_incident'],
        createdAt: new Date('2024-02-05'),
        updatedAt: new Date('2024-02-10')
      }
    ];

    setSecurityRules(mockRules);
  };

  const handleSavePolicies = () => {
    // In real implementation, this would save to backend
    console.log('Saving security policies:', {
      passwordPolicy,
      sessionPolicy,
      accessPolicy,
      _auditPolicy,
      compliancePolicy
    });
  };

  const handleRuleToggle = (ruleId: string, enabled: boolean) => {
    setSecurityRules(prev => prev.map(rule =>
      rule.id === ruleId ? { ...rule, enabled } : rule
    ));
  };

  const handleEditRule = (rule: SecurityRule) => {
    setSelectedRule(rule);
    setEditRuleDialog(true);
  };

  const getSeverityColor = (severity: SecurityRule['severity']) => {
    switch (severity) {
      case 'critical': return theme.palette.error.main;
      case 'high': return theme.palette.warning.main;
      case 'medium': return theme.palette.info.main;
      case 'low': return theme.palette.success.main;
      default: return theme.palette.grey[500];
    }
  };

  const getTypeIcon = (type: SecurityRule['type']) => {
    switch (type) {
      case 'access': return <LockIcon />;
      case 'behavior': return <AdminIcon />;
      case 'data': return <ShieldIcon />;
      case 'network': return <SecurityIcon />;
      default: return <WarningIcon />;
    }
  };

  const renderPasswordPolicyCard = () => (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <VpnKeyIcon color="primary" />
          <Typography variant="h6">Password Policy</Typography>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Minimum Length"
              type="number"
              value={passwordPolicy.minLength}
              onChange={(e) => setPasswordPolicy(prev => ({
                ...prev,
                minLength: parseInt(e.target.value) || 8
              }))}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Expiration (days)"
              type="number"
              value={passwordPolicy.expirationDays}
              onChange={(e) => setPasswordPolicy(prev => ({
                ...prev,
                expirationDays: parseInt(e.target.value) || 90
              }))}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12}>
            <Box display="flex" flexWrap="wrap" gap={1}>
              <FormControlLabel
                control={
                  <Switch
                    checked={passwordPolicy.requireUppercase}
                    onChange={(e) => setPasswordPolicy(prev => ({
                      ...prev,
                      requireUppercase: e.target.checked
                    }))}
                  />
                }
                label="Require Uppercase"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={passwordPolicy.requireLowercase}
                    onChange={(e) => setPasswordPolicy(prev => ({
                      ...prev,
                      requireLowercase: e.target.checked
                    }))}
                  />
                }
                label="Require Lowercase"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={passwordPolicy.requireNumbers}
                    onChange={(e) => setPasswordPolicy(prev => ({
                      ...prev,
                      requireNumbers: e.target.checked
                    }))}
                  />
                }
                label="Require Numbers"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={passwordPolicy.requireSpecialChars}
                    onChange={(e) => setPasswordPolicy(prev => ({
                      ...prev,
                      requireSpecialChars: e.target.checked
                    }))}
                  />
                }
                label="Require Special Characters"
              />
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" gutterBottom>
              Prevent Password Reuse (last {passwordPolicy.preventReuse} passwords)
            </Typography>
            <Slider
              value={passwordPolicy.preventReuse}
              onChange={(_, value) => setPasswordPolicy(prev => ({
                ...prev,
                preventReuse: value as number
              }))}
              min={0}
              max={10}
              marks
              valueLabelDisplay="auto"
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderSessionPolicyCard = () => (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <AccessTimeIcon color="primary" />
          <Typography variant="h6">Session Policy</Typography>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Max Session Duration (hours)"
              type="number"
              value={sessionPolicy.maxDuration}
              onChange={(e) => setSessionPolicy(prev => ({
                ...prev,
                maxDuration: parseInt(e.target.value) || 8
              }))}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Idle Timeout (minutes)"
              type="number"
              value={sessionPolicy.idleTimeout}
              onChange={(e) => setSessionPolicy(prev => ({
                ...prev,
                idleTimeout: parseInt(e.target.value) || 30
              }))}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Max Concurrent Sessions"
              type="number"
              value={sessionPolicy.maxConcurrentSessions}
              onChange={(e) => setSessionPolicy(prev => ({
                ...prev,
                maxConcurrentSessions: parseInt(e.target.value) || 3
              }))}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Re-authentication Interval (hours)"
              type="number"
              value={sessionPolicy.reauthenticationInterval}
              onChange={(e) => setSessionPolicy(prev => ({
                ...prev,
                reauthenticationInterval: parseInt(e.target.value) || 4
              }))}
              fullWidth
              size="small"
              disabled={!sessionPolicy.requireReauthentication}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={sessionPolicy.requireReauthentication}
                  onChange={(e) => setSessionPolicy(prev => ({
                    ...prev,
                    requireReauthentication: e.target.checked
                  }))}
                />
              }
              label="Require Periodic Re-authentication"
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderAccessPolicyCard = () => (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <SecurityIcon color="primary" />
          <Typography variant="h6">Access Control Policy</Typography>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Max Failed Attempts"
              type="number"
              value={accessPolicy.maxFailedAttempts}
              onChange={(e) => setAccessPolicy(prev => ({
                ...prev,
                maxFailedAttempts: parseInt(e.target.value) || 5
              }))}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Lockout Duration (minutes)"
              type="number"
              value={accessPolicy.lockoutDuration}
              onChange={(e) => setAccessPolicy(prev => ({
                ...prev,
                lockoutDuration: parseInt(e.target.value) || 15
              }))}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={accessPolicy.requireMFA}
                  onChange={(e) => setAccessPolicy(prev => ({
                    ...prev,
                    requireMFA: e.target.checked
                  }))}
                />
              }
              label="Require Multi-Factor Authentication"
            />
          </Grid>
          {accessPolicy.requireMFA && (
            <Grid item xs={12}>
              <Typography variant="body2" gutterBottom>
                Allowed MFA Methods
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {['totp', 'sms', 'email', 'yubikey'].map(method => (
                  <FormControlLabel
                    key={method}
                    control={
                      <Switch
                        checked={accessPolicy.allowedMFAMethods.includes(method)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAccessPolicy(prev => ({
                              ...prev,
                              allowedMFAMethods: [...prev.allowedMFAMethods, method]
                            }));
                          } else {
                            setAccessPolicy(prev => ({
                              ...prev,
                              allowedMFAMethods: prev.allowedMFAMethods.filter(m => m !== method)
                            }));
                          }
                        }}
                        size="small"
                      />
                    }
                    label={method.toUpperCase()}
                  />
                ))}
              </Box>
            </Grid>
          )}
          <Grid item xs={12} sm={6}>
            <TextField
              label="Allowed IP Ranges"
              value={showSensitiveData ? accessPolicy.allowedIpRanges.join(', ') : '••••••••'}
              fullWidth
              size="small"
              multiline
              rows={2}
              InputProps={{
                endAdornment: (
                  <IconButton
                    size="small"
                    onClick={() => setShowSensitiveData(!showSensitiveData)}
                  >
                    {showSensitiveData ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Blocked Countries"
              value={accessPolicy.blockedCountries.join(', ')}
              fullWidth
              size="small"
              multiline
              rows={2}
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderCompliancePolicyCard = () => (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <ShieldIcon color="primary" />
          <Typography variant="h6">Compliance Policy</Typography>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Compliance Standards
            </Typography>
            <Box display="flex" gap={2} flexWrap="wrap">
              <FormControlLabel
                control={
                  <Switch
                    checked={compliancePolicy.gdprCompliance}
                    onChange={(e) => setCompliancePolicy(prev => ({
                      ...prev,
                      gdprCompliance: e.target.checked
                    }))}
                  />
                }
                label="GDPR Compliance"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compliancePolicy.hipaaCompliance}
                    onChange={(e) => setCompliancePolicy(prev => ({
                      ...prev,
                      hipaaCompliance: e.target.checked
                    }))}
                  />
                }
                label="HIPAA Compliance"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compliancePolicy.sox404Compliance}
                    onChange={(e) => setCompliancePolicy(prev => ({
                      ...prev,
                      sox404Compliance: e.target.checked
                    }))}
                  />
                }
                label="SOX 404 Compliance"
              />
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Data Retention (days)"
              type="number"
              value={compliancePolicy.dataRetentionDays}
              onChange={(e) => setCompliancePolicy(prev => ({
                ...prev,
                dataRetentionDays: parseInt(e.target.value) || 2555
              }))}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12}>
            <Box display="flex" gap={2} flexWrap="wrap">
              <FormControlLabel
                control={
                  <Switch
                    checked={compliancePolicy.automaticDeletion}
                    onChange={(e) => setCompliancePolicy(prev => ({
                      ...prev,
                      automaticDeletion: e.target.checked
                    }))}
                  />
                }
                label="Automatic Data Deletion"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compliancePolicy.encryptionRequired}
                    onChange={(e) => setCompliancePolicy(prev => ({
                      ...prev,
                      encryptionRequired: e.target.checked
                    }))}
                  />
                }
                label="Require Encryption"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compliancePolicy.backupEncryption}
                    onChange={(e) => setCompliancePolicy(prev => ({
                      ...prev,
                      backupEncryption: e.target.checked
                    }))}
                  />
                }
                label="Encrypt Backups"
              />
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderSecurityRulesCard = () => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <WarningIcon color="primary" />
            <Typography variant="h6">Security Rules</Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => {
              setSelectedRule(null);
              setEditRuleDialog(true);
            }}
          >
            Add Rule
          </Button>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Rule Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {securityRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {rule.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {rule.description}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getTypeIcon(rule.type)}
                      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                        {rule.type}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={rule.severity}
                      size="small"
                      sx={{
                        backgroundColor: alpha(getSeverityColor(rule.severity), 0.1),
                        color: getSeverityColor(rule.severity),
                        textTransform: 'capitalize'
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.enabled}
                      onChange={(e) => handleRuleToggle(rule.id, e.target.checked)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleEditRule(rule)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={() => setSecurityRules(prev => prev.filter(r => r.id !== rule.id))}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">Security Policies</Typography>
        <Button variant="contained" onClick={handleSavePolicies}>
          Save All Policies
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Configure security policies to enforce compliance and protect your Email Assist system.
        Changes will take effect immediately and apply to all users.
      </Alert>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={6}>
          {renderPasswordPolicyCard()}
        </Grid>
        <Grid item xs={12} lg={6}>
          {renderSessionPolicyCard()}
        </Grid>
        <Grid item xs={12} lg={6}>
          {renderAccessPolicyCard()}
        </Grid>
        <Grid item xs={12} lg={6}>
          {renderCompliancePolicyCard()}
        </Grid>
        <Grid item xs={12}>
          {renderSecurityRulesCard()}
        </Grid>
      </Grid>

      {/* Rule Edit Dialog */}
      <Dialog
        open={editRuleDialog}
        onClose={() => setEditRuleDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedRule ? 'Edit Security Rule' : 'Add Security Rule'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            <TextField
              label="Rule Name"
              defaultValue={selectedRule?.name}
              fullWidth
            />
            <TextField
              label="Description"
              defaultValue={selectedRule?.description}
              fullWidth
              multiline
              rows={2}
            />
            <Box display="flex" gap={2}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select defaultValue={selectedRule?.type || 'access'}>
                  <MenuItem value="access">Access Control</MenuItem>
                  <MenuItem value="behavior">Behavior Analysis</MenuItem>
                  <MenuItem value="data">Data Protection</MenuItem>
                  <MenuItem value="network">Network Security</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Severity</InputLabel>
                <Select defaultValue={selectedRule?.severity || 'medium'}>
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Typography variant="subtitle2" gutterBottom>
              Actions to Take
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {['log_incident', 'alert_admin', 'block_ip', 'block_action', 'require_mfa', 'notify_compliance'].map(action => (
                <FormControlLabel
                  key={action}
                  control={
                    <Switch
                      defaultChecked={selectedRule?.actions.includes(action)}
                      size="small"
                    />
                  }
                  label={action.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditRuleDialog(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => setEditRuleDialog(false)}>
            Save Rule
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SecurityPolicyManager;