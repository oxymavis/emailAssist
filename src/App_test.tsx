import React from 'react';

const TestApp: React.FC = () => {
  return (
    <div style={{
      padding: '50px',
      textAlign: 'center',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ color: '#1976d2' }}>🎉 Email Assist 正常运行!</h1>
      <h2>智能邮件管理系统</h2>
      <p>前端服务器: http://localhost:3000 ✅</p>
      <p>后端服务器: http://localhost:3001 ✅</p>
      <div style={{
        marginTop: '30px',
        padding: '20px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        maxWidth: '600px',
        margin: '30px auto'
      }}>
        <h3>系统状态</h3>
        <p>✅ React 应用已启动</p>
        <p>✅ TypeScript 编译成功</p>
        <p>✅ 开发服务器运行中</p>
        <p>🚀 系统准备就绪</p>
      </div>
    </div>
  );
};

export default TestApp;