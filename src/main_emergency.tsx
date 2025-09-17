import React from 'react';
import ReactDOM from 'react-dom/client';

// 最简单的应用，用于排除问题
const EmergencyApp = () => {
  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', minHeight: '100vh' }}>
      <h1 style={{ color: 'red' }}>🚨 Emergency App - 测试白屏问题</h1>
      <p>如果你能看到这个页面，说明React基础工作正常</p>
      <p>时间: {new Date().toLocaleString()}</p>
      <button onClick={() => alert('按钮工作正常!')}>点击测试</button>
    </div>
  );
};

// 获取根元素
const rootElement = document.getElementById('root');
if (!rootElement) {
  // 如果没有root元素，创建一个
  const newRoot = document.createElement('div');
  newRoot.id = 'root';
  document.body.appendChild(newRoot);
  console.log('❌ 原始root元素不存在，已创建新的');
} else {
  console.log('✅ 找到root元素');
}

// 渲染应用
try {
  const root = ReactDOM.createRoot(rootElement || document.getElementById('root')!);
  root.render(<EmergencyApp />);
  console.log('✅ Emergency App 渲染成功');
} catch (error) {
  console.error('❌ Emergency App 渲染失败:', error);
  // 如果React渲染失败，直接操作DOM
  document.body.innerHTML = `
    <div style="padding: 20px; background: red; color: white;">
      <h1>🚨 React渲染失败</h1>
      <p>错误: ${error}</p>
    </div>
  `;
}