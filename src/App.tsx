import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import 'react-toastify/dist/ReactToastify.css';

// 导入i18n配置
import './i18n';

import Layout from './components/common/Layout';
import Dashboard from './pages/Dashboard';
import Analysis from './pages/Analysis';
import Filters from './pages/Filters';
import Reports from './pages/Reports';
import Workflows from './pages/Workflows';
import Settings from './pages/Settings';

import { useAppStore } from './store';
import { getTheme } from './themes';

// 404页面组件
const NotFound: React.FC = () => {
  const { t } = useTranslation();
  
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
      <p>{t('app.notFound')}</p>
    </div>
  );
};

const App: React.FC = () => {
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
            <Route path="/filters" element={<Filters />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/workflows" element={<Workflows />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
        
        {/* Toast通知容器 */}
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme={theme === 'dark' ? 'dark' : 'light'}
        />
      </Router>
    </ThemeProvider>
  );
};

export default App;