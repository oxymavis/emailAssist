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
} from '@mui/icons-material';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, LineChart, Line } from 'recharts';

import { LoadingState, SkeletonTable, SkeletonCard } from '@/components/common/Loading';
import { useReports, useNotifications } from '@/store';
import { mockDataService } from '@/services/mockData';
import { Report } from '@/types';
import { sentimentColors } from '@/themes';

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

          {/* 趋势图 */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('reports.processingTrend')}
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={report.data.trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <RechartsTooltip />
                    <Line type="monotone" dataKey="count" stroke="#2196F3" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* 分类统计 */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('reports.categoriesStatistics')}
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('reports.category')}</TableCell>
                        <TableCell align="right">{t('reports.count')}</TableCell>
                        <TableCell align="right">{t('reports.percentage')}</TableCell>
                        <TableCell>{t('reports.proportion')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {report.data.topCategories.map((category, index) => (
                        <TableRow key={index}>
                          <TableCell>{category.name}</TableCell>
                          <TableCell align="right">{category.count}</TableCell>
                          <TableCell align="right">{category.percentage}%</TableCell>
                          <TableCell>
                            <LinearProgress
                              variant="determinate"
                              value={category.percentage}
                              sx={{ width: 100, height: 6, borderRadius: 3 }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
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

const Reports: React.FC = () => {
  const { t } = useTranslation();
  const { reports, setReports, addReport } = useReports();
  const { addNotification } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [creationDialogOpen, setCreationDialogOpen] = useState(false);
  const [detailsDialog, setDetailsDialog] = useState<{
    open: boolean;
    report: Report | null;
  }>({
    open: false,
    report: null,
  });

  // 初始化数据
  useEffect(() => {
    const initializeReports = async () => {
      try {
        setLoading(true);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const mockReports = mockDataService.getReports();
        setReports(mockReports);
        
        addNotification({
          type: 'success',
          title: t('reports.dataLoaded'),
          message: t('reports.dataLoadedMessage', { count: mockReports.length }),
        });
      } catch (error) {
        addNotification({
          type: 'error',
          title: t('common.error'),
          message: t('reports.loadError'),
        });
      } finally {
        setLoading(false);
      }
    };

    initializeReports();
  }, [setReports, addNotification]);

  // 生成新报告
  const handleGenerateReport = async (config: any) => {
    const newReport: Report = {
      id: `report-${Date.now()}`,
      title: config.title,
      type: config.type,
      generatedAt: new Date().toISOString(),
      period: {
        startDate: config.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: config.endDate || new Date().toISOString(),
      },
      data: mockDataService.getReports()[0].data, // 使用模拟数据
      status: 'generating',
    };

    addReport(newReport);
    
    addNotification({
      type: 'info',
      title: t('reports.generating'),
      message: t('reports.generatingMessage', { title: config.title }),
    });

    // 模拟报告生成过程
    setTimeout(() => {
      // 这里应该调用更新报告的方法，暂时用添加新报告代替演示
      addNotification({
        type: 'success',
        title: t('reports.generated'),
        message: t('reports.generatedMessage', { title: config.title }),
      });
    }, 3000);
  };

  // 查看报告详情
  const handleViewReport = (report: Report) => {
    setDetailsDialog({ open: true, report });
  };

  // 下载报告
  const handleDownloadReport = (report: Report, format: 'pdf' | 'excel') => {
    addNotification({
      type: 'success',
      title: t('reports.downloadStarted'),
      message: t('reports.downloadMessage', { title: report.title, format: format.toUpperCase() }),
    });
  };

  // 删除报告
  const handleDeleteReport = (report: Report) => {
    // 这里应该有删除报告的逻辑
    addNotification({
      type: 'success',
      title: t('reports.deleted'),
      message: t('reports.deletedMessage', { title: report.title }),
    });
  };

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
    <Box>
      {/* 页面标题和操作 */}
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            {t('reports.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('reports.subtitle')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreationDialogOpen(true)}
        >
          {t('reports.generateReport')}
        </Button>
      </Box>

      <LoadingState
        loading={loading}
        skeleton={
          <Grid container spacing={3}>
            {Array.from({ length: 3 }, (_, i) => (
              <Grid item xs={12} md={4} key={i}>
                <SkeletonCard />
              </Grid>
            ))}
            <Grid item xs={12}>
              <SkeletonTable rows={5} />
            </Grid>
          </Grid>
        }
      >
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
                  {t('reports.totalReports')}
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
                  {t('reports.completed')}
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
                  {t('reports.generating')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <ScheduleIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                <Typography variant="h4" fontWeight="bold" color="warning.main">
                  3
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('reports.scheduledTasks')}
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
                    <TableCell>{t('common.status')}</TableCell>
                    <TableCell>{t('reports.reportTitle')}</TableCell>
                    <TableCell>{t('reports.type')}</TableCell>
                    <TableCell>{t('reports.timeRange')}</TableCell>
                    <TableCell>{t('reports.generatedTime')}</TableCell>
                    <TableCell align="center">{t('actions.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">
                          {t('reports.noReports')}
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
                                report.status === 'generating' ? t('reports.generating') :
                                report.status === 'completed' ? t('reports.completed') : t('reports.failed')
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
                              report.type === 'daily' ? t('reports.types.daily') :
                              report.type === 'weekly' ? t('reports.types.weekly') :
                              report.type === 'monthly' ? t('reports.types.monthly') : t('reports.types.custom')
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
                                <Tooltip title={t('reports.viewReport')}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleViewReport(report)}
                                    color="primary"
                                  >
                                    <VisibilityIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={t('reports.downloadPDF')}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDownloadReport(report, 'pdf')}
                                    color="error"
                                  >
                                    <PdfIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={t('reports.downloadExcel')}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDownloadReport(report, 'excel')}
                                    color="success"
                                  >
                                    <ExcelIcon />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                            {report.status === 'generating' && (
                              <Tooltip title={t('reports.generating')}>
                                <IconButton size="small" disabled>
                                  <ProcessingIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title={t('reports.deleteReport')}>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteReport(report)}
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

        {/* 报告创建对话框 */}
        <ReportCreationDialog
          open={creationDialogOpen}
          onClose={() => setCreationDialogOpen(false)}
          onGenerate={handleGenerateReport}
        />

        {/* 报告详情对话框 */}
        <ReportDetailsDialog
          open={detailsDialog.open}
          onClose={() => setDetailsDialog({ open: false, report: null })}
          report={detailsDialog.report}
        />
      </LoadingState>
    </Box>
  );
};

export default Reports;