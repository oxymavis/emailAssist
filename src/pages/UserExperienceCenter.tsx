import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Button,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Switch,
  FormControlLabel,
  Slider,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Settings as SettingsIcon,
  Help as HelpIcon,
  Accessibility as AccessibilityIcon,
  Analytics as AnalyticsIcon,
  Psychology as AIIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Visibility as VisibilityIcon,
  VolumeUp as SoundIcon,
  Palette as ColorIcon,
  TextFields as TextIcon,
  Speed as PerformanceIcon,
  TouchApp as TouchIcon,
  Keyboard as KeyboardIcon,
  Stars as RecommendationIcon,
  Timeline as ProgressIcon,
} from '@mui/icons-material';

import OnboardingGuide from '../components/ux/OnboardingGuide';
import { SmartTooltip, TooltipManager } from '../components/ux/SmartTooltips';
import {
  userExperienceService,
  OnboardingFlow,
  UserProgress,
  AccessibilityOptions,
  HelpContent,
} from '../services/userExperienceService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ height: '100%' }}>
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

const UserExperienceCenter: React.FC = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [flows, setFlows] = useState<OnboardingFlow[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [helpContent, setHelpContent] = useState<HelpContent[]>([]);
  const [accessibilitySettings, setAccessibilitySettings] = useState<AccessibilityOptions>({
    highContrast: false,
    largeText: false,
    reducedMotion: false,
    screenReader: false,
    keyboardNavigation: true,
    focusIndicator: true,
    colorBlind: { enabled: false },
    dyslexiaFriendly: false,
    autoReadAloud: false,
  });

  // 对话框状态
  const [onboardingDialogOpen, setOnboardingDialogOpen] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<OnboardingFlow | null>(null);
  const [selectedHelp, setSelectedHelp] = useState<HelpContent | null>(null);

  // 演示状态
  const [demoTooltipVisible, setDemoTooltipVisible] = useState(false);
  const demoButtonRef = useRef<HTMLButtonElement>(null);

  const userId = 'demo_user'; // 在实际应用中应从认证状态获取

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const flowsData = userExperienceService.getAllOnboardingFlows();
      const helpData = userExperienceService.searchHelpContent('');
      const accessibilityData = userExperienceService.getAccessibilitySettings();

      setFlows(flowsData);
      setHelpContent(helpData);
      setAccessibilitySettings(accessibilityData);

      // 加载用户进度
      const progressData = flowsData.map(flow =>
        userExperienceService.getUserProgress(userId, flow.id)
      ).filter(Boolean) as UserProgress[];

      setUserProgress(progressData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleStartOnboarding = async (flowId: string) => {
    try {
      await userExperienceService.startOnboardingFlow(flowId, userId);
      const flow = flows.find(f => f.id === flowId);
      if (flow) {
        setSelectedFlow(flow);
        setOnboardingDialogOpen(true);
      }
    } catch (error) {
      console.error('Failed to start onboarding:', error);
    }
  };

  const handleAccessibilityChange = (setting: keyof AccessibilityOptions, value: any) => {
    const newSettings = { ...accessibilitySettings, [setting]: value };
    setAccessibilitySettings(newSettings);
    userExperienceService.updateAccessibilitySettings({ [setting]: value });
  };

  const handleOnboardingComplete = (progress: UserProgress) => {
    setUserProgress(prev => [...prev.filter(p => p.flowId !== progress.flowId), progress]);
    setOnboardingDialogOpen(false);
    setSelectedFlow(null);
  };

  const getProgressPercentage = (flowId: string): number => {
    const progress = userProgress.find(p => p.flowId === flowId);
    const flow = flows.find(f => f.id === flowId);

    if (!progress || !flow) return 0;

    return (progress.completedSteps.length / flow.steps.length) * 100;
  };

  const getProgressStatus = (flowId: string): string => {
    const progress = userProgress.find(p => p.flowId === flowId);
    if (!progress) return '未开始';

    switch (progress.status) {
      case 'completed':
        return '已完成';
      case 'in_progress':
        return '进行中';
      case 'abandoned':
        return '已放弃';
      default:
        return '未知';
    }
  };

  // 引导流程管理标签页
  const renderOnboardingTab = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h5" gutterBottom>
          用户引导流程
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          管理和体验不同的用户引导流程，帮助用户快速了解产品功能。
        </Typography>
      </Grid>

      {flows.map((flow) => (
        <Grid item xs={12} md={6} key={flow.id}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {flow.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {flow.description}
                  </Typography>
                </Box>
                <Chip
                  label={flow.targetAudience}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </Box>

              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="caption" color="text.secondary">
                    进度: {getProgressStatus(flow.id)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {Math.round(getProgressPercentage(flow.id))}%
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: '100%',
                    height: 4,
                    backgroundColor: alpha(theme.palette.primary.main, 0.2),
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      width: `${getProgressPercentage(flow.id)}%`,
                      height: '100%',
                      backgroundColor: theme.palette.primary.main,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </Box>
              </Box>

              <Box display="flex" gap={1} mb={2}>
                <Chip label={`${flow.steps.length} 步骤`} size="small" />
                <Chip label={flow.version} size="small" variant="outlined" />
              </Box>

              <Button
                variant="contained"
                startIcon={<StartIcon />}
                onClick={() => handleStartOnboarding(flow.id)}
                fullWidth
              >
                开始引导
              </Button>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  // 无障碍设置标签页
  const renderAccessibilityTab = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h5" gutterBottom>
          无障碍设置
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          调整界面设置以满足不同用户的无障碍需求。
        </Typography>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              视觉辅助
            </Typography>

            <List>
              <ListItem>
                <ListItemIcon>
                  <VisibilityIcon />
                </ListItemIcon>
                <ListItemText
                  primary="高对比度"
                  secondary="增强色彩对比度以提高可读性"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={accessibilitySettings.highContrast}
                    onChange={(e) => handleAccessibilityChange('highContrast', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <TextIcon />
                </ListItemIcon>
                <ListItemText
                  primary="大字体"
                  secondary="放大文字以提高可读性"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={accessibilitySettings.largeText}
                    onChange={(e) => handleAccessibilityChange('largeText', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <ColorIcon />
                </ListItemIcon>
                <ListItemText
                  primary="色盲友好"
                  secondary="调整配色方案适应色盲用户"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={accessibilitySettings.colorBlind.enabled}
                    onChange={(e) => handleAccessibilityChange('colorBlind', {
                      ...accessibilitySettings.colorBlind,
                      enabled: e.target.checked
                    })}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              交互辅助
            </Typography>

            <List>
              <ListItem>
                <ListItemIcon>
                  <KeyboardIcon />
                </ListItemIcon>
                <ListItemText
                  primary="键盘导航"
                  secondary="启用键盘快捷键导航"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={accessibilitySettings.keyboardNavigation}
                    onChange={(e) => handleAccessibilityChange('keyboardNavigation', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <TouchIcon />
                </ListItemIcon>
                <ListItemText
                  primary="减少动画"
                  secondary="减少或禁用动画效果"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={accessibilitySettings.reducedMotion}
                    onChange={(e) => handleAccessibilityChange('reducedMotion', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <SoundIcon />
                </ListItemIcon>
                <ListItemText
                  primary="自动朗读"
                  secondary="自动朗读页面内容"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={accessibilitySettings.autoReadAloud}
                    onChange={(e) => handleAccessibilityChange('autoReadAloud', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Alert severity="info">
          这些设置会自动保存并在您下次访问时生效。您可以随时在此页面修改这些设置。
        </Alert>
      </Grid>
    </Grid>
  );

  // 智能提示演示标签页
  const renderTooltipDemoTab = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h5" gutterBottom>
          智能提示系统
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          体验智能上下文提示功能，获得实时帮助和指导。
        </Typography>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              提示演示
            </Typography>

            <Box display="flex" flexDirection="column" gap={2}>
              <Button
                ref={demoButtonRef}
                variant="outlined"
                data-tooltip-target="demo-button"
                onMouseEnter={() => setDemoTooltipVisible(true)}
                onMouseLeave={() => setDemoTooltipVisible(false)}
              >
                悬停查看提示
              </Button>

              {demoTooltipVisible && (
                <SmartTooltip
                  target="[data-tooltip-target='demo-button']"
                  content="这是一个智能提示示例，可以根据上下文显示相关帮助信息。"
                  title="演示提示"
                  type="tip"
                  interactive={true}
                />
              )}

              <Button
                variant="contained"
                onClick={() => {
                  // 这里可以触发更多的演示功能
                  alert('这里可以展示更复杂的交互演示');
                }}
              >
                交互式提示演示
              </Button>

              <Typography variant="body2" color="text.secondary">
                智能提示系统可以：
              </Typography>
              <ul>
                <li>根据用户行为自动显示相关提示</li>
                <li>提供上下文相关的帮助信息</li>
                <li>支持多种提示样式和交互方式</li>
                <li>适应不同屏幕尺寸和设备</li>
              </ul>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              帮助内容库
            </Typography>

            <List>
              {helpContent.slice(0, 5).map((help) => (
                <ListItem
                  key={help.id}
                  button
                  onClick={() => {
                    setSelectedHelp(help);
                    setHelpDialogOpen(true);
                  }}
                >
                  <ListItemIcon>
                    <HelpIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={help.title}
                    secondary={`${help.category} • ${help.estimatedTime}分钟`}
                  />
                  <Chip
                    label={help.difficulty}
                    size="small"
                    color={
                      help.difficulty === 'beginner' ? 'success' :
                      help.difficulty === 'intermediate' ? 'warning' : 'error'
                    }
                  />
                </ListItem>
              ))}
            </List>

            <Button variant="text" fullWidth>
              查看更多帮助内容
            </Button>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label="用户引导" icon={<ProgressIcon />} />
          <Tab label="无障碍设置" icon={<AccessibilityIcon />} />
          <Tab label="智能提示" icon={<AIIcon />} />
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <TabPanel value={activeTab} index={0}>
          {renderOnboardingTab()}
        </TabPanel>
        <TabPanel value={activeTab} index={1}>
          {renderAccessibilityTab()}
        </TabPanel>
        <TabPanel value={activeTab} index={2}>
          {renderTooltipDemoTab()}
        </TabPanel>
      </Box>

      {/* 引导流程对话框 */}
      {selectedFlow && (
        <OnboardingGuide
          flowId={selectedFlow.id}
          userId={userId}
          onComplete={handleOnboardingComplete}
          onClose={() => {
            setOnboardingDialogOpen(false);
            setSelectedFlow(null);
          }}
        />
      )}

      {/* 帮助内容对话框 */}
      <Dialog
        open={helpDialogOpen}
        onClose={() => setHelpDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedHelp?.title}
        </DialogTitle>
        <DialogContent>
          {selectedHelp && (
            <Box>
              <Box display="flex" gap={1} mb={2}>
                <Chip label={selectedHelp.category} size="small" color="primary" />
                <Chip label={selectedHelp.difficulty} size="small" />
                <Chip label={`${selectedHelp.estimatedTime}分钟`} size="small" variant="outlined" />
              </Box>
              <Typography variant="body1" paragraph>
                {selectedHelp.content}
              </Typography>
              {selectedHelp.tags.length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    标签:
                  </Typography>
                  <Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
                    {selectedHelp.tags.map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpDialogOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 智能提示管理器 */}
      <TooltipManager userId={userId} context={{ userType: 'regular' }} />
    </Box>
  );
};

export default UserExperienceCenter;