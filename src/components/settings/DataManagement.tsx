import React, { useState, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  FormControlLabel,
  Checkbox,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  CloudDownload as CloudDownloadIcon,
  Backup as BackupIcon,
  Restore as RestoreIcon,
  DeleteSweep as DeleteSweepIcon,
  Storage as StorageIcon,
  Assessment as AssessmentIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface BackupItem {
  id: string;
  name: string;
  type: 'full' | 'incremental' | 'settings' | 'data';
  size: string;
  createdAt: Date;
  status: 'completed' | 'failed' | 'in_progress';
  description: string;
}

interface DataExportTask {
  id: string;
  name: string;
  type: 'emails' | 'analysis' | 'reports' | 'settings' | 'all';
  format: 'JSON' | 'CSV' | 'PDF' | 'XML';
  dateRange: {
    start: Date;
    end: Date;
  };
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  size?: string;
}

interface StorageUsage {
  category: string;
  used: number;
  total: number;
  percentage: number;
  color: string;
}

const DataManagement: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeStep, setActiveStep] = useState(0);
  const [exportDialog, setExportDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [backupDialog, setBackupDialog] = useState(false);
  const [restoreDialog, setRestoreDialog] = useState(false);

  const [backups, setBackups] = useState<BackupItem[]>([
    {
      id: '1',
      name: 'Full System Backup',
      type: 'full',
      size: '2.4 GB',
      createdAt: new Date('2024-03-10T10:30:00'),
      status: 'completed',
      description: 'Complete system backup including all emails, analysis, and settings'
    },
    {
      id: '2',
      name: 'Settings Backup',
      type: 'settings',
      size: '15.2 MB',
      createdAt: new Date('2024-03-09T15:45:00'),
      status: 'completed',
      description: 'User preferences and system configuration'
    },
    {
      id: '3',
      name: 'Incremental Backup',
      type: 'incremental',
      size: '124 MB',
      createdAt: new Date('2024-03-08T09:15:00'),
      status: 'failed',
      description: 'Changes since last full backup'
    }
  ]);

  const [exportTasks, setExportTasks] = useState<DataExportTask[]>([
    {
      id: '1',
      name: 'Q1 Email Analysis Report',
      type: 'analysis',
      format: 'PDF',
      dateRange: {
        start: new Date('2024-01-01'),
        end: new Date('2024-03-31')
      },
      status: 'completed',
      progress: 100,
      createdAt: new Date('2024-03-10T14:20:00'),
      size: '45.6 MB'
    },
    {
      id: '2',
      name: 'Email Export (CSV)',
      type: 'emails',
      format: 'CSV',
      dateRange: {
        start: new Date('2024-03-01'),
        end: new Date('2024-03-31')
      },
      status: 'running',
      progress: 67,
      createdAt: new Date('2024-03-10T16:45:00')
    }
  ]);

  const [storageUsage] = useState<StorageUsage[]>([
    {
      category: 'Emails',
      used: 1200,
      total: 2000,
      percentage: 60,
      color: theme.palette.primary.main
    },
    {
      category: 'Analysis Cache',
      used: 450,
      total: 800,
      percentage: 56,
      color: theme.palette.secondary.main
    },
    {
      category: 'Reports',
      used: 180,
      total: 500,
      percentage: 36,
      color: theme.palette.success.main
    },
    {
      category: 'System Data',
      used: 95,
      total: 200,
      percentage: 48,
      color: theme.palette.warning.main
    }
  ]);

  const getStatusIcon = (status: BackupItem['status'] | DataExportTask['status']) => {
    switch (status) {
      case 'completed': return <CheckCircleIcon color="success" />;
      case 'failed': return <ErrorIcon color="error" />;
      case 'in_progress':
      case 'running': return <InfoIcon color="info" />;
      case 'pending': return <WarningIcon color="warning" />;
      default: return <InfoIcon />;
    }
  };

  const getTypeChipColor = (type: BackupItem['type'] | DataExportTask['type']) => {
    switch (type) {
      case 'full': return 'primary';
      case 'incremental': return 'secondary';
      case 'settings': return 'info';
      case 'data': return 'success';
      case 'emails': return 'primary';
      case 'analysis': return 'secondary';
      case 'reports': return 'info';
      case 'all': return 'warning';
      default: return 'default';
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log('Uploading file:', file.name);
      // Handle file upload logic
    }
  };

  const handleCreateBackup = () => {
    setBackupDialog(true);
  };

  const handleExportData = () => {
    setExportDialog(true);
  };

  const handleImportData = () => {
    setImportDialog(true);
  };

  const renderStorageOverview = () => (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <StorageIcon color="primary" />
          <Typography variant="h6">Storage Usage Overview</Typography>
        </Box>

        <Grid container spacing={3}>
          {storageUsage.map((usage) => (
            <Grid item xs={12} sm={6} md={3} key={usage.category}>
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2" fontWeight={500}>
                    {usage.category}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {usage.percentage}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={usage.percentage}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: alpha(usage.color, 0.2),
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: usage.color,
                      borderRadius: 4
                    }
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  {usage.used} MB / {usage.total} MB
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

        <Alert severity="info" sx={{ mt: 2 }}>
          Total storage used: 1.9 GB / 3.5 GB (54%). Consider cleaning up old data or increasing storage capacity.
        </Alert>
      </CardContent>
    </Card>
  );

  const renderDataExport = () => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <CloudDownloadIcon color="primary" />
            <Typography variant="h6">Data Export</Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleExportData}
          >
            New Export
          </Button>
        </Box>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Format</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Progress</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {exportTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {task.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={task.type}
                      size="small"
                      color={getTypeChipColor(task.type)}
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip label={task.format} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getStatusIcon(task.status)}
                      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                        {task.status}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <LinearProgress
                        variant="determinate"
                        value={task.progress}
                        sx={{ width: 60, height: 4 }}
                      />
                      <Typography variant="body2">
                        {task.progress}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {task.size || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {task.createdAt.toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Download">
                      <IconButton size="small" disabled={task.status !== 'completed'}>
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small">
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

  const renderDataImport = () => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <CloudUploadIcon color="primary" />
            <Typography variant="h6">Data Import</Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<UploadIcon />}
            onClick={handleImportData}
          >
            Import Data
          </Button>
        </Box>

        <Alert severity="warning" sx={{ mb: 2 }}>
          Data import will merge with existing data. Please ensure your import file is compatible with the current system version.
        </Alert>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Supported Import Formats
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <CheckCircleIcon color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Email Data (PST, MBOX, EML)"
                  secondary="Outlook, Thunderbird, and standard email formats"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckCircleIcon color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Analysis Results (JSON, CSV)"
                  secondary="Previously exported analysis data"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckCircleIcon color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Settings & Configuration (JSON)"
                  secondary="User preferences and system settings"
                />
              </ListItem>
            </List>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Import Guidelines
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <InfoIcon color="info" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Maximum file size: 2 GB"
                  secondary="Larger files should be split into smaller chunks"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <InfoIcon color="info" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Data validation enabled"
                  secondary="Invalid data will be skipped with detailed logs"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <InfoIcon color="info" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Backup recommended"
                  secondary="Create a backup before importing large datasets"
                />
              </ListItem>
            </List>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderBackupManagement = () => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <BackupIcon color="primary" />
            <Typography variant="h6">Backup Management</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<RestoreIcon />}
              onClick={() => setRestoreDialog(true)}
            >
              Restore
            </Button>
            <Button
              variant="contained"
              startIcon={<BackupIcon />}
              onClick={handleCreateBackup}
            >
              Create Backup
            </Button>
          </Stack>
        </Box>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Backup Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {backups.map((backup) => (
                <TableRow key={backup.id}>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {backup.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {backup.description}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={backup.type}
                      size="small"
                      color={getTypeChipColor(backup.type)}
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </TableCell>
                  <TableCell>{backup.size}</TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getStatusIcon(backup.status)}
                      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                        {backup.status}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {backup.createdAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Download">
                      <IconButton size="small" disabled={backup.status !== 'completed'}>
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Restore">
                      <IconButton size="small" disabled={backup.status !== 'completed'}>
                        <RestoreIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small">
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Alert severity="info" sx={{ mt: 2 }}>
          Automatic backups are scheduled daily at 2:00 AM. Backups are retained for 30 days.
        </Alert>
      </CardContent>
    </Card>
  );

  const renderDataCleanup = () => (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <DeleteSweepIcon color="primary" />
          <Typography variant="h6">Data Cleanup</Typography>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Automated Cleanup Rules
            </Typography>
            <List>
              <ListItem>
                <ListItemText
                  primary="Delete emails older than 7 years"
                  secondary="Compliance with data retention policies"
                />
                <Chip label="Enabled" size="small" color="success" />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Clear analysis cache older than 30 days"
                  secondary="Free up storage space"
                />
                <Chip label="Enabled" size="small" color="success" />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Archive completed export tasks"
                  secondary="After 90 days"
                />
                <Chip label="Disabled" size="small" color="default" />
              </ListItem>
            </List>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Manual Cleanup Actions
            </Typography>
            <Stack spacing={2}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<DeleteSweepIcon />}
              >
                Clear Temporary Files (124 MB)
              </Button>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<DeleteSweepIcon />}
              >
                Clean Analysis Cache (45 MB)
              </Button>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<DeleteSweepIcon />}
              >
                Remove Old Backups (890 MB)
              </Button>
              <Button
                variant="outlined"
                fullWidth
                color="error"
                startIcon={<DeleteSweepIcon />}
              >
                Deep Clean (Reclaim 1.2 GB)
              </Button>
            </Stack>
          </Grid>
        </Grid>

        <Alert severity="warning" sx={{ mt: 2 }}>
          Deep clean operations cannot be undone. Please ensure you have recent backups before proceeding.
        </Alert>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <AssessmentIcon fontSize="large" color="primary" />
        <Typography variant="h5">Data Management</Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          {renderStorageOverview()}
        </Grid>

        <Grid item xs={12}>
          {renderDataExport()}
        </Grid>

        <Grid item xs={12}>
          {renderDataImport()}
        </Grid>

        <Grid item xs={12}>
          {renderBackupManagement()}
        </Grid>

        <Grid item xs={12}>
          {renderDataCleanup()}
        </Grid>
      </Grid>

      {/* Hidden file input for import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        style={{ display: 'none' }}
        accept=".json,.csv,.pst,.mbox,.eml"
      />

      {/* Export Dialog */}
      <Dialog
        open={exportDialog}
        onClose={() => setExportDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create Data Export</DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} orientation="vertical">
            <Step>
              <StepLabel>Select Data Type</StepLabel>
              <StepContent>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Data Type</InputLabel>
                  <Select defaultValue="emails" label="Data Type">
                    <MenuItem value="emails">Email Messages</MenuItem>
                    <MenuItem value="analysis">Analysis Results</MenuItem>
                    <MenuItem value="reports">Generated Reports</MenuItem>
                    <MenuItem value="settings">Settings & Configuration</MenuItem>
                    <MenuItem value="all">All Data</MenuItem>
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  onClick={() => setActiveStep(1)}
                  sx={{ mt: 1, mr: 1 }}
                >
                  Continue
                </Button>
              </StepContent>
            </Step>
            <Step>
              <StepLabel>Choose Format</StepLabel>
              <StepContent>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Export Format</InputLabel>
                  <Select defaultValue="JSON" label="Export Format">
                    <MenuItem value="JSON">JSON</MenuItem>
                    <MenuItem value="CSV">CSV</MenuItem>
                    <MenuItem value="PDF">PDF</MenuItem>
                    <MenuItem value="XML">XML</MenuItem>
                  </Select>
                </FormControl>
                <Box sx={{ mb: 2 }}>
                  <Button
                    variant="contained"
                    onClick={() => setActiveStep(2)}
                    sx={{ mt: 1, mr: 1 }}
                  >
                    Continue
                  </Button>
                  <Button onClick={() => setActiveStep(0)} sx={{ mt: 1, mr: 1 }}>
                    Back
                  </Button>
                </Box>
              </StepContent>
            </Step>
            <Step>
              <StepLabel>Configure Options</StepLabel>
              <StepContent>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      label="Start Date"
                      type="date"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="End Date"
                      type="date"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={<Checkbox defaultChecked />}
                      label="Include attachments"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={<Checkbox />}
                      label="Compress export file"
                    />
                  </Grid>
                </Grid>
                <Box sx={{ mb: 2 }}>
                  <Button
                    variant="contained"
                    onClick={() => setExportDialog(false)}
                    sx={{ mt: 1, mr: 1 }}
                  >
                    Start Export
                  </Button>
                  <Button onClick={() => setActiveStep(1)} sx={{ mt: 1, mr: 1 }}>
                    Back
                  </Button>
                </Box>
              </StepContent>
            </Step>
          </Stepper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog
        open={importDialog}
        onClose={() => setImportDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Import Data</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Select a file to import. The system will validate the format and content before processing.
          </Alert>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => fileInputRef.current?.click()}
            sx={{ mb: 2 }}
          >
            Choose File
          </Button>
          <FormControlLabel
            control={<Checkbox />}
            label="Create backup before import"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialog(false)}>Cancel</Button>
          <Button variant="contained">Import</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DataManagement;