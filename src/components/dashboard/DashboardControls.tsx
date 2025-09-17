import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Toolbar,
  Button,
  ButtonGroup,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Divider,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Restore as RestoreIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Schedule as ScheduleIcon,
  Fullscreen as FullscreenIcon,
  MoreVert as MoreIcon,
} from '@mui/icons-material';

import { ChartFilter, TimeRange } from '@/types';

interface DashboardControlsProps {
  isEditMode: boolean;
  onEditModeChange: (editMode: boolean) => void;
  onSaveLayout: () => void;
  onResetLayout: () => void;
  onRefresh: () => void;
  onExport?: () => void;
  filters: ChartFilter[];
  onFiltersChange: (filters: ChartFilter[]) => void;
  timeRange: TimeRange;
  onTimeRangeChange: (timeRange: TimeRange) => void;
  refreshInterval: number;
  onRefreshIntervalChange: (interval: number) => void;
  isFullscreen?: boolean;
  onFullscreenToggle?: () => void;
}

export const DashboardControls: React.FC<DashboardControlsProps> = ({
  isEditMode,
  onEditModeChange,
  onSaveLayout,
  onResetLayout,
  onRefresh,
  onExport,
  filters,
  onFiltersChange,
  timeRange,
  onTimeRangeChange,
  refreshInterval,
  onRefreshIntervalChange,
  isFullscreen,
  onFullscreenToggle,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<HTMLElement | null>(null);
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // 时间范围预设
  const timeRangePresets = [
    { key: 'today', label: t('common.today') },
    { key: 'week', label: t('common.thisWeek') },
    { key: 'month', label: t('common.thisMonth') },
    { key: 'quarter', label: t('common.thisQuarter') },
    { key: 'year', label: t('common.thisYear') },
    { key: 'custom', label: t('common.custom') },
  ];

  // 刷新间隔选项
  const refreshIntervals = [
    { value: 0, label: t('dashboard.noRefresh') },
    { value: 30000, label: '30s' },
    { value: 60000, label: '1m' },
    { value: 300000, label: '5m' },
    { value: 900000, label: '15m' },
    { value: 1800000, label: '30m' },
    { value: 3600000, label: '1h' },
  ];

  // 处理时间范围变化
  const handleTimeRangePresetChange = (preset: string) => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (preset) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        startDate = weekStart;
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        startDate = quarterStart;
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        return; // custom - don't auto set dates
    }

    onTimeRangeChange({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      preset: preset as any,
    });
  };

  // 渲染过滤器对话框
  const renderFiltersDialog = () => (
    <Dialog
      open={filtersDialogOpen}
      onClose={() => setFiltersDialogOpen(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>{t('dashboard.configureFilters')}</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t('dashboard.filtersDescription')}
          </Typography>
          
          {/* 当前过滤器列表 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('dashboard.activeFilters')}
            </Typography>
            {filters.length > 0 ? (
              <Box display="flex" flexWrap="wrap" gap={1}>
                {filters.map((filter, index) => (
                  <Chip
                    key={index}
                    label={`${filter.field} ${filter.operator} ${filter.value}`}
                    onDelete={() => {
                      const newFilters = filters.filter((_, i) => i !== index);
                      onFiltersChange(newFilters);
                    }}
                    variant="outlined"
                  />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t('dashboard.noActiveFilters')}
              </Typography>
            )}
          </Box>

          {/* 添加新过滤器的表单 */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 2, alignItems: 'end' }}>
            <TextField
              label={t('dashboard.field')}
              size="small"
              placeholder={t('dashboard.fieldPlaceholder')}
            />
            <FormControl size="small">
              <InputLabel>{t('dashboard.operator')}</InputLabel>
              <Select label={t('dashboard.operator')}>
                <MenuItem value="equals">{t('dashboard.equals')}</MenuItem>
                <MenuItem value="contains">{t('dashboard.contains')}</MenuItem>
                <MenuItem value="in">{t('dashboard.in')}</MenuItem>
                <MenuItem value="range">{t('dashboard.range')}</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label={t('dashboard.value')}
              size="small"
              placeholder={t('dashboard.valuePlaceholder')}
            />
            <Button variant="contained" size="small">
              {t('common.add')}
            </Button>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setFiltersDialogOpen(false)}>
          {t('common.close')}
        </Button>
        <Button 
          variant="contained" 
          onClick={() => {
            // 清除所有过滤器
            onFiltersChange([]);
            setFiltersDialogOpen(false);
          }}
        >
          {t('dashboard.clearAll')}
        </Button>
      </DialogActions>
    </Dialog>
  );

  // 渲染设置对话框
  const renderSettingsDialog = () => (
    <Dialog
      open={settingsDialogOpen}
      onClose={() => setSettingsDialogOpen(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{t('dashboard.dashboardSettings')}</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* 刷新设置 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t('dashboard.refreshSettings')}
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>{t('dashboard.refreshInterval')}</InputLabel>
              <Select
                value={refreshInterval}
                onChange={(e) => onRefreshIntervalChange(Number(e.target.value))}
                label={t('dashboard.refreshInterval')}
              >
                {refreshIntervals.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* 显示设置 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t('dashboard.displaySettings')}
            </Typography>
            <FormControlLabel
              control={<Switch />}
              label={t('dashboard.showAnimations')}
            />
            <FormControlLabel
              control={<Switch />}
              label={t('dashboard.showTooltips')}
            />
            <FormControlLabel
              control={<Switch />}
              label={t('dashboard.compactMode')}
            />
          </Box>

          {/* 数据设置 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t('dashboard.dataSettings')}
            </Typography>
            <FormControlLabel
              control={<Switch />}
              label={t('dashboard.cacheData')}
            />
            <FormControlLabel
              control={<Switch />}
              label={t('dashboard.realTimeUpdates')}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setSettingsDialogOpen(false)}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" onClick={() => setSettingsDialogOpen(false)}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );

  // 渲染分享对话框
  const renderShareDialog = () => (
    <Dialog
      open={shareDialogOpen}
      onClose={() => setShareDialogOpen(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{t('dashboard.shareDashboard')}</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t('dashboard.shareDescription')}
          </Typography>
          
          <TextField
            fullWidth
            label={t('dashboard.shareUrl')}
            value={window.location.href}
            InputProps={{
              readOnly: true,
            }}
            sx={{ mb: 2 }}
          />

          <Box display="flex" gap={1}>
            <Button variant="outlined" fullWidth>
              {t('dashboard.copyLink')}
            </Button>
            <Button variant="outlined" fullWidth>
              {t('dashboard.generatePdf')}
            </Button>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShareDialogOpen(false)}>
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <>
      <Toolbar sx={{ gap: 2, flexWrap: 'wrap', minHeight: 'auto !important', py: 1 }}>
        {/* 编辑模式控制 */}
        <ButtonGroup variant="outlined" size="small">
          <Button
            onClick={() => onEditModeChange(!isEditMode)}
            startIcon={<EditIcon />}
            variant={isEditMode ? 'contained' : 'outlined'}
          >
            {isEditMode ? t('dashboard.exitEdit') : t('dashboard.editMode')}
          </Button>
          {isEditMode && (
            <>
              <Button
                onClick={onSaveLayout}
                startIcon={<SaveIcon />}
              >
                {t('common.save')}
              </Button>
              <Button
                onClick={onResetLayout}
                startIcon={<RestoreIcon />}
              >
                {t('dashboard.reset')}
              </Button>
            </>
          )}
        </ButtonGroup>

        {/* 时间范围选择 */}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>{t('dashboard.timeRange')}</InputLabel>
          <Select
            value={timeRange.preset || 'custom'}
            onChange={(e) => handleTimeRangePresetChange(e.target.value)}
            label={t('dashboard.timeRange')}
          >
            {timeRangePresets.map((preset) => (
              <MenuItem key={preset.key} value={preset.key}>
                {preset.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 过滤器状态 */}
        <Box display="flex" alignItems="center" gap={1}>
          <Tooltip title={t('dashboard.configureFilters')}>
            <IconButton
              size="small"
              onClick={() => setFiltersDialogOpen(true)}
              color={filters.length > 0 ? 'primary' : 'default'}
            >
              <FilterIcon />
            </IconButton>
          </Tooltip>
          {filters.length > 0 && (
            <Chip
              label={`${filters.length} ${t('dashboard.filters')}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
        </Box>

        {/* 刷新控制 */}
        <Tooltip title={t('common.refresh')}>
          <IconButton size="small" onClick={onRefresh}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>

        {/* 右侧工具 */}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* 全屏切换 */}
          {onFullscreenToggle && (
            <Tooltip title={isFullscreen ? t('common.exitFullscreen') : t('common.fullscreen')}>
              <IconButton size="small" onClick={onFullscreenToggle}>
                <FullscreenIcon />
              </IconButton>
            </Tooltip>
          )}

          {/* 刷新间隔指示器 */}
          {refreshInterval > 0 && (
            <Chip
              icon={<ScheduleIcon />}
              label={refreshIntervals.find(r => r.value === refreshInterval)?.label || 'Auto'}
              size="small"
              variant="outlined"
              color="primary"
            />
          )}

          {/* 更多操作 */}
          <Tooltip title={t('common.more')}>
            <IconButton
              size="small"
              onClick={(e) => setMoreMenuAnchor(e.currentTarget)}
            >
              <MoreIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>

      {/* 更多操作菜单 */}
      <Menu
        anchorEl={moreMenuAnchor}
        open={Boolean(moreMenuAnchor)}
        onClose={() => setMoreMenuAnchor(null)}
      >
        <MenuItem onClick={() => {
          setSettingsDialogOpen(true);
          setMoreMenuAnchor(null);
        }}>
          <SettingsIcon sx={{ mr: 1 }} />
          {t('common.settings')}
        </MenuItem>
        <MenuItem onClick={() => {
          setShareDialogOpen(true);
          setMoreMenuAnchor(null);
        }}>
          <ShareIcon sx={{ mr: 1 }} />
          {t('dashboard.share')}
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => {
          onExport?.();
          setMoreMenuAnchor(null);
        }}>
          <DownloadIcon sx={{ mr: 1 }} />
          {t('common.export')}
        </MenuItem>
      </Menu>

      {/* 对话框 */}
      {renderFiltersDialog()}
      {renderSettingsDialog()}
      {renderShareDialog()}
    </>
  );
};

export default DashboardControls;