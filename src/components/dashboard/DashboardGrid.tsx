import React, { useState, useCallback, useRef } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  Tooltip,
  Fab,
  useTheme,
  alpha,
} from '@mui/material';
import {
  DragIndicatorOutlined,
  MoreVertOutlined,
  AddOutlined,
  SettingsOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  DeleteOutlined,
  EditOutlined,
  RefreshOutlined,
} from '@mui/icons-material';

import { DashboardLayout, DashboardWidget, WidgetConfig } from '@/types';
import { useDashboardWidgets } from '@/store';

// 导入网格布局样式
import './dashboard-grid.css';

// 引入图表组件
import EmailVolumeChart from './EmailVolumeChart';
import SentimentAnalysisChart from './SentimentAnalysisChart';
import PriorityHeatmap from './PriorityHeatmap';
import ResponseTimeChart from './ResponseTimeChart';
import TopSendersChart from './TopSendersChart';

// 响应式网格
const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardGridProps {
  onWidgetClick?: (widget: DashboardWidget) => void;
  onLayoutChange?: (layouts: DashboardLayout[]) => void;
  className?: string;
}

const DashboardGrid: React.FC<DashboardGridProps> = ({
  onWidgetClick,
  onLayoutChange,
  className,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { widgets, layouts, isEditMode, updateLayout, removeWidget, updateWidget } = useDashboardWidgets();

  // 状态管理
  const [fullscreenWidget, setFullscreenWidget] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    widgetId: string;
  } | null>(null);
  const [addWidgetDialog, setAddWidgetDialog] = useState(false);
  const [selectedWidgetType, setSelectedWidgetType] = useState<string>('');
  const [refreshingWidget, setRefreshingWidget] = useState<string | null>(null);

  const gridRef = useRef<any>(null);

  // 可用的组件类型
  const availableWidgets = [
    { type: 'email-volume', name: t('dashboard.emailVolumeAnalysis'), icon: '📊' },
    { type: 'sentiment-analysis', name: t('dashboard.sentimentAnalysis'), icon: '😊' },
    { type: 'category-distribution', name: t('dashboard.categoryDistribution'), icon: '📋' },
    { type: 'priority-heatmap', name: t('dashboard.priorityHeatmap'), icon: '🔥' },
    { type: 'response-time', name: t('dashboard.responseTimeAnalysis'), icon: '⏱️' },
    { type: 'top-senders', name: t('dashboard.topSenders'), icon: '👥' },
  ];

  // 网格布局配置
  const gridProps = {
    className: 'layout',
    layouts: { lg: layouts },
    breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
    cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
    rowHeight: 60,
    margin: [16, 16] as [number, number],
    containerPadding: [16, 16] as [number, number],
    isDraggable: isEditMode,
    isResizable: isEditMode,
    useCSSTransforms: true,
    preventCollision: false,
    autoSize: true,
  };

  // 处理布局变化
  const handleLayoutChange = useCallback(
    (layout: DashboardLayout[], allLayouts: { [key: string]: DashboardLayout[] }) => {
      if (onLayoutChange) {
        onLayoutChange(layout);
      }
      updateLayout(layout);
    },
    [updateLayout, onLayoutChange]
  );

  // 处理组件右键菜单
  const handleContextMenu = (event: React.MouseEvent, widgetId: string) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      widgetId,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  // 处理组件操作
  const handleWidgetAction = (action: string, widgetId: string) => {
    const widget = widgets.find(w => w.id === widgetId);
    if (!widget) return;

    switch (action) {
      case 'fullscreen':
        setFullscreenWidget(widgetId);
        break;
      case 'refresh':
        handleRefreshWidget(widgetId);
        break;
      case 'settings':
        // 打开组件设置对话框
        if (onWidgetClick) {
          onWidgetClick(widget);
        }
        break;
      case 'delete':
        removeWidget(widgetId);
        break;
    }
    handleCloseContextMenu();
  };

  // 刷新组件数据
  const handleRefreshWidget = async (widgetId: string) => {
    setRefreshingWidget(widgetId);
    // 模拟异步刷新
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshingWidget(null);
  };

  // 添加新组件
  const handleAddWidget = () => {
    if (!selectedWidgetType) return;

    const newWidget: DashboardWidget = {
      id: `widget-${Date.now()}`,
      type: selectedWidgetType as any,
      title: availableWidgets.find(w => w.type === selectedWidgetType)?.name || '',
      description: '',
      config: {},
      layout: {
        i: `widget-${Date.now()}`,
        x: 0,
        y: 0,
        w: 6,
        h: 4,
        minW: 3,
        minH: 3,
      },
      isVisible: true,
    };

    // TODO: 通过store添加组件
    setAddWidgetDialog(false);
    setSelectedWidgetType('');
  };

  // 渲染组件内容
  const renderWidgetContent = (widget: DashboardWidget) => {
    const commonProps = {
      config: widget.config,
      height: (widget.layout.h * 60) - 120, // 减去header和padding
      onExport: () => {
        // TODO: 实现导出功能
        console.log('Export widget:', widget.id);
      },
      onFullscreen: () => setFullscreenWidget(widget.id),
      onDataClick: (data: any) => {
        console.log('Widget data clicked:', widget.id, data);
      },
    };

    // 根据组件类型渲染不同的图表
    switch (widget.type) {
      case 'email-volume':
        return <EmailVolumeChart data={[]} {...commonProps} />;
      case 'sentiment-analysis':
        return <SentimentAnalysisChart data={[]} {...commonProps} />;
      case 'priority-heatmap':
        return <PriorityHeatmap data={[]} {...commonProps} />;
      case 'response-time':
        return <ResponseTimeChart data={[]} {...commonProps} />;
      case 'top-senders':
        return <TopSendersChart data={[]} {...commonProps} />;
      default:
        return (
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6">{widget.title}</Typography>
              <Typography color="text.secondary">
                {t('dashboard.widgetNotImplemented')}
              </Typography>
            </CardContent>
          </Card>
        );
    }
  };

  // 渲染组件包装器
  const renderWidget = (widget: DashboardWidget) => {
    const isRefreshing = refreshingWidget === widget.id;
    const isFullscreen = fullscreenWidget === widget.id;

    return (
      <Box
        key={widget.id}
        sx={{
          position: 'relative',
          height: '100%',
          opacity: isRefreshing ? 0.7 : 1,
          transition: 'opacity 0.3s ease',
          '&:hover .widget-controls': {
            opacity: 1,
          },
          ...(isEditMode && {
            border: 2,
            borderColor: alpha(theme.palette.primary.main, 0.3),
            borderStyle: 'dashed',
            borderRadius: 1,
          }),
        }}
        onContextMenu={(e) => handleContextMenu(e, widget.id)}
      >
        {/* 编辑模式下的拖拽指示器 */}
        {isEditMode && (
          <Box
            className="widget-drag-handle"
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              zIndex: 1000,
              cursor: 'grab',
              backgroundColor: alpha(theme.palette.background.paper, 0.9),
              borderRadius: '50%',
              p: 0.5,
              '&:active': {
                cursor: 'grabbing',
              },
            }}
          >
            <DragIndicatorOutlined fontSize="small" color="action" />
          </Box>
        )}

        {/* 组件控制按钮 */}
        <Box
          className="widget-controls"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1000,
            opacity: 0,
            transition: 'opacity 0.2s ease',
            display: 'flex',
            gap: 0.5,
          }}
        >
          <IconButton
            size="small"
            onClick={() => handleWidgetAction('refresh', widget.id)}
            disabled={isRefreshing}
            sx={{ 
              backgroundColor: alpha(theme.palette.background.paper, 0.9),
              '&:hover': { backgroundColor: alpha(theme.palette.background.paper, 1) },
            }}
          >
            <RefreshOutlined fontSize="small" />
          </IconButton>
          
          <IconButton
            size="small"
            onClick={() => handleWidgetAction('fullscreen', widget.id)}
            sx={{ 
              backgroundColor: alpha(theme.palette.background.paper, 0.9),
              '&:hover': { backgroundColor: alpha(theme.palette.background.paper, 1) },
            }}
          >
            <FullscreenOutlined fontSize="small" />
          </IconButton>
          
          <IconButton
            size="small"
            onClick={(e) => handleContextMenu(e, widget.id)}
            sx={{ 
              backgroundColor: alpha(theme.palette.background.paper, 0.9),
              '&:hover': { backgroundColor: alpha(theme.palette.background.paper, 1) },
            }}
          >
            <MoreVertOutlined fontSize="small" />
          </IconButton>
        </Box>

        {/* 组件内容 */}
        {renderWidgetContent(widget)}
      </Box>
    );
  };

  return (
    <Box sx={{ position: 'relative', height: '100%' }} className={className}>
      {/* 响应式网格布局 */}
      <ResponsiveGridLayout
        ref={gridRef}
        {...gridProps}
        onLayoutChange={handleLayoutChange}
      >
        {widgets.map(renderWidget)}
      </ResponsiveGridLayout>

      {/* 添加组件按钮（编辑模式） */}
      {isEditMode && (
        <Fab
          color="primary"
          aria-label="add widget"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1300,
          }}
          onClick={() => setAddWidgetDialog(true)}
        >
          <AddOutlined />
        </Fab>
      )}

      {/* 右键菜单 */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={() => handleWidgetAction('refresh', contextMenu?.widgetId || '')}>
          <RefreshOutlined fontSize="small" sx={{ mr: 1 }} />
          {t('dashboard.refresh')}
        </MenuItem>
        <MenuItem onClick={() => handleWidgetAction('settings', contextMenu?.widgetId || '')}>
          <SettingsOutlined fontSize="small" sx={{ mr: 1 }} />
          {t('dashboard.settings')}
        </MenuItem>
        <MenuItem onClick={() => handleWidgetAction('fullscreen', contextMenu?.widgetId || '')}>
          <FullscreenOutlined fontSize="small" sx={{ mr: 1 }} />
          {t('dashboard.fullscreen')}
        </MenuItem>
        <MenuItem 
          onClick={() => handleWidgetAction('delete', contextMenu?.widgetId || '')}
          sx={{ color: 'error.main' }}
        >
          <DeleteOutlined fontSize="small" sx={{ mr: 1 }} />
          {t('dashboard.delete')}
        </MenuItem>
      </Menu>

      {/* 添加组件对话框 */}
      <Dialog open={addWidgetDialog} onClose={() => setAddWidgetDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('dashboard.addWidget')}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>{t('dashboard.widgetType')}</InputLabel>
            <Select
              value={selectedWidgetType}
              onChange={(e) => setSelectedWidgetType(e.target.value)}
              label={t('dashboard.widgetType')}
            >
              {availableWidgets.map((widget) => (
                <MenuItem key={widget.type} value={widget.type}>
                  <Box display="flex" alignItems="center">
                    <Typography sx={{ mr: 1 }}>{widget.icon}</Typography>
                    <Typography>{widget.name}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddWidgetDialog(false)}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleAddWidget} 
            variant="contained" 
            disabled={!selectedWidgetType}
          >
            {t('common.add')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 全屏显示对话框 */}
      <Dialog
        open={fullscreenWidget !== null}
        onClose={() => setFullscreenWidget(null)}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: { 
            width: '95vw', 
            height: '90vh',
            maxHeight: '90vh',
          },
        }}
      >
        <Box sx={{ position: 'relative', height: '100%', p: 2 }}>
          <IconButton
            onClick={() => setFullscreenWidget(null)}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 1,
              backgroundColor: alpha(theme.palette.background.paper, 0.9),
            }}
          >
            <FullscreenExitOutlined />
          </IconButton>
          {fullscreenWidget && (
            <Box sx={{ height: '100%' }}>
              {renderWidgetContent(
                widgets.find(w => w.id === fullscreenWidget) || widgets[0]
              )}
            </Box>
          )}
        </Box>
      </Dialog>
    </Box>
  );
};

export default DashboardGrid;