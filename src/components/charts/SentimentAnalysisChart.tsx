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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  useTheme,
  Chip,
} from '@mui/material';
import {
  PieChart as PieChartIcon,
  DonutLarge as DonutIcon,
  Fullscreen as FullscreenIcon,
  Download as DownloadIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  SentimentSatisfiedAlt as PositiveIcon,
  SentimentNeutral as NeutralIcon,
  SentimentDissatisfied as NegativeIcon,
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';

import { SentimentData, AdvancedChartProps } from '@/types';

interface SentimentAnalysisChartProps extends AdvancedChartProps {
  data: SentimentData[];
  chartType?: 'pie' | 'donut';
  showDetails?: boolean;
  showTrends?: boolean;
}

export const SentimentAnalysisChart: React.FC<SentimentAnalysisChartProps> = ({
  data,
  chartType = 'donut',
  height = 350,
  interactive = true,
  onDataClick,
  showDetails = true,
  showTrends = true,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [selectedChart, setSelectedChart] = useState<'pie' | 'donut'>(chartType);
  const [selectedSentiment, setSelectedSentiment] = useState<string | null>(null);

  // 情感图标映射
  const sentimentIcons = {
    positive: <PositiveIcon sx={{ color: theme.palette.success.main }} />,
    neutral: <NeutralIcon sx={{ color: theme.palette.warning.main }} />,
    negative: <NegativeIcon sx={{ color: theme.palette.error.main }} />,
  };

  // 处理数据点击
  const handlePieClick = (data: any, index: number) => {
    setSelectedSentiment(data.sentiment);
    if (interactive && onDataClick) {
      onDataClick({
        ...data,
        chartType: 'sentiment-analysis',
        index,
      });
    }
  };

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Card sx={{ p: 2, minWidth: 200 }}>
          <Box display="flex" alignItems="center" sx={{ mb: 1 }}>
            {sentimentIcons[data.sentiment as keyof typeof sentimentIcons]}
            <Typography variant="subtitle2" sx={{ ml: 1 }}>
              {t(`common.${data.sentiment}`)}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {t('common.count')}: <strong>{data.count.toLocaleString()}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('common.percentage')}: <strong>{data.percentage.toFixed(1)}%</strong>
          </Typography>
          {showTrends && (
            <Box display="flex" alignItems="center" sx={{ mt: 1 }}>
              {data.trend > 0 ? (
                <TrendingUpIcon fontSize="small" sx={{ color: 'success.main', mr: 0.5 }} />
              ) : (
                <TrendingDownIcon fontSize="small" sx={{ color: 'error.main', mr: 0.5 }} />
              )}
              <Typography
                variant="caption"
                sx={{
                  color: data.trend > 0 ? 'success.main' : 'error.main',
                  fontWeight: 500,
                }}
              >
                {data.trend > 0 ? '+' : ''}{data.trend.toFixed(1)}%
              </Typography>
            </Box>
          )}
        </Card>
      );
    }
    return null;
  };

  // 自定义标签
  const renderCustomizedLabel = (entry: any) => {
    const RADIAN = Math.PI / 180;
    const radius = entry.innerRadius + (entry.outerRadius - entry.innerRadius) * 0.5;
    const x = entry.cx + radius * Math.cos(-entry.midAngle * RADIAN);
    const y = entry.cy + radius * Math.sin(-entry.midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > entry.cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize="12"
        fontWeight="bold"
      >
        {`${entry.percentage.toFixed(0)}%`}
      </text>
    );
  };

  // 计算总数
  const totalCount = useMemo(() => {
    return data.reduce((sum, item) => sum + item.count, 0);
  }, [data]);

  // 渲染饼图
  const renderPieChart = () => {
    const innerRadius = selectedChart === 'donut' ? 60 : 0;
    
    return (
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderCustomizedLabel}
          outerRadius={120}
          innerRadius={innerRadius}
          fill="#8884d8"
          dataKey="count"
          onClick={handlePieClick}
          style={{ cursor: interactive ? 'pointer' : 'default' }}
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={entry.color}
              stroke={selectedSentiment === entry.sentiment ? theme.palette.common.black : 'none'}
              strokeWidth={selectedSentiment === entry.sentiment ? 2 : 0}
            />
          ))}
        </Pie>
        <RechartsTooltip content={<CustomTooltip />} />
      </PieChart>
    );
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" fontWeight="bold">
            {t('dashboard.sentimentAnalysis')}
          </Typography>
          
          {interactive && (
            <Box display="flex" alignItems="center" gap={1}>
              {/* 图表类型切换 */}
              <ButtonGroup size="small" variant="outlined">
                <Button
                  onClick={() => setSelectedChart('pie')}
                  variant={selectedChart === 'pie' ? 'contained' : 'outlined'}
                >
                  <PieChartIcon fontSize="small" />
                </Button>
                <Button
                  onClick={() => setSelectedChart('donut')}
                  variant={selectedChart === 'donut' ? 'contained' : 'outlined'}
                >
                  <DonutIcon fontSize="small" />
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

        {/* 中心统计信息（仅环形图显示） */}
        {selectedChart === 'donut' && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              zIndex: 1,
              pointerEvents: 'none',
            }}
          >
            <Typography variant="h4" fontWeight="bold" color="primary">
              {totalCount.toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('dashboard.totalAnalyzed')}
            </Typography>
          </Box>
        )}
      </CardContent>
      
      <Box sx={{ flex: 1, position: 'relative' }}>
        <ResponsiveContainer width="100%" height={height - 100}>
          {renderPieChart()}
        </ResponsiveContainer>
      </Box>

      {/* 详细信息列表 */}
      {showDetails && (
        <CardContent sx={{ pt: 0 }}>
          <List dense>
            {data.map((item, index) => (
              <ListItem
                key={index}
                sx={{
                  py: 0.5,
                  backgroundColor: selectedSentiment === item.sentiment 
                    ? theme.palette.action.selected 
                    : 'transparent',
                  borderRadius: 1,
                  cursor: interactive ? 'pointer' : 'default',
                }}
                onClick={() => handlePieClick(item, index)}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {sentimentIcons[item.sentiment as keyof typeof sentimentIcons]}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Typography variant="body2" fontWeight="medium">
                        {t(`common.${item.sentiment}`)}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip
                          label={`${item.count.toLocaleString()} (${item.percentage.toFixed(1)}%)`}
                          size="small"
                          sx={{ backgroundColor: item.color, color: 'white' }}
                        />
                        {showTrends && (
                          <Box display="flex" alignItems="center">
                            {item.trend > 0 ? (
                              <TrendingUpIcon fontSize="small" sx={{ color: 'success.main' }} />
                            ) : (
                              <TrendingDownIcon fontSize="small" sx={{ color: 'error.main' }} />
                            )}
                            <Typography
                              variant="caption"
                              sx={{
                                color: item.trend > 0 ? 'success.main' : 'error.main',
                                fontWeight: 500,
                                ml: 0.5,
                              }}
                            >
                              {item.trend > 0 ? '+' : ''}{item.trend.toFixed(1)}%
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      )}
    </Card>
  );
};

export default SentimentAnalysisChart;