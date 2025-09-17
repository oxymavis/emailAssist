import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Breadcrumbs,
  Link,
  Alert,
  useTheme,
} from '@mui/material';
import {
  Home as HomeIcon,
  People as PeopleIcon,
  Group as GroupIcon,
  Chat as ChatIcon,
  Settings as SettingsIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';

import TeamManagement from '@/components/team/TeamManagement';
import TeamCollaboration from '@/components/team/TeamCollaboration';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`team-center-tabpanel-${index}`}
    aria-labelledby={`team-center-tab-${index}`}
    {...other}
  >
    {value === index && <Box>{children}</Box>}
  </div>
);

const TeamCenter: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    {
      label: t('team.management'),
      icon: <GroupIcon />,
      component: <TeamManagement />,
      description: t('team.managementDescription'),
    },
    {
      label: t('team.collaboration'),
      icon: <ChatIcon />,
      component: <TeamCollaboration />,
      description: t('team.collaborationDescription'),
    },
    {
      label: t('team.analytics'),
      icon: <AnalyticsIcon />,
      component: (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <AnalyticsIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {t('team.analytics')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('team.analyticsComingSoon')}
          </Typography>
        </Box>
      ),
      description: t('team.analyticsDescription'),
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
        <Typography
          color="text.primary"
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <PeopleIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          {t('team.center')}
        </Typography>
      </Breadcrumbs>

      {/* 页面标题 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          {t('team.center')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('team.centerDescription')}
        </Typography>
      </Box>

      {/* 系统状态提示 */}
      <Alert
        severity="info"
        sx={{ mb: 3 }}
        icon={<PeopleIcon />}
      >
        <Typography variant="body2">
          {t('team.welcomeMessage')}
        </Typography>
      </Alert>

      {/* 主要内容区域 */}
      <Paper sx={{ width: '100%' }}>
        {/* 标签页导航 */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="team center tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            {tabs.map((tab, index) => (
              <Tab
                key={index}
                icon={tab.icon}
                label={tab.label}
                id={`team-center-tab-${index}`}
                aria-controls={`team-center-tabpanel-${index}`}
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

export default TeamCenter;