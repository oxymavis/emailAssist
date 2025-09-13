const http = require('http');
const https = require('https');
const url = require('url');
const querystring = require('querystring');

// 配置
const config = {
    clientId: process.env.MICROSOFT_CLIENT_ID || 'YOUR_MICROSOFT_CLIENT_ID',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || 'YOUR_MICROSOFT_CLIENT_SECRET',
    tenantId: process.env.MICROSOFT_TENANT_ID || 'YOUR_MICROSOFT_TENANT_ID',
    redirectUri: 'http://localhost:3001/api/auth/microsoft/callback'
};

let accessToken = null;
let userInfo = null;

// 创建服务器
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // 健康检查
    if (pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            data: { status: 'healthy', timestamp: new Date().toISOString() }
        }));
        return;
    }
    
    // OAuth 回调处理
    if (pathname === '/api/auth/microsoft/callback') {
        const code = parsedUrl.query.code;
        const error = parsedUrl.query.error;
        
        if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<h1>认证失败</h1><p>${parsedUrl.query.error_description}</p>`);
            return;
        }
        
        if (code) {
            console.log('收到授权码:', code);
            
            try {
                // 交换 token
                const tokenData = await exchangeToken(code);
                accessToken = tokenData.access_token;
                console.log('Token 交换成功!');
                
                // 获取用户信息
                userInfo = await getUserInfo(accessToken);
                console.log('用户信息:', userInfo.displayName, userInfo.mail || userInfo.userPrincipalName);
                
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>认证成功</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                padding: 50px;
                                text-align: center;
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            }
                            .container {
                                background: white;
                                padding: 30px;
                                border-radius: 10px;
                                max-width: 600px;
                                margin: 0 auto;
                            }
                            .success { color: green; }
                            button {
                                background: #667eea;
                                color: white;
                                border: none;
                                padding: 10px 20px;
                                border-radius: 5px;
                                cursor: pointer;
                                margin: 10px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1 class="success">✅ Microsoft 认证成功！</h1>
                            <p><strong>用户:</strong> ${userInfo.displayName}</p>
                            <p><strong>邮箱:</strong> ${userInfo.mail || userInfo.userPrincipalName}</p>
                            <p><strong>ID:</strong> ${userInfo.id}</p>
                            <hr>
                            <button onclick="getEmails()">获取邮件列表</button>
                            <button onclick="window.location.href='/api/emails'">查看邮件 JSON</button>
                            <div id="result"></div>
                        </div>
                        <script>
                            async function getEmails() {
                                const result = document.getElementById('result');
                                result.innerHTML = '<p>加载中...</p>';
                                try {
                                    const response = await fetch('/api/emails');
                                    const data = await response.json();
                                    result.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
                                } catch (err) {
                                    result.innerHTML = '<p style="color:red;">错误: ' + err.message + '</p>';
                                }
                            }
                        </script>
                    </body>
                    </html>
                `);
            } catch (err) {
                console.error('Token 交换失败:', err);
                res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`<h1>Token 交换失败</h1><pre>${err.message}</pre>`);
            }
        }
        return;
    }
    
    // 获取邮件列表
    if (pathname === '/api/emails') {
        if (!accessToken) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '请先完成认证' }));
            return;
        }
        
        try {
            const emails = await getEmails(accessToken);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                user: {
                    name: userInfo.displayName,
                    email: userInfo.mail || userInfo.userPrincipalName
                },
                count: emails.length,
                emails: emails
            }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
    }
    
    // 默认响应
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Not found' }));
});

// 交换 token
function exchangeToken(code) {
    return new Promise((resolve, reject) => {
        const postData = querystring.stringify({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code: code,
            redirect_uri: config.redirectUri,
            grant_type: 'authorization_code'
        });
        
        const options = {
            hostname: 'login.microsoftonline.com',
            path: `/${config.tenantId}/oauth2/v2.0/token`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (res.statusCode === 200) {
                        resolve(result);
                    } else {
                        reject(new Error(JSON.stringify(result)));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// 获取用户信息
function getUserInfo(token) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'graph.microsoft.com',
            path: '/v1.0/me',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });
        
        req.on('error', reject);
        req.end();
    });
}

// 获取邮件列表
function getEmails(token) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'graph.microsoft.com',
            path: '/v1.0/me/messages?$top=10&$select=id,subject,from,receivedDateTime,bodyPreview,isRead',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    const emails = result.value.map(email => ({
                        id: email.id,
                        subject: email.subject,
                        from: email.from?.emailAddress?.address,
                        date: email.receivedDateTime,
                        preview: email.bodyPreview?.substring(0, 100),
                        isRead: email.isRead
                    }));
                    resolve(emails);
                } catch (e) {
                    reject(e);
                }
            });
        });
        
        req.on('error', reject);
        req.end();
    });
}

// 启动服务器
server.listen(3001, () => {
    console.log(`
========================================
Microsoft OAuth 服务器已启动
========================================

🚀 服务器运行在: http://localhost:3001

📋 可用端点:
- GET  /api/health                    - 健康检查
- GET  /api/auth/microsoft/callback   - OAuth 回调
- GET  /api/emails                    - 获取邮件列表

⚠️  请在浏览器中完成 Microsoft 认证
   认证页面应该已经打开

========================================
    `);
});