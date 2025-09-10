#!/bin/bash

# Email Assist 快速启动脚本
echo "🚀 启动 Email Assist 开发环境..."

# 检查 Node.js 版本
echo "📋 检查环境..."
node --version
npm --version

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo "⚙️  创建环境变量文件..."
    cp .env.example .env
    echo "✅ 请编辑 .env 文件配置您的API密钥和服务地址"
fi

# 启动开发服务器
echo "🎯 启动开发服务器..."
echo "📱 应用将在 http://localhost:3000 启动"
echo "⏰ 请稍等片刻..."
echo ""

npm run dev