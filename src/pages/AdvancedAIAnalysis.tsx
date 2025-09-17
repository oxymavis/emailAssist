import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Tabs,
  Tab,
  Button,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Divider,
  Alert,
  AlertTitle,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
} from '@mui/material';
import {
  Psychology as AIIcon,
  TrendingUp as TrendIcon,
  Lightbulb as InsightIcon,
  Recommendations as RecommendIcon,
  Search as SearchIcon,
  Send as SendIcon,
  AutoAwesome as MagicIcon,
  DataSaverOn as ModelIcon,
  Analytics as AnalyticsIcon,
  Schedule as PredictIcon,
  Science as LabIcon,
  Assistant as AssistantIcon,
  Refresh as RefreshIcon,
  Download as ExportIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ScatterPlot,
  Scatter,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import {
  advancedAIService,
  PredictiveAnalysisResult,
  SmartRecommendation,
  EmailClassificationModel,
  NaturalLanguageQuery,
} from '@/services/advancedAIService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`ai-analysis-tabpanel-${index}`}
    aria-labelledby={`ai-analysis-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
  </div>
);

const AdvancedAIAnalysis: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [nlQuery, setNlQuery] = useState('');
  const [queryResult, setQueryResult] = useState<NaturalLanguageQuery | null>(null);
  const [predictions, setPredictions] = useState<PredictiveAnalysisResult[]>([]);
  const [recommendations, setRecommendations] = useState<SmartRecommendation[]>([]);
  const [models, setModels] = useState<EmailClassificationModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<EmailClassificationModel | null>(null);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);

  const tabs = [
    {
      label: t('ai.predictiveAnalysis'),
      icon: <PredictIcon />,
      description: t('ai.predictiveAnalysisDesc'),
    },
    {
      label: t('ai.smartRecommendations'),
      icon: <RecommendIcon />,
      description: t('ai.smartRecommendationsDesc'),
    },
    {
      label: t('ai.naturalLanguageQuery'),
      icon: <AssistantIcon />,
      description: t('ai.naturalLanguageQueryDesc'),
    },
    {
      label: t('ai.modelManagement'),
      icon: <ModelIcon />,
      description: t('ai.modelManagementDesc'),
    },
  ];

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // 加载AI模型
      const aiModels = advancedAIService.getModels();
      setModels(aiModels);

      // 加载缓存的预测结果
      const cachedPredictions = advancedAIService.getCachedPredictions();
      setPredictions(cachedPredictions);

      // 生成推荐
      await loadRecommendations();
    } catch (error) {
      console.error('Failed to load AI analysis data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendations = async () => {
    try {
      const userContext = { userId: 'current-user', preferences: {} };
      const emailData = []; // 这里应该传入实际的邮件数据
      const recs = await advancedAIService.generateSmartRecommendations(userContext, emailData, 10);
      setRecommendations(recs);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    }
  };

  const handleGeneratePrediction = async (type: 'volume_prediction' | 'trend_analysis' | 'priority_forecast' | 'sentiment_trend') => {
    setLoading(true);
    try {
      const timeRange = {
        start: new Date(),
        end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天
      };
      const historicalData = []; // 这里应该传入实际的历史数据

      const prediction = await advancedAIService.generatePredictiveAnalysis(type, timeRange, historicalData);
      setPredictions(prev => [prediction, ...prev.filter(p => p.type !== type)]);
    } catch (error) {
      console.error('Failed to generate prediction:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNaturalLanguageQuery = async () => {
    if (!nlQuery.trim()) return;

    setLoading(true);
    try {
      const result = await advancedAIService.processNaturalLanguageQuery(nlQuery);
      setQueryResult(result);
    } catch (error) {
      console.error('Failed to process natural language query:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const renderPredictiveAnalysis = () => (
    <Grid container spacing={3}>
      {/* 快速生成预测 */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              预测分析生成器
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<TrendIcon />}
                  onClick={() => handleGeneratePrediction('volume_prediction')}
                  disabled={loading}
                >
                  邮件量预测
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<AnalyticsIcon />}
                  onClick={() => handleGeneratePrediction('trend_analysis')}
                  disabled={loading}
                >
                  趋势分析
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<PredictIcon />}
                  onClick={() => handleGeneratePrediction('priority_forecast')}
                  disabled={loading}
                >
                  优先级预测
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<AIIcon />}
                  onClick={() => handleGeneratePrediction('sentiment_trend')}
                  disabled={loading}
                >
                  情感趋势
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* 预测结果展示 */}
      {predictions.map((prediction) => (
        <Grid item xs={12} lg={6} key={prediction.id}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  {getPredictionTypeLabel(prediction.type)}
                </Typography>
                <Chip
                  label={`准确率: ${Math.round(prediction.accuracy * 100)}%`}
                  color="primary"
                  size="small"
                />
              </Box>

              {/* 预测图表 */}
              <Box sx={{ height: 300, mb: 2 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={prediction.predictions.map(p => ({
                    date: p.date.toLocaleDateString(),
                    value: p.value,
                    confidence: p.confidence,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={theme.palette.primary.main}
                      strokeWidth={2}
                      dot={{ fill: theme.palette.primary.main }}
                    />
                    <Area
                      dataKey="confidence"
                      fill={theme.palette.primary.light}
                      fillOpacity={0.3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>

              {/* 洞察和建议 */}
              <Typography variant="subtitle2" gutterBottom>
                关键洞察
              </Typography>
              <List dense>
                {prediction.insights.slice(0, 3).map((insight, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <InsightIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={insight} />
                  </ListItem>
                ))}
              </List>

              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                智能建议
              </Typography>
              <List dense>
                {prediction.recommendations.slice(0, 2).map((recommendation, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <RecommendIcon color="secondary" />
                    </ListItemIcon>
                    <ListItemText primary={recommendation} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      ))}

      {predictions.length === 0 && (
        <Grid item xs={12}>
          <Alert severity="info">
            <AlertTitle>开始预测分析</AlertTitle>
            点击上方按钮生成您的第一个AI预测分析。我们的机器学习模型将基于历史数据为您提供准确的预测和洞察。
          </Alert>
        </Grid>
      )}
    </Grid>
  );

  const renderSmartRecommendations = () => (
    <Grid container spacing={3}>
      {/* 推荐统计概览 */}
      <Grid item xs={12}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="primary">
                  {recommendations.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  活跃推荐
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="secondary">
                  {recommendations.filter(r => r.impact === 'high').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  高影响推荐
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="success.main">
                  {Math.round(recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length * 100) || 0}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  平均置信度
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="info.main">
                  {recommendations.reduce((sum, r) => sum + r.appliedCount, 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  已应用次数
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Grid>

      {/* 推荐列表 */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6">
                智能推荐
              </Typography>
              <Button
                startIcon={<RefreshIcon />}
                onClick={loadRecommendations}
                disabled={loading}
              >
                刷新推荐
              </Button>
            </Box>

            {recommendations.map((recommendation) => (
              <Card key={recommendation.id} variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        {recommendation.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {recommendation.description}
                      </Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip
                        label={`${Math.round(recommendation.confidence * 100)}%`}
                        color="primary"
                        size="small"
                      />
                      <Chip
                        label={getImpactLabel(recommendation.impact)}
                        color={getImpactColor(recommendation.impact)}
                        size="small"
                      />
                    </Box>
                  </Box>

                  <Box display="flex" gap={1} mb={2}>
                    {recommendation.tags.map((tag) => (
                      <Chip key={tag} label={tag} variant="outlined" size="small" />
                    ))}
                  </Box>

                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      类型: {getRecommendationTypeLabel(recommendation.type)} |
                      已应用: {recommendation.appliedCount} 次
                    </Typography>
                    <Box>
                      <Button size="small" color="primary">
                        查看详情
                      </Button>
                      <Button size="small" variant="contained" sx={{ ml: 1 }}>
                        应用推荐
                      </Button>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}

            {recommendations.length === 0 && (
              <Alert severity="info">
                <AlertTitle>暂无推荐</AlertTitle>
                AI正在分析您的使用模式，推荐将在有足够数据后自动生成。
              </Alert>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderNaturalLanguageQuery = () => (
    <Grid container spacing={3}>
      {/* 查询输入 */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              自然语言查询
            </Typography>
            <TextField
              fullWidth
              placeholder="请用自然语言描述您想了解的信息，例如：'本周有多少高优先级邮件？'"
              value={nlQuery}
              onChange={(e) => setNlQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleNaturalLanguageQuery()}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleNaturalLanguageQuery} disabled={loading || !nlQuery.trim()}>
                      <SendIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />

            <Typography variant="body2" color="text.secondary" paragraph>
              示例查询:
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              {[
                '今天有多少未读邮件？',
                '本周的邮件趋势如何？',
                '预测明天的邮件量',
                '推荐优化建议',
                '分析客户满意度',
              ].map((example) => (
                <Chip
                  key={example}
                  label={example}
                  onClick={() => setNlQuery(example)}
                  clickable
                  variant="outlined"
                  size="small"
                />
              ))}
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* 查询结果 */}
      {queryResult && (
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                查询结果
              </Typography>

              <Alert severity="success" sx={{ mb: 2 }}>
                <AlertTitle>理解了您的查询</AlertTitle>
                意图: {getIntentLabel(queryResult.intent)} |
                处理时间: {Math.round(queryResult.processingTime)}ms
              </Alert>

              {/* 识别的实体 */}
              {queryResult.entities.length > 0 && (
                <Box mb={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    识别的关键信息:
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {queryResult.entities.map((entity, index) => (
                      <Chip
                        key={index}
                        label={`${entity.type}: ${entity.value}`}
                        color="primary"
                        size="small"
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* 查询响应 */}
              <Box mb={2}>
                <Typography variant="subtitle2" gutterBottom>
                  分析结果:
                </Typography>
                {queryResult.response.type === 'data' && (
                  <Box>
                    <Typography variant="body1" paragraph>
                      {queryResult.response.content.summary}
                    </Typography>
                    {queryResult.response.content.metrics && (
                      <Grid container spacing={2}>
                        {Object.entries(queryResult.response.content.metrics).map(([key, value]) => (
                          <Grid item xs={6} sm={3} key={key}>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h6" color="primary">
                                {value as string}
                              </Typography>
                              <Typography variant="caption">
                                {key}
                              </Typography>
                            </Paper>
                          </Grid>
                        ))}
                      </Grid>
                    )}
                  </Box>
                )}

                {queryResult.response.type === 'information' && (
                  <Box>
                    <Typography variant="body1" paragraph>
                      {queryResult.response.content.message}
                    </Typography>
                    {queryResult.response.content.suggestions && (
                      <List>
                        {queryResult.response.content.suggestions.map((suggestion: string, index: number) => (
                          <ListItem key={index}>
                            <ListItemIcon>
                              <InfoIcon color="primary" />
                            </ListItemIcon>
                            <ListItemText primary={suggestion} />
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </Box>
                )}
              </Box>

              {/* 可视化结果 */}
              {queryResult.response.visualizations && queryResult.response.visualizations.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    数据可视化:
                  </Typography>
                  {queryResult.response.visualizations.map((viz, index) => (
                    <Box key={index} sx={{ height: 300, mt: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        {viz.title}
                      </Typography>
                      <ResponsiveContainer width="100%" height="100%">
                        {viz.type === 'bar_chart' ? (
                          <BarChart data={viz.data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <RechartsTooltip />
                            <Bar dataKey="value" fill={theme.palette.primary.main} />
                          </BarChart>
                        ) : (
                          <LineChart data={viz.data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <RechartsTooltip />
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke={theme.palette.primary.main}
                              strokeWidth={2}
                            />
                          </LineChart>
                        )}
                      </ResponsiveContainer>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      )}

      {!queryResult && (
        <Grid item xs={12}>
          <Alert severity="info">
            <AlertTitle>开始自然语言查询</AlertTitle>
            在上方输入框中用自然语言描述您想了解的信息，AI将理解您的意图并提供相应的分析结果。
          </Alert>
        </Grid>
      )}
    </Grid>
  );

  const renderModelManagement = () => (
    <Grid container spacing={3}>
      {/* 模型概览 */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6">
                AI模型管理
              </Typography>
              <Button startIcon={<RefreshIcon />} onClick={loadInitialData}>
                刷新模型
              </Button>
            </Box>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>模型名称</TableCell>
                    <TableCell>类型</TableCell>
                    <TableCell align="center">准确率</TableCell>
                    <TableCell align="center">精确率</TableCell>
                    <TableCell align="center">召回率</TableCell>
                    <TableCell align="center">F1分数</TableCell>
                    <TableCell align="center">状态</TableCell>
                    <TableCell align="center">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {models.map((model) => (
                    <TableRow key={model.id}>
                      <TableCell>
                        <Box>
                          <Typography variant="subtitle2">
                            {model.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            版本 {model.version}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getModelTypeLabel(model.type)}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" color={getMetricColor(model.accuracy)}>
                          {(model.accuracy * 100).toFixed(1)}%
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" color={getMetricColor(model.precision)}>
                          {(model.precision * 100).toFixed(1)}%
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" color={getMetricColor(model.recall)}>
                          {(model.recall * 100).toFixed(1)}%
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" color={getMetricColor(model.f1Score)}>
                          {(model.f1Score * 100).toFixed(1)}%
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={model.isActive ? '活跃' : '停用'}
                          color={model.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="查看详情">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedModel(model);
                              setModelDialogOpen(true);
                            }}
                          >
                            <InfoIcon />
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
      </Grid>
    </Grid>
  );

  // 辅助函数
  const getPredictionTypeLabel = (type: string) => {
    const labels = {
      volume_prediction: '邮件量预测',
      trend_analysis: '趋势分析',
      priority_forecast: '优先级预测',
      sentiment_trend: '情感趋势',
    };
    return labels[type] || type;
  };

  const getRecommendationTypeLabel = (type: string) => {
    const labels = {
      email_template: '邮件模板',
      filter_rule: '过滤规则',
      workflow_optimization: '工作流优化',
      response_suggestion: '响应建议',
    };
    return labels[type] || type;
  };

  const getImpactLabel = (impact: string) => {
    const labels = {
      low: '低影响',
      medium: '中等影响',
      high: '高影响',
    };
    return labels[impact] || impact;
  };

  const getImpactColor = (impact: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    const colors = {
      low: 'default' as const,
      medium: 'warning' as const,
      high: 'error' as const,
    };
    return colors[impact] || 'default';
  };

  const getIntentLabel = (intent: string) => {
    const labels = {
      query_statistics: '数据查询',
      analyze_trends: '趋势分析',
      predict_future: '预测分析',
      get_recommendations: '获取推荐',
      search_emails: '邮件搜索',
      general_inquiry: '一般询问',
    };
    return labels[intent] || intent;
  };

  const getModelTypeLabel = (type: string) => {
    const labels = {
      priority: '优先级分类',
      category: '类别分类',
      sentiment: '情感分析',
      spam: '垃圾邮件检测',
    };
    return labels[type] || type;
  };

  const getMetricColor = (value: number) => {
    if (value >= 0.9) return 'success.main';
    if (value >= 0.8) return 'warning.main';
    return 'error.main';
  };

  if (loading && predictions.length === 0 && recommendations.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress sx={{ mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          正在加载AI分析模块...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* 页面标题 */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            高级AI分析
          </Typography>
          <Typography variant="body1" color="text.secondary">
            利用机器学习和人工智能技术进行深度邮件分析和智能预测
          </Typography>
        </Box>
        <Box>
          <Button startIcon={<ExportIcon />} sx={{ mr: 1 }}>
            导出报告
          </Button>
          <Button startIcon={<SettingsIcon />} variant="outlined">
            设置
          </Button>
        </Box>
      </Box>

      {/* 标签页导航 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="advanced ai analysis tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          {tabs.map((tab, index) => (
            <Tab
              key={index}
              icon={tab.icon}
              label={tab.label}
              id={`ai-analysis-tab-${index}`}
              aria-controls={`ai-analysis-tabpanel-${index}`}
              sx={{
                minHeight: 72,
                '& .MuiTab-iconWrapper': {
                  mb: 0.5,
                },
              }}
            />
          ))}
        </Tabs>
      </Box>

      {/* 当前标签页描述 */}
      <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {tabs[activeTab]?.description}
        </Typography>
      </Box>

      {/* 标签页内容 */}
      <TabPanel value={activeTab} index={0}>
        {renderPredictiveAnalysis()}
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {renderSmartRecommendations()}
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        {renderNaturalLanguageQuery()}
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        {renderModelManagement()}
      </TabPanel>

      {/* 模型详情对话框 */}
      <Dialog
        open={modelDialogOpen}
        onClose={() => setModelDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedModel?.name} - 模型详情
        </DialogTitle>
        <DialogContent>
          {selectedModel && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    模型类型
                  </Typography>
                  <Typography variant="body1">
                    {getModelTypeLabel(selectedModel.type)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    版本
                  </Typography>
                  <Typography variant="body1">
                    {selectedModel.version}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    训练数据量
                  </Typography>
                  <Typography variant="body1">
                    {selectedModel.trainingDataCount.toLocaleString()} 条
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    最后训练时间
                  </Typography>
                  <Typography variant="body1">
                    {selectedModel.lastTrainedAt.toLocaleDateString()}
                  </Typography>
                </Grid>
              </Grid>

              <Typography variant="subtitle2" gutterBottom>
                性能指标
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h6" color="primary">
                      {(selectedModel.accuracy * 100).toFixed(1)}%
                    </Typography>
                    <Typography variant="caption">
                      准确率
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h6" color="secondary">
                      {(selectedModel.precision * 100).toFixed(1)}%
                    </Typography>
                    <Typography variant="caption">
                      精确率
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h6" color="success.main">
                      {(selectedModel.recall * 100).toFixed(1)}%
                    </Typography>
                    <Typography variant="caption">
                      召回率
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h6" color="info.main">
                      {(selectedModel.f1Score * 100).toFixed(1)}%
                    </Typography>
                    <Typography variant="caption">
                      F1分数
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModelDialogOpen(false)}>
            关闭
          </Button>
          <Button variant="contained">
            重新训练
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdvancedAIAnalysis;