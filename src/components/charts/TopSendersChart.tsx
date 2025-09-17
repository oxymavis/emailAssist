import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Tooltip,
  ButtonGroup,
  Button,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  LinearProgress,
  useTheme,
  Divider,
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  TableChart as TableIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  AccessTime as TimeIcon,
  Mood as SentimentIcon,
  Fullscreen as FullscreenIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

import { TopSenderData, AdvancedChartProps } from '@/types';

interface TopSendersChartProps extends AdvancedChartProps {
  data: TopSenderData[];
  viewMode?: 'chart' | 'table';
  maxSenders?: number;
  showDetails?: boolean;
}

export const TopSendersChart: React.FC<TopSendersChartProps> = ({
  data,
  viewMode = 'table',
  height = 350,
  interactive = true,
  onDataClick,
  maxSenders = 10,
  showDetails = true,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [selectedView, setSelectedView] = useState<'chart' | 'table'>(viewMode);
  const [selectedSender, setSelectedSender] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'count' | 'responseTime' | 'sentiment'>('count');

  // 处理数据排序
  const sortedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      switch (sortBy) {
        case 'responseTime':
          return a.avgResponseTime - b.avgResponseTime;
        case 'sentiment':
          return b.sentimentScore - a.sentimentScore;
        default: // count
          return b.count - a.count;
      }
    });
    return sorted.slice(0, maxSenders);
  }, [data, sortBy, maxSenders]);

  // 获取头像颜色
  const getAvatarColor = (name: string) => {
    const colors = [
      theme.palette.primary.main,
      theme.palette.secondary.main,
      theme.palette.success.main,
      theme.palette.warning.main,
      theme.palette.error.main,
      theme.palette.info.main,
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  // 获取情感颜色
  const getSentimentColor = (score: number) => {
    if (score >= 7) return theme.palette.success.main;
    if (score >= 4) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  // 处理发件人点击
  const handleSenderClick = (sender: TopSenderData, index: number) => {
    setSelectedSender(sender.email);
    if (interactive && onDataClick) {
      onDataClick({
        ...sender,
        chartType: 'top-senders',
        index,
      });
    }
  };

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Card sx={{ p: 2, minWidth: 250 }}>
          <Box display="flex" alignItems="center" sx={{ mb: 1 }}>
            <Avatar
              sx={{
                width: 32,
                height: 32,
                backgroundColor: getAvatarColor(data.name),
                fontSize: '0.875rem',
                mr: 1,
              }}
            >
              {data.name.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="subtitle2">{data.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {data.email}
              </Typography>
            </Box>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {t('dashboard.emailCount')}: <strong>{data.count.toLocaleString()}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('dashboard.avgResponseTime')}: <strong>{data.avgResponseTime.toFixed(1)}h</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('dashboard.sentimentScore')}: <strong>{data.sentimentScore.toFixed(1)}/10</strong>
          </Typography>
        </Card>
      );
    }
    return null;
  };

  // 渲染图表视图
  const renderChartView = () => (
    <ResponsiveContainer width="100%" height={height - 100}>
      <BarChart
        data={sortedData}
        layout="horizontal"
        margin={{ top: 20, right: 30, left: 80, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" />
        <YAxis type="category" dataKey="name" width={70} />
        <RechartsTooltip content={<CustomTooltip />} />
        <Bar
          dataKey={sortBy === 'responseTime' ? 'avgResponseTime' : sortBy === 'sentiment' ? 'sentimentScore' : 'count'}
          fill={theme.palette.primary.main}
        >
          {sortedData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={selectedSender === entry.email ? theme.palette.secondary.main : getAvatarColor(entry.name)}
              style={{ cursor: interactive ? 'pointer' : 'default' }}
              onClick={() => handleSenderClick(entry, index)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  // 渲染表格视图
  const renderTableView = () => {
    const maxCount = Math.max(...sortedData.map(s => s.count));

    return (
      <List sx={{ maxHeight: height - 100, overflow: 'auto', px: 0 }}>
        {sortedData.map((sender, index) => (
          <React.Fragment key={sender.email}>
            <ListItem
              sx={{
                backgroundColor: selectedSender === sender.email 
                  ? theme.palette.action.selected 
                  : 'transparent',
                borderRadius: 1,
                cursor: interactive ? 'pointer' : 'default',
                py: 1.5,
              }}
              onClick={() => handleSenderClick(sender, index)}
            >
              <ListItemAvatar>
                <Avatar
                  sx={{
                    backgroundColor: getAvatarColor(sender.name),
                    width: 48,
                    height: 48,
                  }}
                >
                  {sender.name.charAt(0).toUpperCase()}
                </Avatar>
              </ListItemAvatar>
              
              <ListItemText
                primary={
                  <Box>
                    <Typography variant="subtitle1" fontWeight="medium">
                      {sender.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {sender.email}
                    </Typography>
                  </Box>
                }
                secondary={
                  showDetails && (
                    <Box sx={{ mt: 1 }}>
                      {/* 邮件数量进度条 */}
                      <Box sx={{ mb: 1 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" color="text.secondary">
                            {t('dashboard.emailCount')}
                          </Typography>
                          <Typography variant="caption" fontWeight="bold">
                            {sender.count.toLocaleString()}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={(sender.count / maxCount) * 100}
                          sx={{ height: 4, borderRadius: 2 }}
                        />
                      </Box>

                      {/* 统计信息 */}
                      <Box display="flex" gap={1} flexWrap="wrap">
                        <Chip
                          icon={<TimeIcon />}
                          label={`${sender.avgResponseTime.toFixed(1)}h`}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          icon={<SentimentIcon />}
                          label={`${sender.sentimentScore.toFixed(1)}/10`}
                          size="small"
                          variant="outlined"
                          sx={{
                            borderColor: getSentimentColor(sender.sentimentScore),
                            color: getSentimentColor(sender.sentimentScore),
                          }}
                        />
                      </Box>

                      {/* 紧急性分布 */}
                      {sender.urgencyDistribution && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary" gutterBottom>
                            {t('dashboard.urgencyDistribution')}:
                          </Typography>
                          <Box display="flex" gap={0.5}>
                            {Object.entries(sender.urgencyDistribution).map(([priority, count]) => (
                              <Chip
                                key={priority}
                                label={`${t(`common.${priority}`)}: ${count}`}
                                size="small"
                                variant="filled"
                                sx={{
                                  fontSize: '0.65rem',
                                  height: 20,
                                  backgroundColor: 
                                    priority === 'critical' ? theme.palette.error.main :
                                    priority === 'high' ? theme.palette.warning.main :
                                    priority === 'medium' ? theme.palette.info.main :
                                    theme.palette.success.main,
                                  color: 'white',
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  )
                }
              />

              <ListItemSecondaryAction>
                <Box textAlign="right">
                  <Typography variant="h6" fontWeight="bold" color="primary">
                    #{index + 1}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('dashboard.rank')}
                  </Typography>
                </Box>
              </ListItemSecondaryAction>
            </ListItem>
            {index < sortedData.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>
    );
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" fontWeight="bold">
            {t('dashboard.topSenders')}
          </Typography>
          
          {interactive && (
            <Box display="flex" alignItems="center" gap={1}>
              {/* 视图切换 */}
              <ButtonGroup size="small" variant="outlined">
                <Button
                  onClick={() => setSelectedView('table')}
                  variant={selectedView === 'table' ? 'contained' : 'outlined'}
                >
                  <TableIcon fontSize="small" />
                </Button>
                <Button
                  onClick={() => setSelectedView('chart')}
                  variant={selectedView === 'chart' ? 'contained' : 'outlined'}
                >
                  <BarChartIcon fontSize="small" />
                </Button>
              </ButtonGroup>

              {/* 排序选择 */}
              <ButtonGroup size="small" variant="outlined">
                <Button
                  onClick={() => setSortBy('count')}
                  variant={sortBy === 'count' ? 'contained' : 'outlined'}
                >
                  <EmailIcon fontSize="small" />
                </Button>
                <Button
                  onClick={() => setSortBy('responseTime')}
                  variant={sortBy === 'responseTime' ? 'contained' : 'outlined'}
                >
                  <TimeIcon fontSize="small" />
                </Button>
                <Button
                  onClick={() => setSortBy('sentiment')}
                  variant={sortBy === 'sentiment' ? 'contained' : 'outlined'}
                >
                  <SentimentIcon fontSize="small" />
                </Button>
              </ButtonGroup>

              {/* 工具按钮 */}
              <Tooltip title={t('common.fullscreen')}>
                <IconButton size="small">
                  <FullscreenIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('common.download')}>
                <IconButton size="small">
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>

        {/* 排序说明 */}
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>
          {t('dashboard.sortedBy')}: {
            sortBy === 'count' ? t('dashboard.emailCount') :
            sortBy === 'responseTime' ? t('dashboard.avgResponseTime') :
            t('dashboard.sentimentScore')
          }
        </Typography>
      </CardContent>
      
      <Box sx={{ flex: 1, px: selectedView === 'table' ? 2 : 0, pb: 2 }}>
        {selectedView === 'chart' ? renderChartView() : renderTableView()}
      </Box>

      {/* 选中发件人详情 */}
      {selectedSender && interactive && (
        <CardContent sx={{ pt: 0, borderTop: 1, borderColor: 'divider' }}>
          {(() => {
            const sender = sortedData.find(s => s.email === selectedSender);
            if (!sender) return null;
            
            return (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t('dashboard.selectedSender')}: {sender.name}
                </Typography>
                <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                  <Chip
                    icon={<EmailIcon />}
                    label={`${t('dashboard.emailCount')}: ${sender.count.toLocaleString()}`}
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                  <Chip
                    icon={<TimeIcon />}
                    label={`${t('dashboard.avgResponseTime')}: ${sender.avgResponseTime.toFixed(1)}h`}
                    variant="outlined"
                    size="small"
                  />
                  <Chip
                    icon={<SentimentIcon />}
                    label={`${t('dashboard.sentimentScore')}: ${sender.sentimentScore.toFixed(1)}/10`}
                    variant="outlined"
                    size="small"
                    sx={{
                      borderColor: getSentimentColor(sender.sentimentScore),
                      color: getSentimentColor(sender.sentimentScore),
                    }}
                  />
                </Box>
              </Box>
            );
          })()}
        </CardContent>
      )}
    </Card>
  );
};

export default TopSendersChart;