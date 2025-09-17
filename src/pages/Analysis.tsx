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
  Timeline as TimelineIcon,
  Lightbulb as LightbulbIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Group as GroupIcon,
  Category as CategoryIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  Star as StarIcon,
  Archive as ArchiveIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import { LoadingState, SkeletonTable, SkeletonCard } from '@/components/common/Loading';
import { useEmails, useNotifications } from '@/store';
import realApiService from '@/services/realApi';
import { sentimentColors } from '@/themes';
import { Email, EmailAnalysis } from '@/types';

// 智能洞察接口
interface SmartInsight {
  id: string;
  type: 'trend' | 'anomaly' | 'recommendation' | 'pattern';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionRequired: boolean;
  data?: any;
}

// 分析趋势接口
interface AnalysisTrend {
  date: string;
  totalEmails: number;
  analyzed: number;
  positiveCount: number;
  negativeCount: number;
  urgentCount: number;
  averageConfidence: number;
}

// 分析结果卡片组件
interface AnalysisResultCardProps {
  email: Email;
  analysis: EmailAnalysis;
  onViewDetails: (email: Email, analysis: EmailAnalysis) => void;
  isSelected?: boolean;
  onToggleSelection?: (emailId: string) => void;
}

const AnalysisResultCard: React.FC<AnalysisResultCardProps> = ({
  email,
  analysis,
  onViewDetails,
  isSelected = false,
  onToggleSelection
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

  const getPriorityBorderColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return '2px solid #f44336';
      case 'high': return '2px solid #ff9800';
      case 'medium': return '2px solid #2196f3';
      default: return '2px solid #4caf50';
    }
  };

  return (
    <Card sx={{
      mb: 2,
      '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' },
      transition: 'all 0.2s ease-in-out',
      borderLeft: getPriorityBorderColor(analysis.urgency),
      bgcolor: isSelected ? 'action.selected' : 'background.paper',
      border: isSelected ? '2px solid' : '1px solid',
      borderColor: isSelected ? 'primary.main' : 'divider'
    }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box display="flex" alignItems="flex-start" gap={2} flex={1}>
            {onToggleSelection && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelection(email.id)}
                style={{ marginTop: 8 }}
              />
            )}
            <Box flex={1}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Typography variant="h6" noWrap>
                  {email.subject}
                </Typography>
              {analysis.actionRequired && (
                <Chip
                  icon={<AssignmentIcon />}
                  label={t('analysis.actionRequired')}
                  color="warning"
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" mb={1}>
              {t('common.from')}: {email.sender.name} ({email.sender.email})
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {format(new Date(email.receivedDateTime), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
            </Typography>
            </Box>
          </Box>
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<VisibilityIcon />}
              onClick={() => onViewDetails(email, analysis)}
            >
              {t('analysis.viewDetails')}
            </Button>
          </Box>
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

        {/* 智能建议 */}
        {analysis.suggestedResponse && (
          <Box mt={2} p={2} bgcolor="action.hover" borderRadius={1}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              <LightbulbIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
              {t('analysis.aiSuggestion')}:
            </Typography>
            <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
              {analysis.suggestedResponse.length > 100
                ? `${analysis.suggestedResponse.substring(0, 100)}...`
                : analysis.suggestedResponse}
            </Typography>
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
        <Button variant="outlined" startIcon={<StarIcon />}>
          {t('analysis.saveInsight')}
        </Button>
        {analysis?.suggestedResponse && (
          <Button variant="contained" startIcon={<CheckCircleIcon />}>
            {t('analysis.adoptSuggestion')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

// 智能洞察卡片组件
const SmartInsightCard: React.FC<{ insight: SmartInsight }> = ({ insight }) => {
  const { t } = useTranslation();

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'trend': return <TrendingUpIcon />;
      case 'anomaly': return <WarningIcon />;
      case 'recommendation': return <LightbulbIcon />;
      case 'pattern': return <TimelineIcon />;
      default: return <InfoIcon />;
    }
  };

  const getInsightColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      default: return 'info';
    }
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          {getInsightIcon(insight.type)}
          <Typography variant="h6" fontWeight="bold">
            {insight.title}
          </Typography>
          <Chip
            label={insight.impact}
            size="small"
            color={getInsightColor(insight.impact) as any}
            variant="outlined"
          />
        </Box>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {insight.description}
        </Typography>
        {insight.actionRequired && (
          <Chip
            icon={<PlayArrowIcon />}
            label={t('analysis.actionNeeded')}
            color="warning"
            size="small"
          />
        )}
      </CardContent>
    </Card>
  );
};

// 分析趋势组件
const AnalysisTrendCard: React.FC<{ trends: AnalysisTrend[] }> = ({ trends }) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <TimelineIcon />
          <Typography variant="h6" fontWeight="bold">
            {t('analysis.analysisProgress')}
          </Typography>
        </Box>
        <Box sx={{ height: 120 }}>
          {trends.length > 0 ? (
            <Box>
              <Typography variant="body2" color="text.secondary" mb={1}>
                {t('analysis.last7Days')}
              </Typography>
              <Box display="flex" justifyContent="space-between" alignItems="end">
                {trends.slice(-7).map((trend, index) => (
                  <Box key={index} textAlign="center">
                    <Box
                      sx={{
                        height: Math.max(20, (trend.analyzed / trend.totalEmails) * 60),
                        width: 20,
                        bgcolor: 'primary.main',
                        borderRadius: 1,
                        mb: 1,
                        opacity: 0.7 + (index * 0.1)
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {format(new Date(trend.date), 'MM/dd')}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          ) : (
            <Box display="flex" alignItems="center" justifyContent="center" height="100%">
              <Typography variant="body2" color="text.secondary">
                {t('analysis.noTrendData')}
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

// 批量操作工具栏
const BatchActionToolbar: React.FC<{
  selectedIds: string[];
  onBulkAction: (action: string, ids: string[]) => void;
  onClearSelection: () => void;
}> = ({ selectedIds, onBulkAction, onClearSelection }) => {
  const { t } = useTranslation();

  if (selectedIds.length === 0) return null;

  return (
    <Card sx={{ mb: 2, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
      <CardContent sx={{ py: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="body1" fontWeight="bold" color="primary.main">
              {t('analysis.selectedEmails', { count: selectedIds.length })}
            </Typography>
            <Button
              size="small"
              onClick={onClearSelection}
            >
              {t('actions.clearSelection')}
            </Button>
          </Box>
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<StarIcon />}
              onClick={() => onBulkAction('star', selectedIds)}
            >
              {t('actions.star')}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ArchiveIcon />}
              onClick={() => onBulkAction('archive', selectedIds)}
            >
              {t('actions.archive')}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DeleteIcon />}
              color="error"
              onClick={() => onBulkAction('delete', selectedIds)}
            >
              {t('actions.delete')}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
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
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>([]);
  const [showInsights, setShowInsights] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [smartInsights, setSmartInsights] = useState<SmartInsight[]>([]);
  const [analysisTrends, setAnalysisTrends] = useState<AnalysisTrend[]>([]);
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

        // 生成智能洞察
        const insights = generateSmartInsights(Object.values(analysisMap));
        setSmartInsights(insights);

        // 生成分析趋势数据
        const trends = generateAnalysisTrends();
        setAnalysisTrends(trends);

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

  // 生成智能洞察
  const generateSmartInsights = (analyses: EmailAnalysis[]): SmartInsight[] => {
    const insights: SmartInsight[] = [];

    // 情感异常检测
    const negativeCount = analyses.filter(a => a.sentiment === 'negative').length;
    if (negativeCount > analyses.length * 0.3) {
      insights.push({
        id: 'negative-trend',
        type: 'anomaly',
        title: t('analysis.insights.highNegativeSentiment'),
        description: t('analysis.insights.negativeDescription', { percentage: Math.round((negativeCount / analyses.length) * 100) }),
        impact: 'high',
        actionRequired: true,
      });
    }

    // 紧急邮件积压
    const urgentCount = analyses.filter(a => a.urgency === 'critical' || a.urgency === 'high').length;
    if (urgentCount > 5) {
      insights.push({
        id: 'urgent-backlog',
        type: 'recommendation',
        title: t('analysis.insights.urgentBacklog'),
        description: t('analysis.insights.urgentDescription', { count: urgentCount }),
        impact: 'high',
        actionRequired: true,
      });
    }

    // 置信度低的分析
    const lowConfidenceCount = analyses.filter(a => a.confidence < 0.7).length;
    if (lowConfidenceCount > analyses.length * 0.2) {
      insights.push({
        id: 'low-confidence',
        type: 'pattern',
        title: t('analysis.insights.lowConfidence'),
        description: t('analysis.insights.confidenceDescription', { count: lowConfidenceCount }),
        impact: 'medium',
        actionRequired: false,
      });
    }

    // 类别分布建议
    const categoryCount = analyses.reduce((acc, a) => {
      acc[a.category] = (acc[a.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const dominantCategory = Object.keys(categoryCount).reduce((a, b) =>
      categoryCount[a] > categoryCount[b] ? a : b
    );

    if (categoryCount[dominantCategory] > analyses.length * 0.6) {
      insights.push({
        id: 'category-dominance',
        type: 'trend',
        title: t('analysis.insights.categoryTrend'),
        description: t('analysis.insights.categoryDescription', { category: dominantCategory }),
        impact: 'medium',
        actionRequired: false,
      });
    }

    return insights;
  };

  // 生成分析趋势数据
  const generateAnalysisTrends = (): AnalysisTrend[] => {
    const trends: AnalysisTrend[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      const totalEmails = Math.floor(Math.random() * 20) + 10;
      const analyzed = Math.floor(totalEmails * (0.6 + Math.random() * 0.4));

      trends.push({
        date: date.toISOString(),
        totalEmails,
        analyzed,
        positiveCount: Math.floor(analyzed * 0.4),
        negativeCount: Math.floor(analyzed * 0.2),
        urgentCount: Math.floor(analyzed * 0.15),
        averageConfidence: 0.7 + Math.random() * 0.3,
      });
    }

    return trends;
  };

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

  // 批量操作处理
  const handleBulkAction = async (action: string, emailIds: string[]) => {
    try {
      switch (action) {
        case 'star':
          addNotification({
            type: 'success',
            title: t('actions.success'),
            message: t('analysis.bulkStarred', { count: emailIds.length }),
          });
          break;
        case 'archive':
          addNotification({
            type: 'success',
            title: t('actions.success'),
            message: t('analysis.bulkArchived', { count: emailIds.length }),
          });
          break;
        case 'delete':
          addNotification({
            type: 'success',
            title: t('actions.success'),
            message: t('analysis.bulkDeleted', { count: emailIds.length }),
          });
          break;
      }
      setSelectedEmailIds([]);
    } catch (error) {
      addNotification({
        type: 'error',
        title: t('actions.error'),
        message: t('analysis.bulkActionFailed'),
      });
    }
  };

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(async () => {
      const unanalyzedEmails = emails.filter(email => !emailAnalysis[email.id]);
      if (unanalyzedEmails.length > 0) {
        const email = unanalyzedEmails[0];
        const analysis = mockDataService.getEmailAnalysis(email.id);
        setEmailAnalysis(email.id, analysis);

        // 更新洞察
        const allAnalyses = Object.values({ ...emailAnalysis, [email.id]: analysis });
        const insights = generateSmartInsights(allAnalyses);
        setSmartInsights(insights);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, emails, emailAnalysis]);

  // 过滤邮件
  const filteredEmails = emails.filter(email => {
    const analysis = emailAnalysis[email.id];
    if (!analysis) return false;

    const matchesSearch = email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         email.sender.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         analysis.summary.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSentiment = !sentimentFilter || analysis.sentiment === sentimentFilter;
    const matchesUrgency = !urgencyFilter || analysis.urgency === urgencyFilter;
    const matchesCategory = !categoryFilter || analysis.category === categoryFilter;

    return matchesSearch && matchesSentiment && matchesUrgency && matchesCategory;
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
            variant={autoRefresh ? 'contained' : 'outlined'}
            startIcon={autoRefresh ? <PauseIcon /> : <PlayArrowIcon />}
            onClick={() => setAutoRefresh(!autoRefresh)}
            color={autoRefresh ? 'success' : 'primary'}
          >
            {autoRefresh ? t('analysis.pauseAuto') : t('analysis.autoAnalyze')}
          </Button>
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
          <Button
            variant={showInsights ? 'contained' : 'outlined'}
            startIcon={<LightbulbIcon />}
            onClick={() => setShowInsights(!showInsights)}
          >
            {t('analysis.insights')}
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

        {/* 智能洞察区域 */}
        {showInsights && (
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <LightbulbIcon />
                    <Typography variant="h6" fontWeight="bold">
                      {t('analysis.smartInsights')}
                    </Typography>
                  </Box>
                  {smartInsights.length > 0 ? (
                    <Grid container spacing={2}>
                      {smartInsights.map((insight) => (
                        <Grid item xs={12} md={6} key={insight.id}>
                          <SmartInsightCard insight={insight} />
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <Box display="flex" alignItems="center" justifyContent="center" py={4}>
                      <Typography variant="body2" color="text.secondary">
                        {t('analysis.noInsights')}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <AnalysisTrendCard trends={analysisTrends} />
            </Grid>
          </Grid>
        )}

        {/* 批量操作工具栏 */}
        <BatchActionToolbar
          selectedIds={selectedEmailIds}
          onBulkAction={handleBulkAction}
          onClearSelection={() => setSelectedEmailIds([])}
        />

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
              <Grid item xs={12} md={2}>
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
                <FormControl fullWidth>
                  <InputLabel>{t('analysis.categoryFilter')}</InputLabel>
                  <Select
                    value={categoryFilter}
                    label={t('analysis.categoryFilter')}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <MenuItem value="">{t('analysis.all')}</MenuItem>
                    <MenuItem value="work">{t('analysis.work')}</MenuItem>
                    <MenuItem value="personal">{t('analysis.personal')}</MenuItem>
                    <MenuItem value="marketing">{t('analysis.marketing')}</MenuItem>
                    <MenuItem value="support">{t('analysis.support')}</MenuItem>
                    <MenuItem value="notification">{t('analysis.notification')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <Box textAlign="center">
                  <Typography variant="body2" color="text.secondary">
{t('analysis.found')} {filteredEmails.length} {t('analysis.emails')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selectedEmailIds.length > 0 && `${selectedEmailIds.length} ${t('analysis.selected')}`}
                  </Typography>
                </Box>
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
                  isSelected={selectedEmailIds.includes(email.id)}
                  onToggleSelection={(emailId) => {
                    setSelectedEmailIds(prev =>
                      prev.includes(emailId)
                        ? prev.filter(id => id !== emailId)
                        : [...prev, emailId]
                    );
                  }}
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