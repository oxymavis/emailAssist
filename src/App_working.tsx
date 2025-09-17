import React, { useState } from 'react';
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material';

const WorkingApp: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const theme = createTheme({
    palette: {
      mode: 'light',
    },
  });

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <div style={{ padding: '30px' }}>
            <h1 style={{ color: '#1976d2', marginBottom: '20px' }}>📊 仪表板</h1>
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <h3>欢迎来到Email Assist</h3>
              <p>智能邮件管理系统已准备就绪</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
              <div style={{ backgroundColor: '#e3f2fd', padding: '20px', borderRadius: '8px' }}>
                <h4>📧 邮件统计</h4>
                <p>总邮件数: 1,234</p>
                <p>未读邮件: 23</p>
              </div>
              <div style={{ backgroundColor: '#e8f5e8', padding: '20px', borderRadius: '8px' }}>
                <h4>🤖 AI分析</h4>
                <p>已分析: 1,200</p>
                <p>待处理: 34</p>
              </div>
              <div style={{ backgroundColor: '#fff3e0', padding: '20px', borderRadius: '8px' }}>
                <h4>⚡ 工作流</h4>
                <p>活跃规则: 15</p>
                <p>自动处理: 856</p>
              </div>
            </div>
          </div>
        );

      case 'emails':
        return (
          <div style={{ padding: '30px' }}>
            <h1 style={{ color: '#1976d2', marginBottom: '20px' }}>📧 邮件管理</h1>
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <h3>邮件列表</h3>
              <div style={{ marginTop: '15px' }}>
                {[
                  { from: 'john@example.com', subject: '项目进度更新', time: '10:30 AM' },
                  { from: 'sarah@company.com', subject: '会议安排确认', time: '09:15 AM' },
                  { from: 'system@notification.com', subject: '系统维护通知', time: '08:45 AM' }
                ].map((email, index) => (
                  <div key={index} style={{
                    borderBottom: '1px solid #eee',
                    padding: '10px 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <strong>{email.subject}</strong>
                      <div style={{ color: '#666', fontSize: '14px' }}>来自: {email.from}</div>
                    </div>
                    <div style={{ color: '#999', fontSize: '12px' }}>{email.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'analysis':
        return (
          <div style={{ padding: '30px' }}>
            <h1 style={{ color: '#1976d2', marginBottom: '20px' }}>📊 智能分析</h1>
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <h3>邮件情感分析</h3>
              <div style={{ display: 'flex', gap: '20px', marginTop: '15px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', color: '#4caf50' }}>😊 65%</div>
                  <div>积极</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', color: '#ff9800' }}>😐 25%</div>
                  <div>中性</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', color: '#f44336' }}>😞 10%</div>
                  <div>消极</div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div style={{ padding: '30px' }}>
            <h1 style={{ color: '#1976d2', marginBottom: '20px' }}>⚙️ 系统设置</h1>
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <h3>基本设置</h3>
              <div style={{ marginTop: '15px' }}>
                <p>✅ 自动同步邮件</p>
                <p>✅ 智能分类</p>
                <p>✅ 实时通知</p>
                <p>⚙️ 主题: 浅色模式</p>
                <p>🌍 语言: 中文 (简体)</p>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div style={{ padding: '30px' }}>
            <h1>页面未找到</h1>
          </div>
        );
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}>
        {/* 左侧导航栏 */}
        <nav style={{
          width: '280px',
          backgroundColor: '#1976d2',
          color: 'white',
          padding: '0',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* 应用标题 */}
          <div style={{
            padding: '20px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            textAlign: 'center'
          }}>
            <h2 style={{ margin: 0, fontSize: '24px' }}>
              📧 Email Assist
            </h2>
            <p style={{ margin: '5px 0 0 0', opacity: 0.8, fontSize: '14px' }}>
              智能邮件管理系统
            </p>
          </div>

          {/* 导航菜单 */}
          <div style={{ padding: '20px 0', flex: 1 }}>
            {[
              { id: 'dashboard', icon: '🏠', label: '仪表板' },
              { id: 'emails', icon: '📧', label: '邮件管理' },
              { id: 'analysis', icon: '📊', label: '智能分析' },
              { id: 'settings', icon: '⚙️', label: '系统设置' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                style={{
                  width: '100%',
                  border: 'none',
                  background: currentPage === item.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: 'white',
                  padding: '15px 20px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '16px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== item.id) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage !== item.id) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span style={{ marginRight: '10px' }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          {/* 底部状态 */}
          <div style={{
            padding: '20px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            fontSize: '12px',
            opacity: 0.7
          }}>
            <div>🟢 系统运行正常</div>
            <div>🔗 前端: localhost:3000</div>
            <div>🔗 后端: localhost:3001</div>
          </div>
        </nav>

        {/* 右侧主要内容区域 */}
        <main style={{
          flex: 1,
          backgroundColor: '#ffffff',
          overflow: 'auto'
        }}>
          {renderContent()}
        </main>
      </div>
    </ThemeProvider>
  );
};

export default WorkingApp;