import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Tabs,
  Tab,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  useTheme,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Email as EmailIcon,
  Schedule as ScheduleIcon,
  Assessment as AssessmentIcon,
  FilterList as FilterIcon,
  DateRange as DateRangeIcon,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

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

const ReportsPage: React.FC = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [timeRange, setTimeRange] = useState('week');

  // 模拟报告数据
  const emailVolumeData = [
    { date: '周一', received: 45, sent: 12, processed: 38 },
    { date: '周二', received: 52, sent: 18, processed: 44 },
    { date: '周三', received: 48, sent: 15, processed: 41 },
    { date: '周四', received: 61, sent: 22, processed: 55 },
    { date: '周五', received: 55, sent: 19, processed: 48 },
    { date: '周六', received: 23, sent: 8, processed: 20 },
    { date: '周日', received: 18, sent: 5, processed: 15 },
  ];

  const sentimentData = [
    { name: '积极', value: 45, color: '#4caf50' },
    { name: '中性', value: 35, color: '#ff9800' },
    { name: '消极', value: 20, color: '#f44336' },
  ];

  const categoryData = [
    { category: '工作', count: 156, percentage: 42 },
    { category: '个人', count: 89, percentage: 24 },
    { category: '通知', count: 67, percentage: 18 },
    { category: '营销', count: 34, percentage: 9 },
    { category: '垃圾邮件', count: 25, percentage: 7 },
  ];

  const efficiencyData = [
    { metric: '平均响应时间', value: '2.3小时', trend: '+12%' },
    { metric: '处理完成率', value: '94.5%', trend: '+5%' },
    { metric: '过滤准确率', value: '96.8%', trend: '+2%' },
    { metric: '重要邮件识别', value: '89.2%', trend: '+8%' },
  ];

  const topSenders = [
    { sender: 'project-team@company.com', count: 24, category: '工作' },
    { sender: 'sarah.chen@client.com', count: 18, category: '客户' },
    { sender: 'notifications@github.com', count: 15, category: '通知' },
    { sender: 'support@tools.com', count: 12, category: '服务' },
    { sender: 'marketing@newsletter.com', count: 8, category: '营销' },
  ];

  const getMetricTrendColor = (trend: string) => {
    return trend.startsWith('+') ? theme.palette.success.main : theme.palette.error.main;
  };

  return (
    <Box>
      {/* 页面标题 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          📊 分析报告
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>时间范围</InputLabel>
            <Select
              value={timeRange}
              label="时间范围"
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <MenuItem value="day">今天</MenuItem>
              <MenuItem value="week">本周</MenuItem>
              <MenuItem value="month">本月</MenuItem>
              <MenuItem value="quarter">本季度</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
          >
            刷新
          </Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
          >
            导出报告
          </Button>
        </Box>
      </Box>

      {/* 概览统计卡片 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <EmailIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4" fontWeight="bold" color="primary">
                2,847
              </Typography>
              <Typography color="textSecondary">
                总邮件数
              </Typography>
              <Chip label="+15%" color="success" size="small" sx={{ mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <TrendingUpIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
              <Typography variant="h4" fontWeight="bold" color="success.main">
                94.5%
              </Typography>
              <Typography color="textSecondary">
                处理效率
              </Typography>
              <Chip label="+3%" color="success" size="small" sx={{ mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <ScheduleIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
              <Typography variant="h4" fontWeight="bold" color="warning.main">
                2.3h
              </Typography>
              <Typography color="textSecondary">
                平均响应时间
              </Typography>
              <Chip label="-8%" color="success" size="small" sx={{ mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <AssessmentIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
              <Typography variant="h4" fontWeight="bold" color="info.main">
                89.2%
              </Typography>
              <Typography color="textSecondary">
                AI识别准确率
              </Typography>
              <Chip label="+2%" color="success" size="small" sx={{ mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 报告标签页 */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
              <Tab label="📈 趋势分析" />
              <Tab label="📊 分类统计" />
              <Tab label="⚡ 效率指标" />
              <Tab label="👥 发件人分析" />
            </Tabs>
          </Box>

          {/* 趋势分析 */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                📈 邮件量趋势分析
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={emailVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="received" stroke="#8884d8" name="收到" />
                  <Line type="monotone" dataKey="sent" stroke="#82ca9d" name="发送" />
                  <Line type="monotone" dataKey="processed" stroke="#ffc658" name="已处理" />
                </LineChart>
              </ResponsiveContainer>

              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom>
                  📊 情感分析分布
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={sentimentData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}%`}
                        >
                          {sentimentData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 3 }}>
                      {sentimentData.map((item, index) => (
                        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Box
                            sx={{
                              width: 16,
                              height: 16,
                              backgroundColor: item.color,
                              borderRadius: '50%',
                            }}
                          />
                          <Typography variant="body1" sx={{ flexGrow: 1 }}>
                            {item.name}
                          </Typography>
                          <Typography variant="h6" fontWeight="bold">
                            {item.value}%
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          </TabPanel>

          {/* 分类统计 */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                📊 邮件分类统计
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>

              <TableContainer component={Paper} sx={{ mt: 3 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>分类</strong></TableCell>
                      <TableCell align="right"><strong>数量</strong></TableCell>
                      <TableCell align="right"><strong>占比</strong></TableCell>
                      <TableCell align="center"><strong>趋势</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {categoryData.map((row) => (
                      <TableRow key={row.category}>
                        <TableCell>{row.category}</TableCell>
                        <TableCell align="right">{row.count}</TableCell>
                        <TableCell align="right">{row.percentage}%</TableCell>
                        <TableCell align="center">
                          <Chip
                            label="稳定"
                            color="success"
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </TabPanel>

          {/* 效率指标 */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                ⚡ 处理效率指标
              </Typography>
              <Grid container spacing={3}>
                {efficiencyData.map((metric, index) => (
                  <Grid item xs={12} sm={6} md={3} key={index}>
                    <Card variant="outlined">
                      <CardContent sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" fontWeight="bold" color="primary">
                          {metric.value}
                        </Typography>
                        <Typography color="textSecondary" sx={{ mb: 1 }}>
                          {metric.metric}
                        </Typography>
                        <Chip
                          label={metric.trend}
                          color={metric.trend.startsWith('+') ? 'success' : 'error'}
                          size="small"
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom>
                  📈 效率趋势图
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={emailVolumeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="processed"
                      stackId="1"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          </TabPanel>

          {/* 发件人分析 */}
          <TabPanel value={tabValue} index={3}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                👥 主要发件人分析
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>发件人</strong></TableCell>
                      <TableCell align="right"><strong>邮件数量</strong></TableCell>
                      <TableCell align="center"><strong>分类</strong></TableCell>
                      <TableCell align="center"><strong>操作</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topSenders.map((sender, index) => (
                      <TableRow key={index}>
                        <TableCell>{sender.sender}</TableCell>
                        <TableCell align="right">{sender.count}</TableCell>
                        <TableCell align="center">
                          <Chip label={sender.category} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell align="center">
                          <IconButton size="small" color="primary">
                            <FilterIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom>
                  📊 发件人分布
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topSenders} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="sender" type="category" width={200} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ReportsPage;