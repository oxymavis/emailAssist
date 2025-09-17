/**
 * Email Details Page Component
 * Displays detailed view of a single email with AI analysis
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Avatar,
  Divider,
  Button,
  IconButton,
  Grid,
  Card,
  CardContent,
  Alert,
  Skeleton,
  Stack,
  Tooltip,
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  ArrowBack,
  Reply,
  Forward,
  Delete,
  Archive,
  Star,
  StarBorder,
  Flag,
  Schedule,
  Person,
  Email as EmailIcon,
  Psychology,
  Priority,
  Category,
  ExpandMore,
  ContentCopy,
  Download,
  Share,
  MoreVert,
} from '@mui/icons-material';
import { useAppStore } from '@/store';
import { toast } from 'react-toastify';

interface EmailDetailsProps {
  emailId?: string;
}

const EmailDetails: React.FC<EmailDetailsProps> = ({ emailId: propEmailId }) => {
  const { id: paramId } = useParams<{ id: string }>();
  const emailId = propEmailId || paramId;
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [isStarred, setIsStarred] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['content']);

  useEffect(() => {
    if (emailId) {
      fetchEmailDetails();
    }
  }, [emailId]);

  const fetchEmailDetails = async () => {
    try {
      setIsLoading(true);

      // 模拟API调用获取邮件详情
      const mockEmail = {
        id: emailId,
        subject: '系统故障紧急处理 - 生产环境数据库连接异常',
        from: {
          name: 'John Smith',
          email: 'john.smith@company.com',
          avatar: '/avatars/john-smith.jpg'
        },
        to: [
          { name: 'Support Team', email: 'support@ourcompany.com' }
        ],
        cc: [
          { name: 'Manager', email: 'manager@ourcompany.com' }
        ],
        receivedAt: '2024-01-15T10:30:00Z',
        sentAt: '2024-01-15T10:28:00Z',
        content: {
          html: `
            <div>
              <p>亲爱的技术支持团队，</p>
              <p>我们的生产环境出现了严重的数据库连接问题，影响了多个核心服务。</p>

              <h3>问题描述：</h3>
              <ul>
                <li>数据库连接池耗尽</li>
                <li>API响应时间超过30秒</li>
                <li>用户无法正常登录</li>
              </ul>

              <h3>错误信息：</h3>
              <pre>
Connection timeout: Unable to connect to database after 30000ms
Error code: ER_CON_COUNT_ERROR
Timestamp: 2024-01-15 10:25:33
              </pre>

              <p><strong>请立即处理此问题！</strong>这已经影响了我们的客户服务。</p>

              <p>谢谢，<br/>John Smith</p>
            </div>
          `,
          text: '亲爱的技术支持团队，我们的生产环境出现了严重的数据库连接问题...'
        },
        hasAttachments: true,
        attachments: [
          { name: 'error-logs.txt', size: '45KB', type: 'text/plain' },
          { name: 'system-report.pdf', size: '2.1MB', type: 'application/pdf' }
        ],
        importance: 'high',
        isRead: false,
        isSpam: false,
        labels: ['urgent', 'production', 'database'],
        messageId: 'msg-12345'
      };

      // 模拟AI分析结果
      const mockAnalysis = {
        sentiment: {
          overall: 'negative',
          score: -0.7,
          confidence: 0.92,
          emotions: [
            { emotion: 'anxiety', intensity: 0.8 },
            { emotion: 'urgency', intensity: 0.9 },
            { emotion: 'frustration', intensity: 0.6 }
          ]
        },
        priority: {
          level: 'critical',
          score: 0.95,
          factors: [
            'Contains urgent keywords',
            'Production system mentioned',
            'Error codes provided',
            'Business impact mentioned'
          ]
        },
        category: {
          primary: 'technical-support',
          secondary: 'database-issue',
          confidence: 0.89,
          tags: ['production', 'database', 'urgent', 'system-failure']
        },
        keyPoints: [
          '生产环境数据库连接问题',
          'API响应时间超过30秒',
          '用户无法正常登录',
          '需要立即处理'
        ],
        suggestedActions: [
          {
            action: 'escalate',
            description: '立即升级给高级工程师',
            priority: 1
          },
          {
            action: 'investigate',
            description: '检查数据库连接池配置',
            priority: 2
          },
          {
            action: 'notify',
            description: '通知相关团队和管理层',
            priority: 3
          }
        ],
        responseTime: {
          suggested: '5分钟内',
          sla: '15分钟',
          reasoning: '生产环境关键问题需要立即响应'
        }
      };

      // 模拟异步加载
      setTimeout(() => {
        setEmail(mockEmail);
        setAnalysis(mockAnalysis);
        setIsStarred(false);
        setIsLoading(false);
      }, 1000);

    } catch (error) {
      console.error('获取邮件详情失败:', error);
      toast.error('获取邮件详情失败');
      setIsLoading(false);
    }
  };

  const handleAction = (action: string) => {
    switch (action) {
      case 'reply':
        toast.info('回复功能开发中');
        break;
      case 'forward':
        toast.info('转发功能开发中');
        break;
      case 'delete':
        toast.info('删除功能开发中');
        break;
      case 'archive':
        toast.info('归档功能开发中');
        break;
      case 'star':
        setIsStarred(!isStarred);
        toast.success(isStarred ? '已取消收藏' : '已收藏');
        break;
      case 'copy':
        navigator.clipboard.writeText(email?.content?.text || '');
        toast.success('已复制到剪贴板');
        break;
      default:
        console.log('Action:', action);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'success';
      case 'negative':
        return 'error';
      case 'neutral':
        return 'info';
      default:
        return 'default';
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  if (isLoading) {
    return (
      <Box p={3}>
        <Skeleton variant="rectangular" height={60} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={300} />
      </Box>
    );
  }

  if (!email) {
    return (
      <Box p={3}>
        <Alert severity="error">
          邮件不存在或已被删除
        </Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* 顶部操作栏 */}
      <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <IconButton onClick={() => navigate(-1)}>
            <ArrowBack />
          </IconButton>

          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            邮件详情
          </Typography>

          <Stack direction="row" spacing={1}>
            <Tooltip title="回复">
              <IconButton onClick={() => handleAction('reply')}>
                <Reply />
              </IconButton>
            </Tooltip>
            <Tooltip title="转发">
              <IconButton onClick={() => handleAction('forward')}>
                <Forward />
              </IconButton>
            </Tooltip>
            <Tooltip title={isStarred ? '取消收藏' : '收藏'}>
              <IconButton onClick={() => handleAction('star')}>
                {isStarred ? <Star color="warning" /> : <StarBorder />}
              </IconButton>
            </Tooltip>
            <Tooltip title="复制内容">
              <IconButton onClick={() => handleAction('copy')}>
                <ContentCopy />
              </IconButton>
            </Tooltip>
            <Tooltip title="归档">
              <IconButton onClick={() => handleAction('archive')}>
                <Archive />
              </IconButton>
            </Tooltip>
            <Tooltip title="删除">
              <IconButton onClick={() => handleAction('delete')}>
                <Delete />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={3}>
        {/* 左侧 - 邮件内容 */}
        <Grid item xs={12} lg={8}>
          <Paper elevation={2} sx={{ p: 3 }}>
            {/* 邮件头部 */}
            <Box mb={3}>
              <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                <Avatar
                  src={email.from.avatar}
                  sx={{ width: 48, height: 48 }}
                >
                  {email.from.name.charAt(0)}
                </Avatar>
                <Box flex={1}>
                  <Typography variant="h6" gutterBottom>
                    {email.from.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {email.from.email}
                  </Typography>
                </Box>
                <Stack alignItems="flex-end" spacing={1}>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(email.receivedAt).toLocaleString('zh-CN')}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip
                      size="small"
                      label={email.importance}
                      color={getPriorityColor(email.importance)}
                      icon={<Priority />}
                    />
                    {email.hasAttachments && (
                      <Chip size="small" label="附件" variant="outlined" />
                    )}
                  </Stack>
                </Stack>
              </Stack>

              <Typography variant="h5" gutterBottom>
                {email.subject}
              </Typography>

              {/* 收件人信息 */}
              <Box mt={2}>
                <Stack spacing={1}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" color="text.secondary" minWidth={60}>
                      收件人:
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {email.to.map((recipient: any, index: number) => (
                        <Chip
                          key={index}
                          size="small"
                          label={recipient.email}
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </Box>
                  {email.cc && email.cc.length > 0 && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2" color="text.secondary" minWidth={60}>
                        抄送:
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {email.cc.map((recipient: any, index: number) => (
                          <Chip
                            key={index}
                            size="small"
                            label={recipient.email}
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </Box>
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* 邮件内容 */}
            <Accordion
              expanded={expandedSections.includes('content')}
              onChange={() => toggleSection('content')}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="h6">邮件内容</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box
                  sx={{
                    '& *': {
                      fontSize: '14px !important',
                      lineHeight: '1.6 !important',
                    },
                    '& pre': {
                      backgroundColor: 'grey.100',
                      p: 2,
                      borderRadius: 1,
                      overflow: 'auto',
                      fontSize: '12px !important',
                    },
                  }}
                  dangerouslySetInnerHTML={{ __html: email.content.html }}
                />
              </AccordionDetails>
            </Accordion>

            {/* 附件 */}
            {email.hasAttachments && (
              <Accordion
                expanded={expandedSections.includes('attachments')}
                onChange={() => toggleSection('attachments')}
                sx={{ mt: 2 }}
              >
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6">
                    附件 ({email.attachments.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={1}>
                    {email.attachments.map((attachment: any, index: number) => (
                      <Card key={index} variant="outlined">
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Stack direction="row" alignItems="center" spacing={2}>
                            <Download />
                            <Box flex={1}>
                              <Typography variant="body2" fontWeight="medium">
                                {attachment.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {attachment.size} • {attachment.type}
                              </Typography>
                            </Box>
                            <Button size="small" variant="outlined">
                              下载
                            </Button>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            )}
          </Paper>
        </Grid>

        {/* 右侧 - AI分析 */}
        <Grid item xs={12} lg={4}>
          <Stack spacing={3}>
            {/* 优先级分析 */}
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                  <Priority color="primary" />
                  <Typography variant="h6">优先级分析</Typography>
                </Stack>
                <Box mb={2}>
                  <Chip
                    label={analysis.priority.level.toUpperCase()}
                    color={getPriorityColor(analysis.priority.level)}
                    size="medium"
                    sx={{ fontWeight: 'bold' }}
                  />
                  <Typography variant="body2" color="text.secondary" mt={1}>
                    置信度: {Math.round(analysis.priority.score * 100)}%
                  </Typography>
                </Box>
                <Typography variant="body2" gutterBottom>
                  优先级因素:
                </Typography>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {analysis.priority.factors.map((factor: string, index: number) => (
                    <li key={index}>
                      <Typography variant="body2" color="text.secondary">
                        {factor}
                      </Typography>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* 情感分析 */}
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                  <Psychology color="primary" />
                  <Typography variant="h6">情感分析</Typography>
                </Stack>
                <Box mb={2}>
                  <Chip
                    label={analysis.sentiment.overall}
                    color={getSentimentColor(analysis.sentiment.overall)}
                    size="medium"
                  />
                  <Typography variant="body2" color="text.secondary" mt={1}>
                    情感值: {analysis.sentiment.score.toFixed(2)}
                    (置信度: {Math.round(analysis.sentiment.confidence * 100)}%)
                  </Typography>
                </Box>
                <Typography variant="body2" gutterBottom>
                  情感分解:
                </Typography>
                <Stack spacing={1}>
                  {analysis.sentiment.emotions.map((emotion: any, index: number) => (
                    <Box key={index} display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        {emotion.emotion}
                      </Typography>
                      <Typography variant="body2">
                        {Math.round(emotion.intensity * 100)}%
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            {/* 分类分析 */}
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                  <Category color="primary" />
                  <Typography variant="h6">分类分析</Typography>
                </Stack>
                <Box mb={2}>
                  <Chip label={analysis.category.primary} color="info" size="medium" />
                  <Typography variant="body2" color="text.secondary" mt={1}>
                    子分类: {analysis.category.secondary}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    置信度: {Math.round(analysis.category.confidence * 100)}%
                  </Typography>
                </Box>
                <Typography variant="body2" gutterBottom>
                  标签:
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {analysis.category.tags.map((tag: string, index: number) => (
                    <Chip key={index} label={tag} size="small" variant="outlined" />
                  ))}
                </Stack>
              </CardContent>
            </Card>

            {/* 建议操作 */}
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                  <Schedule color="primary" />
                  <Typography variant="h6">建议操作</Typography>
                </Stack>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  建议在 {analysis.responseTime.suggested} 内响应
                </Alert>
                <Stack spacing={1}>
                  {analysis.suggestedActions.map((action: any, index: number) => (
                    <Card key={index} variant="outlined">
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <Badge
                            badgeContent={action.priority}
                            color="primary"
                            sx={{ '& .MuiBadge-badge': { fontSize: '10px' } }}
                          >
                            <Flag />
                          </Badge>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {action.action}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {action.description}
                            </Typography>
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            {/* 关键要点 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  关键要点
                </Typography>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {analysis.keyPoints.map((point: string, index: number) => (
                    <li key={index}>
                      <Typography variant="body2" color="text.secondary">
                        {point}
                      </Typography>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EmailDetails;