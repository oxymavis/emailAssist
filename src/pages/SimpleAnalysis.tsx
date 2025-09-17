import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Divider,
  useTheme,
  Tabs,
  Tab,
  LinearProgress,
  IconButton,
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  TrendingUp as TrendingUpIcon,
  Category as CategoryIcon,
  Speed as SpeedIcon,
  Assessment as AssessmentIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

const SimpleAnalysis: React.FC = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);

  // 情感分析数据
  const sentimentData = [
    { name: '积极', value: 65, color: '#4caf50' },
    { name: '中性', value: 25, color: '#ff9800' },
    { name: '消极', value: 10, color: '#f44336' },
  ];

  // 分类分析数据
  const categoryData = [
    { name: '工作', value: 45 },
    { name: '会议', value: 25 },
    { name: '通知', value: 15 },
    { name: '个人', value: 10 },
    { name: '其他', value: 5 },
  ];

  // 紧急程度分析
  const urgencyData = [
    { category: '紧急', low: 10, medium: 20, high: 15, critical: 5 },
    { category: '重要', low: 25, medium: 30, high: 20, critical: 10 },
    { category: '普通', low: 40, medium: 25, high: 10, critical: 2 },
    { category: '低优先级', low: 60, medium: 15, high: 3, critical: 1 },
  ];

  // 关键词分析
  const keywordData = [
    { subject: '会议', count: 89, sentiment: 'positive' },
    { subject: '项目', count: 76, sentiment: 'neutral' },
    { subject: '报告', count: 54, sentiment: 'positive' },
    { subject: '问题', count: 43, sentiment: 'negative' },
    { subject: 'deadline', count: 38, sentiment: 'negative' },
    { subject: '完成', count: 32, sentiment: 'positive' },
  ];

  // AI建议
  const aiSuggestions = [
    {
      type: 'priority',
      title: '高优先级邮件提醒',
      description: '发现3封标记为紧急的邮件需要立即处理',
      action: '查看详情',
      severity: 'high',
    },
    {
      type: 'response',
      title: '响应时间优化',
      description: '平均响应时间较上周增加15%，建议优化处理流程',
      action: '查看建议',
      severity: 'medium',
    },
    {
      type: 'automation',
      title: '自动化机会',
      description: '检测到65%的通知类邮件可以通过规则自动处理',
      action: '设置规则',
      severity: 'low',
    },
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return theme.palette.error.main;
      case 'medium': return theme.palette.warning.main;
      case 'low': return theme.palette.info.main;
      default: return theme.palette.grey[500];
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return '😊';
      case 'neutral': return '😐';
      case 'negative': return '😞';
      default: return '😐';
    }
  };

  return (
    <Box>
      {/* 页面标题 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          📊 智能分析
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            sx={{ mr: 1 }}
          >
            筛选
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            sx={{ mr: 1 }}
          >
            导出
          </Button>
          <IconButton color="primary">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {/* 分析概览卡片 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Avatar sx={{ bgcolor: theme.palette.primary.main, mx: 'auto', mb: 2 }}>
                <PsychologyIcon />
              </Avatar>
              <Typography variant="h4" fontWeight="bold">
                1,234
              </Typography>
              <Typography color="textSecondary">
                已分析邮件
              </Typography>
              <LinearProgress
                variant="determinate"
                value={85}
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Avatar sx={{ bgcolor: theme.palette.success.main, mx: 'auto', mb: 2 }}>
                <TrendingUpIcon />
              </Avatar>
              <Typography variant="h4" fontWeight="bold">
                92%
              </Typography>
              <Typography color="textSecondary">
                准确率
              </Typography>
              <LinearProgress
                variant="determinate"
                value={92}
                color="success"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Avatar sx={{ bgcolor: theme.palette.warning.main, mx: 'auto', mb: 2 }}>
                <SpeedIcon />
              </Avatar>
              <Typography variant="h4" fontWeight="bold">
                2.3s
              </Typography>
              <Typography color="textSecondary">
                平均处理时间
              </Typography>
              <LinearProgress
                variant="determinate"
                value={76}
                color="warning"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Avatar sx={{ bgcolor: theme.palette.info.main, mx: 'auto', mb: 2 }}>
                <CategoryIcon />
              </Avatar>
              <Typography variant="h4" fontWeight="bold">
                15
              </Typography>
              <Typography color="textSecondary">
                识别类别
              </Typography>
              <LinearProgress
                variant="determinate"
                value={88}
                color="info"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 分析标签页 */}
      <Card>
        <CardContent>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label="情感分析" />
            <Tab label="分类分析" />
            <Tab label="关键词分析" />
            <Tab label="AI建议" />
          </Tabs>

          {/* 情感分析 */}
          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  📊 情感分布
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sentimentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {sentimentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  📈 紧急程度分析
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={urgencyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="low" stackId="a" fill="#4caf50" />
                      <Bar dataKey="medium" stackId="a" fill="#ff9800" />
                      <Bar dataKey="high" stackId="a" fill="#f44336" />
                      <Bar dataKey="critical" stackId="a" fill="#9c27b0" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
            </Grid>
          </TabPanel>

          {/* 分类分析 */}
          <TabPanel value={tabValue} index={1}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  📂 邮件分类分布
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill={theme.palette.primary.main} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  🏷️ 分类详情
                </Typography>
                <List>
                  {categoryData.map((category, index) => (
                    <ListItem key={index}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                          {category.name.charAt(0)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={category.name}
                        secondary={`${category.value}%`}
                      />
                      <Chip
                        label={`${category.value}%`}
                        color="primary"
                        size="small"
                      />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            </Grid>
          </TabPanel>

          {/* 关键词分析 */}
          <TabPanel value={tabValue} index={2}>
            <Typography variant="h6" gutterBottom>
              🔍 热门关键词
            </Typography>
            <Grid container spacing={2}>
              {keywordData.map((keyword, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" fontWeight="bold">
                          {keyword.subject}
                        </Typography>
                        <Typography variant="h4">
                          {getSentimentIcon(keyword.sentiment)}
                        </Typography>
                      </Box>
                      <Typography variant="h4" color="primary" fontWeight="bold">
                        {keyword.count}
                      </Typography>
                      <Typography color="textSecondary">
                        出现次数
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </TabPanel>

          {/* AI建议 */}
          <TabPanel value={tabValue} index={3}>
            <Typography variant="h6" gutterBottom>
              🤖 AI智能建议
            </Typography>
            <Grid container spacing={3}>
              {aiSuggestions.map((suggestion, index) => (
                <Grid item xs={12} key={index}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Avatar sx={{ bgcolor: getSeverityColor(suggestion.severity), mr: 2 }}>
                          <AssessmentIcon />
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="h6" fontWeight="bold">
                            {suggestion.title}
                          </Typography>
                          <Typography color="textSecondary">
                            {suggestion.description}
                          </Typography>
                        </Box>
                        <Button
                          variant="contained"
                          size="small"
                          color={suggestion.severity === 'high' ? 'error' : suggestion.severity === 'medium' ? 'warning' : 'primary'}
                        >
                          {suggestion.action}
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SimpleAnalysis;