import React from 'react';

const TestApp: React.FC = () => {
  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f0f8ff',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ color: '#2c3e50' }}>✅ Email Assist 测试版</h1>
      <p>React应用正常运行！</p>
      <p>当前时间: {new Date().toLocaleString()}</p>

      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#e8f5e8',
        borderRadius: '5px'
      }}>
        <h2>📧 Email Assist 功能概览</h2>
        <ul>
          <li>📊 仪表板统计</li>
          <li>🔍 AI邮件分析</li>
          <li>🎯 智能过滤规则</li>
          <li>📈 报告生成</li>
          <li>⚡ 工作流自动化</li>
        </ul>
      </div>

      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#fff3cd',
        borderRadius: '5px'
      }}>
        <h3>🔧 技术状态</h3>
        <p>✅ React 18 运行正常</p>
        <p>✅ TypeScript 编译成功</p>
        <p>✅ Vite 开发服务器运行中</p>
        <p>🔗 API服务器: <a href="http://localhost:3002/health" target="_blank">localhost:3002</a></p>
      </div>
    </div>
  );
};

export default TestApp;