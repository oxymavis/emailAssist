import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Badge,
  useTheme,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Analytics as AnalyticsIcon,
  Notifications as NotificationsIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useResponsive } from '@/hooks/useResponsive';
import { useNotifications } from '@/store';

const MobileBottomNavigation: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useResponsive();
  const { notifications } = useNotifications();

  // 只在移动端显示
  if (!isMobile) {
    return null;
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const navigationItems = [
    {
      label: t('nav.dashboard'),
      icon: <DashboardIcon />,
      path: '/',
    },
    {
      label: t('nav.analysis'),
      icon: <AnalyticsIcon />,
      path: '/analysis',
    },
    {
      label: t('nav.notifications'),
      icon: unreadCount > 0 ? (
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      ) : (
        <NotificationsIcon />
      ),
      path: '/notifications',
    },
    {
      label: t('nav.team'),
      icon: <PeopleIcon />,
      path: '/team',
    },
    {
      label: t('nav.settings'),
      icon: <SettingsIcon />,
      path: '/settings',
    },
  ];

  const currentIndex = navigationItems.findIndex(item => item.path === location.pathname);

  const handleChange = (_: React.SyntheticEvent, newValue: number) => {
    const selectedItem = navigationItems[newValue];
    if (selectedItem) {
      navigate(selectedItem.path);
    }
  };

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: theme.zIndex.appBar,
        borderTop: `1px solid ${theme.palette.divider}`,
      }}
      elevation={8}
    >
      <BottomNavigation
        value={currentIndex >= 0 ? currentIndex : 0}
        onChange={handleChange}
        showLabels
        sx={{
          height: 64,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            padding: theme.spacing(0.5),
            '& .MuiBottomNavigationAction-label': {
              fontSize: '0.75rem',
              fontWeight: 500,
              marginTop: theme.spacing(0.5),
              '&.Mui-selected': {
                fontSize: '0.75rem',
                fontWeight: 600,
              },
            },
          },
        }}
      >
        {navigationItems.map((item, index) => (
          <BottomNavigationAction
            key={index}
            label={item.label}
            icon={item.icon}
            sx={{
              color: currentIndex === index ? theme.palette.primary.main : theme.palette.text.secondary,
            }}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
};

export default MobileBottomNavigation;