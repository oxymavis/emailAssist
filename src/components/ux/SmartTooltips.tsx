import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Tooltip,
  Popper,
  Paper,
  Typography,
  Box,
  Button,
  IconButton,
  Fade,
  ClickAwayListener,
  Portal,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Help as HelpIcon,
  Close as CloseIcon,
  Lightbulb as TipIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';

import {
  userExperienceService,
  TooltipConfig,
} from '../../services/userExperienceService';

interface SmartTooltipProps {
  target: string;
  content: string;
  title?: string;
  type?: 'info' | 'tip' | 'warning' | 'success' | 'error';
  persistent?: boolean;
  interactive?: boolean;
  maxWidth?: number;
  delay?: number;
  children?: React.ReactNode;
  onShow?: () => void;
  onHide?: () => void;
}

interface TooltipManagerProps {
  userId: string;
  context?: Record<string, any>;
}

const getTooltipIcon = (type: SmartTooltipProps['type']) => {
  switch (type) {
    case 'tip':
      return <TipIcon fontSize="small" color="primary" />;
    case 'warning':
      return <WarningIcon fontSize="small" color="warning" />;
    case 'success':
      return <SuccessIcon fontSize="small" color="success" />;
    case 'error':
      return <ErrorIcon fontSize="small" color="error" />;
    case 'info':
    default:
      return <InfoIcon fontSize="small" color="info" />;
  }
};

const getTooltipColor = (type: SmartTooltipProps['type'], theme: any) => {
  switch (type) {
    case 'tip':
      return theme.palette.primary.main;
    case 'warning':
      return theme.palette.warning.main;
    case 'success':
      return theme.palette.success.main;
    case 'error':
      return theme.palette.error.main;
    case 'info':
    default:
      return theme.palette.info.main;
  }
};

