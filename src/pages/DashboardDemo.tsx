import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Divider,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  PlayArrow as PlayIcon,
} from '@mui/icons-material';

import { AdvancedDashboard } from './AdvancedDashboard';

const DashboardDemo: React.FC = () => {
  const { t } = useTranslation();
  const [showDemo, setShowDemo] = React.useState(false);

  if (showDemo) {
    return <AdvancedDashboard />;
  }

  return (
    <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto' }}>
      {/* 页面标题 */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h3" fontWeight="bold" gutterBottom>
          P1.1 高级数据可视化仪表板
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
          基于React + TypeScript + Material-UI的现代化仪表板系统
        </Typography>
        <Button
          variant="contained"
          size="large"
          startIcon={<PlayIcon />}
          onClick={() => setShowDemo(true)}
          sx={{ px: 4, py: 1.5 }}
        >
          启动高级仪表板演示
        </Button>
      </Box>

      {/* 功能特性展示 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" sx={{ mb: 2 }}>
                <DashboardIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6" fontWeight="bold">
                  交互式图表组件
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                6种专业图表组件，支持数据钻取、筛选、导出等高级功能
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={0.5}>
                <Chip label="邮件量趋势" size="small" variant="outlined" />
                <Chip label="情感分析" size="small" variant="outlined" />
                <Chip label="分类分布" size="small" variant="outlined" />
                <Chip label="优先级热力图" size="small" variant="outlined" />
                <Chip label="响应时间" size="small" variant="outlined" />
                <Chip label="主要发件人" size="small" variant="outlined" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" sx={{ mb: 2 }}>
                <AnalyticsIcon color="secondary" sx={{ mr: 1 }} />
                <Typography variant="h6" fontWeight="bold">
                  拖拽式布局系统
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                基于react-grid-layout的可自定义仪表板布局，支持响应式设计
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={0.5}>
                <Chip label="拖拽重排" size="small" variant="outlined" />
                <Chip label="自由调整大小" size="small" variant="outlined" />
                <Chip label="布局保存" size="small" variant="outlined" />
                <Chip label="响应式适配" size="small" variant="outlined" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" sx={{ mb: 2 }}>
                <TrendingUpIcon color="success" sx={{ mr: 1 }} />
                <Typography variant="h6" fontWeight="bold">
                  实时数据更新
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                WebSocket实时数据同步，自动刷新机制，保持数据最新状态
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={0.5}>
                <Chip label="WebSocket" size="small" variant="outlined" />
                <Chip label="自动刷新" size="small" variant="outlined" />
                <Chip label="状态管理" size="small" variant="outlined" />
                <Chip label="通知系统" size="small" variant="outlined" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Divider sx={{ my: 4 }} />

      {/* 技术架构说明 */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          技术架构与特性
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" color="primary" gutterBottom>
              前端技术栈
            </Typography>
            <Box component="ul" sx={{ pl: 2, mb: 2 }}>
              <li>React 18 + TypeScript - 现代化类型安全开发</li>
              <li>Material-UI v5 - 专业设计系统</li>
              <li>Zustand - 轻量级状态管理</li>
              <li>React-Grid-Layout - 拖拽式布局</li>
              <li>Recharts - 高性能图表库</li>
              <li>WebSocket - 实时数据通信</li>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="h6" color="secondary" gutterBottom>
              核心功能特性
            </Typography>
            <Box component="ul" sx={{ pl: 2, mb: 2 }}>
              <li>6种交互式图表组件，支持数据钻取</li>
              <li>可拖拽的仪表板布局系统</li>
              <li>实时数据更新与WebSocket集成</li>
              <li>多维度数据筛选与时间范围选择</li>
              <li>响应式设计，支持移动端访问</li>
              <li>数据导出与布局保存功能</li>
            </Box>
          </Grid>
        </Grid>

        <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>开发进度：</strong>
            前端高级可视化仪表板 ✅ 已完成 | 
            后端API集成 ⚪ 待集成 | 
            WebSocket实时通信 ⚪ 待配置 | 
            生产环境部署 ⚪ 待部署
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default DashboardDemo;