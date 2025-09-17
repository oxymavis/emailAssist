/**
 * Smart Batch Suggestions Component
 * AI驱动的智能批量操作建议组件
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Avatar,
  Divider,
  Alert,
  Collapse,
  LinearProgress,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  Psychology,
  TrendingUp,
  Schedule,
  AutoAwesome,
  Archive,
  Delete,
  Star,
  Label,
  Category,
  Forward,
  ExpandMore,
  ExpandLess,
  Check,
  Close,
  Info,
  Warning,
  Error,
  Success,
  Lightbulb,
  Analytics,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface EmailData {
  id: string;
  subject: string;
  sender: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  importance: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  isRead: boolean;
  receivedAt: Date;
}

interface SmartSuggestion {
  id: string;
  type: 'efficiency' | 'organization' | 'priority' | 'automation';
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  actionType: string;
  actionParams: any;
  affectedCount: number;
  reasoning: string[];
  icon: React.ReactNode;
}

interface SmartBatchSuggestionsProps {
  selectedEmails: EmailData[];
  allEmails: EmailData[];
  onApplySuggestion: (suggestion: SmartSuggestion) => void;
  onDismissSuggestion: (suggestionId: string) => void;
}

const SmartBatchSuggestions: React.FC<SmartBatchSuggestionsProps> = ({
  selectedEmails,
  allEmails,
  onApplySuggestion,
  onDismissSuggestion,
}) => {
  const { t } = useTranslation();

  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // 生成智能建议
  const generateSuggestions = async (emails: EmailData[]) => {
    setAnalyzing(true);

    try {
      // 模拟AI分析延迟
      await new Promise(resolve => setTimeout(resolve, 1500));

      const newSuggestions: SmartSuggestion[] = [];

      // 1. 效率建议 - 批量处理相同发件人
      const senderGroups = emails.reduce((groups, email) => {
        groups[email.sender] = (groups[email.sender] || 0) + 1;
        return groups;
      }, {} as Record<string, number>);

      const dominantSender = Object.entries(senderGroups)
        .filter(([_, count]) => count >= 3)
        .sort(([, a], [, b]) => b - a)[0];

      if (dominantSender) {
        newSuggestions.push({
          id: 'batch-sender-' + Date.now(),
          type: 'efficiency',
          title: t('emails.suggestions.batchProcessSender'),
          description: t('emails.suggestions.senderDescription', {
            sender: dominantSender[0],
            count: dominantSender[1]
          }),
          confidence: 85,
          impact: 'high',
          actionType: 'batch-process-sender',
          actionParams: { sender: dominantSender[0] },
          affectedCount: dominantSender[1],
          reasoning: [
            t('emails.suggestions.reasonMultipleFromSender'),
            t('emails.suggestions.reasonEfficiencyGain'),
            t('emails.suggestions.reasonPatternRecognition'),
          ],
          icon: <Person />,
        });
      }

      // 2. 组织建议 - 按重要性分类
      const highImportanceCount = emails.filter(e => e.importance === 'high' || e.importance === 'critical').length;
      if (highImportanceCount >= 2) {
        newSuggestions.push({
          id: 'prioritize-important-' + Date.now(),
          type: 'priority',
          title: t('emails.suggestions.prioritizeImportant'),
          description: t('emails.suggestions.importantDescription', { count: highImportanceCount }),
          confidence: 92,
          impact: 'high',
          actionType: 'prioritize-important',
          actionParams: { importance: ['high', 'critical'] },
          affectedCount: highImportanceCount,
          reasoning: [
            t('emails.suggestions.reasonUrgentMatter'),
            t('emails.suggestions.reasonTimeManagement'),
          ],
          icon: <Priority />,
        });
      }

      // 3. 自动化建议 - 标记已读的老邮件
      const oldUnreadEmails = emails.filter(email => {
        const daysDiff = (new Date().getTime() - email.receivedAt.getTime()) / (1000 * 3600 * 24);
        return !email.isRead && daysDiff > 7;
      });

      if (oldUnreadEmails.length >= 5) {
        newSuggestions.push({
          id: 'archive-old-' + Date.now(),
          type: 'automation',
          title: t('emails.suggestions.archiveOldEmails'),
          description: t('emails.suggestions.oldEmailsDescription', { count: oldUnreadEmails.length }),
          confidence: 78,
          impact: 'medium',
          actionType: 'archive-old',
          actionParams: { daysCutoff: 7 },
          affectedCount: oldUnreadEmails.length,
          reasoning: [
            t('emails.suggestions.reasonLowEngagement'),
            t('emails.suggestions.reasonClutterReduction'),
          ],
          icon: <Archive />,
        });
      }

      // 4. 情感分析建议 - 处理负面情感邮件
      const negativeEmails = emails.filter(e => e.sentiment === 'negative');
      if (negativeEmails.length >= 2) {
        newSuggestions.push({
          id: 'handle-negative-' + Date.now(),
          type: 'organization',
          title: t('emails.suggestions.handleNegativeEmails'),
          description: t('emails.suggestions.negativeDescription', { count: negativeEmails.length }),
          confidence: 88,
          impact: 'high',
          actionType: 'flag-negative',
          actionParams: { sentiment: 'negative' },
          affectedCount: negativeEmails.length,
          reasoning: [
            t('emails.suggestions.reasonCustomerService'),
            t('emails.suggestions.reasonIssueTracking'),
          ],
          icon: <Warning />,
        });
      }

      // 5. 分类建议 - 相同类别批量处理
      const categoryGroups = emails.reduce((groups, email) => {
        groups[email.category] = (groups[email.category] || 0) + 1;
        return groups;
      }, {} as Record<string, number>);

      const dominantCategory = Object.entries(categoryGroups)
        .filter(([_, count]) => count >= 4)
        .sort(([, a], [, b]) => b - a)[0];

      if (dominantCategory) {
        newSuggestions.push({
          id: 'batch-category-' + Date.now(),
          type: 'organization',
          title: t('emails.suggestions.batchProcessCategory'),
          description: t('emails.suggestions.categoryDescription', {
            category: dominantCategory[0],
            count: dominantCategory[1]
          }),
          confidence: 80,
          impact: 'medium',
          actionType: 'batch-process-category',
          actionParams: { category: dominantCategory[0] },
          affectedCount: dominantCategory[1],
          reasoning: [
            t('emails.suggestions.reasonSimilarContent'),
            t('emails.suggestions.reasonWorkflowOptimization'),
          ],
          icon: <Category />,
        });
      }

      setSuggestions(newSuggestions);
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    if (selectedEmails.length > 0) {
      generateSuggestions(selectedEmails);
    } else {
      setSuggestions([]);
    }
  }, [selectedEmails]);

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'efficiency': return <TrendingUp />;
      case 'organization': return <Category />;
      case 'priority': return <Priority />;
      case 'automation': return <AutoAwesome />;
      default: return <Lightbulb />;
    }
  };

  const getSuggestionColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'success';
    if (confidence >= 75) return 'warning';
    return 'info';
  };

  if (selectedEmails.length === 0) {
    return null;
  }

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Psychology color="primary" />
          <Typography variant="h6">
            {t('emails.suggestions.title')}
          </Typography>
          <Chip
            label={`${selectedEmails.length} ${t('emails.suggestions.emailsSelected')}`}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Box>

        {analyzing && (
          <Box mb={2}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {t('emails.suggestions.analyzing')}
            </Typography>
            <LinearProgress />
          </Box>
        )}

        {suggestions.length === 0 && !analyzing && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('emails.suggestions.noSuggestions')}
          </Alert>
        )}

        {suggestions.length > 0 && (
          <List>
            {suggestions.map((suggestion, index) => (
              <React.Fragment key={suggestion.id}>
                <ListItem
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                  }}
                >
                  <ListItemIcon>
                    <Avatar
                      sx={{
                        bgcolor: `${getSuggestionColor(suggestion.impact)}.light`,
                        color: `${getSuggestionColor(suggestion.impact)}.dark`,
                      }}
                    >
                      {getSuggestionIcon(suggestion.type)}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="subtitle1">
                          {suggestion.title}
                        </Typography>
                        <Chip
                          label={`${suggestion.confidence}%`}
                          size="small"
                          color={getConfidenceColor(suggestion.confidence) as any}
                          variant="outlined"
                        />
                        <Chip
                          label={`${suggestion.affectedCount} ${t('emails.suggestions.emails')}`}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {suggestion.description}
                        </Typography>
                        <Collapse in={expandedSuggestion === suggestion.id}>
                          <Box mt={1}>
                            <Typography variant="body2" fontWeight="bold" gutterBottom>
                              {t('emails.suggestions.reasoning')}:
                            </Typography>
                            <List dense>
                              {suggestion.reasoning.map((reason, idx) => (
                                <ListItem key={idx} sx={{ py: 0 }}>
                                  <ListItemIcon sx={{ minWidth: 24 }}>
                                    <Analytics fontSize="small" />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={
                                      <Typography variant="caption">
                                        {reason}
                                      </Typography>
                                    }
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </Box>
                        </Collapse>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Stack direction="row" spacing={1}>
                      <Tooltip title={t('emails.suggestions.showReasoning')}>
                        <IconButton
                          size="small"
                          onClick={() => setExpandedSuggestion(
                            expandedSuggestion === suggestion.id ? null : suggestion.id
                          )}
                        >
                          {expandedSuggestion === suggestion.id ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('emails.suggestions.applySuggestion')}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => onApplySuggestion(suggestion)}
                        >
                          <Check />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('emails.suggestions.dismissSuggestion')}>
                        <IconButton
                          size="small"
                          color="secondary"
                          onClick={() => onDismissSuggestion(suggestion.id)}
                        >
                          <Close />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < suggestions.length - 1 && <Divider sx={{ my: 1 }} />}
              </React.Fragment>
            ))}
          </List>
        )}

        {suggestions.length > 0 && (
          <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              {t('emails.suggestions.poweredByAI')}
            </Typography>
            <Button
              size="small"
              startIcon={<Psychology />}
              onClick={() => generateSuggestions(selectedEmails)}
              disabled={analyzing}
            >
              {t('emails.suggestions.refreshSuggestions')}
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default SmartBatchSuggestions;