export const SmartTooltip: React.FC<SmartTooltipProps> = ({
  target,
  content,
  title,
  type = 'info',
  persistent = false,
  interactive = false,
  maxWidth = 320,
  delay = 500,
  children,
  onShow,
  onHide,
}) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const targetElementRef = useRef<HTMLElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const targetElement = document.querySelector(target) as HTMLElement;
    if (targetElement) {
      targetElementRef.current = targetElement;
      setAnchorEl(targetElement);

      const handleMouseEnter = () => {
        timeoutRef.current = setTimeout(() => {
          setOpen(true);
          onShow?.();
        }, delay);
      };

      const handleMouseLeave = () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        if (!persistent) {
          setOpen(false);
          onHide?.();
        }
      };

      targetElement.addEventListener('mouseenter', handleMouseEnter);
      targetElement.addEventListener('mouseleave', handleMouseLeave);

      if (persistent) {
        targetElement.addEventListener('click', () => {
          setOpen(true);
          onShow?.();
        });
      }

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        targetElement.removeEventListener('mouseenter', handleMouseEnter);
        targetElement.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, [target, delay, persistent, onShow, onHide]);

  const handleClose = () => {
    setOpen(false);
    onHide?.();
  };

  const handleClickAway = () => {
    if (persistent && interactive) {
      handleClose();
    }
  };

  if (!anchorEl) return null;

  const tooltipContent = (
    <Paper
      elevation={8}
      sx={{
        p: 2,
        maxWidth,
        borderLeft: `4px solid ${getTooltipColor(type, theme)}`,
        backgroundColor: alpha(getTooltipColor(type, theme), 0.05),
      }}
    >
      <Box display="flex" alignItems="flex-start" gap={1}>
        {getTooltipIcon(type)}
        <Box flex={1}>
          {title && (
            <Typography variant="subtitle2" gutterBottom>
              {title}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {content}
          </Typography>
          {children && (
            <Box mt={1}>
              {children}
            </Box>
          )}
        </Box>
        {persistent && (
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    </Paper>
  );

  if (interactive && persistent) {
    return (
      <ClickAwayListener onClickAway={handleClickAway}>
        <Portal>
          <Popper
            open={open}
            anchorEl={anchorEl}
            placement="bottom-start"
            transition
            style={{ zIndex: 1500 }}
          >
            {({ TransitionProps }) => (
              <Fade {...TransitionProps} timeout={200}>
                <div>{tooltipContent}</div>
              </Fade>
            )}
          </Popper>
        </Portal>
      </ClickAwayListener>
    );
  }

  return (
    <Portal>
      <Popper
        open={open}
        anchorEl={anchorEl}
        placement="bottom-start"
        transition
        style={{ zIndex: 1500 }}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={200}>
            <div>{tooltipContent}</div>
          </Fade>
        )}
      </Popper>
    </Portal>
  );
};

export const TooltipManager: React.FC<TooltipManagerProps> = ({
  userId,
  context = {}
}) => {
  const [activeTooltips, setActiveTooltips] = useState<TooltipConfig[]>([]);
  const [shownTooltips, setShownTooltips] = useState<Set<string>>(new Set());

  useEffect(() => {
    checkForContextualHelp();
  }, [context]);

  const checkForContextualHelp = async () => {
    // 获取页面上所有可见的元素
    const elements = document.querySelectorAll('[data-tooltip-target]');
    const newTooltips: TooltipConfig[] = [];

    for (const element of elements) {
      const target = element.getAttribute('data-tooltip-target');
      if (target && !shownTooltips.has(target)) {
        const tooltips = await userExperienceService.showContextualHelp(target, {
          ...context,
          userType: 'regular', // 这里可以从用户上下文获取
        });

        newTooltips.push(...tooltips);
      }
    }

    setActiveTooltips(newTooltips);
  };

  const handleTooltipShow = (tooltipId: string) => {
    setShownTooltips(prev => new Set(prev).add(tooltipId));
  };

  return (
    <>
      {activeTooltips.map((tooltip) => (
        <SmartTooltip
          key={tooltip.id}
          target={tooltip.target}
          content={tooltip.content}
          title={tooltip.title}
          type="tip"
          persistent={tooltip.persistent}
          interactive={tooltip.interactive}
          delay={tooltip.delay}
          onShow={() => handleTooltipShow(tooltip.id)}
        />
      ))}
    </>
  );
};

// 高阶组件，为元素添加智能提示
export const withSmartTooltip = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  tooltipProps: Omit<SmartTooltipProps, 'target'>
) => {
  return React.forwardRef<any, P>((props, ref) => {
    const elementRef = useRef<HTMLElement>();
    const [tooltipTarget, setTooltipTarget] = useState<string>('');

    useEffect(() => {
      if (elementRef.current) {
        const id = `tooltip-target-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        elementRef.current.id = id;
        setTooltipTarget(`#${id}`);
      }
    }, []);

    return (
      <>
        <WrappedComponent
          {...props}
          ref={(element: HTMLElement) => {
            elementRef.current = element;
            if (typeof ref === 'function') {
              ref(element);
            } else if (ref) {
              ref.current = element;
            }
          }}
        />
        {tooltipTarget && (
          <SmartTooltip
            {...tooltipProps}
            target={tooltipTarget}
          />
        )}
      </>
    );
  });
};

// 智能提示钩子
export const useSmartTooltip = (
  elementRef: React.RefObject<HTMLElement>,
  config: Omit<TooltipConfig, 'id' | 'target'>
) => {
  const [tooltip, setTooltip] = useState<TooltipConfig | null>(null);

  useEffect(() => {
    if (elementRef.current) {
      const target = `#${elementRef.current.id || `tooltip-${Date.now()}`}`;

      if (!elementRef.current.id) {
        elementRef.current.id = target.substring(1);
      }

      userExperienceService.createTooltip({
        ...config,
        target,
      }).then(setTooltip);
    }
  }, [config]);

  const showTooltip = useCallback(() => {
    if (tooltip && elementRef.current) {
      const event = new CustomEvent('mouseenter');
      elementRef.current.dispatchEvent(event);
    }
  }, [tooltip]);

  const hideTooltip = useCallback(() => {
    if (tooltip && elementRef.current) {
      const event = new CustomEvent('mouseleave');
      elementRef.current.dispatchEvent(event);
    }
  }, [tooltip]);

  return {
    tooltip,
    showTooltip,
    hideTooltip,
  };
};

export default SmartTooltip;