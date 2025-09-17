import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// 导入i18n配置
import './i18n';

import Layout from './components/common/Layout';
import Dashboard from './pages/Dashboard';
import Analysis from './pages/Analysis';

import { useAppStore } from './store';
import { getTheme } from './themes';

// 简化的404页面组件
const NotFound: React.FC = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '400px',
      textAlign: 'center'
    }}>
      <h1>404</h1>
      <p>页面未找到</p>
    </div>
  );
};

const OriginalApp: React.FC = () => {
  const theme = useAppStore((state) => state.theme);
  const muiTheme = getTheme(theme === 'auto' ? 'light' : theme);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </Router>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </ThemeProvider>
  );
};

export default OriginalApp;