import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  useTheme,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Chip,
  LinearProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';
import {
  FullscreenOutlined,
  DownloadOutlined,
  PersonOutlined,
  EmailOutlined,
  AccessTimeOutlined,
  SentimentSatisfiedOutlined,
  SentimentNeutralOutlined,
  SentimentDissatisfiedOutlined,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
} from 'recharts';

import { TopSenderData, WidgetConfig } from '@/types';

interface TopSendersChartProps {
  data: TopSenderData[];
  config?: WidgetConfig;
  onDataClick?: (data: any) => void;
  onExport?: () => void;
  onFullscreen?: () => void;
  height?: number;
}

const TopSendersChart: React.FC<TopSendersChartProps> = ({
  data,
  config = {
    viewMode: 'table',
    maxSenders: 10,
    showDetails: true,
  },
  onDataClick,
  onExport,
  onFullscreen,
  height = 400,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // 视图模式状态
  const [viewMode, setViewMode] = React.useState<'table' | 'chart' | 'cards'>(
    (config.viewMode as 'table' | 'chart' | 'cards') || 'table'
  );

  // 限制显示数量
  const maxSenders = config.maxSenders || 10;

  // 处理和排序数据
  const processedData = useMemo(() => {
    return data
      .sort((a, b) => b.count - a.count)
      .slice(0, maxSenders)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
        displayName: item.name || item.email.split('@')[0],
        avgResponseHours: Math.round(item.avgResponseTime * 100) / 100,
        sentimentLevel: item.sentimentScore >= 0.7 ? 'positive' : 
                       item.sentimentScore >= 0.3 ? 'neutral' : 'negative',
      }));
  }, [data, maxSenders]);

  // 计算统计指标
  const statistics = useMemo(() => {
    if (processedData.length === 0) return null;

    const totalEmails = processedData.reduce((sum, item) => sum + item.count, 0);
    const avgResponseTime = processedData.reduce((sum, item) => sum + item.avgResponseTime * item.count, 0) / totalEmails;
    const avgSentiment = processedData.reduce((sum, item) => sum + item.sentimentScore * item.count, 0) / totalEmails;
    
    const topSender = processedData[0];
    const fastestResponder = processedData.reduce((fastest, current) => 
      current.avgResponseTime < fastest.avgResponseTime ? current : fastest
    );

    return {
      totalEmails,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      avgSentiment: Math.round(avgSentiment * 100) / 100,
      topSender,
      fastestResponder,
    };
  }, [processedData]);

  // 获取情感图标
  const getSentimentIcon = (level: string) => {
    switch (level) {
      case 'positive':
        return <SentimentSatisfiedOutlined sx={{ color: theme.palette.success.main }} />;
      case 'negative':
        return <SentimentDissatisfiedOutlined sx={{ color: theme.palette.error.main }} />;
      default:
        return <SentimentNeutralOutlined sx={{ color: theme.palette.warning.main }} />;
    }
  };

  // 获取头像颜色
  const getAvatarColor = (index: number) => {
    const colors = [
      theme.palette.primary.main,
      theme.palette.secondary.main,
      theme.palette.success.main,
      theme.palette.warning.main,
      theme.palette.info.main,
      theme.palette.error.main,
    ];
    return colors[index % colors.length];
  };

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Card elevation={3}>
          <CardContent sx={{ p: 2 }}>
            <Box display="flex" alignItems="center" sx={{ mb: 1 }}>
              <Avatar sx={{ bgcolor: getAvatarColor(data.rank - 1), width: 32, height: 32, mr: 1 }}>
                {data.displayName.charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="subtitle2">
                  {data.displayName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {data.email}
                </Typography>
              </Box>
            </Box>
            <Typography variant="body2" gutterBottom>
              {t('dashboard.emailCount')}: <strong>{data.count}</strong>
            </Typography>
            <Typography variant="body2" gutterBottom>
              {t('dashboard.avgResponseTime')}: <strong>{data.avgResponseHours}h</strong>
            </Typography>
            <Typography variant="body2" gutterBottom>
              {t('dashboard.sentimentScore')}: <strong>{Math.round(data.sentimentScore * 100)}%</strong>
            </Typography>
            <Box display="flex" alignItems="center" sx={{ mt: 1 }}>
              {getSentimentIcon(data.sentimentLevel)}
              <Typography variant="caption" sx={{ ml: 0.5 }}>
                {t(`sentiment.${data.sentimentLevel}`)}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  // 处理数据点击
  const handleDataClick = (data: any, index?: number) => {
    if (onDataClick) {
      onDataClick({ ...data, index });
    }
  };

  // 渲染图表视图
  const renderChartView = () => (
    <Box sx={{ height: height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={processedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          onClick={(data) => handleDataClick(data.activePayload?.[0]?.payload)}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis 
            dataKey="displayName" 
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            label={{ value: t('dashboard.emailCount'), angle: -90, position: 'insideLeft' }}
          />
          <RechartsTooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="count" 
            radius={[4, 4, 0, 0]}
            cursor="pointer"
          >
            {processedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getAvatarColor(index)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );

  // 渲染表格视图
  const renderTableView = () => (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>{t('dashboard.rank')}</TableCell>
          <TableCell>{t('dashboard.sender')}</TableCell>
          <TableCell align="right">{t('dashboard.emailCount')}</TableCell>
          <TableCell align="right">{t('dashboard.avgResponse')}</TableCell>
          <TableCell align="center">{t('dashboard.sentiment')}</TableCell>
          {config.showDetails && <TableCell align="center">{t('dashboard.priority')}</TableCell>}
        </TableRow>
      </TableHead>
      <TableBody>
        {processedData.map((sender, index) => (
          <TableRow 
            key={sender.email} 
            hover 
            sx={{ cursor: 'pointer' }}
            onClick={() => handleDataClick(sender, index)}
          >
            <TableCell>
              <Chip 
                label={sender.rank} 
                size="small"
                color={sender.rank <= 3 ? 'primary' : 'default'}
                variant={sender.rank <= 3 ? 'filled' : 'outlined'}
              />
            </TableCell>
            <TableCell>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ bgcolor: getAvatarColor(index), width: 32, height: 32, mr: 1 }}>
                  {sender.displayName.charAt(0).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="body2" fontWeight="500">
                    {sender.displayName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {sender.email}
                  </Typography>
                </Box>
              </Box>
            </TableCell>
            <TableCell align="right">
              <Typography variant="body2" fontWeight="bold">
                {sender.count.toLocaleString()}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={(sender.count / processedData[0].count) * 100}
                sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
              />
            </TableCell>
            <TableCell align="right">
              <Typography 
                variant="body2" 
                color={sender.avgResponseTime <= 2 ? 'success.main' : 'warning.main'}
                fontWeight="500"
              >
                {sender.avgResponseHours}h
              </Typography>
            </TableCell>
            <TableCell align="center">
              <Box display="flex" alignItems="center" justifyContent="center">
                {getSentimentIcon(sender.sentimentLevel)}
                <Typography variant="caption" sx={{ ml: 0.5 }}>
                  {Math.round(sender.sentimentScore * 100)}%
                </Typography>
              </Box>
            </TableCell>
            {config.showDetails && (
              <TableCell align="center">
                <Box display="flex" gap={0.5} justifyContent="center">
                  {Object.entries(sender.urgencyDistribution).map(([priority, count]) => (
                    count > 0 && (
                      <Chip
                        key={priority}
                        size="small"
                        label={count}
                        color={
                          priority === 'critical' ? 'error' :
                          priority === 'high' ? 'warning' :
                          priority === 'normal' ? 'info' : 'default'
                        }
                        variant="outlined"
                        sx={{ minWidth: 24, height: 16, fontSize: '10px' }}
                      />
                    )
                  ))}
                </Box>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  // 渲染卡片视图
  const renderCardsView = () => (
    <List sx={{ maxHeight: height, overflow: 'auto' }}>
      {processedData.map((sender, index) => (
        <ListItem 
          key={sender.email}
          button
          onClick={() => handleDataClick(sender, index)}
          sx={{ 
            border: 1, 
            borderColor: 'divider', 
            borderRadius: 1, 
            mb: 1,
            '&:hover': {
              borderColor: 'primary.main',
            },
          }}
        >
          <ListItemAvatar>
            <Avatar sx={{ bgcolor: getAvatarColor(index) }}>
              {sender.displayName.charAt(0).toUpperCase()}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2" fontWeight="500">
                  #{sender.rank} {sender.displayName}
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip size="small" label={`${sender.count} emails`} />
                  {getSentimentIcon(sender.sentimentLevel)}
                </Box>
              </Box>
            }
            secondary={
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  {sender.email}
                </Typography>
                <Box display="flex" gap={2} sx={{ mt: 0.5 }}>
                  <Box display="flex" alignItems="center">
                    <AccessTimeOutlined fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
                    <Typography variant="caption">
                      {sender.avgResponseHours}h avg
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Sentiment: {Math.round(sender.sentimentScore * 100)}%
                  </Typography>
                </Box>
              </Box>
            }
          />
        </ListItem>
      ))}
    </List>
  );

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3, height: '100%' }}>
        {/* 头部控制区 */}
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              {t('dashboard.topSenders')}
            </Typography>
            {statistics && (
              <Box display="flex" alignItems="center" gap={2}>
                <Box display="flex" alignItems="center">
                  <PersonOutlined fontSize="small" color="primary" sx={{ mr: 0.5 }} />
                  <Typography variant="caption" color="text.secondary">
                    {t('dashboard.topSender')}: {statistics.topSender.displayName}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center">
                  <EmailOutlined fontSize="small" color="info" sx={{ mr: 0.5 }} />
                  <Typography variant="caption" color="text.secondary">
                    {statistics.totalEmails.toLocaleString()} {t('dashboard.totalEmails')}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
          
          <Box display="flex" alignItems="center" gap={1}>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as typeof viewMode)}
                variant="outlined"
              >
                <MenuItem value="table">{t('dashboard.tableView')}</MenuItem>
                <MenuItem value="chart">{t('dashboard.chartView')}</MenuItem>
                <MenuItem value="cards">{t('dashboard.cardsView')}</MenuItem>
              </Select>
            </FormControl>
            
            <Tooltip title={t('dashboard.exportData')}>
              <IconButton size="small" onClick={onExport}>
                <DownloadOutlined />
              </IconButton>
            </Tooltip>
            
            <Tooltip title={t('dashboard.fullscreen')}>
              <IconButton size="small" onClick={onFullscreen}>
                <FullscreenOutlined />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* 统计概览 */}
        {statistics && (
          <Box display="flex" gap={3} sx={{ mb: 3 }}>
            <Box>
              <Typography variant="h6" color="primary.main" fontWeight="bold">
                {statistics.avgResponseTime}h
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('dashboard.avgResponseTime')}
              </Typography>
            </Box>
            <Box>
              <Typography variant="h6" color="success.main" fontWeight="bold">
                {Math.round(statistics.avgSentiment * 100)}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('dashboard.avgSentiment')}
              </Typography>
            </Box>
            <Box>
              <Typography variant="h6" color="info.main" fontWeight="bold">
                {statistics.fastestResponder.avgResponseHours}h
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('dashboard.fastestResponse')}
              </Typography>
            </Box>
          </Box>
        )}

        {/* 主要内容区域 */}
        <Box sx={{ height: 'calc(100% - 160px)', overflow: 'hidden' }}>
          {viewMode === 'chart' && renderChartView()}
          {viewMode === 'table' && (
            <Box sx={{ height: '100%', overflow: 'auto' }}>
              {renderTableView()}
            </Box>
          )}
          {viewMode === 'cards' && renderCardsView()}
        </Box>
      </CardContent>
    </Card>
  );
};

export default TopSendersChart;