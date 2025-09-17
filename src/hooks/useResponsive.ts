import { useState, useEffect } from 'react';
import { useTheme, useMediaQuery, Breakpoint } from '@mui/material';
import type { Theme } from '@mui/material/styles';

export interface ResponsiveState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isSmallScreen: boolean;
  orientation: 'portrait' | 'landscape';
  screenSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  containerMaxWidth: string;
  drawerWidth: number;
  appBarHeight: number;
}

export interface DeviceInfo {
  userAgent: string;
  isTouchDevice: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isChrome: boolean;
  isFirefox: boolean;
  pixelRatio: number;
  viewportWidth: number;
  viewportHeight: number;
}

export const useResponsive = () => {
  const theme = useTheme();

  // 使用MUI的断点系统
  const isXs = useMediaQuery(theme.breakpoints.only('xs'));
  const isSm = useMediaQuery(theme.breakpoints.only('sm'));
  const isMd = useMediaQuery(theme.breakpoints.only('md'));
  const isLg = useMediaQuery(theme.breakpoints.only('lg'));
  const isXl = useMediaQuery(theme.breakpoints.only('xl'));

  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    userAgent: '',
    isTouchDevice: false,
    isIOS: false,
    isAndroid: false,
    isSafari: false,
    isChrome: false,
    isFirefox: false,
    pixelRatio: 1,
    viewportWidth: 0,
    viewportHeight: 0,
  });

  // 检测设备信息
  useEffect(() => {
    const userAgent = navigator.userAgent;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    setDeviceInfo({
      userAgent,
      isTouchDevice,
      isIOS: /iPad|iPhone|iPod/.test(userAgent),
      isAndroid: /Android/.test(userAgent),
      isSafari: /Safari/.test(userAgent) && !/Chrome/.test(userAgent),
      isChrome: /Chrome/.test(userAgent),
      isFirefox: /Firefox/.test(userAgent),
      pixelRatio: window.devicePixelRatio || 1,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
  }, []);

  // 监听屏幕方向变化
  useEffect(() => {
    const updateOrientation = () => {
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');

      // 更新viewport尺寸
      setDeviceInfo(prev => ({
        ...prev,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }));
    };

    updateOrientation();
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);

    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  // 获取当前屏幕尺寸
  const getScreenSize = (): 'xs' | 'sm' | 'md' | 'lg' | 'xl' => {
    if (isXs) return 'xs';
    if (isSm) return 'sm';
    if (isMd) return 'md';
    if (isLg) return 'lg';
    return 'xl';
  };

  // 计算容器最大宽度
  const getContainerMaxWidth = (): string => {
    const screenSize = getScreenSize();
    switch (screenSize) {
      case 'xs':
        return '100%';
      case 'sm':
        return '600px';
      case 'md':
        return '960px';
      case 'lg':
        return '1280px';
      case 'xl':
        return '1920px';
      default:
        return '100%';
    }
  };

  // 计算侧边栏宽度
  const getDrawerWidth = (): number => {
    if (isMobile) return 0; // 移动端使用临时抽屉
    if (isTablet) return 240;
    return 280;
  };

  // 计算应用栏高度
  const getAppBarHeight = (): number => {
    if (isMobile) return 56;
    return 64;
  };

  const responsiveState: ResponsiveState = {
    isMobile,
    isTablet,
    isDesktop,
    isSmallScreen,
    orientation,
    screenSize: getScreenSize(),
    containerMaxWidth: getContainerMaxWidth(),
    drawerWidth: getDrawerWidth(),
    appBarHeight: getAppBarHeight(),
  };

  return {
    ...responsiveState,
    deviceInfo,
    // 工具函数
    isBreakpoint: (breakpoint: Breakpoint) => {
      switch (breakpoint) {
        case 'xs': return isXs;
        case 'sm': return isSm;
        case 'md': return isMd;
        case 'lg': return isLg;
        case 'xl': return isXl;
        default: return false;
      }
    },
    isBreakpointUp: (breakpoint: Breakpoint) => useMediaQuery(theme.breakpoints.up(breakpoint)),
    isBreakpointDown: (breakpoint: Breakpoint) => useMediaQuery(theme.breakpoints.down(breakpoint)),
  };
};

// 响应式样式生成器
export const createResponsiveStyles = (theme: Theme) => ({
  // 容器样式
  container: {
    width: '100%',
    maxWidth: theme.breakpoints.values.lg,
    margin: '0 auto',
    padding: theme.spacing(0, 2),
    [theme.breakpoints.up('sm')]: {
      padding: theme.spacing(0, 3),
    },
    [theme.breakpoints.up('md')]: {
      padding: theme.spacing(0, 4),
    },
  },

  // 网格系统
  gridContainer: {
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    [theme.breakpoints.up('sm')]: {
      gap: theme.spacing(3),
      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    },
    [theme.breakpoints.up('md')]: {
      gap: theme.spacing(4),
      gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    },
  },

  // 移动端优化的卡片
  mobileCard: {
    margin: theme.spacing(1, 0),
    borderRadius: theme.spacing(1),
    [theme.breakpoints.down('sm')]: {
      margin: theme.spacing(0.5, 0),
      borderRadius: theme.spacing(0.5),
      boxShadow: theme.shadows[1],
    },
  },

  // 移动端按钮样式
  mobileButton: {
    minHeight: 44, // 符合移动端触摸目标大小
    [theme.breakpoints.down('sm')]: {
      fontSize: '1rem',
      padding: theme.spacing(1.5, 2),
    },
  },

  // 移动端输入框样式
  mobileInput: {
    [theme.breakpoints.down('sm')]: {
      '& .MuiInputBase-root': {
        fontSize: '1rem',
        minHeight: 44,
      },
      '& .MuiFormLabel-root': {
        fontSize: '1rem',
      },
    },
  },

  // 响应式表格
  responsiveTable: {
    overflowX: 'auto',
    [theme.breakpoints.down('md')]: {
      '& .MuiTableCell-root': {
        padding: theme.spacing(1),
        fontSize: '0.875rem',
      },
    },
    [theme.breakpoints.down('sm')]: {
      '& .MuiTableCell-root': {
        padding: theme.spacing(0.5),
        fontSize: '0.8rem',
      },
    },
  },

  // 移动端导航
  mobileNavigation: {
    [theme.breakpoints.down('md')]: {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.palette.background.paper,
      borderTop: `1px solid ${theme.palette.divider}`,
      zIndex: theme.zIndex.appBar,
    },
  },

  // 移动端内容区域
  mobileContent: {
    [theme.breakpoints.down('md')]: {
      paddingBottom: theme.spacing(8), // 为底部导航留出空间
    },
  },

  // 响应式字体大小
  responsiveTypography: {
    h1: {
      fontSize: '2.5rem',
      [theme.breakpoints.down('md')]: {
        fontSize: '2rem',
      },
      [theme.breakpoints.down('sm')]: {
        fontSize: '1.75rem',
      },
    },
    h2: {
      fontSize: '2rem',
      [theme.breakpoints.down('md')]: {
        fontSize: '1.75rem',
      },
      [theme.breakpoints.down('sm')]: {
        fontSize: '1.5rem',
      },
    },
    h3: {
      fontSize: '1.75rem',
      [theme.breakpoints.down('md')]: {
        fontSize: '1.5rem',
      },
      [theme.breakpoints.down('sm')]: {
        fontSize: '1.25rem',
      },
    },
    h4: {
      fontSize: '1.5rem',
      [theme.breakpoints.down('md')]: {
        fontSize: '1.25rem',
      },
      [theme.breakpoints.down('sm')]: {
        fontSize: '1.125rem',
      },
    },
    h5: {
      fontSize: '1.25rem',
      [theme.breakpoints.down('sm')]: {
        fontSize: '1.125rem',
      },
    },
    h6: {
      fontSize: '1.125rem',
      [theme.breakpoints.down('sm')]: {
        fontSize: '1rem',
      },
    },
  },

  // 间距系统
  spacing: {
    section: {
      padding: theme.spacing(4, 0),
      [theme.breakpoints.down('md')]: {
        padding: theme.spacing(3, 0),
      },
      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(2, 0),
      },
    },
    card: {
      padding: theme.spacing(3),
      [theme.breakpoints.down('md')]: {
        padding: theme.spacing(2),
      },
      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(1.5),
      },
    },
  },
});

export default useResponsive;