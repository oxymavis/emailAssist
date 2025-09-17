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
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  useTheme,
  Divider,
} from '@mui/material';
import {
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  AccountTree as TreeViewIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
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
  PieChart,
  Pie,
  Cell,
  Treemap,
} from 'recharts';

import { CategoryData, AdvancedChartProps } from '@/types';

interface CategoryDistributionChartProps extends AdvancedChartProps {
  data: CategoryData[];
  chartType?: 'bar' | 'pie' | 'treemap';
  showSubcategories?: boolean;
  maxCategories?: number;
}

export const CategoryDistributionChart: React.FC<CategoryDistributionChartProps> = ({
  data,
  chartType = 'bar',
  height = 350,
  interactive = true,
  onDataClick,
  showSubcategories = true,
  maxCategories = 10,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [selectedChart, setSelectedChart] = useState<'bar' | 'pie' | 'treemap'>(chartType);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // 处理展开/折叠
  const handleExpand = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName);
    } else {
      newExpanded.add(categoryName);
    }
    setExpandedCategories(newExpanded);
  };

  // 处理数据点击
  const handleCategoryClick = (data: any, index: number) => {
    setSelectedCategory(data.name);
    if (interactive && onDataClick) {
      onDataClick({
        ...data,
        chartType: 'category-distribution',
        index,
      });
    }
  };

  // 处理显示的数据（限制数量）
  const displayData = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.count - a.count);
    return sorted.slice(0, maxCategories);
  }, [data, maxCategories]);

  // 准备树图数据
  const treemapData = useMemo(() => {
    return displayData.map(item => ({
      name: item.name,
      size: item.count,
      fill: item.color,
      percentage: item.percentage,
    }));
  }, [displayData]);

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Card sx={{ p: 2, minWidth: 200 }}>
          <Typography variant="subtitle2" gutterBottom>
            {data.name || label}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('common.count')}: <strong>{data.count || data.size || payload[0].value}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('common.percentage')}: <strong>{data.percentage?.toFixed(1) || 0}%</strong>
          </Typography>
        </Card>
      );
    }
    return null;
  };

  // 自定义树图内容
  const CustomizedTreemapContent = (props: any) => {
    const { root, depth, x, y, width, height, index, payload, colors, rank, name } = props;
    
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: payload.fill,
            stroke: selectedCategory === name ? theme.palette.common.black : '#fff',
            strokeWidth: selectedCategory === name ? 2 : 1,
            strokeOpacity: 0.6,
            cursor: interactive ? 'pointer' : 'default',
          }}
          onClick={() => handleCategoryClick(payload, index)}
        />
        {width > 60 && height > 40 && (
          <>
            <text
              x={x + width / 2}
              y={y + height / 2 - 8}
              textAnchor="middle"
              fill="#fff"
              fontSize="12"
              fontWeight="bold"
            >
              {name}
            </text>
            <text
              x={x + width / 2}
              y={y + height / 2 + 8}
              textAnchor="middle"
              fill="#fff"
              fontSize="10"
            >
              {payload.size}
            </text>
          </>
        )}
      </g>
    );
  };

  // 渲染条形图
  const renderBarChart = () => (
    <BarChart data={displayData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis 
        dataKey="name"
        angle={-45}
        textAnchor="end"
        height={80}
        interval={0}
      />
      <YAxis />
      <RechartsTooltip content={<CustomTooltip />} />
      <Bar
        dataKey="count"
        fill={theme.palette.primary.main}
        onClick={handleCategoryClick}
        style={{ cursor: interactive ? 'pointer' : 'default' }}
      >
        {displayData.map((entry, index) => (
          <Cell 
            key={`cell-${index}`} 
            fill={entry.color}
            stroke={selectedCategory === entry.name ? theme.palette.common.black : 'none'}
            strokeWidth={selectedCategory === entry.name ? 2 : 0}
          />
        ))}
      </Bar>
    </BarChart>
  );

  // 渲染饼图
  const renderPieChart = () => (
    <PieChart>
      <Pie
        data={displayData}
        cx="50%"
        cy="50%"
        labelLine={false}
        label={({ name, percentage }) => `${name} (${percentage.toFixed(1)}%)`}
        outerRadius={100}
        fill="#8884d8"
        dataKey="count"
        onClick={handleCategoryClick}
        style={{ cursor: interactive ? 'pointer' : 'default' }}
      >
        {displayData.map((entry, index) => (
          <Cell 
            key={`cell-${index}`} 
            fill={entry.color}
            stroke={selectedCategory === entry.name ? theme.palette.common.black : 'none'}
            strokeWidth={selectedCategory === entry.name ? 2 : 0}
          />
        ))}
      </Pie>
      <RechartsTooltip content={<CustomTooltip />} />
    </PieChart>
  );

  // 渲染树图
  const renderTreemap = () => (
    <Treemap
      width={400}
      height={height - 100}
      data={treemapData}
      dataKey="size"
      aspectRatio={4 / 3}
      stroke="#fff"
      fill={theme.palette.primary.main}
      content={<CustomizedTreemapContent />}
    >
      <RechartsTooltip content={<CustomTooltip />} />
    </Treemap>
  );

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" fontWeight="bold">
            {t('reports.categoriesStatistics')}
          </Typography>
          
          {interactive && (
            <Box display="flex" alignItems="center" gap={1}>
              {/* 图表类型切换 */}
              <ButtonGroup size="small" variant="outlined">
                <Button
                  onClick={() => setSelectedChart('bar')}
                  variant={selectedChart === 'bar' ? 'contained' : 'outlined'}
                >
                  <BarChartIcon fontSize="small" />
                </Button>
                <Button
                  onClick={() => setSelectedChart('pie')}
                  variant={selectedChart === 'pie' ? 'contained' : 'outlined'}
                >
                  <PieChartIcon fontSize="small" />
                </Button>
                <Button
                  onClick={() => setSelectedChart('treemap')}
                  variant={selectedChart === 'treemap' ? 'contained' : 'outlined'}
                >
                  <TreeViewIcon fontSize="small" />
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
      </CardContent>
      
      <Box sx={{ flex: 1, px: 2, pb: 2 }}>
        <ResponsiveContainer width="100%" height={height - 120}>
          {selectedChart === 'bar' && renderBarChart()}
          {selectedChart === 'pie' && renderPieChart()}
          {selectedChart === 'treemap' && renderTreemap()}
        </ResponsiveContainer>
      </Box>

      {/* 分类详情列表 */}
      {showSubcategories && selectedChart !== 'treemap' && (
        <CardContent sx={{ pt: 0 }}>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            {t('dashboard.categoryDetails')}
          </Typography>
          <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
            {displayData.map((category, index) => (
              <React.Fragment key={index}>
                <ListItem
                  sx={{
                    backgroundColor: selectedCategory === category.name 
                      ? theme.palette.action.selected 
                      : 'transparent',
                    borderRadius: 1,
                    cursor: interactive ? 'pointer' : 'default',
                  }}
                  onClick={() => handleCategoryClick(category, index)}
                >
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Typography variant="body2" fontWeight="medium">
                          {category.name}
                        </Typography>
                        <Chip
                          label={`${category.count} (${category.percentage.toFixed(1)}%)`}
                          size="small"
                          sx={{ backgroundColor: category.color, color: 'white' }}
                        />
                      </Box>
                    }
                  />
                  {category.subcategories && category.subcategories.length > 0 && (
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExpand(category.name);
                        }}
                      >
                        {expandedCategories.has(category.name) ? 
                          <ExpandLessIcon /> : <ExpandMoreIcon />
                        }
                      </IconButton>
                    </ListItemSecondaryAction>
                  )}
                </ListItem>

                {/* 子分类 */}
                {category.subcategories && (
                  <Collapse in={expandedCategories.has(category.name)} timeout="auto" unmountOnExit>
                    <List dense sx={{ pl: 2 }}>
                      {category.subcategories.map((subcat, subIndex) => (
                        <ListItem key={subIndex} sx={{ py: 0.5 }}>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center" justifyContent="space-between">
                                <Typography variant="caption" color="text.secondary">
                                  {subcat.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {subcat.count} ({subcat.percentage.toFixed(1)}%)
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Collapse>
                )}
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      )}
    </Card>
  );
};

export default CategoryDistributionChart;