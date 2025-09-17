import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  IconButton,
  Button,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  LinearProgress,
  Alert,
  Chip,
  useTheme,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV2';
import {
  CloseOutlined,
  DownloadOutlined,
  FileDownloadOutlined,
  DescriptionOutlined,
  TableViewOutlined,
  ImageOutlined,
  PictureAsPdfOutlined,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import { ExportConfig, TimeRange, ChartFilter } from '@/types';
import { useChartData, useDashboardStats, useNotifications } from '@/store';

interface DataExportDialogProps {
  open: boolean;
  onClose: () => void;
  widgetId?: string;
  widgetTitle?: string;
  data?: any[];
}

const DataExportDialog: React.FC<DataExportDialogProps> = ({
  open,
  onClose,
  widgetId,
  widgetTitle = 'Dashboard Data',
  data,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { addNotification } = useNotifications();
  const { 
    emailVolumeData, 
    sentimentData, 
    categoryData, 
    priorityHeatmapData, 
    responseTimeData, 
    topSendersData 
  } = useChartData();
  const { stats } = useDashboardStats();

  // 状态管理
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    format: 'csv',
    filename: `${widgetTitle}_${format(new Date(), 'yyyy-MM-dd')}`,
    dateRange: {
      startDate: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
    },
    includeCharts: true,
    includeSummary: true,
  });

  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([
    'emailVolume',
    'sentiment',
    'categories',
  ]);

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // 可导出的数据集
  const availableDatasets = [
    { key: 'emailVolume', label: t('dashboard.emailVolumeData'), count: emailVolumeData.length },
    { key: 'sentiment', label: t('dashboard.sentimentData'), count: sentimentData.length },
    { key: 'categories', label: t('dashboard.categoryData'), count: categoryData.length },
    { key: 'priorityHeatmap', label: t('dashboard.priorityHeatmapData'), count: priorityHeatmapData.length },
    { key: 'responseTime', label: t('dashboard.responseTimeData'), count: responseTimeData.length },
    { key: 'topSenders', label: t('dashboard.topSendersData'), count: topSendersData.length },
    { key: 'dashboardStats', label: t('dashboard.dashboardStats'), count: 1 },
  ];

  // 导出格式配置
  const exportFormats = [
    { 
      key: 'csv', 
      label: 'CSV', 
      icon: <TableViewOutlined />, 
      description: t('export.csvDescription'),
      supportsCharts: false,
    },
    { 
      key: 'xlsx', 
      label: 'Excel', 
      icon: <DescriptionOutlined />, 
      description: t('export.excelDescription'),
      supportsCharts: true,
    },
    { 
      key: 'pdf', 
      label: 'PDF', 
      icon: <PictureAsPdfOutlined />, 
      description: t('export.pdfDescription'),
      supportsCharts: true,
    },
    { 
      key: 'png', 
      label: 'PNG', 
      icon: <ImageOutlined />, 
      description: t('export.imageDescription'),
      supportsCharts: true,
    },
  ];

  // 处理数据集选择
  const handleDatasetChange = (dataset: string, checked: boolean) => {
    if (checked) {
      setSelectedDatasets([...selectedDatasets, dataset]);
    } else {
      setSelectedDatasets(selectedDatasets.filter(d => d !== dataset));
    }
  };

  // 处理配置变更
  const handleConfigChange = (key: keyof ExportConfig, value: any) => {
    setExportConfig(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // 获取数据集数据
  const getDatasetData = (datasetKey: string) => {
    switch (datasetKey) {
      case 'emailVolume':
        return emailVolumeData;
      case 'sentiment':
        return sentimentData;
      case 'categories':
        return categoryData;
      case 'priorityHeatmap':
        return priorityHeatmapData;
      case 'responseTime':
        return responseTimeData;
      case 'topSenders':
        return topSendersData;
      case 'dashboardStats':
        return [stats];
      default:
        return [];
    }
  };

  // 生成CSV内容
  const generateCSV = (data: any[], headers: string[]) => {
    const csvHeaders = headers.join(',');
    const csvRows = data.map(row => {
      return headers.map(header => {
        const value = row[header];
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      }).join(',');
    });

    return [csvHeaders, ...csvRows].join('\n');
  };

  // 下载文件
  const downloadFile = (content: string | Blob, filename: string, mimeType: string) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 模拟导出进度
  const simulateProgress = async () => {
    setExportProgress(0);
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      setExportProgress((i / steps) * 100);
    }
  };

  // 执行导出
  const handleExport = async () => {
    if (selectedDatasets.length === 0) {
      addNotification({
        type: 'warning',
        title: t('export.noDataSelected'),
        message: t('export.selectDatasets'),
      });
      return;
    }

    setIsExporting(true);
    
    try {
      await simulateProgress();

      const { format: exportFormat, filename } = exportConfig;
      
      if (exportFormat === 'csv') {
        // 导出CSV
        let combinedCSV = '';
        
        for (const datasetKey of selectedDatasets) {
          const datasetData = getDatasetData(datasetKey);
          const datasetLabel = availableDatasets.find(d => d.key === datasetKey)?.label || datasetKey;
          
          if (datasetData.length > 0) {
            const headers = Object.keys(datasetData[0]);
            const csvContent = generateCSV(datasetData, headers);
            
            combinedCSV += `\n# ${datasetLabel}\n${csvContent}\n`;
          }
        }

        downloadFile(combinedCSV, `${filename}.csv`, 'text/csv');
        
      } else if (exportFormat === 'xlsx') {
        // Excel导出（简化版）
        const workbookData = {
          sheets: selectedDatasets.map(datasetKey => ({
            name: availableDatasets.find(d => d.key === datasetKey)?.label || datasetKey,
            data: getDatasetData(datasetKey),
          })),
          metadata: {
            exportDate: new Date().toISOString(),
            dateRange: exportConfig.dateRange,
          },
        };
        
        const jsonString = JSON.stringify(workbookData, null, 2);
        downloadFile(jsonString, `${filename}.json`, 'application/json');
        
      } else if (exportFormat === 'pdf') {
        // PDF导出（简化版 - 实际应用中使用PDF库）
        let pdfContent = `Email Assist Dashboard Report\n`;
        pdfContent += `Generated: ${new Date().toLocaleString()}\n`;
        pdfContent += `Date Range: ${exportConfig.dateRange?.startDate} - ${exportConfig.dateRange?.endDate}\n\n`;
        
        for (const datasetKey of selectedDatasets) {
          const datasetData = getDatasetData(datasetKey);
          const datasetLabel = availableDatasets.find(d => d.key === datasetKey)?.label || datasetKey;
          
          pdfContent += `${datasetLabel}:\n`;
          pdfContent += JSON.stringify(datasetData, null, 2);
          pdfContent += '\n\n';
        }
        
        downloadFile(pdfContent, `${filename}.txt`, 'text/plain');
        
      } else if (exportFormat === 'png') {
        // 图片导出（简化版）
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.fillStyle = theme.palette.background.paper;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          ctx.fillStyle = theme.palette.text.primary;
          ctx.font = '24px Arial';
          ctx.fillText('Dashboard Export', 50, 50);
          
          ctx.font = '16px Arial';
          ctx.fillText(`Generated: ${new Date().toLocaleString()}`, 50, 100);
          
          canvas.toBlob((blob) => {
            if (blob) {
              downloadFile(blob, `${filename}.png`, 'image/png');
            }
          });
        }
      }

      addNotification({
        type: 'success',
        title: t('export.exportSuccess'),
        message: t('export.fileDownloaded'),
      });

      onClose();

    } catch (error) {
      console.error('Export failed:', error);
      addNotification({
        type: 'error',
        title: t('export.exportFailed'),
        message: t('export.exportError'),
      });
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const selectedFormat = exportFormats.find(f => f.key === exportConfig.format);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <FileDownloadOutlined color="primary" />
            <Typography variant="h6" fontWeight="bold">
              {t('export.title')}
            </Typography>
          </Box>
          <IconButton onClick={onClose} disabled={isExporting}>
            <CloseOutlined />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* 导出格式选择 */}
        <Box sx={{ mb: 3 }}>
          <FormControl component="fieldset">
            <FormLabel component="legend" sx={{ mb: 1 }}>
              {t('export.format')}
            </FormLabel>
            <RadioGroup
              value={exportConfig.format}
              onChange={(e) => handleConfigChange('format', e.target.value)}
            >
              <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={1}>
                {exportFormats.map((format) => (
                  <FormControlLabel
                    key={format.key}
                    value={format.key}
                    control={<Radio />}
                    label={
                      <Box display="flex" alignItems="center" gap={1}>
                        {format.icon}
                        <Box>
                          <Typography variant="body2" fontWeight="500">
                            {format.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {format.description}
                          </Typography>
                        </Box>
                      </Box>
                    }
                    sx={{ 
                      border: 1, 
                      borderColor: 'divider', 
                      borderRadius: 1, 
                      m: 0, 
                      p: 1,
                      '& .MuiFormControlLabel-label': { width: '100%' },
                    }}
                  />
                ))}
              </Box>
            </RadioGroup>
          </FormControl>
        </Box>

        {/* 数据集选择 */}
        <Box sx={{ mb: 3 }}>
          <FormControl component="fieldset">
            <FormLabel component="legend" sx={{ mb: 1 }}>
              {t('export.selectData')}
            </FormLabel>
            <FormGroup>
              {availableDatasets.map((dataset) => (
                <FormControlLabel
                  key={dataset.key}
                  control={
                    <Checkbox
                      checked={selectedDatasets.includes(dataset.key)}
                      onChange={(e) => handleDatasetChange(dataset.key, e.target.checked)}
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography>{dataset.label}</Typography>
                      <Chip 
                        size="small" 
                        label={`${dataset.count} ${t('common.items')}`} 
                        color="primary" 
                        variant="outlined" 
                      />
                    </Box>
                  }
                />
              ))}
            </FormGroup>
          </FormControl>
        </Box>

        {/* 文件名设置 */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label={t('export.filename')}
            value={exportConfig.filename}
            onChange={(e) => handleConfigChange('filename', e.target.value)}
            helperText={t('export.filenameHint')}
          />
        </Box>

        {/* 日期范围 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            {t('export.dateRange')}
          </Typography>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhCN}>
            <Box display="flex" gap={2}>
              <DatePicker
                label={t('export.startDate')}
                value={exportConfig.dateRange ? new Date(exportConfig.dateRange.startDate) : null}
                onChange={(date) => {
                  if (date) {
                    handleConfigChange('dateRange', {
                      ...exportConfig.dateRange,
                      startDate: format(date, 'yyyy-MM-dd'),
                    });
                  }
                }}
                renderInput={(params) => <TextField {...params} size="small" />}
              />
              <DatePicker
                label={t('export.endDate')}
                value={exportConfig.dateRange ? new Date(exportConfig.dateRange.endDate) : null}
                onChange={(date) => {
                  if (date) {
                    handleConfigChange('dateRange', {
                      ...exportConfig.dateRange,
                      endDate: format(date, 'yyyy-MM-dd'),
                    });
                  }
                }}
                renderInput={(params) => <TextField {...params} size="small" />}
              />
            </Box>
          </LocalizationProvider>
        </Box>

        {/* 高级选项 */}
        {selectedFormat?.supportsCharts && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('export.advancedOptions')}
            </Typography>
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={exportConfig.includeCharts || false}
                    onChange={(e) => handleConfigChange('includeCharts', e.target.checked)}
                  />
                }
                label={t('export.includeCharts')}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={exportConfig.includeSummary || false}
                    onChange={(e) => handleConfigChange('includeSummary', e.target.checked)}
                  />
                }
                label={t('export.includeSummary')}
              />
            </FormGroup>
          </Box>
        )}

        {/* 导出进度 */}
        {isExporting && (
          <Box sx={{ mb: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="body2">{t('export.processing')}</Typography>
              <Typography variant="body2">{Math.round(exportProgress)}%</Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={exportProgress} 
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        )}

        {/* 提示信息 */}
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            {t('export.hint', { 
              count: selectedDatasets.length,
              format: selectedFormat?.label || exportConfig.format.toUpperCase()
            })}
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={isExporting}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          startIcon={<DownloadOutlined />}
          onClick={handleExport}
          disabled={isExporting || selectedDatasets.length === 0}
        >
          {isExporting ? t('export.exporting') : t('export.export')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DataExportDialog;