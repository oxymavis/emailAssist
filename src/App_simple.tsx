import React from 'react';
import { ThemeProvider, CssBaseline, Box, Typography, createTheme } from '@mui/material';

const SimpleApp: React.FC = () => {
  // 使用默认主题，避免store相关问题
  const muiTheme = createTheme();

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: 3,
          textAlign: 'center'
        }}
      >
        <Typography variant="h3" component="h1" gutterBottom>
          Email Assist
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          智能邮件管理系统
        </Typography>
        <Typography variant="body1" sx={{ mt: 2 }}>
          应用已成功启动！🎉
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          前端运行在: localhost:3000
        </Typography>
        <Typography variant="body2" color="text.secondary">
          后端运行在: localhost:3001
        </Typography>
      </Box>
    </ThemeProvider>
  );
};

export default SimpleApp;