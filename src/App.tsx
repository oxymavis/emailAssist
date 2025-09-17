import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import 'react-toastify/dist/ReactToastify.css';

// 导入i18n配置
import './i18n';

import Layout from './components/common/Layout';
import SimpleDashboard from './pages/SimpleDashboard';
import Analysis from './pages/Analysis';
import Filters from './pages/Filters';
import Reports from './pages/Reports';
import Workflows from './pages/Workflows';
import Settings from './pages/Settings';
import WorkflowManagement from './pages/WorkflowManagement';
import Login from './pages/Login';
import EmailDetails from './pages/EmailDetails';
import EmailBatchOperations from './pages/EmailBatchOperations';
import AdminPanel from './pages/AdminPanel';
import NotificationSettings from './pages/NotificationSettings';
import WorkflowOutputSystem from './pages/WorkflowOutputSystem';
import TeamCenter from './pages/TeamCenter';
import AdvancedAIAnalysis from './pages/AdvancedAIAnalysis';
import AdvancedDataVisualization from './pages/AdvancedDataVisualization';
import UserExperienceCenter from './pages/UserExperienceCenter';
import SearchAndHelp from './pages/SearchAndHelp';
import IntegrationsPage from './pages/IntegrationsPage';
import TeamCollaborationPage from './pages/TeamCollaborationPage';
import SimpleEmails from './pages/SimpleEmails';
import StaticEmails from './pages/StaticEmails';
import ProtectedRoute from './components/auth/ProtectedRoute';

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
        <Routes>
          {/* 登录页面 - 不需要Layout */}
          <Route path="/login" element={<Login />} />

          {/* 受保护的路由 - 需要认证后才能访问 */}
          <Route path="/*" element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<SimpleDashboard />} />
                  <Route path="/analysis" element={<Analysis />} />
                  <Route path="/filters" element={<Filters />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/workflows" element={<Workflows />} />
                  <Route path="/workflow-management" element={<WorkflowManagement />} />
                  <Route path="/email/:id" element={<EmailDetails />} />
                  <Route path="/emails" element={<EmailBatchOperations />} />
                  <Route path="/admin" element={<AdminPanel />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/notifications" element={<NotificationSettings />} />
                  <Route path="/workflow-output" element={<WorkflowOutputSystem />} />
                  <Route path="/team" element={<TeamCenter />} />
                  <Route path="/advanced-ai" element={<AdvancedAIAnalysis />} />
                  <Route path="/data-visualization" element={<AdvancedDataVisualization />} />
                  <Route path="/ux-center" element={<UserExperienceCenter />} />
                  <Route path="/search-help" element={<SearchAndHelp />} />
                  <Route path="/integrations" element={<IntegrationsPage />} />
                  <Route path="/team-collaboration" element={<TeamCollaborationPage />} />
                  <Route path="/simple-emails" element={<SimpleEmails />} />
                  <Route path="/static-emails" element={<StaticEmails />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          } />
        </Routes>

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