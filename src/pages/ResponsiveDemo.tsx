import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  useTheme,
} from '@mui/material';
import {
  Smartphone as SmartphoneIcon,
  Tablet as TabletIcon,
  Computer as ComputerIcon,
  Info as InfoIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  NetworkCheck as NetworkIcon,
  Visibility as VisibilityIcon,
  TouchApp as TouchIcon,
  PanTool as GestureIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';

import { useResponsive } from '@/hooks/useResponsive';
import { mobileOptimizations } from '@/utils/mobileOptimizations';
import ResponsiveContainer from '@/components/responsive/ResponsiveContainer';
import ResponsiveGrid from '@/components/responsive/ResponsiveGrid';
import ResponsiveTable from '@/components/responsive/ResponsiveTable';
import ResponsiveDialog from '@/components/responsive/ResponsiveDialog';

const ResponsiveDemo: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const {
    isMobile,
    isTablet,
    isDesktop,
    screenSize,
    orientation,
    containerMaxWidth,
    drawerWidth,
    appBarHeight,
    deviceInfo,
  } = useResponsive();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);

  // 获取性能指标
  const handleGetPerformanceMetrics = async () => {
    const metrics = await mobileOptimizations.getPerformanceMetrics();
    setPerformanceMetrics(metrics);
  };

  // 设备类型图标
  const getDeviceIcon = () => {
    if (isMobile) return <SmartphoneIcon />;
    if (isTablet) return <TabletIcon />;
    return <ComputerIcon />;
  };

  // 设备类型名称
  const getDeviceTypeName = () => {
    if (isMobile) return '移动设备';
    if (isTablet) return '平板设备';
    return '桌面设备';
  };

  // 响应式表格数据
  const tableColumns = [
    { id: 'property', label: '属性', priority: 'high' as const },
    { id: 'value', label: '值', priority: 'high' as const },
    { id: 'description', label: '描述', priority: 'medium' as const, hiddenOnMobile: true },
  ];

  const tableRows = [
    {
      id: '1',
      property: '屏幕尺寸',
      value: screenSize.toUpperCase(),
      description: '当前屏幕断点尺寸分类',
    },
    {
      id: '2',
      property: '设备方向',
      value: orientation === 'portrait' ? '竖屏' : '横屏',
      description: '设备当前方向状态',
    },
    {
      id: '3',
      property: '视口宽度',
      value: `${deviceInfo.viewportWidth}px`,
      description: '浏览器视口宽度',
    },
    {
      id: '4',
      property: '视口高度',
      value: `${deviceInfo.viewportHeight}px`,
      description: '浏览器视口高度',
    },
    {
      id: '5',
      property: '像素比',
      value: `${deviceInfo.pixelRatio}x`,
      description: '设备像素比率',
    },
  ];

  return (
    <ResponsiveContainer>
      <Box sx={{ py: 3 }}>
        {/* 页面标题 */}
        <Typography variant="h4" gutterBottom>
          响应式设计演示
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          此页面展示了应用的响应式设计特性和移动端优化功能。
        </Typography>

        {/* 设备信息卡片 */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              {getDeviceIcon()}
              <Typography variant="h6">
                设备信息 - {getDeviceTypeName()}
              </Typography>
            </Box>

            <ResponsiveGrid
              columns={{ xs: 1, sm: 2, md: 3, lg: 4 }}
              spacing={2}
            >
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" color="primary">
                    {screenSize.toUpperCase()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    断点尺寸
                  </Typography>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" color="primary">
                    {orientation === 'portrait' ? '竖屏' : '横屏'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    设备方向
                  </Typography>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" color="primary">
                    {deviceInfo.viewportWidth}×{deviceInfo.viewportHeight}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    视口尺寸
                  </Typography>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" color="primary">
                    {deviceInfo.pixelRatio}x
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    像素比
                  </Typography>
                </CardContent>
              </Card>
            </ResponsiveGrid>
          </CardContent>
        </Card>

        {/* 响应式特性展示 */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              响应式特性展示
            </Typography>

            <List>
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: isMobile ? 'success.main' : 'grey.400' }}>
                    <SmartphoneIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary="移动端优化"
                  secondary={isMobile ? '当前设备已启用移动端优化' : '移动端特性在当前设备上不适用'}
                />
                <ListItemSecondaryAction>
                  <Chip
                    label={isMobile ? '已启用' : '未启用'}
                    color={isMobile ? 'success' : 'default'}
                    size="small"
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <Divider variant="inset" component="li" />

              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: deviceInfo.isTouchDevice ? 'success.main' : 'grey.400' }}>
                    <TouchIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary="触摸设备支持"
                  secondary={deviceInfo.isTouchDevice ? '检测到触摸支持，触摸优化已启用' : '非触摸设备，使用鼠标交互'}
                />
                <ListItemSecondaryAction>
                  <Chip
                    label={deviceInfo.isTouchDevice ? '支持' : '不支持'}
                    color={deviceInfo.isTouchDevice ? 'success' : 'default'}
                    size="small"
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <Divider variant="inset" component="li" />

              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: mobileOptimizations.isLowEndDevice() ? 'warning.main' : 'success.main' }}>
                    <SpeedIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary="设备性能"
                  secondary={mobileOptimizations.isLowEndDevice() ? '检测到低端设备，已启用性能优化' : '设备性能良好'}
                />
                <ListItemSecondaryAction>
                  <Chip
                    label={mobileOptimizations.isLowEndDevice() ? '低端' : '高端'}
                    color={mobileOptimizations.isLowEndDevice() ? 'warning' : 'success'}
                    size="small"
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </CardContent>
        </Card>

        {/* 响应式表格演示 */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              响应式表格演示
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              在移动端会自动切换为卡片视图，在桌面端显示为表格视图。
            </Typography>

            <ResponsiveTable
              columns={tableColumns}
              rows={tableRows}
              mobileCardView={true}
              expandableRows={true}
              renderExpandedContent={(row) => (
                <Typography variant="body2" color="text.secondary">
                  {row.description}
                </Typography>
              )}
            />
          </CardContent>
        </Card>

        {/* 性能指标 */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                性能指标
              </Typography>
              <Button
                variant="outlined"
                startIcon={<SpeedIcon />}
                onClick={handleGetPerformanceMetrics}
                size={isMobile ? 'small' : 'medium'}
              >
                获取指标
              </Button>
            </Box>

            {performanceMetrics ? (
              <ResponsiveGrid columns={{ xs: 1, sm: 2, md: 4 }} spacing={2}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" color="primary">
                      {performanceMetrics.FCP ? `${Math.round(performanceMetrics.FCP)}ms` : 'N/A'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      首次内容绘制 (FCP)
                    </Typography>
                  </CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" color="primary">
                      {performanceMetrics.totalLoadTime ? `${Math.round(performanceMetrics.totalLoadTime)}ms` : 'N/A'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      总加载时间
                    </Typography>
                  </CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" color="primary">
                      {performanceMetrics.memory?.usedJSHeapSize ?
                        `${Math.round(performanceMetrics.memory.usedJSHeapSize / 1024 / 1024)}MB` : 'N/A'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      JS 堆内存使用
                    </Typography>
                  </CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" color="primary">
                      {performanceMetrics.domContentLoaded ? `${Math.round(performanceMetrics.domContentLoaded)}ms` : 'N/A'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      DOM 内容加载
                    </Typography>
                  </CardContent>
                </Card>
              </ResponsiveGrid>
            ) : (
              <Typography variant="body2" color="text.secondary">
                点击"获取指标"按钮来查看当前页面的性能指标。
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* 响应式对话框演示 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              响应式对话框演示
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              在移动端会自动全屏显示，在桌面端显示为浮动窗口。
            </Typography>

            <Button
              variant="contained"
              onClick={() => setDialogOpen(true)}
              fullWidth={isMobile}
            >
              打开响应式对话框
            </Button>
          </CardContent>
        </Card>

        {/* 响应式对话框 */}
        <ResponsiveDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="响应式对话框"
          maxWidth="md"
          mobileFullScreen={true}
          actions={
            <>
              <Button onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button variant="contained" onClick={() => setDialogOpen(false)}>
                确认
              </Button>
            </>
          }
        >
          <Typography paragraph>
            这是一个响应式对话框的演示。在移动设备上，它会自动全屏显示以提供更好的用户体验。
            在桌面设备上，它会显示为浮动窗口。
          </Typography>

          <Typography paragraph>
            对话框的内容会根据屏幕大小自动调整布局和间距，确保在所有设备上都有良好的可读性和交互体验。
          </Typography>

          <Box display="flex" gap={1} flexWrap="wrap">
            <Chip label="响应式" color="primary" size="small" />
            <Chip label="移动优化" color="secondary" size="small" />
            <Chip label="自适应" color="success" size="small" />
          </Box>
        </ResponsiveDialog>
      </Box>
    </ResponsiveContainer>
  );
};

export default ResponsiveDemo;