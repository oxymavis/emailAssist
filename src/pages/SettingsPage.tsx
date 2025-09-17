import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Switch,
  FormControlLabel,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Avatar,
  Paper,
  Tabs,
  Tab,
  useTheme,
} from '@mui/material';
import {
  Save as SaveIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Security as SecurityIcon,
  Notifications as NotificationIcon,
  Language as LanguageIcon,
  Palette as ThemeIcon,
  Email as EmailIcon,
  Storage as StorageIcon,
  Sync as SyncIcon,
  VpnKey as ApiIcon,
} from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

const SettingsPage: React.FC = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);

  // 设置状态
  const [settings, setSettings] = useState({
    // 通用设置
    language: 'zh-CN',
    theme: 'auto',
    timezone: 'Asia/Shanghai',

    // 邮件设置
    autoSync: true,
    syncInterval: 15,
    maxEmailsPerSync: 100,
    enableSmartFiltering: true,

    // 通知设置
    emailNotifications: true,
    pushNotifications: false,
    desktopNotifications: true,
    soundEnabled: true,

    // 隐私设置
    dataRetention: 90,
    anonymizeData: false,
    shareAnalytics: true,

    // AI设置
    enableAIAnalysis: true,
    sentimentAnalysis: true,
    autoCategories: true,
    smartSuggestions: true,
  });

  const [connectedAccounts] = useState([
    {
      id: '1',
      type: 'Microsoft',
      email: 'user@company.com',
      status: 'connected',
      lastSync: '2分钟前',
    },
    {
      id: '2',
      type: 'Gmail',
      email: 'personal@gmail.com',
      status: 'connected',
      lastSync: '10分钟前',
    },
  ]);

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <Box>
      {/* 页面标题 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          ⚙️ 系统设置
        </Typography>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          color="primary"
        >
          保存设置
        </Button>
      </Box>

      {/* 设置标签页 */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
              <Tab label="🌐 通用" />
              <Tab label="📧 邮件" />
              <Tab label="🔔 通知" />
              <Tab label="🔒 隐私" />
              <Tab label="🤖 AI助手" />
              <Tab label="🔗 集成" />
            </Tabs>
          </Box>

          {/* 通用设置 */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                🌐 通用设置
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>语言</InputLabel>
                    <Select
                      value={settings.language}
                      label="语言"
                      onChange={(e) => handleSettingChange('language', e.target.value)}
                    >
                      <MenuItem value="zh-CN">简体中文</MenuItem>
                      <MenuItem value="en-US">English</MenuItem>
                      <MenuItem value="ja-JP">日本語</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>主题</InputLabel>
                    <Select
                      value={settings.theme}
                      label="主题"
                      onChange={(e) => handleSettingChange('theme', e.target.value)}
                    >
                      <MenuItem value="light">浅色主题</MenuItem>
                      <MenuItem value="dark">深色主题</MenuItem>
                      <MenuItem value="auto">跟随系统</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>时区</InputLabel>
                    <Select
                      value={settings.timezone}
                      label="时区"
                      onChange={(e) => handleSettingChange('timezone', e.target.value)}
                    >
                      <MenuItem value="Asia/Shanghai">Asia/Shanghai (GMT+8)</MenuItem>
                      <MenuItem value="America/New_York">America/New_York (GMT-5)</MenuItem>
                      <MenuItem value="Europe/London">Europe/London (GMT+0)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    💾 数据与存储
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="数据保留天数"
                    type="number"
                    value={settings.dataRetention}
                    onChange={(e) => handleSettingChange('dataRetention', parseInt(e.target.value))}
                    helperText="邮件数据在本地保存的天数"
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.shareAnalytics}
                        onChange={(e) => handleSettingChange('shareAnalytics', e.target.checked)}
                      />
                    }
                    label="分享匿名使用数据以帮助改进产品"
                  />
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          {/* 邮件设置 */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                📧 邮件同步设置
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.autoSync}
                        onChange={(e) => handleSettingChange('autoSync', e.target.checked)}
                      />
                    }
                    label="启用自动同步"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="同步间隔 (分钟)"
                    type="number"
                    value={settings.syncInterval}
                    onChange={(e) => handleSettingChange('syncInterval', parseInt(e.target.value))}
                    disabled={!settings.autoSync}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="每次同步最大邮件数"
                    type="number"
                    value={settings.maxEmailsPerSync}
                    onChange={(e) => handleSettingChange('maxEmailsPerSync', parseInt(e.target.value))}
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableSmartFiltering}
                        onChange={(e) => handleSettingChange('enableSmartFiltering', e.target.checked)}
                      />
                    }
                    label="启用智能过滤"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    📱 连接的邮箱账户
                  </Typography>

                  <List>
                    {connectedAccounts.map((account) => (
                      <ListItem key={account.id}>
                        <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                          <EmailIcon />
                        </Avatar>
                        <ListItemText
                          primary={account.email}
                          secondary={`${account.type} • 最后同步: ${account.lastSync}`}
                        />
                        <Chip
                          label={account.status === 'connected' ? '已连接' : '未连接'}
                          color={account.status === 'connected' ? 'success' : 'error'}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        <ListItemSecondaryAction>
                          <IconButton edge="end">
                            <EditIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>

                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    sx={{ mt: 2 }}
                    onClick={() => setOpenDialog(true)}
                  >
                    添加邮箱账户
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          {/* 通知设置 */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                🔔 通知设置
              </Typography>

              <List>
                <ListItem>
                  <ListItemText
                    primary="邮件通知"
                    secondary="收到新邮件时发送邮件通知"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.emailNotifications}
                      onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemText
                    primary="推送通知"
                    secondary="在移动设备上接收推送通知"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.pushNotifications}
                      onChange={(e) => handleSettingChange('pushNotifications', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemText
                    primary="桌面通知"
                    secondary="在桌面显示通知弹窗"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.desktopNotifications}
                      onChange={(e) => handleSettingChange('desktopNotifications', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemText
                    primary="声音提醒"
                    secondary="通知时播放提示音"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.soundEnabled}
                      onChange={(e) => handleSettingChange('soundEnabled', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </Box>
          </TabPanel>

          {/* 隐私设置 */}
          <TabPanel value={tabValue} index={3}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                🔒 隐私与安全
              </Typography>

              <List>
                <ListItem>
                  <ListItemText
                    primary="数据匿名化"
                    secondary="对个人数据进行匿名化处理"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.anonymizeData}
                      onChange={(e) => handleSettingChange('anonymizeData', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" gutterBottom>
                🛡️ 安全选项
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<SecurityIcon />}
                  >
                    更改密码
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<ApiIcon />}
                  >
                    API密钥管理
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          {/* AI助手设置 */}
          <TabPanel value={tabValue} index={4}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                🤖 AI助手设置
              </Typography>

              <List>
                <ListItem>
                  <ListItemText
                    primary="启用AI分析"
                    secondary="使用AI对邮件进行智能分析"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.enableAIAnalysis}
                      onChange={(e) => handleSettingChange('enableAIAnalysis', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemText
                    primary="情感分析"
                    secondary="分析邮件的情感倾向"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.sentimentAnalysis}
                      onChange={(e) => handleSettingChange('sentimentAnalysis', e.target.checked)}
                      disabled={!settings.enableAIAnalysis}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemText
                    primary="自动分类"
                    secondary="自动识别和分类邮件"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.autoCategories}
                      onChange={(e) => handleSettingChange('autoCategories', e.target.checked)}
                      disabled={!settings.enableAIAnalysis}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemText
                    primary="智能建议"
                    secondary="提供智能回复建议"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.smartSuggestions}
                      onChange={(e) => handleSettingChange('smartSuggestions', e.target.checked)}
                      disabled={!settings.enableAIAnalysis}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </Box>
          </TabPanel>

          {/* 集成设置 */}
          <TabPanel value={tabValue} index={5}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                🔗 第三方集成
              </Typography>

              <Grid container spacing={3}>
                {[
                  { name: 'Slack', icon: '💬', status: '已连接', description: '将通知发送到Slack频道' },
                  { name: 'Microsoft Teams', icon: '👥', status: '已连接', description: '与Teams集成进行协作' },
                  { name: 'Trello', icon: '📋', status: '未连接', description: '自动创建Trello卡片' },
                  { name: 'Jira', icon: '🎯', status: '未连接', description: '同步问题和任务到Jira' },
                ].map((integration, index) => (
                  <Grid item xs={12} key={index}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="h4">{integration.icon}</Typography>
                            <Box>
                              <Typography variant="h6">{integration.name}</Typography>
                              <Typography variant="body2" color="textSecondary">
                                {integration.description}
                              </Typography>
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={integration.status}
                              color={integration.status === '已连接' ? 'success' : 'default'}
                              size="small"
                            />
                            <Button
                              variant={integration.status === '已连接' ? 'outlined' : 'contained'}
                              size="small"
                            >
                              {integration.status === '已连接' ? '配置' : '连接'}
                            </Button>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </TabPanel>
        </CardContent>
      </Card>

      {/* 添加邮箱账户对话框 */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>添加邮箱账户</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>邮箱类型</InputLabel>
                  <Select defaultValue="">
                    <MenuItem value="microsoft">Microsoft Exchange</MenuItem>
                    <MenuItem value="gmail">Gmail</MenuItem>
                    <MenuItem value="outlook">Outlook.com</MenuItem>
                    <MenuItem value="imap">IMAP/POP3</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="邮箱地址"
                  type="email"
                  placeholder="your.email@example.com"
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>取消</Button>
          <Button variant="contained">连接</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SettingsPage;