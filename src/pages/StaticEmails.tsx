import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Paper,
  Chip
} from '@mui/material';

// 完全静态的邮件数据，不需要任何API调用
const staticEmails = [
  {
    id: '1',
    subject: '项目会议安排 - 下周一讨论新功能',
    from: {
      name: '张经理',
      address: 'zhang.manager@company.com'
    },
    preview: '大家好，我们需要在下周一安排一个会议来讨论新功能的开发计划...',
    receivedAt: '2024-09-17T09:30:00Z',
    isRead: false,
    priority: 'high'
  },
  {
    id: '2',
    subject: '系统维护通知',
    from: {
      name: 'IT部门',
      address: 'it@company.com'
    },
    preview: '系统将在本周末进行例行维护，预计停机时间2小时...',
    receivedAt: '2024-09-17T08:15:00Z',
    isRead: true,
    priority: 'medium'
  },
  {
    id: '3',
    subject: '客户反馈汇总',
    from: {
      name: '客服小王',
      address: 'wang.service@company.com'
    },
    preview: '本月收到的客户反馈已整理完成，总体满意度较高...',
    receivedAt: '2024-09-16T16:45:00Z',
    isRead: false,
    priority: 'low'
  },
  {
    id: '4',
    subject: '销售数据报告',
    from: {
      name: '销售部',
      address: 'sales@company.com'
    },
    preview: '第三季度销售数据统计完成，同比增长15%...',
    receivedAt: '2024-09-16T14:20:00Z',
    isRead: true,
    priority: 'high'
  },
  {
    id: '5',
    subject: '员工培训通知',
    from: {
      name: 'HR部门',
      address: 'hr@company.com'
    },
    preview: '下个月将组织技能培训，请大家积极报名参加...',
    receivedAt: '2024-09-16T11:30:00Z',
    isRead: false,
    priority: 'medium'
  }
];

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high': return 'error';
    case 'medium': return 'warning';
    case 'low': return 'success';
    default: return 'default';
  }
};

const StaticEmails: React.FC = () => {
  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        静态邮件展示 (无需API)
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        共 {staticEmails.length} 封邮件 (完全静态数据)
      </Typography>

      <Paper>
        <List>
          {staticEmails.map((email, index) => (
            <ListItem
              key={email.id}
              divider={index < staticEmails.length - 1}
              sx={{
                bgcolor: email.isRead ? 'transparent' : 'action.hover',
                '&:hover': { bgcolor: 'action.selected' }
              }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: email.isRead ? 'normal' : 'bold',
                        color: email.isRead ? 'text.secondary' : 'text.primary',
                        flex: 1
                      }}
                    >
                      {email.subject}
                    </Typography>
                    <Chip
                      label={email.priority}
                      size="small"
                      color={getPriorityColor(email.priority) as any}
                      variant="outlined"
                    />
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography variant="body2" color="primary">
                      {email.from.name} &lt;{email.from.address}&gt;
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {email.preview}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(email.receivedAt).toLocaleString('zh-CN')}
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </Paper>

      <Box mt={2}>
        <Typography variant="caption" color="success.main">
          ✅ 此页面完全静态，无API调用，无状态管理，不会出现白屏或无限循环问题
        </Typography>
      </Box>
    </Box>
  );
};

export default StaticEmails;