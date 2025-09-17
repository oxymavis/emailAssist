import React from 'react';
import { Box, Container, useTheme } from '@mui/material';
import { useResponsive, createResponsiveStyles } from '@/hooks/useResponsive';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  disableGutters?: boolean;
  fullHeight?: boolean;
  className?: string;
  sx?: any;
}

const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  maxWidth = 'lg',
  disableGutters = false,
  fullHeight = false,
  className,
  sx = {},
}) => {
  const theme = useTheme();
  const { isMobile, isTablet, screenSize } = useResponsive();
  const responsiveStyles = createResponsiveStyles(theme);

  const containerProps = {
    maxWidth: isMobile ? false : maxWidth,
    disableGutters: disableGutters || isMobile,
  };

  const containerSx = {
    ...responsiveStyles.container,
    height: fullHeight ? '100vh' : 'auto',
    display: 'flex',
    flexDirection: 'column',
    // 移动端优化
    ...(isMobile && {
      padding: theme.spacing(1),
      maxWidth: '100vw',
      overflowX: 'hidden',
    }),
    // 平板优化
    ...(isTablet && {
      padding: theme.spacing(2),
    }),
    ...sx,
  };

  return (
    <Container {...containerProps} className={className} sx={containerSx}>
      {children}
    </Container>
  );
};

export default ResponsiveContainer;