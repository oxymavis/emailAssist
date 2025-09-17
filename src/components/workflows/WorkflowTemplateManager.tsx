import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
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
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Grid,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Preview as PreviewIcon,
  Code as CodeIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  ExpandMore as ExpandMoreIcon,
  Description as DescriptionIcon,
  Transform as TransformIcon,
  Api as ApiIcon,
  DataObject as DataIcon,
  Schema as SchemaIcon,
} from '@mui/icons-material';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  type: 'trello' | 'jira' | 'asana' | 'notion' | 'slack' | 'webhook' | 'database';
  category: 'task_management' | 'communication' | 'data_sync' | 'notification' | 'custom';
  enabled: boolean;
  template: {
    // 输出格式配置
    outputFormat: string;

    // 字段映射
    fieldMapping: {
      title: string;
      description: string;
      priority: string;
      assignee?: string;
      labels?: string[];
      dueDate?: string;
      customFields?: Record<string, string>;
    };

    // 数据转换规则
    transformRules: {
      dateFormat?: string;
      priorityMapping?: Record<string, string>;
      categoryMapping?: Record<string, string>;
      textProcessing?: {
        truncateDescription?: number;
        removeHtml?: boolean;
        extractUrls?: boolean;
      };
    };

    // 条件逻辑
    conditionalLogic?: {
      conditions: Array<{
        field: string;
        operator: 'equals' | 'contains' | 'greater' | 'less';
        value: string;
        action: 'include' | 'exclude' | 'transform';
      }>;
    };

    // API配置模板
    apiTemplate?: {
      method: string;
      endpoint: string;
      headers: Record<string, string>;
      bodyTemplate: string;
      responseMapping?: Record<string, string>;
    };
  };
  variables: string[];
  usageCount: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowTemplateManager: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();

  const [templates, setTemplates] = useState<WorkflowTemplate[]>([
    {
      id: '1',
      name: 'Trello Card Creator',
      description: '将邮件转换为Trello卡片的标准模板',
      type: 'trello',
      category: 'task_management',
      enabled: true,
      template: {
        outputFormat: 'card',
        fieldMapping: {
          title: '{{subject}}',
          description: 'From: {{sender.name}} ({{sender.email}})\nReceived: {{receivedDateTime}}\nPriority: {{priority}}\n\n{{content}}',
          priority: '{{priority}}',
          labels: ['email', '{{category}}'],
          dueDate: '{{suggestedDueDate}}',
        },
        transformRules: {
          dateFormat: 'YYYY-MM-DD',
          priorityMapping: {
            'low': 'Low',
            'normal': 'Normal',
            'high': 'High',
            'critical': 'Critical'
          },
          textProcessing: {
            truncateDescription: 500,
            removeHtml: true,
            extractUrls: true,
          },
        },
        conditionalLogic: {
          conditions: [
            {
              field: 'priority',
              operator: 'equals',
              value: 'critical',
              action: 'transform'
            }
          ]
        },
        apiTemplate: {
          method: 'POST',
          endpoint: '/1/cards',
          headers: {
            'Content-Type': 'application/json',
          },
          bodyTemplate: JSON.stringify({
            name: '{{title}}',
            desc: '{{description}}',
            idList: '{{listId}}',
            pos: 'top',
            labels: '{{labels}}',
          }, null, 2),
        },
      },
      variables: ['subject', 'sender.name', 'sender.email', 'receivedDateTime', 'priority', 'category', 'content'],
      usageCount: 142,
      isPublic: true,
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-03-10'),
    },
    {
      id: '2',
      name: 'Jira Issue Template',
      description: '创建Jira问题单的企业级模板',
      type: 'jira',
      category: 'task_management',
      enabled: true,
      template: {
        outputFormat: 'issue',
        fieldMapping: {
          title: '[EMAIL] {{subject}}',
          description: 'Reporter: {{sender.name}} ({{sender.email}})\nReceived: {{receivedDateTime}}\n\nDescription:\n{{content}}\n\nAI Analysis:\n- Category: {{category}}\n- Priority: {{priority}}\n- Sentiment: {{sentiment}}\n- Action Required: {{actionRequired}}',
          priority: '{{priority}}',
          assignee: '{{defaultAssignee}}',
        },
        transformRules: {
          priorityMapping: {
            'low': 'Low',
            'normal': 'Medium',
            'high': 'High',
            'critical': 'Highest'
          },
          categoryMapping: {
            'support': 'Customer Support',
            'bug': 'Bug Report',
            'feature': 'Feature Request',
          },
          textProcessing: {
            removeHtml: true,
            extractUrls: true,
          },
        },
        apiTemplate: {
          method: 'POST',
          endpoint: '/rest/api/2/issue',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic {{authToken}}',
          },
          bodyTemplate: JSON.stringify({
            fields: {
              project: { key: '{{projectKey}}' },
              summary: '{{title}}',
              description: '{{description}}',
              issuetype: { name: 'Task' },
              priority: { name: '{{priority}}' },
              assignee: { name: '{{assignee}}' },
            }
          }, null, 2),
        },
      },
      variables: ['subject', 'sender.name', 'sender.email', 'receivedDateTime', 'category', 'priority', 'sentiment', 'content', 'actionRequired'],
      usageCount: 89,
      isPublic: true,
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-03-12'),
    },
    {
      id: '3',
      name: 'Slack Alert Message',
      description: 'Slack频道警报消息模板',
      type: 'slack',
      category: 'notification',
      enabled: true,
      template: {
        outputFormat: 'message',
        fieldMapping: {
          title: '🚨 {{priority}} Priority Email',
          description: '*From:* {{sender.name}} <{{sender.email}}>\n*Subject:* {{subject}}\n*Received:* {{receivedDateTime}}\n*Priority:* {{priority}}\n*Sentiment:* {{sentiment}}\n\n{{truncatedContent}}',
        },
        transformRules: {
          textProcessing: {
            truncateDescription: 200,
            removeHtml: true,
          },
        },
        apiTemplate: {
          method: 'POST',
          endpoint: '{{webhookUrl}}',
          headers: {
            'Content-Type': 'application/json',
          },
          bodyTemplate: JSON.stringify({
            channel: '{{channel}}',
            username: 'Email Assistant',
            icon_emoji: ':email:',
            text: '{{title}}',
            attachments: [
              {
                color: '{{priorityColor}}',
                fields: [
                  {
                    title: 'Email Details',
                    value: '{{description}}',
                    short: false
                  }
                ]
              }
            ]
          }, null, 2),
        },
      },
      variables: ['priority', 'sender.name', 'sender.email', 'subject', 'receivedDateTime', 'sentiment', 'content'],
      usageCount: 56,
      isPublic: true,
      createdAt: new Date('2024-02-15'),
      updatedAt: new Date('2024-03-08'),
    },
  ]);

  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // 模板分类
  const templateCategories = [
    { key: 'task_management', label: t('workflows.categories.taskManagement'), icon: <DescriptionIcon /> },
    { key: 'communication', label: t('workflows.categories.communication'), icon: <ApiIcon /> },
    { key: 'data_sync', label: t('workflows.categories.dataSync'), icon: <TransformIcon /> },
    { key: 'notification', label: t('workflows.categories.notification'), icon: <DataIcon /> },
    { key: 'custom', label: t('workflows.categories.custom'), icon: <SchemaIcon /> },
  ];

  // 集成类型
  const integrationTypes = [
    { key: 'trello', label: 'Trello', icon: '📋' },
    { key: 'jira', label: 'Jira', icon: '🎯' },
    { key: 'asana', label: 'Asana', icon: '📌' },
    { key: 'notion', label: 'Notion', icon: '📝' },
    { key: 'slack', label: 'Slack', icon: '💬' },
    { key: 'webhook', label: 'Webhook', icon: '🔗' },
    { key: 'database', label: 'Database', icon: '🗄️' },
  ];

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
  const handleCopyTemplate = (template: WorkflowTemplate) => {
    const newTemplate: WorkflowTemplate = {
      ...template,
      id: Date.now().toString(),
      name: `${template.name} (Copy)`,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setTemplates(prev => [...prev, newTemplate]);
  };

  // 渲染模板预览对话框
  const renderPreviewDialog = () => (
    <Dialog
      open={previewDialogOpen}
      onClose={() => setPreviewDialogOpen(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        {t('workflows.templatePreview')}: {selectedTemplate?.name}
      </DialogTitle>
      <DialogContent>
        {selectedTemplate && (
          <Box>
            {/* 字段映射预览 */}
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              {t('workflows.fieldMapping')}
            </Typography>
            <Paper sx={{ p: 2, bgcolor: 'grey.50', mb: 2 }}>
              <pre style={{ fontFamily: 'monospace', fontSize: '0.875rem', margin: 0, whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(selectedTemplate.template.fieldMapping, null, 2)}
              </pre>
            </Paper>

            {/* API模板预览 */}
            {selectedTemplate.template.apiTemplate && (
              <>
                <Typography variant="h6" gutterBottom>
                  {t('workflows.apiTemplate')}
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.50', mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {selectedTemplate.template.apiTemplate.method} {selectedTemplate.template.apiTemplate.endpoint}
                  </Typography>
                  <pre style={{ fontFamily: 'monospace', fontSize: '0.875rem', margin: 0, whiteSpace: 'pre-wrap' }}>
                    {selectedTemplate.template.apiTemplate.bodyTemplate}
                  </pre>
                </Paper>
              </>
            )}

            {/* 变量列表 */}
            <Typography variant="h6" gutterBottom>
              {t('workflows.availableVariables')}
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {selectedTemplate.variables.map((variable) => (
                <Chip
                  key={variable}
                  label={`{{${variable}}}`}
                  size="small"
                  icon={<CodeIcon />}
                  variant="outlined"
                />
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setPreviewDialogOpen(false)}>
          {t('common.close')}
        </Button>
        <Button
          variant="contained"
          startIcon={<EditIcon />}
          onClick={() => {
            setPreviewDialogOpen(false);
            setEditMode(true);
            setDialogOpen(true);
          }}
        >
          {t('common.edit')}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6">
          {t('workflows.templateManager')}
        </Typography>
        <Box display="flex" gap={1}>
          <Button
            startIcon={<UploadIcon />}
            variant="outlined"
            size="small"
          >
            {t('workflows.importTemplate')}
          </Button>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => {
              setSelectedTemplate(null);
              setEditMode(false);
              setDialogOpen(true);
            }}
          >
            {t('workflows.createTemplate')}
          </Button>
        </Box>
      </Box>

      {/* 按分类分组显示模板 */}
      {templateCategories.map((category) => {
        const categoryTemplates = templates.filter(t => t.category === category.key);
        if (categoryTemplates.length === 0) return null;

        return (
          <Accordion key={category.key} defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={1}>
                {category.icon}
                <Typography variant="h6">
                  {category.label} ({categoryTemplates.length})
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {categoryTemplates.map((template) => {
                  const integrationType = integrationTypes.find(t => t.key === template.type);
                  return (
                    <Grid item xs={12} md={6} lg={4} key={template.id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box display="flex" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="h6" fontSize="1.2rem">
                                {integrationType?.icon}
                              </Typography>
                              <Box>
                                <Typography variant="subtitle1" fontWeight="bold">
                                  {template.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {integrationType?.label}
                                </Typography>
                              </Box>
                            </Box>
                            <Switch
                              checked={template.enabled}
                              onChange={() => handleTemplateToggle(template.id)}
                              size="small"
                            />
                          </Box>

                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {template.description}
                          </Typography>

                          {/* 变量统计 */}
                          <Box display="flex" alignItems="center" gap={1} sx={{ mb: 2 }}>
                            <Chip
                              label={`${template.variables.length} ${t('workflows.variables')}`}
                              size="small"
                              variant="outlined"
                            />
                            <Chip
                              label={`${t('workflows.used')} ${template.usageCount}`}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                            {template.isPublic && (
                              <Chip
                                label={t('workflows.public')}
                                size="small"
                                color="success"
                                variant="outlined"
                              />
                            )}
                          </Box>

                          {/* 操作按钮 */}
                          <Box display="flex" gap={0.5}>
                            <Tooltip title={t('workflows.preview')}>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setSelectedTemplate(template);
                                  setPreviewDialogOpen(true);
                                }}
                              >
                                <PreviewIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('common.copy')}>
                              <IconButton
                                size="small"
                                onClick={() => handleCopyTemplate(template)}
                              >
                                <CopyIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('workflows.export')}>
                              <IconButton size="small">
                                <DownloadIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('common.edit')}>
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
                            </Tooltip>
                            <Tooltip title={t('common.delete')}>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteTemplate(template.id)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </AccordionDetails>
          </Accordion>
        );
      })}

      {renderPreviewDialog()}
    </Box>
  );
};

export default WorkflowTemplateManager;