import React from 'react';
import ReactDOM from 'react-dom/client';
import EmailAssistApp from './App_working_new';

console.log('🚀 Loading NEW Email Assist App...');

// 确保根元素存在
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// 创建React根节点
const root = ReactDOM.createRoot(rootElement);

// 渲染新的应用
root.render(
  <React.StrictMode>
    <EmailAssistApp />
  </React.StrictMode>
);

console.log('✅ NEW Email Assist App loaded successfully');