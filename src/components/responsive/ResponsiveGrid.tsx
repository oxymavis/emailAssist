import React from 'react';
import { Grid, Box, useTheme } from '@mui/material';
import { useResponsive } from '@/hooks/useResponsive';

interface ResponsiveGridProps {
  children: React.ReactNode;
  spacing?: number;
  columns?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  minItemWidth?: number;
  maxItemWidth?: number;
  autoFit?: boolean;
  sx?: any;
}

const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  spacing = 2,
  columns = { xs: 1, sm: 2, md: 3, lg: 4, xl: 5 },
  minItemWidth = 280,
  maxItemWidth,
  autoFit = false,
  sx = {},
}) => {
  const theme = useTheme();
  const { screenSize, isMobile } = useResponsive();

  if (autoFit) {
    // 使用CSS Grid自动适应布局
    const autoGridSx = {
      display: 'grid',
      gap: theme.spacing(spacing),
      gridTemplateColumns: `repeat(auto-fit, minmax(${minItemWidth}px, ${maxItemWidth ? `${maxItemWidth}px` : '1fr'}))`,
      [theme.breakpoints.down('sm')]: {
        gridTemplateColumns: '1fr', // 移动端单列
        gap: theme.spacing(Math.max(1, spacing - 1)),
      },
      ...sx,
    };

    return (
      <Box sx={autoGridSx}>
        {children}
      </Box>
    );
  }

  // 使用MUI Grid系统
  const currentColumns = columns[screenSize] || columns.xs || 1;
  const mobileSpacing = isMobile ? Math.max(1, spacing - 1) : spacing;

  return (
    <Grid container spacing={mobileSpacing} sx={sx}>
      {React.Children.map(children, (child, index) => (
        <Grid
          item
          xs={12 / Math.min(columns.xs || 1, 12)}
          sm={12 / Math.min(columns.sm || 2, 12)}
          md={12 / Math.min(columns.md || 3, 12)}
          lg={12 / Math.min(columns.lg || 4, 12)}
          xl={12 / Math.min(columns.xl || 5, 12)}
          key={index}
        >
          {child}
        </Grid>
      ))}
    </Grid>
  );
};

export default ResponsiveGrid;