import { Theme } from '@mui/material/styles';

// 响应式主题增强器
export const enhanceThemeWithResponsive = (theme: Theme): Theme => {
  return {
    ...theme,
    components: {
      ...theme.components,

      // 增强按钮组件的响应式设计
      MuiButton: {
        ...theme.components?.MuiButton,
        styleOverrides: {
          ...theme.components?.MuiButton?.styleOverrides,
          root: {
            ...theme.components?.MuiButton?.styleOverrides?.root,
            minHeight: 44, // 移动端友好的触摸目标
            [theme.breakpoints.down('sm')]: {
              fontSize: '0.875rem',
              padding: theme.spacing(1.5, 2),
              minHeight: 48,
            },
          },
          sizeLarge: {
            ...theme.components?.MuiButton?.styleOverrides?.sizeLarge,
            [theme.breakpoints.down('sm')]: {
              fontSize: '1rem',
              padding: theme.spacing(2, 3),
              minHeight: 52,
            },
          },
        },
      },

      // 增强输入框组件的响应式设计
      MuiTextField: {
        ...theme.components?.MuiTextField,
        styleOverrides: {
          ...theme.components?.MuiTextField?.styleOverrides,
          root: {
            ...theme.components?.MuiTextField?.styleOverrides?.root,
            '& .MuiInputBase-root': {
              minHeight: 44,
              [theme.breakpoints.down('sm')]: {
                minHeight: 48,
                fontSize: '1rem',
              },
            },
            '& .MuiFormLabel-root': {
              [theme.breakpoints.down('sm')]: {
                fontSize: '1rem',
              },
            },
          },
        },
      },

      // 增强IconButton的响应式设计
      MuiIconButton: {
        ...theme.components?.MuiIconButton,
        styleOverrides: {
          ...theme.components?.MuiIconButton?.styleOverrides,
          root: {
            ...theme.components?.MuiIconButton?.styleOverrides?.root,
            minWidth: 44,
            minHeight: 44,
            [theme.breakpoints.down('sm')]: {
              minWidth: 48,
              minHeight: 48,
              padding: theme.spacing(1.5),
            },
          },
        },
      },

      // 增强Chip组件的响应式设计
      MuiChip: {
        ...theme.components?.MuiChip,
        styleOverrides: {
          ...theme.components?.MuiChip?.styleOverrides,
          root: {
            ...theme.components?.MuiChip?.styleOverrides?.root,
            [theme.breakpoints.down('sm')]: {
              fontSize: '0.8125rem',
              height: 32,
            },
          },
        },
      },

      // 增强Typography组件的响应式设计
      MuiTypography: {
        ...theme.components?.MuiTypography,
        styleOverrides: {
          ...theme.components?.MuiTypography?.styleOverrides,
          h1: {
            ...theme.components?.MuiTypography?.styleOverrides?.h1,
            fontSize: '2.5rem',
            [theme.breakpoints.down('md')]: {
              fontSize: '2rem',
            },
            [theme.breakpoints.down('sm')]: {
              fontSize: '1.75rem',
            },
          },
          h2: {
            ...theme.components?.MuiTypography?.styleOverrides?.h2,
            fontSize: '2rem',
            [theme.breakpoints.down('md')]: {
              fontSize: '1.75rem',
            },
            [theme.breakpoints.down('sm')]: {
              fontSize: '1.5rem',
            },
          },
          h3: {
            ...theme.components?.MuiTypography?.styleOverrides?.h3,
            fontSize: '1.75rem',
            [theme.breakpoints.down('md')]: {
              fontSize: '1.5rem',
            },
            [theme.breakpoints.down('sm')]: {
              fontSize: '1.25rem',
            },
          },
          h4: {
            ...theme.components?.MuiTypography?.styleOverrides?.h4,
            fontSize: '1.5rem',
            [theme.breakpoints.down('md')]: {
              fontSize: '1.25rem',
            },
            [theme.breakpoints.down('sm')]: {
              fontSize: '1.125rem',
            },
          },
          h5: {
            ...theme.components?.MuiTypography?.styleOverrides?.h5,
            fontSize: '1.25rem',
            [theme.breakpoints.down('sm')]: {
              fontSize: '1.125rem',
            },
          },
          h6: {
            ...theme.components?.MuiTypography?.styleOverrides?.h6,
            fontSize: '1.125rem',
            [theme.breakpoints.down('sm')]: {
              fontSize: '1rem',
            },
          },
        },
      },

      // 增强Card组件的响应式设计
      MuiCard: {
        ...theme.components?.MuiCard,
        styleOverrides: {
          ...theme.components?.MuiCard?.styleOverrides,
          root: {
            ...theme.components?.MuiCard?.styleOverrides?.root,
            [theme.breakpoints.down('sm')]: {
              borderRadius: theme.spacing(1),
              margin: theme.spacing(0.5, 0),
            },
          },
        },
      },

      // 增强CardContent组件的响应式设计
      MuiCardContent: {
        ...theme.components?.MuiCardContent,
        styleOverrides: {
          ...theme.components?.MuiCardContent?.styleOverrides,
          root: {
            ...theme.components?.MuiCardContent?.styleOverrides?.root,
            padding: theme.spacing(2),
            [theme.breakpoints.down('md')]: {
              padding: theme.spacing(1.5),
            },
            [theme.breakpoints.down('sm')]: {
              padding: theme.spacing(1),
            },
          },
        },
      },

      // 增强Dialog组件的响应式设计
      MuiDialog: {
        ...theme.components?.MuiDialog,
        styleOverrides: {
          ...theme.components?.MuiDialog?.styleOverrides,
          paper: {
            ...theme.components?.MuiDialog?.styleOverrides?.paper,
            [theme.breakpoints.down('sm')]: {
              margin: theme.spacing(1),
              width: 'calc(100% - 16px)',
              maxWidth: 'calc(100% - 16px)',
              borderRadius: theme.spacing(1),
            },
          },
        },
      },

      // 增强Drawer组件的响应式设计
      MuiDrawer: {
        ...theme.components?.MuiDrawer,
        styleOverrides: {
          ...theme.components?.MuiDrawer?.styleOverrides,
          paper: {
            ...theme.components?.MuiDrawer?.styleOverrides?.paper,
            [theme.breakpoints.down('md')]: {
              width: 280,
            },
            [theme.breakpoints.down('sm')]: {
              width: '80vw',
              maxWidth: 320,
            },
          },
        },
      },

      // 增强AppBar组件的响应式设计
      MuiAppBar: {
        ...theme.components?.MuiAppBar,
        styleOverrides: {
          ...theme.components?.MuiAppBar?.styleOverrides,
          root: {
            ...theme.components?.MuiAppBar?.styleOverrides?.root,
            [theme.breakpoints.down('sm')]: {
              '& .MuiToolbar-root': {
                minHeight: 56,
                paddingLeft: theme.spacing(1),
                paddingRight: theme.spacing(1),
              },
            },
          },
        },
      },

      // 增强Toolbar组件的响应式设计
      MuiToolbar: {
        ...theme.components?.MuiToolbar,
        styleOverrides: {
          ...theme.components?.MuiToolbar?.styleOverrides,
          root: {
            ...theme.components?.MuiToolbar?.styleOverrides?.root,
            minHeight: 64,
            [theme.breakpoints.down('sm')]: {
              minHeight: 56,
              padding: theme.spacing(0, 1),
            },
          },
        },
      },

      // 增强Table组件的响应式设计
      MuiTable: {
        ...theme.components?.MuiTable,
        styleOverrides: {
          ...theme.components?.MuiTable?.styleOverrides,
          root: {
            ...theme.components?.MuiTable?.styleOverrides?.root,
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
        },
      },

      // 增强Tab组件的响应式设计
      MuiTab: {
        ...theme.components?.MuiTab,
        styleOverrides: {
          ...theme.components?.MuiTab?.styleOverrides,
          root: {
            ...theme.components?.MuiTab?.styleOverrides?.root,
            minHeight: 48,
            [theme.breakpoints.down('sm')]: {
              minWidth: 'auto',
              padding: theme.spacing(1, 2),
              fontSize: '0.875rem',
            },
          },
        },
      },

      // 增强Menu组件的响应式设计
      MuiMenu: {
        ...theme.components?.MuiMenu,
        styleOverrides: {
          ...theme.components?.MuiMenu?.styleOverrides,
          paper: {
            ...theme.components?.MuiMenu?.styleOverrides?.paper,
            [theme.breakpoints.down('sm')]: {
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 'calc(100vh - 96px)',
            },
          },
        },
      },

      // 增强MenuItem组件的响应式设计
      MuiMenuItem: {
        ...theme.components?.MuiMenuItem,
        styleOverrides: {
          ...theme.components?.MuiMenuItem?.styleOverrides,
          root: {
            ...theme.components?.MuiMenuItem?.styleOverrides?.root,
            minHeight: 44,
            [theme.breakpoints.down('sm')]: {
              minHeight: 48,
              padding: theme.spacing(1.5, 2),
            },
          },
        },
      },

      // 增强Fab组件的响应式设计
      MuiFab: {
        ...theme.components?.MuiFab,
        styleOverrides: {
          ...theme.components?.MuiFab?.styleOverrides,
          root: {
            ...theme.components?.MuiFab?.styleOverrides?.root,
            [theme.breakpoints.down('sm')]: {
              width: 56,
              height: 56,
              fontSize: '1.5rem',
            },
          },
        },
      },

      // 增强Snackbar组件的响应式设计
      MuiSnackbar: {
        ...theme.components?.MuiSnackbar,
        styleOverrides: {
          ...theme.components?.MuiSnackbar?.styleOverrides,
          root: {
            ...theme.components?.MuiSnackbar?.styleOverrides?.root,
            [theme.breakpoints.down('sm')]: {
              left: theme.spacing(1),
              right: theme.spacing(1),
              bottom: theme.spacing(1),
              transform: 'none',
            },
          },
        },
      },
    },

    // 增强间距系统
    spacing: theme.spacing,

    // 增强断点系统
    breakpoints: {
      ...theme.breakpoints,
      values: {
        xs: 0,
        sm: 600,
        md: 960,
        lg: 1280,
        xl: 1920,
      },
    },

    // 增强z-index系统
    zIndex: {
      ...theme.zIndex,
    },
  };
};

// 响应式工具类
export const responsiveUtils = {
  // 生成响应式间距
  spacing: (xs: number, sm?: number, md?: number, lg?: number, xl?: number) => (theme: Theme) => ({
    padding: theme.spacing(xs),
    [theme.breakpoints.up('sm')]: {
      padding: theme.spacing(sm ?? xs),
    },
    [theme.breakpoints.up('md')]: {
      padding: theme.spacing(md ?? sm ?? xs),
    },
    [theme.breakpoints.up('lg')]: {
      padding: theme.spacing(lg ?? md ?? sm ?? xs),
    },
    [theme.breakpoints.up('xl')]: {
      padding: theme.spacing(xl ?? lg ?? md ?? sm ?? xs),
    },
  }),

  // 生成响应式字体大小
  fontSize: (xs: string, sm?: string, md?: string, lg?: string, xl?: string) => (theme: Theme) => ({
    fontSize: xs,
    [theme.breakpoints.up('sm')]: {
      fontSize: sm ?? xs,
    },
    [theme.breakpoints.up('md')]: {
      fontSize: md ?? sm ?? xs,
    },
    [theme.breakpoints.up('lg')]: {
      fontSize: lg ?? md ?? sm ?? xs,
    },
    [theme.breakpoints.up('xl')]: {
      fontSize: xl ?? lg ?? md ?? sm ?? xs,
    },
  }),

  // 生成响应式宽度
  width: (xs: string | number, sm?: string | number, md?: string | number, lg?: string | number, xl?: string | number) => (theme: Theme) => ({
    width: xs,
    [theme.breakpoints.up('sm')]: {
      width: sm ?? xs,
    },
    [theme.breakpoints.up('md')]: {
      width: md ?? sm ?? xs,
    },
    [theme.breakpoints.up('lg')]: {
      width: lg ?? md ?? sm ?? xs,
    },
    [theme.breakpoints.up('xl')]: {
      width: xl ?? lg ?? md ?? sm ?? xs,
    },
  }),

  // 移动端隐藏
  hideOnMobile: (theme: Theme) => ({
    [theme.breakpoints.down('md')]: {
      display: 'none',
    },
  }),

  // 桌面端隐藏
  hideOnDesktop: (theme: Theme) => ({
    [theme.breakpoints.up('md')]: {
      display: 'none',
    },
  }),

  // 移动端全宽
  fullWidthOnMobile: (theme: Theme) => ({
    [theme.breakpoints.down('md')]: {
      width: '100%',
      maxWidth: 'none',
    },
  }),
};

export default enhanceThemeWithResponsive;