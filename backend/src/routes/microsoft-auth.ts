/**
 * Microsoft OAuth Authentication Routes
 * 处理Microsoft账户的OAuth2认证流程
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { MicrosoftAuthToken } from '@/models/MicrosoftAuthToken';
import logger from '@/utils/logger';
import { ResponseHandler } from '@/utils/response';

const router = Router();

// Microsoft OAuth配置
const MICROSOFT_AUTH_CONFIG = {
  clientId: process.env.MICROSOFT_CLIENT_ID || 'your-client-id',
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET || 'your-client-secret',
  tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
  redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3001/api/auth/microsoft/callback',
  scopes: [
    'openid',
    'profile',
    'email',
    'offline_access',
    'https://graph.microsoft.com/Mail.Read',
    'https://graph.microsoft.com/Mail.ReadWrite',
    'https://graph.microsoft.com/Mail.Send',
    'https://graph.microsoft.com/User.Read'
  ]
};

// 临时存储授权状态（生产环境应使用Redis或数据库）
const authStateStore = new Map<string, { userId?: string; timestamp: number }>();

/**
 * 生成OAuth状态参数
 */
function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 清理过期的状态（10分钟过期）
 */
function cleanupExpiredStates() {
  const now = Date.now();
  const expiryTime = 10 * 60 * 1000; // 10分钟
  
  for (const [state, data] of authStateStore.entries()) {
    if (now - data.timestamp > expiryTime) {
      authStateStore.delete(state);
    }
  }
}

// 定期清理过期状态
setInterval(cleanupExpiredStates, 60 * 1000); // 每分钟清理一次

/**
 * GET /api/auth/microsoft
 * 启动Microsoft OAuth认证流程
 */
router.get('/microsoft', (req: Request, res: Response) => {
  try {
    // 生成并存储状态
    const state = generateState();
    authStateStore.set(state, {
      userId: req.query.userId as string,
      timestamp: Date.now()
    });

    // 构建授权URL
    const authUrl = new URL(`https://login.microsoftonline.com/${MICROSOFT_AUTH_CONFIG.tenantId}/oauth2/v2.0/authorize`);
    authUrl.searchParams.append('client_id', MICROSOFT_AUTH_CONFIG.clientId);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', MICROSOFT_AUTH_CONFIG.redirectUri);
    authUrl.searchParams.append('scope', MICROSOFT_AUTH_CONFIG.scopes.join(' '));
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('response_mode', 'query');
    authUrl.searchParams.append('prompt', 'select_account');

    res.json({
      success: true,
      data: {
        authUrl: authUrl.toString()
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'auth-microsoft-init'
      }
    });
  } catch (error) {
    console.error('Error initiating Microsoft auth:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_INIT_ERROR',
        message: 'Failed to initiate Microsoft authentication'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'auth-microsoft-error'
      }
    });
  }
});

/**
 * GET /api/auth/microsoft/callback
 * 处理Microsoft OAuth回调
 */
