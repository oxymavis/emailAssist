import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  TextField,
  InputAdornment,
  MenuItem,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Stack,
} from '@mui/material';
import {
  Search as SearchIcon,
  Psychology as PsychologyIcon,
  Visibility as VisibilityIcon,
  Analytics as AnalyticsIcon,
  AutoAwesome as AutoAwesomeIcon,
  Speed as SpeedIcon,
  Mood as MoodIcon,
  Assignment as AssignmentIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import { LoadingState, SkeletonTable, SkeletonCard } from '@/components/common/Loading';
import { useEmails, useNotifications } from '@/store';
import { mockDataService } from '@/services/mockData';
import { sentimentColors } from '@/themes';
import { Email, EmailAnalysis } from '@/types';

// 分析结果卡片组件
interface AnalysisResultCardProps {
  email: Email;
  analysis: EmailAnalysis;
  onViewDetails: (email: Email, analysis: EmailAnalysis) => void;
}

const AnalysisResultCard: React.FC<AnalysisResultCardProps> = ({ 
  email, 
  analysis, 
  onViewDetails 
}) => {
  const { t } = useTranslation();
  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return '😊';
      case 'negative': return '😞';
      default: return '😐';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      default: return 'success';
    }
  };

  return (
    <Card sx={{ mb: 2, '&:hover': { boxShadow: 3 } }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box flex={1}>
            <Typography variant="h6" gutterBottom noWrap>
              {email.subject}
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={1}>
              {t('common.from')}: {email.sender.name} ({email.sender.email})
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {format(new Date(email.receivedDateTime), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<VisibilityIcon />}
            onClick={() => onViewDetails(email, analysis)}
            sx={{ ml: 2 }}
          >
            {t('analysis.viewDetails')}
          </Button>
        </Box>

        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" color="text.secondary">{t('analysis.emotion')}:</Typography>
              <Chip
                label={`${getSentimentIcon(analysis.sentiment)} ${analysis.sentiment}`}
                size="small"
                sx={{ 
                  bgcolor: sentimentColors[analysis.sentiment as keyof typeof sentimentColors] + '20',
                  color: sentimentColors[analysis.sentiment as keyof typeof sentimentColors],
                  border: `1px solid ${sentimentColors[analysis.sentiment as keyof typeof sentimentColors]}40`
                }}
              />
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" color="text.secondary">{t('analysis.urgency')}:</Typography>
              <Chip
                label={analysis.urgency}
                size="small"
                color={getUrgencyColor(analysis.urgency) as any}
                variant="outlined"
              />
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" color="text.secondary">{t('analysis.category')}:</Typography>
              <Chip label={analysis.category} size="small" />
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" color="text.secondary">{t('analysis.confidence')}:</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={analysis.confidence * 100}
                  sx={{ flex: 1, height: 6, borderRadius: 3 }}
                />
                <Typography variant="caption">
                  {Math.round(analysis.confidence * 100)}%
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>

        {analysis.keyTopics.length > 0 && (
          <Box mt={2}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {t('analysis.keyTopics')}:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {analysis.keyTopics.map((topic, index) => (
                <Chip key={index} label={topic} size="small" variant="outlined" />
              ))}
            </Stack>
          </Box>
        )}

        <Box mt={2}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t('analysis.aiSummary')}:
          </Typography>
          <Typography variant="body2">
            {analysis.summary}
          </Typography>
        </Box>

        {analysis.actionRequired && (
          <Box mt={2}>
            <Chip
              icon={<AssignmentIcon />}
              label={t('analysis.actionRequired')}
              color="warning"
              variant="outlined"
              size="small"
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// 详情对话框组件
interface AnalysisDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  email: Email | null;
  analysis: EmailAnalysis | null;
}

const AnalysisDetailsDialog: React.FC<AnalysisDetailsDialogProps> = ({
  open,
  onClose,
  email,
  analysis,
}) => {
  const { t } = useTranslation();
  if (!email || !analysis) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <PsychologyIcon />
          {t('analysis.emailDetailsTitle')}
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              {t('analysis.emailInfo')}
            </Typography>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  {email.subject}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {t('analysis.sender')}: {email.sender.name} ({email.sender.email})
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {t('analysis.receivedTime')}: {format(new Date(email.receivedDateTime), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                </Typography>
                <Typography variant="body2" paragraph>
                  {email.content}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              {t('analysis.aiAnalysisResults')}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      {t('analysis.sentimentAnalysis')}
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="h4">
                        {analysis.sentiment === 'positive' ? '😊' : 
                         analysis.sentiment === 'negative' ? '😞' : '😐'}
                      </Typography>
                      <Box>
                        <Typography variant="body1" fontWeight="bold">
                          {analysis.sentiment}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('analysis.confidence')}: {Math.round(analysis.confidence * 100)}%
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      {t('analysis.urgency')}
                    </Typography>
                    <Chip
                      label={analysis.urgency}
                      color={
                        analysis.urgency === 'critical' ? 'error' :
                        analysis.urgency === 'high' ? 'warning' :
                        analysis.urgency === 'medium' ? 'info' : 'success'
                      }
                      sx={{ fontSize: '1rem', height: '32px' }}
                    />
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      {t('analysis.category')}
                    </Typography>
                    <Typography variant="body1">
                      {analysis.category}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      {t('analysis.actionRequired')}
                    </Typography>
                    <Chip
                      label={analysis.actionRequired ? t('analysis.yes') : t('analysis.no')}
                      color={analysis.actionRequired ? 'warning' : 'success'}
                    />
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>

          {analysis.keyTopics.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                {t('analysis.keyTopics')}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {analysis.keyTopics.map((topic, index) => (
                  <Chip key={index} label={topic} />
                ))}
              </Stack>
            </Grid>
          )}

          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              {t('analysis.aiSummary')}
            </Typography>
            <Typography variant="body1" paragraph>
              {analysis.summary}
            </Typography>
          </Grid>

          {analysis.suggestedResponse && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                {t('analysis.suggestedReply')}
              </Typography>
              <Card variant="outlined" sx={{ bgcolor: 'action.hover' }}>
                <CardContent>
                  <Typography variant="body2">
                    {analysis.suggestedResponse}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('actions.close')}</Button>
        <Button variant="contained">{t('analysis.adoptSuggestion')}</Button>
      </DialogActions>
    </Dialog>
  );
};

const Analysis: React.FC = () => {
  const { t } = useTranslation();
  const { emails, setEmails, emailAnalysis, setEmailAnalysis } = useEmails();
  const { addNotification } = useNotifications();
  
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [detailsDialog, setDetailsDialog] = useState<{
    open: boolean;
    email: Email | null;
    analysis: EmailAnalysis | null;
  }>({
    open: false,
    email: null,
    analysis: null,
  });

  // 初始化数据
  useEffect(() => {
    const initializeAnalysis = async () => {
      try {
        setLoading(true);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 获取邮件数据
        const mockEmails = mockDataService.getEmails(20);
        setEmails(mockEmails);
        
        // 生成分析数据
        const analysisMap: Record<string, EmailAnalysis> = {};
        mockEmails.slice(0, 15).forEach(email => {
          analysisMap[email.id] = mockDataService.getEmailAnalysis(email.id);
        });
        
        // 批量设置分析结果
        Object.entries(analysisMap).forEach(([emailId, analysis]) => {
          setEmailAnalysis(emailId, analysis);
        });
        
        addNotification({
          type: 'success',
          title: t('common.success'),
          message: t('analysis.dataLoadedMessage', { count: Object.keys(analysisMap).length }),
        });
      } catch (error) {
        addNotification({
          type: 'error',
          title: t('analysis.loadError'),
          message: t('analysis.loadErrorMessage'),
        });
      } finally {
        setLoading(false);
      }
    };

    initializeAnalysis();
  }, [setEmails, setEmailAnalysis, addNotification]);

  // 批量分析邮件
  const handleBatchAnalysis = async () => {
    const unanalyzedEmails = emails.filter(email => !emailAnalysis[email.id]);
    
    if (unanalyzedEmails.length === 0) {
      addNotification({
        type: 'info',
        title: t('analysis.noNeedAnalysis'),
        message: t('analysis.allAnalyzed'),
      });
      return;
    }

    setAnalyzing(true);
    try {
      for (const email of unanalyzedEmails) {
        const analysis = mockDataService.getEmailAnalysis(email.id);
        setEmailAnalysis(email.id, analysis);
        
        // 模拟分析延迟
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      addNotification({
        type: 'success',
        title: t('common.success'),
        message: t('analysis.analysisCompleted', { count: unanalyzedEmails.length }),
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: t('analysis.analysisFailed'),
        message: t('analysis.analysisFailedMessage'),
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // 过滤邮件
  const filteredEmails = emails.filter(email => {
    const analysis = emailAnalysis[email.id];
    if (!analysis) return false;

    const matchesSearch = email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         email.sender.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSentiment = !sentimentFilter || analysis.sentiment === sentimentFilter;
    const matchesUrgency = !urgencyFilter || analysis.urgency === urgencyFilter;

    return matchesSearch && matchesSentiment && matchesUrgency;
  });

  // 统计数据
  const totalAnalyzed = Object.keys(emailAnalysis).length;
  const sentimentStats = Object.values(emailAnalysis).reduce((acc, analysis) => {
    acc[analysis.sentiment] = (acc[analysis.sentiment] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const urgencyStats = Object.values(emailAnalysis).reduce((acc, analysis) => {
    acc[analysis.urgency] = (acc[analysis.urgency] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleViewDetails = (email: Email, analysis: EmailAnalysis) => {
    setDetailsDialog({ open: true, email, analysis });
  };

  return (
    <Box>
      {/* 页面标题和操作 */}
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            {t('analysis.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
{t('analysis.subtitle')}
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="contained"
            startIcon={<PsychologyIcon />}
            onClick={handleBatchAnalysis}
            disabled={analyzing}
          >
{analyzing ? t('analysis.analyzing') : t('analysis.batchAnalyze')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            disabled={analyzing}
          >
{t('analysis.refreshData')}
          </Button>
        </Box>
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
                <AnalyticsIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                <Typography variant="h4" fontWeight="bold" color="primary.main">
                  {totalAnalyzed}
                </Typography>
                <Typography variant="body2" color="text.secondary">
{t('analysis.analyzedEmails')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <MoodIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                <Typography variant="h4" fontWeight="bold" color="success.main">
                  {sentimentStats.positive || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
{t('analysis.positiveEmails')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <SpeedIcon sx={{ fontSize: 40, color: 'error.main', mb: 1 }} />
                <Typography variant="h4" fontWeight="bold" color="error.main">
                  {urgencyStats.critical || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
{t('analysis.urgentEmails')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <AutoAwesomeIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
                <Typography variant="h4" fontWeight="bold" color="info.main">
                  {Math.round((totalAnalyzed / emails.length) * 100) || 0}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
{t('analysis.analysisCoverage')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 搜索和过滤 */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  placeholder={t('analysis.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>{t('analysis.sentimentFilter')}</InputLabel>
                  <Select
                    value={sentimentFilter}
                    label={t('analysis.sentimentFilter')}
                    onChange={(e) => setSentimentFilter(e.target.value)}
                  >
                    <MenuItem value="">{t('analysis.all')}</MenuItem>
                    <MenuItem value="positive">{t('analysis.positive')}</MenuItem>
                    <MenuItem value="neutral">{t('analysis.neutral')}</MenuItem>
                    <MenuItem value="negative">{t('analysis.negative')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>{t('analysis.urgencyFilter')}</InputLabel>
                  <Select
                    value={urgencyFilter}
                    label={t('analysis.urgencyFilter')}
                    onChange={(e) => setUrgencyFilter(e.target.value)}
                  >
                    <MenuItem value="">{t('analysis.all')}</MenuItem>
                    <MenuItem value="critical">{t('analysis.critical')}</MenuItem>
                    <MenuItem value="high">{t('analysis.high')}</MenuItem>
                    <MenuItem value="medium">{t('analysis.medium')}</MenuItem>
                    <MenuItem value="low">{t('analysis.low')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <Typography variant="body2" color="text.secondary" textAlign="center">
{t('analysis.found')} {filteredEmails.length} {t('analysis.emails')}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* 分析结果列表 */}
        <Box>
          {filteredEmails.length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <PsychologyIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
{t('analysis.noResults')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
{totalAnalyzed === 0 ? t('analysis.clickToAnalyze') : t('analysis.tryAdjustFilters')}
                </Typography>
              </CardContent>
            </Card>
          ) : (
            filteredEmails.map(email => {
              const analysis = emailAnalysis[email.id];
              return (
                <AnalysisResultCard
                  key={email.id}
                  email={email}
                  analysis={analysis}
                  onViewDetails={handleViewDetails}
                />
              );
            })
          )}
        </Box>

        {/* 详情对话框 */}
        <AnalysisDetailsDialog
          open={detailsDialog.open}
          onClose={() => setDetailsDialog({ open: false, email: null, analysis: null })}
          email={detailsDialog.email}
          analysis={detailsDialog.analysis}
        />
      </LoadingState>
    </Box>
  );
};

export default Analysis;