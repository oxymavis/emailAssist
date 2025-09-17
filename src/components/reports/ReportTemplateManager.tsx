/**
 * Report Template Manager Component
 * 报告模板管理组件
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Avatar,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Stack,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  FileCopy,
  Visibility,
  ExpandMore,
  Assessment,
  Schedule,
  Share,
  Star,
  StarBorder,
  Settings,
  Code,
  Preview,
  Save,
  Refresh,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'predefined' | 'custom';
  category: string;
  isDefault: boolean;
  isStarred: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  config: {
    sections: TemplateSection[];
    styling: {
      theme: string;
      colors: string[];
      layout: string;
    };
    filters: {
      dateRange: string;
      categories: string[];
      importance: string[];
    };
    export: {
      formats: string[];
      autoGenerate: boolean;
      schedule?: string;
    };
  };
}

interface TemplateSection {
  id: string;
  type: 'summary' | 'chart' | 'table' | 'text' | 'metrics' | 'insights';
  title: string;
  order: number;
  visible: boolean;
  config: any;
}

interface ReportTemplateManagerProps {
  templates: ReportTemplate[];
  onTemplateSelect: (template: ReportTemplate) => void;
  onTemplateCreate: (template: Partial<ReportTemplate>) => void;
  onTemplateUpdate: (id: string, template: Partial<ReportTemplate>) => void;
  onTemplateDelete: (id: string) => void;
}

const ReportTemplateManager: React.FC<ReportTemplateManagerProps> = ({
  templates,
  onTemplateSelect,
  onTemplateCreate,
  onTemplateUpdate,
  onTemplateDelete,
}) => {
  const { t } = useTranslation();

  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    template: ReportTemplate | null;
    isNew: boolean;
  }>({
    open: false,
    template: null,
    isNew: false,
  });

  const [previewDialog, setPreviewDialog] = useState<{
    open: boolean;
    template: ReportTemplate | null;
  }>({
    open: false,
    template: null,
  });

  const [formData, setFormData] = useState<Partial<ReportTemplate>>({
    name: '',
    description: '',
    category: 'general',
    config: {
      sections: [],
      styling: {
        theme: 'default',
        colors: ['#1976d2', '#dc004e', '#ed6c02', '#2e7d32'],
        layout: 'standard',
      },
      filters: {
        dateRange: 'week',
        categories: [],
        importance: [],
      },
      export: {
        formats: ['pdf'],
        autoGenerate: false,
      },
    },
  });

  // 预定义模板类型
  const templateCategories = [
    { value: 'general', label: t('reports.templates.categories.general') },
    { value: 'executive', label: t('reports.templates.categories.executive') },
    { value: 'operational', label: t('reports.templates.categories.operational') },
    { value: 'analytics', label: t('reports.templates.categories.analytics') },
    { value: 'compliance', label: t('reports.templates.categories.compliance') },
    { value: 'performance', label: t('reports.templates.categories.performance') },
  ];

  // 可用的报告节
  const availableSections = [
    {
      type: 'summary',
      title: t('reports.sections.summary'),
      description: t('reports.sections.summaryDesc'),
      icon: <Assessment />,
    },
    {
      type: 'metrics',
      title: t('reports.sections.metrics'),
      description: t('reports.sections.metricsDesc'),
      icon: <Assessment />,
    },
    {
      type: 'chart',
      title: t('reports.sections.charts'),
      description: t('reports.sections.chartsDesc'),
      icon: <Assessment />,
    },
    {
      type: 'table',
      title: t('reports.sections.tables'),
      description: t('reports.sections.tablesDesc'),
      icon: <Assessment />,
    },
    {
      type: 'insights',
      title: t('reports.sections.insights'),
      description: t('reports.sections.insightsDesc'),
      icon: <Assessment />,
    },
    {
      type: 'text',
      title: t('reports.sections.text'),
      description: t('reports.sections.textDesc'),
      icon: <Assessment />,
    },
  ];

  const handleCreateTemplate = () => {
    setFormData({
      name: '',
      description: '',
      category: 'general',
      config: {
        sections: [
          {
            id: 'summary',
            type: 'summary',
            title: t('reports.sections.summary'),
            order: 1,
            visible: true,
            config: {},
          },
          {
            id: 'metrics',
            type: 'metrics',
            title: t('reports.sections.metrics'),
            order: 2,
            visible: true,
            config: {},
          },
        ],
        styling: {
          theme: 'default',
          colors: ['#1976d2', '#dc004e', '#ed6c02', '#2e7d32'],
          layout: 'standard',
        },
        filters: {
          dateRange: 'week',
          categories: [],
          importance: [],
        },
        export: {
          formats: ['pdf'],
          autoGenerate: false,
        },
      },
    });
    setEditDialog({ open: true, template: null, isNew: true });
  };

  const handleEditTemplate = (template: ReportTemplate) => {
    setFormData(template);
    setEditDialog({ open: true, template, isNew: false });
  };

  const handleSaveTemplate = () => {
    if (!formData.name?.trim()) {
      toast.error(t('reports.templates.pleaseEnterName'));
      return;
    }

    const templateData: Partial<ReportTemplate> = {
      ...formData,
      type: 'custom',
      createdBy: 'Current User',
      updatedAt: new Date(),
      ...(editDialog.isNew && { createdAt: new Date(), usageCount: 0 }),
    };

    if (editDialog.isNew) {
      onTemplateCreate(templateData);
      toast.success(t('reports.templates.templateCreated'));
    } else {
      onTemplateUpdate(editDialog.template!.id, templateData);
      toast.success(t('reports.templates.templateUpdated'));
    }

    setEditDialog({ open: false, template: null, isNew: false });
  };

  const handleDuplicateTemplate = (template: ReportTemplate) => {
    const duplicated = {
      ...template,
      name: `${template.name} (${t('reports.templates.copy')})`,
      id: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      isDefault: false,
    };
    onTemplateCreate(duplicated);
    toast.success(t('reports.templates.templateDuplicated'));
  };

  const handleToggleStarred = (template: ReportTemplate) => {
    onTemplateUpdate(template.id, { isStarred: !template.isStarred });
  };

  const handleDeleteTemplate = (template: ReportTemplate) => {
    if (template.isDefault) {
      toast.error(t('reports.templates.cannotDeleteDefault'));
      return;
    }

    if (window.confirm(t('reports.templates.confirmDelete'))) {
      onTemplateDelete(template.id);
      toast.success(t('reports.templates.templateDeleted'));
    }
  };

  const addSection = (sectionType: string) => {
    const newSection: TemplateSection = {
      id: `${sectionType}-${Date.now()}`,
      type: sectionType as any,
      title: availableSections.find(s => s.type === sectionType)?.title || sectionType,
      order: (formData.config?.sections?.length || 0) + 1,
      visible: true,
      config: {},
    };

    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config!,
        sections: [...(prev.config?.sections || []), newSection],
      },
    }));
  };

  const removeSection = (sectionId: string) => {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config!,
        sections: prev.config?.sections?.filter(s => s.id !== sectionId) || [],
      },
    }));
  };

  const updateSection = (sectionId: string, updates: Partial<TemplateSection>) => {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config!,
        sections: prev.config?.sections?.map(s =>
          s.id === sectionId ? { ...s, ...updates } : s
        ) || [],
      },
    }));
  };

  const renderTemplateList = () => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            {t('reports.templates.title')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreateTemplate}
          >
            {t('reports.templates.createNew')}
          </Button>
        </Box>

        <List>
          {templates.map((template, index) => (
            <React.Fragment key={template.id}>
              <ListItem>
                <ListItemIcon>
                  <Avatar
                    variant="rounded"
                    sx={{
                      bgcolor: template.isDefault ? 'primary.main' : 'secondary.main',
                    }}
                  >
                    <Assessment />
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="subtitle1">
                        {template.name}
                      </Typography>
                      {template.isDefault && (
                        <Chip label={t('reports.templates.default')} size="small" color="primary" />
                      )}
                      {template.isStarred && <Star fontSize="small" color="warning" />}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {template.description}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1} mt={1}>
                        <Chip label={template.category} size="small" variant="outlined" />
                        <Chip
                          label={`${template.usageCount} ${t('reports.templates.uses')}`}
                          size="small"
                          variant="outlined"
                        />
                        <Typography variant="caption" color="text.secondary">
                          {t('reports.templates.updatedAt', {
                            date: template.updatedAt.toLocaleDateString()
                          })}
                        </Typography>
                      </Box>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title={template.isStarred ? t('common.unstar') : t('common.star')}>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleStarred(template)}
                      >
                        {template.isStarred ? <Star color="warning" /> : <StarBorder />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.preview')}>
                      <IconButton
                        size="small"
                        onClick={() => setPreviewDialog({ open: true, template })}
                      >
                        <Preview />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.use')}>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => onTemplateSelect(template)}
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.duplicate')}>
                      <IconButton
                        size="small"
                        onClick={() => handleDuplicateTemplate(template)}
                      >
                        <FileCopy />
                      </IconButton>
                    </Tooltip>
                    {!template.isDefault && (
                      <>
                        <Tooltip title={t('common.edit')}>
                          <IconButton
                            size="small"
                            onClick={() => handleEditTemplate(template)}
                          >
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('common.delete')}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteTemplate(template)}
                          >
                            <Delete />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </Stack>
                </ListItemSecondaryAction>
              </ListItem>
              {index < templates.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>

        {templates.length === 0 && (
          <Alert severity="info">
            {t('reports.templates.noTemplates')}
          </Alert>
        )}
      </CardContent>
    </Card>
  );

  const renderEditDialog = () => (
    <Dialog open={editDialog.open} onClose={() => setEditDialog({ open: false, template: null, isNew: false })} maxWidth="md" fullWidth>
      <DialogTitle>
        {editDialog.isNew ? t('reports.templates.createTemplate') : t('reports.templates.editTemplate')}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('reports.templates.templateName')}
                value={formData.name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>{t('reports.templates.category')}</InputLabel>
                <Select
                  value={formData.category || 'general'}
                  label={t('reports.templates.category')}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                >
                  {templateCategories.map((cat) => (
                    <MenuItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label={t('reports.templates.description')}
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>

            {/* 报告节配置 */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                {t('reports.templates.reportSections')}
              </Typography>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography>{t('reports.templates.addSections')}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    {availableSections.map((section) => (
                      <Grid item xs={12} md={6} key={section.type}>
                        <Card variant="outlined" sx={{ cursor: 'pointer' }} onClick={() => addSection(section.type)}>
                          <CardContent sx={{ py: 1 }}>
                            <Box display="flex" alignItems="center" gap={1}>
                              {section.icon}
                              <Box>
                                <Typography variant="subtitle2">
                                  {section.title}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {section.description}
                                </Typography>
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {/* 已添加的节 */}
              <Box mt={2}>
                <Typography variant="subtitle2" gutterBottom>
                  {t('reports.templates.configuredSections')}
                </Typography>
                {formData.config?.sections?.map((section, index) => (
                  <Card key={section.id} variant="outlined" sx={{ mb: 1 }}>
                    <CardContent sx={{ py: 1 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box display="flex" alignItems="center" gap={2}>
                          <Typography variant="body2">
                            {index + 1}. {section.title}
                          </Typography>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={section.visible}
                                onChange={(e) => updateSection(section.id, { visible: e.target.checked })}
                              />
                            }
                            label={t('common.visible')}
                          />
                        </Box>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeSection(section.id)}
                        >
                          <Delete />
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
                {(!formData.config?.sections || formData.config.sections.length === 0) && (
                  <Alert severity="info">
                    {t('reports.templates.noSectionsAdded')}
                  </Alert>
                )}
              </Box>
            </Grid>

            {/* 样式配置 */}
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography>{t('reports.templates.styling')}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>{t('reports.templates.theme')}</InputLabel>
                        <Select
                          value={formData.config?.styling?.theme || 'default'}
                          label={t('reports.templates.theme')}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            config: {
                              ...prev.config!,
                              styling: {
                                ...prev.config!.styling,
                                theme: e.target.value,
                              },
                            },
                          }))}
                        >
                          <MenuItem value="default">{t('reports.templates.themes.default')}</MenuItem>
                          <MenuItem value="modern">{t('reports.templates.themes.modern')}</MenuItem>
                          <MenuItem value="minimal">{t('reports.templates.themes.minimal')}</MenuItem>
                          <MenuItem value="corporate">{t('reports.templates.themes.corporate')}</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>{t('reports.templates.layout')}</InputLabel>
                        <Select
                          value={formData.config?.styling?.layout || 'standard'}
                          label={t('reports.templates.layout')}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            config: {
                              ...prev.config!,
                              styling: {
                                ...prev.config!.styling,
                                layout: e.target.value,
                              },
                            },
                          }))}
                        >
                          <MenuItem value="standard">{t('reports.templates.layouts.standard')}</MenuItem>
                          <MenuItem value="compact">{t('reports.templates.layouts.compact')}</MenuItem>
                          <MenuItem value="detailed">{t('reports.templates.layouts.detailed')}</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setEditDialog({ open: false, template: null, isNew: false })}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" startIcon={<Save />} onClick={handleSaveTemplate}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );

  const renderPreviewDialog = () => (
    <Dialog
      open={previewDialog.open}
      onClose={() => setPreviewDialog({ open: false, template: null })}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Preview />
          {t('reports.templates.preview')}: {previewDialog.template?.name}
        </Box>
      </DialogTitle>
      <DialogContent>
        {previewDialog.template && (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              {t('reports.templates.previewDescription')}
            </Alert>

            <Typography variant="h6" gutterBottom>
              {t('reports.templates.sections')}:
            </Typography>
            <List>
              {previewDialog.template.config.sections
                .sort((a, b) => a.order - b.order)
                .map((section, index) => (
                  <ListItem key={section.id}>
                    <ListItemIcon>
                      {availableSections.find(s => s.type === section.type)?.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={`${index + 1}. ${section.title}`}
                      secondary={section.visible ? t('common.visible') : t('common.hidden')}
                    />
                  </ListItem>
                ))}
            </List>

            <Box mt={2}>
              <Typography variant="h6" gutterBottom>
                {t('reports.templates.styling')}:
              </Typography>
              <Chip label={`${t('reports.templates.theme')}: ${previewDialog.template.config.styling.theme}`} sx={{ mr: 1, mb: 1 }} />
              <Chip label={`${t('reports.templates.layout')}: ${previewDialog.template.config.styling.layout}`} sx={{ mr: 1, mb: 1 }} />
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setPreviewDialog({ open: false, template: null })}>
          {t('common.close')}
        </Button>
        {previewDialog.template && (
          <Button
            variant="contained"
            onClick={() => {
              onTemplateSelect(previewDialog.template!);
              setPreviewDialog({ open: false, template: null });
            }}
          >
            {t('reports.templates.useTemplate')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );

  return (
    <>
      {renderTemplateList()}
      {renderEditDialog()}
      {renderPreviewDialog()}
    </>
  );
};

export default ReportTemplateManager;