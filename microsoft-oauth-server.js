const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 3001;

// Microsoft OAuth 配置
const config = {
    clientId: process.env.MICROSOFT_CLIENT_ID || 'YOUR_MICROSOFT_CLIENT_ID',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || 'YOUR_MICROSOFT_CLIENT_SECRET',
    tenantId: process.env.MICROSOFT_TENANT_ID || 'YOUR_MICROSOFT_TENANT_ID',
    redirectUri: 'http://localhost:3001/api/auth/microsoft/callback'
};

// 存储 tokens（实际应用应使用数据库）
let tokens = {};
let userInfo = {};

// 允许跨域
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'healthy',
            timestamp: new Date().toISOString()
        }
    });
});

// 开始 OAuth 流程
app.get('/api/auth/microsoft', (req, res) => {
    const authUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize`;
    const params = new URLSearchParams({
        client_id: config.clientId,
        response_type: 'code',
        redirect_uri: config.redirectUri,
        response_mode: 'query',
        scope: 'openid profile email offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read',
        state: 'email-assist-' + Date.now()
    });
    
    res.redirect(`${authUrl}?${params}`);
});

// OAuth 回调处理
app.get('/api/auth/microsoft/callback', async (req, res) => {
    const { code, error, error_description } = req.query;
    
    if (error) {
        console.error('OAuth error:', error, error_description);
        return res.send(`
            <html>
            <body style="font-family: Arial; padding: 50px; text-align: center;">
                <h2 style="color: red;">❌ 认证失败</h2>
                <p>${error_description || error}</p>
                <a href="/">返回首页</a>
            </body>
            </html>
        `);
    }
    
    try {
        console.log('收到授权码:', code);
        
        // 交换授权码获取 token
        const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
        const tokenResponse = await axios.post(tokenUrl, new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code: code,
            redirect_uri: config.redirectUri,
            grant_type: 'authorization_code'
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        tokens = tokenResponse.data;
        console.log('Token 交换成功！');
        console.log('Access Token:', tokens.access_token.substring(0, 50) + '...');
        
        // 获取用户信息
        const userResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`
            }
        });
        
        userInfo = userResponse.data;
        console.log('用户信息:', {
            name: userInfo.displayName,
            email: userInfo.mail || userInfo.userPrincipalName,
            id: userInfo.id
        });
        
        // 返回成功页面
        res.send(`
            <html>
            <head>
                <style>
                    body { 
                        font-family: Arial; 
                        padding: 50px; 
                        text-align: center;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                    }
                    .container {
                        background: white;
                        color: #333;
                        padding: 30px;
                        border-radius: 10px;
                        max-width: 600px;
                        margin: 0 auto;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                    }
                    .success { color: green; }
                    .info { 
                        background: #f0f0f0; 
                        padding: 15px; 
                        border-radius: 5px;
                        margin: 20px 0;
                        text-align: left;
                    }
                    button {
                        background: #667eea;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        margin: 5px;
                    }
                    button:hover { background: #764ba2; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1 class="success">✅ Microsoft 认证成功！</h1>
                    <div class="info">
                        <p><strong>用户名称:</strong> ${userInfo.displayName}</p>
                        <p><strong>邮箱:</strong> ${userInfo.mail || userInfo.userPrincipalName}</p>
                        <p><strong>用户 ID:</strong> ${userInfo.id}</p>
                        <p><strong>Token 已保存</strong> - 可以开始获取邮件了</p>
                    </div>
                    <div>
                        <button onclick="getEmails()">📧 获取邮件列表</button>
                        <button onclick="testAPI()">🧪 测试 API</button>
                        <button onclick="window.close()">关闭窗口</button>
                    </div>
                    <div id="result" style="margin-top: 20px;"></div>
                </div>
                
                <script>
                    async function getEmails() {
                        const result = document.getElementById('result');
                        result.innerHTML = '正在获取邮件...';
                        try {
                            const response = await fetch('/api/emails');
                            const data = await response.json();
                            result.innerHTML = '<div class="info"><pre>' + JSON.stringify(data, null, 2) + '</pre></div>';
                        } catch (error) {
                            result.innerHTML = '<p style="color:red;">错误: ' + error.message + '</p>';
                        }
                    }
                    
                    async function testAPI() {
                        const result = document.getElementById('result');
                        result.innerHTML = '正在测试 API...';
                        try {
                            const response = await fetch('/api/test');
                            const data = await response.json();
                            result.innerHTML = '<div class="info"><pre>' + JSON.stringify(data, null, 2) + '</pre></div>';
                        } catch (error) {
                            result.innerHTML = '<p style="color:red;">错误: ' + error.message + '</p>';
                        }
                    }
                </script>
            </body>
            </html>
        `);
        
    } catch (error) {
        console.error('Token 交换失败:', error.response?.data || error.message);
        res.status(500).send(`
            <html>
            <body style="font-family: Arial; padding: 50px; text-align: center;">
                <h2 style="color: red;">❌ Token 交换失败</h2>
                <pre>${JSON.stringify(error.response?.data || error.message, null, 2)}</pre>
                <a href="/api/auth/microsoft">重试</a>
            </body>
            </html>
        `);
    }
});

// 获取邮件列表
app.get('/api/emails', async (req, res) => {
    if (!tokens.access_token) {
        return res.status(401).json({
            success: false,
            error: '请先完成认证'
        });
    }
    
    try {
        const response = await axios.get('https://graph.microsoft.com/v1.0/me/messages?$top=10&$select=id,subject,from,receivedDateTime,bodyPreview', {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`
            }
        });
        
        res.json({
            success: true,
            user: {
                name: userInfo.displayName,
                email: userInfo.mail || userInfo.userPrincipalName
            },
            emails: response.data.value.map(email => ({
                id: email.id,
                subject: email.subject,
                from: email.from?.emailAddress?.address,
                date: email.receivedDateTime,
                preview: email.bodyPreview
            }))
        });
    } catch (error) {
        console.error('获取邮件失败:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data || error.message
        });
    }
});

// 测试端点
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'Microsoft OAuth 服务器运行正常',
        hasToken: !!tokens.access_token,
        user: userInfo.displayName ? {
            name: userInfo.displayName,
            email: userInfo.mail || userInfo.userPrincipalName
        } : null
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`
========================================
Microsoft OAuth 服务器已启动
========================================

🚀 服务器运行在: http://localhost:${PORT}

📋 可用端点:
- GET  /api/health                    - 健康检查
- GET  /api/auth/microsoft            - 开始 OAuth 认证
- GET  /api/auth/microsoft/callback   - OAuth 回调
- GET  /api/emails                    - 获取邮件列表
- GET  /api/test                      - 测试端点

🔗 开始认证:
http://localhost:${PORT}/api/auth/microsoft

========================================
    `);
});