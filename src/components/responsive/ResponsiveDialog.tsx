import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slide,
  useTheme,
  useMediaQuery,
  IconButton,
  Box,
  Typography,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';
import { useResponsive } from '@/hooks/useResponsive';

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface ResponsiveDialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  fullScreen?: boolean;
  fullWidth?: boolean;
  disableBackdropClick?: boolean;
  showCloseButton?: boolean;
  mobileFullScreen?: boolean;
  sx?: any;
}

const ResponsiveDialog: React.FC<ResponsiveDialogProps> = ({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = 'sm',
  fullScreen = false,
  fullWidth = true,
  disableBackdropClick = false,
  showCloseButton = true,
  mobileFullScreen = true,
  sx = {},
}) => {
  const theme = useTheme();
  const { isMobile } = useResponsive();

  const handleClose = (event: any, reason: string) => {
    if (disableBackdropClick && reason === 'backdropClick') {
      return;
    }
    onClose();
  };

  const isFullScreen = fullScreen || (mobileFullScreen && isMobile);

  const dialogSx = {
    '& .MuiDialog-paper': {
      margin: isMobile ? theme.spacing(1) : theme.spacing(2),
      width: isMobile ? 'calc(100% - 16px)' : 'auto',
      maxHeight: isMobile ? 'calc(100% - 16px)' : 'calc(100% - 64px)',
      borderRadius: isMobile ? theme.spacing(1) : theme.spacing(2),
      ...(isFullScreen && {
        margin: 0,
        width: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
        height: '100%',
        borderRadius: 0,
      }),
    },
    ...sx,
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={isFullScreen ? false : maxWidth}
      fullWidth={fullWidth}
      fullScreen={isFullScreen}
      TransitionComponent={isMobile ? Transition : undefined}
      sx={dialogSx}
    >
      {title && (
        <DialogTitle
          sx={{
            pb: 2,
            position: 'relative',
            ...(isMobile && {
              pb: 1,
              '& .MuiTypography-root': {
                fontSize: '1.125rem',
                fontWeight: 600,
              },
            }),
          }}
        >
          {typeof title === 'string' ? (
            <Typography variant="h6" component="div">
              {title}
            </Typography>
          ) : (
            title
          )}

          {showCloseButton && (
            <IconButton
              aria-label="close"
              onClick={onClose}
              sx={{
                position: 'absolute',
                right: 8,
                top: 8,
                color: theme.palette.grey[500],
              }}
            >
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
      )}

      <DialogContent
        sx={{
          px: 3,
          py: 2,
          ...(isMobile && {
            px: 2,
            py: 1.5,
          }),
          ...(isFullScreen && {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }),
        }}
      >
        {children}
      </DialogContent>

      {actions && (
        <DialogActions
          sx={{
            px: 3,
            py: 2,
            gap: 1,
            ...(isMobile && {
              px: 2,
              py: 1.5,
              flexDirection: 'column-reverse',
              '& .MuiButton-root': {
                width: '100%',
                minHeight: 44,
              },
            }),
          }}
        >
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
};

export default ResponsiveDialog;