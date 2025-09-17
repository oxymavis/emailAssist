import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Divider,
  Grid,
  Paper,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Preview as PreviewIcon,
  ExpandMore as ExpandMoreIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  Notifications as PushIcon,
  Code as CodeIcon,
  Palette as PaletteIcon,
  Send as SendIcon,
} from '@mui/icons-material';

interface NotificationTemplate {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push';
  category: string;
  enabled: boolean;
  subject?: string;
  content: string;
  variables: string[];
  htmlContent?: string;
  styling?: {
    primaryColor: string;
    fontSize: string;
    fontFamily: string;
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    usageCount: number;
    lastUsed?: Date;
  };
}

const NotificationTemplateManager: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();

  const [templates, setTemplates] = useState<NotificationTemplate[]>([
    {
      id: '1',
      name: 'New Email Alert',
      type: 'email',
      category: 'email_alerts',
      enabled: true,
      subject: 'New Email: {{subject}}',
      content: 'You have received a new email from {{sender}} with subject "{{subject}}". Priority: {{priority}}',
      variables: ['sender', 'subject', 'priority'],
      htmlContent: '<h2>New Email Alert</h2><p>From: <strong>{{sender}}</strong></p><p>Subject: {{subject}}</p>',
      styling: {
        primaryColor: '#1976d2',
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
      },
      metadata: {
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-03-10'),
        usageCount: 157,
        lastUsed: new Date('2024-03-14'),
      },
    },
    {
      id: '2',
      name: 'Analysis Complete',
      type: 'push',
      category: 'system_alerts',
      enabled: true,
      content: 'AI analysis of {{emailCount}} emails completed. {{insights}} new insights discovered.',
      variables: ['emailCount', 'insights'],
      metadata: {
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-02-01'),
        usageCount: 45,
        lastUsed: new Date('2024-03-14'),
      },
    },
    {
      id: '3',
      name: 'Security Alert',
      type: 'sms',
      category: 'security',
      enabled: true,
      content: 'Security Alert: {{alertType}} detected. Please check your account immediately.',
      variables: ['alertType'],
      metadata: {
        createdAt: new Date('2024-01-20'),
        updatedAt: new Date('2024-03-05'),
        usageCount: 12,
        lastUsed: new Date('2024-03-12'),
      },
    },
  ]);

  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [newTemplate, setNewTemplate] = useState<Partial<NotificationTemplate>>({
    type: 'email',
    category: 'email_alerts',
    enabled: true,
    variables: [],
  });

  // 模板分类
  const templateCategories = [
    { key: 'email_alerts', label: t('notifications.categories.emailAlerts') },
    { key: 'system_alerts', label: t('notifications.categories.systemAlerts') },
    { key: 'security', label: t('notifications.categories.security') },
    { key: 'workflows', label: t('notifications.categories.workflows') },
    { key: 'reports', label: t('notifications.categories.reports') },
  ];

  // 可用变量
  const availableVariables = {
    email_alerts: ['sender', 'subject', 'priority', 'timestamp', 'category'],
    system_alerts: ['emailCount', 'insights', 'analysisType', 'duration'],
    security: ['alertType', 'ipAddress', 'timestamp', 'severity'],
    workflows: ['workflowName', 'status', 'triggerType', 'data'],
    reports: ['reportName', 'period', 'emailCount', 'insights'],
  };

  // 处理模板启用/禁用
  const handleTemplateToggle = (templateId: string) => {
    setTemplates(prev => prev.map(template =>
      template.id === templateId
        ? { ...template, enabled: !template.enabled }
        : template
    ));
  };

  // 处理模板删除
  const handleDeleteTemplate = (templateId: string) => {
    setTemplates(prev => prev.filter(template => template.id !== templateId));
  };

  // 处理模板复制
  const handleCopyTemplate = (template: NotificationTemplate) => {
    const newTemplate = {
      ...template,
      id: Date.now().toString(),
      name: `${template.name} (Copy)`,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      },
    };
    setTemplates(prev => [...prev, newTemplate]);
  };

  // 处理模板保存
  const handleSaveTemplate = () => {
    if (editMode && selectedTemplate) {
      setTemplates(prev => prev.map(template =>
        template.id === selectedTemplate.id
          ? {
              ...selectedTemplate,
              metadata: {
                ...selectedTemplate.metadata,
                updatedAt: new Date(),
              },
            }
          : template
      ));
    } else {
      const template: NotificationTemplate = {
        id: Date.now().toString(),
        name: newTemplate.name || '',
        type: newTemplate.type || 'email',
        category: newTemplate.category || 'email_alerts',
        enabled: newTemplate.enabled || true,
        subject: newTemplate.subject,
        content: newTemplate.content || '',
        variables: newTemplate.variables || [],
        htmlContent: newTemplate.htmlContent,
        styling: newTemplate.styling,
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 0,
        },
      };
      setTemplates(prev => [...prev, template]);
    }
    setDialogOpen(false);
    setSelectedTemplate(null);
    setEditMode(false);
    setNewTemplate({
      type: 'email',
      category: 'email_alerts',
      enabled: true,
      variables: [],
    });
  };

  // 提取内容中的变量
  const extractVariables = (content: string) => {
    const matches = content.match(/\{\{([^}]+)\}\}/g);
    return matches ? matches.map(match => match.slice(2, -2)) : [];
  };

  // 渲染模板编辑对话框
  const renderEditDialog = () => {
    const template = editMode ? selectedTemplate : newTemplate;
    if (!template) return null;

    return (
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editMode ? t('notifications.editTemplate') : t('notifications.createTemplate')}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('notifications.templateName')}
                value={template.name || ''}
                onChange={(e) => {
                  if (editMode) {
                    setSelectedTemplate(prev => prev ? { ...prev, name: e.target.value } : null);
                  } else {
                    setNewTemplate(prev => ({ ...prev, name: e.target.value }));
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>{t('notifications.templateType')}</InputLabel>
                <Select
                  value={template.type || 'email'}
                  onChange={(e) => {
                    const type = e.target.value as 'email' | 'sms' | 'push';
                    if (editMode) {
                      setSelectedTemplate(prev => prev ? { ...prev, type } : null);
                    } else {
                      setNewTemplate(prev => ({ ...prev, type }));
                    }
                  }}
                  label={t('notifications.templateType')}
                >
                  <MenuItem value="email">
                    <Box display="flex" alignItems="center" gap={1}>
                      <EmailIcon />
                      {t('notifications.email')}
                    </Box>
                  </MenuItem>
                  <MenuItem value="sms">
                    <Box display="flex" alignItems="center" gap={1}>
                      <SmsIcon />
                      {t('notifications.sms')}
                    </Box>
                  </MenuItem>
                  <MenuItem value="push">
                    <Box display="flex" alignItems="center" gap={1}>
                      <PushIcon />
                      {t('notifications.push')}
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>{t('notifications.category')}</InputLabel>
                <Select
                  value={template.category || 'email_alerts'}
                  onChange={(e) => {
                    if (editMode) {
                      setSelectedTemplate(prev => prev ? { ...prev, category: e.target.value } : null);
                    } else {
                      setNewTemplate(prev => ({ ...prev, category: e.target.value }));
                    }
                  }}
                  label={t('notifications.category')}
                >
                  {templateCategories.map((category) => (
                    <MenuItem key={category.key} value={category.key}>
                      {category.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {template.type === 'email' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('notifications.subject')}
                  value={template.subject || ''}
                  onChange={(e) => {
                    if (editMode) {
                      setSelectedTemplate(prev => prev ? { ...prev, subject: e.target.value } : null);
                    } else {
                      setNewTemplate(prev => ({ ...prev, subject: e.target.value }));
                    }
                  }}
                  helperText={t('notifications.variablesHelp')}
                />
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label={t('notifications.content')}
                value={template.content || ''}
                onChange={(e) => {
                  const content = e.target.value;
                  const variables = extractVariables(content);
                  if (editMode) {
                    setSelectedTemplate(prev => prev ? { ...prev, content, variables } : null);
                  } else {
                    setNewTemplate(prev => ({ ...prev, content, variables }));
                  }
                }}
                helperText={t('notifications.contentHelp')}
              />
            </Grid>

            {template.type === 'email' && (
              <Grid item xs={12}>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>{t('notifications.htmlContent')}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TextField
                      fullWidth
                      multiline
                      rows={6}
                      label={t('notifications.htmlTemplate')}
                      value={template.htmlContent || ''}
                      onChange={(e) => {
                        if (editMode) {
                          setSelectedTemplate(prev => prev ? { ...prev, htmlContent: e.target.value } : null);
                        } else {
                          setNewTemplate(prev => ({ ...prev, htmlContent: e.target.value }));
                        }
                      }}
                      helperText={t('notifications.htmlHelp')}
                    />
                  </AccordionDetails>
                </Accordion>
              </Grid>
            )}

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                {t('notifications.detectedVariables')}
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {(template.variables || []).map((variable) => (
                  <Chip
                    key={variable}
                    label={`{{${variable}}}`}
                    size="small"
                    icon={<CodeIcon />}
                    variant="outlined"
                  />
                ))}
                {(!template.variables || template.variables.length === 0) && (
                  <Typography variant="body2" color="text.secondary">
                    {t('notifications.noVariables')}
                  </Typography>
                )}
              </Box>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={template.enabled || false}
                    onChange={(e) => {
                      if (editMode) {
                        setSelectedTemplate(prev => prev ? { ...prev, enabled: e.target.checked } : null);
                      } else {
                        setNewTemplate(prev => ({ ...prev, enabled: e.target.checked }));
                      }
                    }}
                  />
                }
                label={t('notifications.enableTemplate')}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSaveTemplate}
            variant="contained"
            disabled={!template.name || !template.content}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  // 渲染预览对话框
  const renderPreviewDialog = () => (
    <Dialog
      open={previewDialogOpen}
      onClose={() => setPreviewDialogOpen(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>{t('notifications.preview')}</DialogTitle>
      <DialogContent>
        {selectedTemplate && (
          <Box>
            {selectedTemplate.type === 'email' && selectedTemplate.subject && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {t('notifications.subject')}
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography>{selectedTemplate.subject}</Typography>
                </Paper>
              </Box>
            )}
            <Typography variant="subtitle2" gutterBottom>
              {t('notifications.content')}
            </Typography>
            <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
              {selectedTemplate.htmlContent ? (
                <Box dangerouslySetInnerHTML={{ __html: selectedTemplate.htmlContent }} />
              ) : (
                <Typography>{selectedTemplate.content}</Typography>
              )}
            </Paper>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setPreviewDialogOpen(false)}>
          {t('common.close')}
        </Button>
        <Button
          variant="contained"
          startIcon={<SendIcon />}
          onClick={() => {
            setPreviewDialogOpen(false);
            setTestDialogOpen(true);
          }}
        >
          {t('notifications.sendTest')}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6">
          {t('notifications.templateManager')}
        </Typography>
        <Button
          startIcon={<AddIcon />}
          variant="contained"
          onClick={() => {
            setEditMode(false);
            setSelectedTemplate(null);
            setDialogOpen(true);
          }}
        >
          {t('notifications.createTemplate')}
        </Button>
      </Box>

      <Grid container spacing={3}>
        {templateCategories.map((category) => {
          const categoryTemplates = templates.filter(t => t.category === category.key);
          if (categoryTemplates.length === 0) return null;

          return (
            <Grid item xs={12} key={category.key}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {category.label}
                  </Typography>
                  <List>
                    {categoryTemplates.map((template) => (
                      <ListItem key={template.id} divider>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              {template.type === 'email' && <EmailIcon fontSize="small" />}
                              {template.type === 'sms' && <SmsIcon fontSize="small" />}
                              {template.type === 'push' && <PushIcon fontSize="small" />}
                              <Typography variant="subtitle2">
                                {template.name}
                              </Typography>
                              {!template.enabled && (
                                <Chip label={t('common.disabled')} size="small" variant="outlined" />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary" noWrap>
                                {template.content.length > 100
                                  ? `${template.content.substring(0, 100)}...`
                                  : template.content
                                }
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {t('notifications.usageCount', { count: template.metadata.usageCount })} •
                                {template.variables.length} {t('notifications.variables')}
                              </Typography>
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedTemplate(template);
                                setPreviewDialogOpen(true);
                              }}
                            >
                              <PreviewIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleCopyTemplate(template)}
                            >
                              <CopyIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedTemplate(template);
                                setEditMode(true);
                                setDialogOpen(true);
                              }}
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteTemplate(template.id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                            <Switch
                              size="small"
                              checked={template.enabled}
                              onChange={() => handleTemplateToggle(template.id)}
                            />
                          </Box>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {renderEditDialog()}
      {renderPreviewDialog()}
    </Box>
  );
};

export default NotificationTemplateManager;