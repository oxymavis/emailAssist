import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Paper,
  Button,
  CircularProgress,
  Alert
} from '@mui/material';

interface SimpleEmail {
  id: string;
  subject: string;
  from: {
    name: string;
    address: string;
  };
  preview: string;
  receivedAt: string;
  isRead: boolean;
}

const SimpleEmails: React.FC = () => {
  const [emails, setEmails] = useState<SimpleEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('http://localhost:3001/api/emails-simple?limit=10');

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }

      const data = await response.json();
      console.log('API响应:', data);

      if (data.success && data.emails) {
        setEmails(data.emails);
      } else {
        throw new Error('API响应格式错误');
      }
    } catch (err) {
      console.error('获取邮件失败:', err);
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="200px">
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>正在加载邮件...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={fetchEmails}>
          重试
        </Button>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        简化邮件列表
      </Typography>

      <Button variant="outlined" onClick={fetchEmails} sx={{ mb: 2 }}>
        刷新邮件
      </Button>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        共 {emails.length} 封邮件
      </Typography>

      <Paper>
        <List>
          {emails.map((email, index) => (
            <ListItem
              key={email.id}
              divider={index < emails.length - 1}
              sx={{
                bgcolor: email.isRead ? 'transparent' : 'action.hover',
                '&:hover': { bgcolor: 'action.selected' }
              }}
            >
              <ListItemText
                primary={
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: email.isRead ? 'normal' : 'bold',
                      color: email.isRead ? 'text.secondary' : 'text.primary'
                    }}
                  >
                    {email.subject}
                  </Typography>
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
                      {new Date(email.receivedAt).toLocaleString()}
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </Paper>

      {emails.length === 0 && (
        <Typography variant="body1" color="text.secondary" textAlign="center" py={4}>
          暂无邮件
        </Typography>
      )}
    </Box>
  );
};

export default SimpleEmails;