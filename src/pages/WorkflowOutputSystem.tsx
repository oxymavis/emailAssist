import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Alert,
  Breadcrumbs,
  Link,
  Card,
  CardContent,
  Grid,
  useTheme,
} from '@mui/material';
import {
  Hub as HubIcon,
  Settings as SettingsIcon,
  Home as HomeIcon,
  PlayArrow as ExecutionIcon,
  Description as TemplateIcon,
  IntegrationInstructions as IntegrationIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';

import WorkflowIntegrationManager from '@/components/workflows/WorkflowIntegrationManager';
import WorkflowTemplateManager from '@/components/workflows/WorkflowTemplateManager';
import WorkflowExecutionEngine from '@/components/workflows/WorkflowExecutionEngine';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`workflow-tabpanel-${index}`}
    aria-labelledby={`workflow-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

const WorkflowOutputSystem: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    {
      label: t('workflows.integrations'),
      icon: <IntegrationIcon />,
      component: <WorkflowIntegrationManager />,
      description: t('workflows.integrationsDescription'),
    },
    {
      label: t('workflows.templates'),
      icon: <TemplateIcon />,
      component: <WorkflowTemplateManager />,
      description: t('workflows.templatesDescription'),
    },
    {
      label: t('workflows.execution'),
      icon: <ExecutionIcon />,
      component: <WorkflowExecutionEngine />,
      description: t('workflows.executionDescription'),
    },
    {
      label: t('workflows.analytics.title'),
      icon: <AnalyticsIcon />,
      component: (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t('workflows.analytics.overview')}
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="h4" color="primary.main">
                    247
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('workflows.analytics.totalExecutions')}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    95.2%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('workflows.analytics.successRate')}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="h4" color="info.main">
                    6.5s
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('workflows.analytics.averageTime')}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
            <Alert severity="info" sx={{ mt: 3 }}>
              {t('workflows.analytics.comingSoon')}
            </Alert>
          </CardContent>
        </Card>
      ),
      description: t('workflows.analyticsDescription'),
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
          <HubIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          {t('workflows.outputSystem')}
        </Typography>
      </Breadcrumbs>

      {/* 页面标题 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          {t('workflows.outputSystem')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('workflows.outputSystemDescription')}
        </Typography>
      </Box>

      {/* 系统状态提示 */}
      <Alert
        severity="success"
        sx={{ mb: 3 }}
        icon={<HubIcon />}
      >
        <Typography variant="body2">
          {t('workflows.systemStatus')}
        </Typography>
      </Alert>

      {/* 主要内容区域 */}
      <Paper sx={{ width: '100%' }}>
        {/* 标签页导航 */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="workflow output system tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            {tabs.map((tab, index) => (
              <Tab
                key={index}
                icon={tab.icon}
                label={tab.label}
                id={`workflow-tab-${index}`}
                aria-controls={`workflow-tabpanel-${index}`}
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

export default WorkflowOutputSystem;