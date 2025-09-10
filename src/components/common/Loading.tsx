import React from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Skeleton,
  Card,
  CardContent,
  LinearProgress,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

// 基础加载组件
interface LoadingProps {
  size?: number;
  message?: string;
  fullScreen?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({ 
  size = 40, 
  message, 
  fullScreen = false 
}) => {
  const { t } = useTranslation();
  const loadingMessage = message || t('common.loading');
  const content = (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={2}
      sx={{
        minHeight: fullScreen ? '100vh' : 200,
        width: '100%',
      }}
    >
      <CircularProgress size={size} />
      <Typography variant="body2" color="text.secondary">
        {loadingMessage}
      </Typography>
    </Box>
  );

  return fullScreen ? (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: 'background.default',
        zIndex: 9999,
      }}
    >
      {content}
    </Box>
  ) : content;
};

// 线性加载组件
interface LinearLoadingProps {
  message?: string;
  progress?: number;
}

export const LinearLoading: React.FC<LinearLoadingProps> = ({ 
  message, 
  progress 
}) => {
  const { t } = useTranslation();
  const processingMessage = message || t('common.processing');
  
  return (
  <Box sx={{ width: '100%', py: 2 }}>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
      {processingMessage}
    </Typography>
    <LinearProgress 
      variant={progress !== undefined ? "determinate" : "indeterminate"}
      value={progress}
      sx={{ borderRadius: 1 }}
    />
    {progress !== undefined && (
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
        {Math.round(progress)}%
      </Typography>
    )}
  </Box>
  );
};

// 骨架屏加载组件
export const SkeletonCard: React.FC = () => (
  <Card>
    <CardContent>
      <Skeleton variant="text" height={24} width="60%" />
      <Skeleton variant="text" height={20} width="80%" sx={{ mt: 1 }} />
      <Skeleton variant="text" height={20} width="40%" sx={{ mt: 1 }} />
      <Skeleton variant="rectangular" height={120} sx={{ mt: 2, borderRadius: 1 }} />
    </CardContent>
  </Card>
);

// 表格骨架屏
export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <Box>
    {Array.from({ length: rows }, (_, index) => (
      <Box key={index} sx={{ display: 'flex', gap: 2, py: 2, borderBottom: '1px solid #eee' }}>
        <Skeleton variant="circular" width={40} height={40} />
        <Box sx={{ flexGrow: 1 }}>
          <Skeleton variant="text" height={20} width="60%" />
          <Skeleton variant="text" height={16} width="40%" />
        </Box>
        <Skeleton variant="text" height={20} width="20%" />
      </Box>
    ))}
  </Box>
);

// 图表骨架屏
export const SkeletonChart: React.FC<{ height?: number }> = ({ height = 300 }) => (
  <Box sx={{ display: 'flex', alignItems: 'end', gap: 1, height, p: 2 }}>
    {Array.from({ length: 8 }, (_, index) => (
      <Skeleton
        key={index}
        variant="rectangular"
        width={40}
        height={Math.random() * (height - 100) + 50}
        sx={{ borderRadius: '4px 4px 0 0' }}
      />
    ))}
  </Box>
);

// 列表骨架屏
export const SkeletonList: React.FC<{ items?: number }> = ({ items = 6 }) => (
  <Box>
    {Array.from({ length: items }, (_, index) => (
      <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5 }}>
        <Skeleton variant="circular" width={32} height={32} />
        <Box sx={{ flexGrow: 1 }}>
          <Skeleton variant="text" height={18} width="70%" />
          <Skeleton variant="text" height={14} width="50%" />
        </Box>
        <Skeleton variant="text" height={16} width="15%" />
      </Box>
    ))}
  </Box>
);

// 组合加载状态组件
interface LoadingStateProps {
  loading: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
  skeleton?: React.ReactNode;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  loading,
  error,
  empty = false,
  emptyMessage,
  children,
  skeleton
}) => {
  const { t } = useTranslation();
  const noDataMessage = emptyMessage || t('common.noData');
  if (loading) {
    return skeleton ? <>{skeleton}</> : <Loading />;
  }

  if (error) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        sx={{ minHeight: 200, textAlign: 'center' }}
      >
        <Typography variant="h6" color="error" gutterBottom>
          {t('common.loadFailed')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {error}
        </Typography>
      </Box>
    );
  }

  if (empty) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        sx={{ minHeight: 200, textAlign: 'center' }}
      >
        <Typography variant="body1" color="text.secondary">
          {noDataMessage}
        </Typography>
      </Box>
    );
  }

  return <>{children}</>;
};

export default Loading;