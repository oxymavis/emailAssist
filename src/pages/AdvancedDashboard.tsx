import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Drawer,
  useTheme,
  useMediaQuery,
} from '@mui/material';

import { LoadingState, SkeletonCard } from '@/components/common/Loading';
import { DashboardGrid } from '@/components/dashboard/DashboardGrid';
import { DashboardControls } from '@/components/dashboard/DashboardControls';
import { DrillDownModal } from '@/components/dashboard/DrillDownModal';
import { 
  useDashboardState, 
  useDashboardWidgets, 
  useDashboardFilters, 
  useChartData, 
  useDrillDown,
  useNotifications 
} from '@/store';
import { mockDataService } from '@/services/mockData';
import { useWebSocket } from '@/services/websocket';
import { Layout } from 'react-grid-layout';
import { TimeRange, DrillDownConfig } from '@/types';

export const AdvancedDashboard: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Store hooks
  const { dashboardState, setEditMode, updateDashboardLayout } = useDashboardState();
  const { widgets, layouts, addWidget, removeWidget, updateWidget } = useDashboardWidgets();
  const { globalFilters, refreshInterval, setGlobalFilters, setRefreshInterval } = useDashboardFilters();
  const { 
    emailVolumeData, 
    sentimentData, 
    categoryData, 
    priorityHeatmapData, 
    responseTimeData, 
    topSendersData,
    setEmailVolumeData,
    setSentimentData,
    setCategoryData,
    setPriorityHeatmapData,
    setResponseTimeData,
    setTopSendersData
  } = useChartData();
  const { drillDownConfig, setDrillDownConfig, updateDrillDownConfig } = useDrillDown();
  const { addNotification } = useNotifications();

  // 本地状态
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
    preset: 'month',
  });

  // WebSocket配置
  const webSocketConfig = {
    url: 'ws://localhost:3001/ws', // 根据实际后端配置调整
    reconnectInterval: 5000,
    maxReconnectAttempts: 5,
    isConnected: false,
  };

  const { isConnected, subscribe } = useWebSocket(webSocketConfig);

  // 初始化数据
  const loadChartData = useCallback(async () => {
    try {
      setRefreshing(true);

      // 并行加载所有图表数据
      const [
        emailVolume,
        sentiment,
        category,
        heatmap,
        responseTime,
        topSenders
      ] = await Promise.all([
        mockDataService.getEmailVolumeData(30),
        mockDataService.getSentimentAnalysisData(),
        mockDataService.getCategoryDistributionData(),
        mockDataService.getPriorityHeatmapData(),
        mockDataService.getResponseTimeData(14),
        mockDataService.getTopSendersData(10),
      ]);

      // 更新store中的数据
      setEmailVolumeData(emailVolume);
      setSentimentData(sentiment);
      setCategoryData(category);
      setPriorityHeatmapData(heatmap);
      setResponseTimeData(responseTime);
      setTopSendersData(topSenders);

      addNotification({
        type: 'success',
        title: t('dashboard.dataRefreshed'),
        message: t('dashboard.dataRefreshSuccess'),
      });

    } catch (error) {
      console.error('Failed to load chart data:', error);
      addNotification({
        type: 'error',
        title: t('dashboard.dataRefreshError'),
        message: t('common.loadingError'),
      });
    } finally {
      setRefreshing(false);
    }
  }, [
    setEmailVolumeData,
    setSentimentData,
    setCategoryData,
    setPriorityHeatmapData,
    setResponseTimeData,
    setTopSendersData,
    addNotification,
    t
  ]);

  // 初始化仪表板
  useEffect(() => {
    const initializeDashboard = async () => {
      setLoading(true);
      await loadChartData();
      setLoading(false);
    };

    initializeDashboard();
  }, [loadChartData]);

  // 设置自动刷新
  useEffect(() => {
    if (refreshInterval > 0) {
      const intervalId = setInterval(loadChartData, refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [refreshInterval, loadChartData]);

  // WebSocket实时数据订阅
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribeStats = subscribe('stats-update', (data) => {
      console.log('Received stats update:', data);
      // 可以在这里更新特定的统计数据
      loadChartData();
    });

    const unsubscribeEmail = subscribe('email-received', (data) => {
      console.log('New email received:', data);
      // 实时更新邮件量数据
      loadChartData();
    });

    return () => {
      unsubscribeStats?.();
      unsubscribeEmail?.();
    };
  }, [isConnected, subscribe, loadChartData]);

  // 处理布局变化
  const handleLayoutChange = useCallback((layout: Layout[], layouts: any) => {
    updateDashboardLayout(layout);
  }, [updateDashboardLayout]);

  // 处理组件数据点击（钻取）
  const handleWidgetDataClick = useCallback((data: any) => {
    if (!data.chartType) return;

    // 创建钻取配置
    const drillConfig: DrillDownConfig = {
      enabled: true,
      currentLevel: 0,
      breadcrumbs: [t('dashboard.overview')],
      levels: [
        {
          field: 'date',
          label: t('dashboard.overview'),
        },
        {
          field: 'category',
          label: t('dashboard.byCategory'),
          chartType: data.chartType,
        },
        {
          field: 'sender',
          label: t('dashboard.bySender'),
          chartType: 'table',
        },
      ],
    };

    setDrillDownConfig(drillConfig);
  }, [setDrillDownConfig, t]);

  // 处理全屏切换
  const handleFullscreenToggle = () => {
    setIsFullscreen(!isFullscreen);
  };

  // 处理时间范围变化
  const handleTimeRangeChange = useCallback((newTimeRange: TimeRange) => {
    setTimeRange(newTimeRange);
    loadChartData(); // 重新加载数据
  }, [loadChartData]);

  // 处理导出
  const handleExport = useCallback(() => {
    addNotification({
      type: 'info',
      title: t('dashboard.exportStarted'),
      message: t('dashboard.exportInProgress'),
    });
    
    // 实现导出逻辑
    setTimeout(() => {
      addNotification({
        type: 'success',
        title: t('dashboard.exportCompleted'),
        message: t('dashboard.exportSuccess'),
      });
    }, 2000);
  }, [addNotification, t]);

  // 处理布局保存
  const handleSaveLayout = useCallback(() => {
    // 保存当前布局到自定义布局
    const layoutName = `layout-${Date.now()}`;
    // 这里可以实现保存到服务器或本地存储
    addNotification({
      type: 'success',
      title: t('dashboard.layoutSaved'),
      message: t('dashboard.layoutSaveSuccess'),
    });
  }, [addNotification, t]);

  // 处理布局重置
  const handleResetLayout = useCallback(() => {
    // 重置到默认布局
    addNotification({
      type: 'info',
      title: t('dashboard.layoutReset'),
      message: t('dashboard.layoutResetSuccess'),
    });
  }, [addNotification, t]);

  const chartData = {
    emailVolumeData,
    sentimentData,
    categoryData,
    priorityHeatmapData,
    responseTimeData,
    topSendersData,
  };

  return (
    <Box sx={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      bgcolor: 'background.default',
    }}>
      {/* 控制工具栏 */}
      <Box sx={{ 
        borderBottom: 1, 
        borderColor: 'divider',
        bgcolor: 'background.paper',
        zIndex: theme.zIndex.appBar,
      }}>
        <DashboardControls
          isEditMode={dashboardState.isEditMode}
          onEditModeChange={setEditMode}
          onSaveLayout={handleSaveLayout}
          onResetLayout={handleResetLayout}
          onRefresh={loadChartData}
          onExport={handleExport}
          filters={globalFilters}
          onFiltersChange={setGlobalFilters}
          timeRange={timeRange}
          onTimeRangeChange={handleTimeRangeChange}
          refreshInterval={refreshInterval}
          onRefreshIntervalChange={setRefreshInterval}
          isFullscreen={isFullscreen}
          onFullscreenToggle={handleFullscreenToggle}
        />
      </Box>

      {/* 主要内容区域 */}
      <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <LoadingState 
          loading={loading}
          skeleton={
            <Box sx={{ p: 3 }}>
              <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap={3}>
                {Array.from({ length: 6 }, (_, i) => (
                  <SkeletonCard key={i} height={300} />
                ))}
              </Box>
            </Box>
          }
        >
          <Box sx={{ 
            height: '100%', 
            overflow: 'auto',
            p: dashboardState.isEditMode ? 2 : 1,
          }}>
            <DashboardGrid
              widgets={widgets}
              layouts={{ lg: layouts }}
              isEditMode={dashboardState.isEditMode}
              onLayoutChange={handleLayoutChange}
              onWidgetRemove={removeWidget}
              onWidgetAdd={addWidget}
              onWidgetUpdate={updateWidget}
              data={chartData}
            />
          </Box>
        </LoadingState>

        {/* 刷新指示器 */}
        {refreshing && (
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              zIndex: theme.zIndex.snackbar,
              bgcolor: 'background.paper',
              p: 2,
              borderRadius: 1,
              boxShadow: theme.shadows[4],
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Box
              sx={{
                width: 16,
                height: 16,
                border: 2,
                borderColor: 'primary.main',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' },
                },
              }}
            />
            {t('dashboard.refreshing')}...
          </Box>
        )}

        {/* WebSocket连接状态指示器 */}
        {!isConnected && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              zIndex: theme.zIndex.snackbar,
              bgcolor: 'warning.main',
              color: 'warning.contrastText',
              p: 1,
              borderRadius: 1,
              fontSize: '0.75rem',
            }}
          >
            {t('dashboard.realTimeDisconnected')}
          </Box>
        )}
      </Box>

      {/* 数据钻取弹框 */}
      {drillDownConfig && (
        <DrillDownModal
          open={Boolean(drillDownConfig)}
          onClose={() => setDrillDownConfig(null)}
          data={chartData}
          config={drillDownConfig}
          onConfigUpdate={updateDrillDownConfig}
        />
      )}
    </Box>
  );
};

export default AdvancedDashboard;