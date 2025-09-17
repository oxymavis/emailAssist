/**
 * Enhanced Reports Page
 * 增强的报告管理中心 - 集成模板管理、调度和高级分析
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Grid,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  Stack,
  Tooltip,
  Tabs,
  Tab,
  Paper,
  Badge,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  GetApp as DownloadIcon,
  Visibility as VisibilityIcon,
  Delete as DeleteIcon,
  Assessment as AssessmentIcon,
  Schedule as ScheduleIcon,
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as ProcessingIcon,
  Analytics,
  Template as TemplateIcon,
  AutoMode,
  Refresh,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, LineChart, Line } from 'recharts';

import { LoadingState, SkeletonTable, SkeletonCard } from '@/components/common/Loading';
import { useReports, useNotifications } from '@/store';
import { mockDataService } from '@/services/mockData';
import { Report } from '@/types';
import { sentimentColors } from '@/themes';

// 导入新的报告组件
import ReportTemplateManager from '@/components/reports/ReportTemplateManager';
import ReportScheduler from '@/components/reports/ReportScheduler';
import AdvancedReportAnalytics from '@/components/reports/AdvancedReportAnalytics';

// 报告创建对话框
interface ReportCreationDialogProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (config: { type: string; startDate?: string; endDate?: string; title: string }) => void;
}

const ReportCreationDialog: React.FC<ReportCreationDialogProps> = ({
  open,
  onClose,
  onGenerate,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    type: 'weekly',
    title: '',
    startDate: '',
    endDate: '',
  });

  const handleGenerate = () => {
    const config = {
      type: formData.type,
      title: formData.title || `${getTypeLabel(formData.type)}${t('reports.report')}`,
      ...(formData.type === 'custom' && {
        startDate: formData.startDate,
        endDate: formData.endDate,
      }),
    };
    onGenerate(config);
    onClose();
    // 重置表单
    setFormData({
      type: 'weekly',
      title: '',
      startDate: '',
      endDate: '',
    });
  };

  const getTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      daily: t('reports.types.daily'),
      weekly: t('reports.types.weekly'),
      monthly: t('reports.types.monthly'),
      custom: t('reports.types.custom'),
    };
    return typeMap[type] || t('reports.report');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('reports.generateNewReport')}</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>{t('reports.reportType')}</InputLabel>
                <Select
                  value={formData.type}
                  label={t('reports.reportType')}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <MenuItem value="daily">{t('reports.types.daily')}</MenuItem>
                  <MenuItem value="weekly">{t('reports.types.weekly')}</MenuItem>
                  <MenuItem value="monthly">{t('reports.types.monthly')}</MenuItem>
                  <MenuItem value="custom">{t('reports.types.customPeriod')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('reports.reportTitle')}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={`${getTypeLabel(formData.type)}${t('reports.report')}`}
              />
            </Grid>

            {formData.type === 'custom' && (
              <>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label={t('reports.startDate')}
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label={t('reports.endDate')}
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </>
            )}
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('actions.cancel')}</Button>
        <Button variant="contained" onClick={handleGenerate}>
          {t('reports.generateReport')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// 报告详情对话框
interface ReportDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  report: Report | null;
}

const ReportDetailsDialog: React.FC<ReportDetailsDialogProps> = ({
  open,
  onClose,
  report,
}) => {
  const { t } = useTranslation();
  if (!report) return null;

  const sentimentData = [
    { name: t('common.positive'), value: report.data.sentimentAnalysis.positive, color: sentimentColors.positive },
    { name: t('common.neutral'), value: report.data.sentimentAnalysis.neutral, color: sentimentColors.neutral },
    { name: t('common.negative'), value: report.data.sentimentAnalysis.negative, color: sentimentColors.negative },
  ];

  const urgencyData = [
    { name: t('common.low'), value: report.data.urgencyDistribution.low },
    { name: t('common.medium'), value: report.data.urgencyDistribution.medium },
    { name: t('common.high'), value: report.data.urgencyDistribution.high },
    { name: t('common.critical'), value: report.data.urgencyDistribution.critical },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">{report.title}</Typography>
          <Box display="flex" gap={1}>
            <Tooltip title={t('reports.exportPDF')}>
              <IconButton color="error">
                <PdfIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('reports.exportExcel')}>
              <IconButton color="success">
                <ExcelIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={3}>
          {/* 报告概要 */}
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('reports.summary')}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="primary.main" fontWeight="bold">
                        {report.data.totalEmails}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('reports.totalEmails')}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="success.main" fontWeight="bold">
                        {report.data.processedEmails}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('reports.processedEmails')}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="info.main" fontWeight="bold">
                        {report.data.responseTime.average}h
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('dashboard.avgResponseTime')}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="warning.main" fontWeight="bold">
                        {Math.round((report.data.processedEmails / report.data.totalEmails) * 100)}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('dashboard.responseRate')}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* 图表区域 */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('dashboard.sentimentDistribution')}
                </Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={sentimentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {sentimentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('reports.urgencyDistribution')}
                </Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={urgencyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="value" fill="#FF9800" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('actions.close')}</Button>
        <Button variant="contained" startIcon={<DownloadIcon />}>
          {t('reports.exportReport')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const EnhancedReports: React.FC = () => {
  const { t } = useTranslation();
  const { reports, setReports, addReport } = useReports();
  const { addNotification } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [creationDialog, setCreationDialog] = useState(false);
  const [detailsDialog, setDetailsDialog] = useState<{
    open: boolean;
    report: Report | null;
  }>({
    open: false,
    report: null,
  });

  // 新增状态
  const [templates, setTemplates] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  // 初始化数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 加载报告
        const mockReports = mockDataService.getReports();
        setReports(mockReports);

        // 加载模板
        const mockTemplates = [
          {
            id: 'template-1',
            name: '周度摘要报告',
            description: '包含邮件统计、情感分析和关键指标的周度综合报告',
            type: 'predefined',
            category: 'general',
            isDefault: true,
            isStarred: false,
            createdBy: 'System',
            createdAt: new Date(),
            updatedAt: new Date(),
            usageCount: 25,
            config: {
              sections: [
                { id: 'summary', type: 'summary', title: '概要', order: 1, visible: true, config: {} },
                { id: 'metrics', type: 'metrics', title: '关键指标', order: 2, visible: true, config: {} },
                { id: 'chart', type: 'chart', title: '图表分析', order: 3, visible: true, config: {} },
              ],
              styling: { theme: 'default', colors: ['#1976d2', '#dc004e', '#ed6c02', '#2e7d32'], layout: 'standard' },
              filters: { dateRange: 'week', categories: [], importance: [] },
              export: { formats: ['pdf'], autoGenerate: false },
            },
          },
          {
            id: 'template-2',
            name: '执行总结报告',
            description: '面向管理层的高级别综合报告',
            type: 'predefined',
            category: 'executive',
            isDefault: false,
            isStarred: true,
            createdBy: 'System',
            createdAt: new Date(),
            updatedAt: new Date(),
            usageCount: 12,
            config: {
              sections: [
                { id: 'summary', type: 'summary', title: '概要', order: 1, visible: true, config: {} },
                { id: 'insights', type: 'insights', title: '智能洞察', order: 2, visible: true, config: {} },
              ],
              styling: { theme: 'corporate', colors: ['#1976d2', '#dc004e', '#ed6c02', '#2e7d32'], layout: 'detailed' },
              filters: { dateRange: 'month', categories: [], importance: ['high', 'critical'] },
              export: { formats: ['pdf', 'excel'], autoGenerate: false },
            },
          },
        ];
        setTemplates(mockTemplates);

        // 加载调度任务
        const mockSchedules = [
          {
            id: 'schedule-1',
            name: '周度报告自动生成',
            description: '每周一自动生成并发送周度分析报告',
            templateId: 'template-1',
            templateName: '周度摘要报告',
            isActive: true,
            frequency: 'weekly',
            scheduleTime: '09:00',
            dayOfWeek: 1, // Monday
            timezone: 'Asia/Shanghai',
            recipients: [
              { id: 'r1', type: 'user', name: 'John Doe', email: 'john@example.com', isActive: true },
              { id: 'r2', type: 'group', name: 'Management Team', email: 'management@example.com', isActive: true },
            ],
            deliveryOptions: {
              formats: ['pdf'],
              emailSubject: '周度邮件分析报告 - {date}',
              emailBody: '请查收本周的邮件分析报告。',
              attachments: true,
              compressed: false,
            },
            filters: {
              dateRange: 'last7days',
              categories: [],
              conditions: [],
            },
            lastRun: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000),
            status: 'active',
            createdBy: 'Current User',
            createdAt: new Date(),
            updatedAt: new Date(),
            executionHistory: [
              {
                id: 'exec-1',
                scheduleId: 'schedule-1',
                executedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                status: 'success',
                generatedReports: 1,
                sentEmails: 2,
                errors: [],
                duration: 45,
              },
            ],
          },
        ];
        setSchedules(mockSchedules);

        // 加载分析数据
        const mockAnalyticsData = {
          timeSeriesData: Array.from({ length: 30 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (29 - i));
            return {
              date: date.toISOString(),
              totalEmails: Math.floor(Math.random() * 100) + 50,
              processedEmails: Math.floor(Math.random() * 80) + 40,
              responseTime: Math.random() * 10 + 2,
              sentimentPositive: Math.floor(Math.random() * 30) + 20,
              sentimentNegative: Math.floor(Math.random() * 15) + 5,
              sentimentNeutral: Math.floor(Math.random() * 40) + 25,
              urgentEmails: Math.floor(Math.random() * 10) + 2,
              categories: {
                work: Math.floor(Math.random() * 30) + 20,
                personal: Math.floor(Math.random() * 20) + 10,
                marketing: Math.floor(Math.random() * 15) + 5,
              },
            };
          }),
          distributionData: {
            sentiment: [
              { name: 'positive', value: 45, color: '#4caf50' },
              { name: 'neutral', value: 35, color: '#2196f3' },
              { name: 'negative', value: 20, color: '#f44336' },
            ],
            urgency: [
              { name: 'low', value: 40 },
              { name: 'medium', value: 35 },
              { name: 'high', value: 20 },
              { name: 'critical', value: 5 },
            ],
            categories: [
              { name: 'Work', value: 45, size: 450 },
              { name: 'Personal', value: 25, size: 250 },
              { name: 'Marketing', value: 20, size: 200 },
              { name: 'Support', value: 10, size: 100 },
            ],
            senders: [
              { name: 'John Smith', count: 25, avgResponseTime: 2.5 },
              { name: 'Sarah Johnson', count: 20, avgResponseTime: 1.8 },
              { name: 'Mike Chen', count: 15, avgResponseTime: 3.2 },
            ],
          },
          insights: [],
          comparisons: [
            { metric: '总邮件数', current: 245, previous: 230, change: 6.5, trend: 'up' },
            { metric: '响应时间', current: 2.3, previous: 2.8, change: -17.9, trend: 'down' },
            { metric: '紧急邮件', current: 12, previous: 15, change: -20.0, trend: 'down' },
          ],
        };
        setAnalyticsData(mockAnalyticsData);

        addNotification({
          type: 'success',
          title: t('common.success'),
          message: '报告数据加载完成',
        });
      } catch (error) {
        console.error('加载报告数据失败:', error);
        addNotification({
          type: 'error',
          title: '加载错误',
          message: '报告数据加载失败',
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [setReports, addNotification, t]);

  // 生成新报告
  const handleGenerateReport = async (config: { type: string; startDate?: string; endDate?: string; title: string }) => {
    const newReport: Report = {
      id: `report-${Date.now()}`,
      title: config.title,
      type: config.type,
      generatedAt: new Date().toISOString(),
      period: {
        startDate: config.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: config.endDate || new Date().toISOString(),
      },
      data: mockDataService.getReports()[0].data,
      status: 'generating',
    };

    addReport(newReport);

    addNotification({
      type: 'info',
      title: '报告生成中',
      message: `正在生成报告：${config.title}`,
    });

    // 模拟报告生成过程
    setTimeout(() => {
      addNotification({
        type: 'success',
        title: '报告生成完成',
        message: `报告 ${config.title} 生成完成`,
      });
    }, 3000);
  };

  // 模板管理处理函数
  const handleTemplateSelect = (template: any) => {
    handleGenerateReport({
      type: 'template',
      title: `${template.name} - ${new Date().toLocaleDateString()}`,
    });
  };

  const handleTemplateCreate = (template: any) => {
    const newTemplate = {
      ...template,
      id: `template-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
    };
    setTemplates(prev => [...prev, newTemplate]);
  };

  const handleTemplateUpdate = (id: string, updates: any) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t));
  };

  const handleTemplateDelete = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  // 调度管理处理函数
  const handleScheduleCreate = (schedule: any) => {
    const newSchedule = {
      ...schedule,
      id: `schedule-${Date.now()}`,
      createdAt: new Date(),
      executionHistory: [],
    };
    setSchedules(prev => [...prev, newSchedule]);
  };

  const handleScheduleUpdate = (id: string, updates: any) => {
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...updates, updatedAt: new Date() } : s));
  };

  const handleScheduleDelete = (id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  const handleScheduleExecute = async (id: string) => {
    // 模拟执行调度任务
    await new Promise(resolve => setTimeout(resolve, 2000));

    const execution = {
      id: `exec-${Date.now()}`,
      scheduleId: id,
      executedAt: new Date(),
      status: 'success',
      generatedReports: 1,
      sentEmails: 2,
      errors: [],
      duration: Math.floor(Math.random() * 60) + 30,
    };

    setSchedules(prev => prev.map(s =>
      s.id === id
        ? {
            ...s,
            lastRun: new Date(),
            executionHistory: [execution, ...s.executionHistory],
          }
        : s
    ));
  };

  // 分析数据处理函数
  const handleDataRefresh = () => {
    // 重新生成分析数据
    const refreshedData = {
      ...analyticsData,
      insights: [
        {
          id: 'insight-1',
          type: 'trend',
          severity: 'medium',
          title: '邮件量显著增加',
          description: '过去一周邮件量增长了15.2%',
          value: 245,
          change: 15.2,
          timestamp: new Date(),
        },
      ],
    };
    setAnalyticsData(refreshedData);
  };

  const handleExportData = (format: string) => {
    // 导出分析数据
    addNotification({
      type: 'success',
      title: '导出成功',
      message: `${format.toUpperCase()}格式数据导出成功`,
    });
  };

  const handleShareReport = () => {
    // 分享报告
    addNotification({
      type: 'info',
      title: '分享报告',
      message: '报告分享链接已生成',
    });
  };

  const renderReportsList = () => {
    const getStatusIcon = (status: Report['status']) => {
      switch (status) {
        case 'generating':
          return <ProcessingIcon color="info" />;
        case 'completed':
          return <CheckCircleIcon color="success" />;
        case 'failed':
          return <ErrorIcon color="error" />;
        default:
          return <ProcessingIcon />;
      }
    };

    const getStatusColor = (status: Report['status']) => {
      switch (status) {
        case 'generating':
          return 'info';
        case 'completed':
          return 'success';
        case 'failed':
          return 'error';
        default:
          return 'default';
      }
    };

    const completedReports = reports.filter(r => r.status === 'completed');
    const generatingReports = reports.filter(r => r.status === 'generating');

    return (
      <>
        {/* 统计卡片 */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <AssessmentIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                <Typography variant="h4" fontWeight="bold" color="primary.main">
                  {reports.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  总报告数
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                <Typography variant="h4" fontWeight="bold" color="success.main">
                  {completedReports.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  已完成
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <ProcessingIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
                <Typography variant="h4" fontWeight="bold" color="info.main">
                  {generatingReports.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  生成中
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <ScheduleIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                <Typography variant="h4" fontWeight="bold" color="warning.main">
                  {schedules.filter(s => s.isActive).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  活跃调度
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 报告列表 */}
        <Card>
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>状态</TableCell>
                    <TableCell>报告标题</TableCell>
                    <TableCell>类型</TableCell>
                    <TableCell>时间范围</TableCell>
                    <TableCell>生成时间</TableCell>
                    <TableCell align="center">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">
                          暂无报告数据
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    reports.map((report) => (
                      <TableRow key={report.id} hover>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            {getStatusIcon(report.status)}
                            <Chip
                              label={
                                report.status === 'generating' ? '生成中' :
                                report.status === 'completed' ? '已完成' : '失败'
                              }
                              size="small"
                              color={getStatusColor(report.status) as any}
                              variant="outlined"
                            />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {report.title}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={
                              report.type === 'daily' ? '日报' :
                              report.type === 'weekly' ? '周报' :
                              report.type === 'monthly' ? '月报' : '自定义'
                            }
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {format(new Date(report.period.startDate), 'MM-dd', { locale: zhCN })} ~ {' '}
                            {format(new Date(report.period.endDate), 'MM-dd', { locale: zhCN })}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {format(new Date(report.generatedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={1} justifyContent="center">
                            {report.status === 'completed' && (
                              <>
                                <Tooltip title="查看报告">
                                  <IconButton
                                    size="small"
                                    onClick={() => setDetailsDialog({ open: true, report })}
                                    color="primary"
                                  >
                                    <VisibilityIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="导出PDF">
                                  <IconButton
                                    size="small"
                                    color="error"
                                  >
                                    <PdfIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="导出Excel">
                                  <IconButton
                                    size="small"
                                    color="success"
                                  >
                                    <ExcelIcon />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                            {report.status === 'generating' && (
                              <Tooltip title="生成中">
                                <IconButton size="small" disabled>
                                  <ProcessingIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="删除报告">
                              <IconButton
                                size="small"
                                color="error"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </>
    );
  };

  const renderTabContent = () => {
    switch (tabValue) {
      case 0:
        return (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h5" fontWeight="bold">
                我的报告
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreationDialog(true)}
              >
                生成新报告
              </Button>
            </Box>
            {renderReportsList()}
          </Box>
        );
      case 1:
        return (
          <ReportTemplateManager
            templates={templates}
            onTemplateSelect={handleTemplateSelect}
            onTemplateCreate={handleTemplateCreate}
            onTemplateUpdate={handleTemplateUpdate}
            onTemplateDelete={handleTemplateDelete}
          />
        );
      case 2:
        return (
          <ReportScheduler
            schedules={schedules}
            templates={templates.map(t => ({ id: t.id, name: t.name }))}
            onScheduleCreate={handleScheduleCreate}
            onScheduleUpdate={handleScheduleUpdate}
            onScheduleDelete={handleScheduleDelete}
            onScheduleExecute={handleScheduleExecute}
          />
        );
      case 3:
        return analyticsData ? (
          <AdvancedReportAnalytics
            data={analyticsData}
            onDataRefresh={handleDataRefresh}
            onExportData={handleExportData}
            onShareReport={handleShareReport}
          />
        ) : (
          <Alert severity="info">分析数据加载中...</Alert>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <LoadingState
        loading={loading}
        skeleton={
          <Grid container spacing={3}>
            {Array.from({ length: 4 }, (_, i) => (
              <Grid item xs={12} md={6} lg={3} key={i}>
                <SkeletonCard height={120} />
              </Grid>
            ))}
            <Grid item xs={12}>
              <SkeletonTable rows={5} />
            </Grid>
          </Grid>
        }
      />
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          报告管理中心
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<Refresh />}
            variant="outlined"
            onClick={() => window.location.reload()}
          >
            刷新
          </Button>
        </Stack>
      </Box>

      {/* 标签页导航 */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          variant="fullWidth"
        >
          <Tab
            icon={<Badge badgeContent={reports.length} color="primary"><AssessmentIcon /></Badge>}
            label="我的报告"
          />
          <Tab
            icon={<Badge badgeContent={templates.length} color="secondary"><TemplateIcon /></Badge>}
            label="报告模板"
          />
          <Tab
            icon={<Badge badgeContent={schedules.filter(s => s.isActive).length} color="success"><ScheduleIcon /></Badge>}
            label="自动调度"
          />
          <Tab
            icon={<Analytics />}
            label="高级分析"
          />
        </Tabs>
      </Paper>

      {/* 标签页内容 */}
      {renderTabContent()}

      {/* 报告生成对话框 */}
      <ReportCreationDialog
        open={creationDialog}
        onClose={() => setCreationDialog(false)}
        onGenerate={handleGenerateReport}
      />

      {/* 报告详情对话框 */}
      <ReportDetailsDialog
        open={detailsDialog.open}
        onClose={() => setDetailsDialog({ open: false, report: null })}
        report={detailsDialog.report}
      />
    </Box>
  );
};

export default EnhancedReports;