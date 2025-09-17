import React, { useState } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  Avatar,
  Badge,
  Menu,
  MenuItem,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Analytics as AnalyticsIcon,
  FilterList as FilterListIcon,
  Assessment as AssessmentIcon,
  Hub as HubIcon,
  Settings as SettingsIcon,
  AdminPanelSettings as AdminIcon,
  Notifications as NotificationsIcon,
  AccountCircle as AccountCircleIcon,
  People as PeopleIcon,
  Brightness4 as Brightness4Icon,
  Brightness7 as Brightness7Icon,
  Logout as LogoutIcon,
  IntegrationInstructions as IntegrationIcon,
  Groups as GroupsIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppStore, useSidebar, useNotifications } from '@/store';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import MobileBottomNavigation from '@/components/responsive/MobileBottomNavigation';
import { useResponsive } from '@/hooks/useResponsive';

const _DRAWER_WIDTH = 280;

// 导航菜单配置
const getNavigationItems = (t: any) => [
  {
    text: t('nav.dashboard'),
    icon: <DashboardIcon />,
    path: '/',
    badge: null,
  },
  {
    text: t('nav.analysis'),
    icon: <AnalyticsIcon />,
    path: '/analysis',
    badge: null,
  },
  {
    text: '简化邮件列表',
    icon: <EmailIcon />,
    path: '/simple-emails',
    badge: null,
  },
  {
    text: '静态邮件展示',
    icon: <EmailIcon />,
    path: '/static-emails',
    badge: null,
  },
  {
    text: t('nav.filters'),
    icon: <FilterListIcon />,
    path: '/filters',
    badge: null,
  },
  {
    text: t('nav.reports'),
    icon: <AssessmentIcon />,
    path: '/reports',
    badge: null,
  },
  {
    text: t('nav.workflows'),
    icon: <HubIcon />,
    path: '/workflows',
    badge: null,
  },
  {
    text: t('nav.workflowOutput'),
    icon: <HubIcon />,
    path: '/workflow-output',
    badge: null,
  },
  {
    text: t('nav.integrations'),
    icon: <IntegrationIcon />,
    path: '/integrations',
    badge: null,
  },
  {
    text: t('nav.teamCollaboration'),
    icon: <GroupsIcon />,
    path: '/team-collaboration',
    badge: null,
  },
  {
    text: t('nav.team'),
    icon: <PeopleIcon />,
    path: '/team',
    badge: null,
  },
  {
    text: t('nav.admin'),
    icon: <AdminIcon />,
    path: '/admin',
    badge: null,
    adminOnly: true,
  },
  {
    text: t('nav.notifications'),
    icon: <NotificationsIcon />,
    path: '/notifications',
    badge: null,
  },
  {
    text: t('nav.settings'),
    icon: <SettingsIcon />,
    path: '/settings',
    badge: null,
  },
];

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { drawerWidth, appBarHeight: _appBarHeight } = useResponsive();
  
  const { isOpen, toggle } = useSidebar();
  const { notifications } = useNotifications();
  const { theme: appTheme, setTheme } = useAppStore();
  
  const navigationItems = getNavigationItems(t);
  
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [notificationMenuAnchor, setNotificationMenuAnchor] = useState<null | HTMLElement>(null);

  // 未读通知数量
  const _unreadNotifications = notifications.filter(n => !n.isRead).length;

  // 处理导航点击
  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      toggle();
    }
  };

  // 处理主题切换
  const handleThemeToggle = () => {
    setTheme(appTheme === 'light' ? 'dark' : 'light');
  };

  // 用户菜单处理
  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  // 通知菜单处理
  const _handleNotificationMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationMenuAnchor(event.currentTarget);
  };

  const handleNotificationMenuClose = () => {
    setNotificationMenuAnchor(null);
  };

  // 侧边栏内容
  const drawerContent = (
    <Box sx={{ overflow: 'auto', height: '100%' }}>
      {/* Logo 和标题 */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar
          sx={{
            bgcolor: theme.palette.primary.main,
            width: 40,
            height: 40,
          }}
        >
          📧
        </Avatar>
        <Typography variant="h6" noWrap component="div" fontWeight="bold">
          {t('app.title')}
        </Typography>
      </Box>
      
      <Divider />
      
      {/* 导航菜单 */}
      <List sx={{ px: 1, py: 2 }}>
        {navigationItems.map((item) => {
          const isSelected = location.pathname === item.path;

          // 检查是否需要管理员权限
          // 在实际应用中，这应该从store或context中获取用户角色
          const currentUserRole = 'admin'; // 模拟当前用户角色
          const hasAdminAccess = currentUserRole === 'admin' || currentUserRole === 'manager';

          // 如果是管理员专属菜单且用户没有权限，则不显示
          if (item.adminOnly && !hasAdminAccess) {
            return null;
          }

          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={isSelected}
                onClick={() => handleNavigation(item.path)}
                sx={{
                  borderRadius: 2,
                  mx: 0.5,
                  '&.Mui-selected': {
                    bgcolor: theme.palette.primary.main,
                    color: 'white',
                    '&:hover': {
                      bgcolor: theme.palette.primary.dark,
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: isSelected ? 'white' : 'inherit',
                  }}
                >
                  {item.badge ? (
                    <Badge badgeContent={item.badge} color="error">
                      {item.icon}
                    </Badge>
                  ) : (
                    item.icon
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '0.9rem',
                    fontWeight: isSelected ? 600 : 500,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider />
      
      {/* 底部信息 */}
      <Box sx={{ p: 2, mt: 'auto' }}>
        <Typography variant="caption" color="text.secondary" display="block">
          {t('app.title')} {t('app.version')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('app.subtitle')}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* 顶部导航栏 */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${isOpen ? drawerWidth : 0}px)` },
          ml: { md: isOpen ? `${drawerWidth}px` : 0 },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle drawer"
            edge="start"
            onClick={toggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {navigationItems.find(item => item.path === location.pathname)?.text || t('app.title')}
          </Typography>

          {/* 右侧工具栏 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* 主题切换按钮 */}
            <Tooltip title={t('menu.toggleTheme', { theme: appTheme === 'light' ? t('menu.darkTheme') : t('menu.lightTheme') })}>
              <IconButton color="inherit" onClick={handleThemeToggle}>
                {appTheme === 'light' ? <Brightness4Icon /> : <Brightness7Icon />}
              </IconButton>
            </Tooltip>

            {/* 语言切换按钮 */}
            <LanguageSwitcher />

            {/* 通知中心 */}
            <NotificationCenter />

            {/* 用户菜单 */}
            <Tooltip title={t('menu.accountMenu')}>
              <IconButton
                color="inherit"
                onClick={handleUserMenuOpen}
                sx={{ ml: 1 }}
              >
                <AccountCircleIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* 侧边栏 */}
      <Box
        component="nav"
        sx={{ width: { md: isOpen ? drawerWidth : 0 }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant={isMobile ? 'temporary' : 'persistent'}
          open={isOpen}
          onClose={toggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* 主内容区域 */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${isOpen ? drawerWidth : 0}px)` },
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar /> {/* 为固定导航栏留出空间 */}
        <Box sx={{
          p: 3,
          pb: isMobile ? 10 : 3, // 移动端为底部导航预留空间
        }}>
          {children}
        </Box>
      </Box>

      {/* 用户菜单 */}
      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={handleUserMenuClose}
        onClick={handleUserMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => navigate('/settings')}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          {t('menu.settings')}
        </MenuItem>
        <Divider />
        <MenuItem>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          {t('menu.logout')}
        </MenuItem>
      </Menu>

      {/* 通知菜单 */}
      <Menu
        anchorEl={notificationMenuAnchor}
        open={Boolean(notificationMenuAnchor)}
        onClose={handleNotificationMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: { width: 320, maxHeight: 400 }
        }}
      >
        {notifications.length === 0 ? (
          <MenuItem>
            <Typography variant="body2" color="text.secondary">
              {t('menu.noNotifications')}
            </Typography>
          </MenuItem>
        ) : (
          notifications.slice(0, 5).map((notification) => (
            <MenuItem key={notification.id} onClick={handleNotificationMenuClose}>
              <Box sx={{ width: '100%' }}>
                <Typography variant="subtitle2" noWrap>
                  {notification.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {notification.message}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(notification.timestamp).toLocaleTimeString()}
                </Typography>
              </Box>
            </MenuItem>
          ))
        )}
        {notifications.length > 5 && (
          <>
            <Divider />
            <MenuItem onClick={() => navigate('/notifications')}>
              <Typography variant="body2" color="primary">
                {t('menu.viewAll')}
              </Typography>
            </MenuItem>
          </>
        )}
      </Menu>

      {/* 移动端底部导航 */}
      <MobileBottomNavigation />
    </Box>
  );
};

export default Layout;