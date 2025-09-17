import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App_ai_enhanced';

console.log('🚀 Loading AI Enhanced Email Assist App...');

// 确保根元素存在
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// 创建React根节点
const root = ReactDOM.createRoot(rootElement);

// 渲染应用
root.render(<App />);

console.log('✅ AI Enhanced Email Assist App loaded successfully');