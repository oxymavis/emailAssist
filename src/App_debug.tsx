import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, Typography, Button } from '@mui/material';
import { useAppStore } from './store';

// 简单的测试组件
const TestComponent: React.FC = () => {
  const theme = useAppStore((state) => state.theme);
  
  return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <Typography variant="h3" gutterBottom>
        🚀 Email Assist 测试页面
      </Typography>
      <Typography variant="h6" gutterBottom>
        当前主题: {theme}
      </Typography>
      <Button variant="contained" color="primary">
        测试按钮
      </Button>
    </Box>
  );
};

const App: React.FC = () => {
  const theme = useAppStore((state) => state.theme);
  const muiTheme = {
    palette: {
      mode: theme === 'dark' ? 'dark' : 'light',
      primary: { main: '#1976d2' },
      secondary: { main: '#dc004e' },
    },
  };

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/*" element={<TestComponent />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
};

export default App;