router.get('/microsoft/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error: authError, error_description } = req.query;

    // 处理授权错误
    if (authError) {
      console.error('Microsoft auth error:', authError, error_description);
      return res.redirect(`http://localhost:3000/auth/error?error=${authError}&description=${error_description}`);
    }

    // 验证state
    if (!state || !authStateStore.has(state as string)) {
      return res.redirect('http://localhost:3000/auth/error?error=invalid_state');
    }

    const stateData = authStateStore.get(state as string);
    authStateStore.delete(state as string);

    // 验证code
    if (!code) {
      return res.redirect('http://localhost:3000/auth/error?error=no_code');
    }

    // 交换code获取token
    const tokenUrl = `https://login.microsoftonline.com/${MICROSOFT_AUTH_CONFIG.tenantId}/oauth2/v2.0/token`;
    
    const tokenParams = new URLSearchParams({
      client_id: MICROSOFT_AUTH_CONFIG.clientId,
      client_secret: MICROSOFT_AUTH_CONFIG.clientSecret,
      code: code as string,
      redirect_uri: MICROSOFT_AUTH_CONFIG.redirectUri,
      grant_type: 'authorization_code',
      scope: MICROSOFT_AUTH_CONFIG.scopes.join(' ')
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: tokenParams.toString()
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange error:', errorData);
      return res.redirect('http://localhost:3000/auth/error?error=token_exchange_failed');
    }

    const tokens: any = await tokenResponse.json();

    // 获取用户信息
    const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });

    if (!userResponse.ok) {
      console.error('Failed to fetch user info');
      return res.redirect('http://localhost:3000/auth/error?error=user_info_failed');
    }

    const userInfo: any = await userResponse.json();

    try {
      // Save tokens and user info to database
      const tokenData = {
        userId: 'temp-user-' + userInfo.id, // TODO: Replace with actual user ID from session/JWT
        microsoftId: userInfo.id,
        email: userInfo.mail || userInfo.userPrincipalName,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope
      };

      await MicrosoftAuthToken.upsert(tokenData);
      
      logger.info('Microsoft tokens saved successfully', {
        email: userInfo.mail || userInfo.userPrincipalName,
        microsoftId: userInfo.id
      });

      console.log('Successfully authenticated user:', userInfo.mail || userInfo.userPrincipalName);

    } catch (dbError) {
      logger.error('Failed to save Microsoft tokens to database', dbError);
      // Continue with redirect even if DB save fails
    }

    // 重定向到前端成功页面
    res.redirect(`http://localhost:3000/auth/success?email=${encodeURIComponent(userInfo.mail || userInfo.userPrincipalName)}`);
  } catch (error) {
    console.error('Error in Microsoft auth callback:', error);
    res.redirect('http://localhost:3000/auth/error?error=callback_error');
  }
});

/**
 * POST /api/auth/microsoft/refresh
 * 刷新访问令牌
 */
router.post('/microsoft/refresh', async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token is required'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: 'refresh-token-error'
        }
      });
    }

    const tokenUrl = `https://login.microsoftonline.com/${MICROSOFT_AUTH_CONFIG.tenantId}/oauth2/v2.0/token`;
    
    const tokenParams = new URLSearchParams({
      client_id: MICROSOFT_AUTH_CONFIG.clientId,
      client_secret: MICROSOFT_AUTH_CONFIG.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: MICROSOFT_AUTH_CONFIG.scopes.join(' ')
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: tokenParams.toString()
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token refresh error:', errorData);
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_REFRESH_FAILED',
          message: 'Failed to refresh token'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: 'refresh-token-failed'
        }
      });
    }

    const tokens: any = await tokenResponse.json();

    return res.json({
      success: true,
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'refresh-token-success'
      }
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REFRESH_ERROR',
        message: 'Failed to refresh token'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'refresh-error'
      }
    });
  }
});

/**
 * POST /api/auth/microsoft/revoke
 * 撤销用户的Microsoft账户连接
 */
router.post('/microsoft/revoke', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    // TODO: 从数据库删除用户的Microsoft tokens
    console.log('Revoking Microsoft access for user:', userId);

    res.json({
      success: true,
      data: {
        message: 'Microsoft account disconnected successfully'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'revoke-success'
      }
    });
  } catch (error) {
    console.error('Error revoking Microsoft access:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REVOKE_ERROR',
        message: 'Failed to disconnect Microsoft account'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'revoke-error'
      }
    });
  }
});

/**
 * GET /api/auth/microsoft/status
 * 检查用户的Microsoft连接状态
 */
router.get('/microsoft/status', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    // TODO: 从数据库检查用户是否已连接Microsoft账户
    const isConnected = false; // 临时返回false

    res.json({
      success: true,
      data: {
        isConnected,
        email: isConnected ? 'user@example.com' : null,
        lastSync: isConnected ? new Date().toISOString() : null
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'status-check'
      }
    });
  } catch (error) {
    console.error('Error checking Microsoft status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_ERROR',
        message: 'Failed to check Microsoft connection status'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'status-error'
      }
    });
  }
});

export default router;