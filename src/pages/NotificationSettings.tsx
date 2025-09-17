import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Alert,
  useTheme,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Template as TemplateIcon,
  Router as ChannelIcon,
  Analytics as AnalyticsIcon,
  Home as HomeIcon,
} from '@mui/icons-material';

import NotificationPreferences from '@/components/notifications/NotificationPreferences';
import NotificationTemplateManager from '@/components/notifications/NotificationTemplateManager';
import NotificationChannelConfig from '@/components/notifications/NotificationChannelConfig';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`notification-tabpanel-${index}`}
    aria-labelledby={`notification-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

const NotificationSettings: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    {
      label: t('notifications.preferences'),
      icon: <NotificationsIcon />,
      component: <NotificationPreferences />,
      description: t('notifications.preferencesDescription'),
    },
    {
      label: t('notifications.channels'),
      icon: <ChannelIcon />,
      component: <NotificationChannelConfig />,
      description: t('notifications.channelsDescription'),
    },
    {
      label: t('notifications.templates'),
      icon: <TemplateIcon />,
      component: <NotificationTemplateManager />,
      description: t('notifications.templatesDescription'),
    },
    {
      label: t('notifications.analytics.title'),
      icon: <AnalyticsIcon />,
      component: (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            {t('notifications.analytics.comingSoon')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('notifications.analytics.description')}
          </Typography>
        </Box>
      ),
      description: t('notifications.analyticsDescription'),
    },
  ];

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* 面包屑导航 */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/"
          sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          {t('common.home')}
        </Link>
        <Link
          color="inherit"
          href="/settings"
          sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          <SettingsIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          {t('common.settings')}
        </Link>
        <Typography
          color="text.primary"
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <NotificationsIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          {t('notifications.title')}
        </Typography>
      </Breadcrumbs>

      {/* 页面标题 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          {t('notifications.settings')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('notifications.settingsDescription')}
        </Typography>
      </Box>

      {/* 系统状态提示 */}
      <Alert
        severity="info"
        sx={{ mb: 3 }}
        icon={<NotificationsIcon />}
      >
        <Typography variant="body2">
          {t('notifications.systemStatus')}
        </Typography>
      </Alert>

      {/* 主要内容区域 */}
      <Paper sx={{ width: '100%' }}>
        {/* 标签页导航 */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="notification settings tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            {tabs.map((tab, index) => (
              <Tab
                key={index}
                icon={tab.icon}
                label={tab.label}
                id={`notification-tab-${index}`}
                aria-controls={`notification-tabpanel-${index}`}
                sx={{
                  minHeight: 72,
                  '& .MuiTab-iconWrapper': {
                    mb: 0.5,
                  },
                }}
              />
            ))}
          </Tabs>
        </Box>

        {/* 当前标签页描述 */}
        <Box sx={{ p: 2, bgcolor: 'background.default' }}>
          <Typography variant="body2" color="text.secondary">
            {tabs[activeTab]?.description}
          </Typography>
        </Box>

        {/* 标签页内容 */}
        {tabs.map((tab, index) => (
          <TabPanel key={index} value={activeTab} index={index}>
            {tab.component}
          </TabPanel>
        ))}
      </Paper>
    </Box>
  );
};

export default NotificationSettings;