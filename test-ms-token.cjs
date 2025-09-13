// 测试 Microsoft OAuth Token 交换
const https = require('https');
const querystring = require('querystring');

// 配置信息
const config = {
    clientId: process.env.MICROSOFT_CLIENT_ID || 'YOUR_MICROSOFT_CLIENT_ID',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || 'YOUR_MICROSOFT_CLIENT_SECRET',
    tenantId: process.env.MICROSOFT_TENANT_ID || 'YOUR_MICROSOFT_TENANT_ID',
    redirectUri: 'http://localhost:3001/api/auth/microsoft/callback'
};

// 生成授权 URL
function getAuthUrl() {
    const baseUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize`;
    const params = querystring.stringify({
        client_id: config.clientId,
        response_type: 'code',
        redirect_uri: config.redirectUri,
        response_mode: 'query',
        scope: 'openid profile email offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read',
        state: 'test-state-123'
    });
    return `${baseUrl}?${params}`;
}

// 测试 token 交换（需要有效的授权码）
async function testTokenExchange(authCode) {
    return new Promise((resolve, reject) => {
        const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
        const postData = querystring.stringify({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code: authCode,
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
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (res.statusCode === 200) {
                        resolve(result);
                    } else {
                        reject(result);
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
async function getUserInfo(accessToken) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'graph.microsoft.com',
            path: '/v1.0/me',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (res.statusCode === 200) {
                        resolve(result);
                    } else {
                        reject(result);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// 主函数
async function main() {
    console.log('========================================');
    console.log('Microsoft OAuth 配置测试');
    console.log('========================================\n');
    
    console.log('📋 当前配置:');
    console.log(`Client ID: ${config.clientId}`);
    console.log(`Tenant ID: ${config.tenantId}`);
    console.log(`Redirect URI: ${config.redirectUri}`);
    console.log(`Client Secret: ${config.clientSecret.substring(0, 10)}...`);
    console.log('\n');
    
    const authUrl = getAuthUrl();
    console.log('🔗 授权 URL:');
    console.log(authUrl);
    console.log('\n');
    
    console.log('📝 测试步骤:');
    console.log('1. 在浏览器中打开上面的授权 URL');
    console.log('2. 登录您的 Microsoft 账户');
    console.log('3. 授权应用访问');
    console.log('4. 从重定向 URL 中复制 code 参数');
    console.log('5. 运行: node test-ms-token.js YOUR_CODE');
    console.log('\n');
    
    // 如果提供了授权码，尝试交换 token
    const authCode = process.argv[2];
    if (authCode) {
        console.log('🔄 正在交换 token...');
        try {
            const tokenResult = await testTokenExchange(authCode);
            console.log('✅ Token 交换成功!');
            console.log(`Access Token: ${tokenResult.access_token.substring(0, 50)}...`);
            console.log(`Token Type: ${tokenResult.token_type}`);
            console.log(`Expires In: ${tokenResult.expires_in} seconds`);
            console.log('\n');
            
            if (tokenResult.access_token) {
                console.log('👤 获取用户信息...');
                const userInfo = await getUserInfo(tokenResult.access_token);
                console.log('✅ 用户信息:');
                console.log(`名称: ${userInfo.displayName}`);
                console.log(`邮箱: ${userInfo.mail || userInfo.userPrincipalName}`);
                console.log(`ID: ${userInfo.id}`);
            }
        } catch (error) {
            console.error('❌ 错误:', error);
        }
    }
}

main();