import axios from 'axios';
import crypto from 'crypto';
import { 
  EmailProvider, 
  OAuthConfig, 
  OAuthTokens,
  ApiResponse 
} from '../../types';
import logger from '../../utils/logger';
import config from '../../config';
import { EmailServiceFactory } from '../email/EmailServiceFactory';

/**
 * OAuth 2.0认证服务
 * 处理不同邮件提供商的OAuth认证流程
 */
export class OAuthService {
  private static instance: OAuthService;
  private emailServiceFactory: EmailServiceFactory;

  private constructor() {
    this.emailServiceFactory = EmailServiceFactory.getInstance();
  }

  public static getInstance(): OAuthService {
    if (!OAuthService.instance) {
      OAuthService.instance = new OAuthService();
    }
    return OAuthService.instance;
  }

  /**
   * 生成OAuth授权URL
   */
  public generateAuthUrl(provider: EmailProvider, userId: string): ApiResponse<{ authUrl: string; state: string }> {
    try {
      // 生成状态参数用于CSRF保护
      const state = this.generateState(provider, userId);
      
      const authUrl = this.emailServiceFactory.generateAuthUrl(provider, state);
      
      logger.info(`Generated OAuth URL for ${provider}`, { userId, provider });
      
      return {
        success: true,
        data: {
          authUrl,
          state
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: crypto.randomUUID()
        }
      };
    } catch (error) {
      logger.error(`Failed to generate OAuth URL for ${provider}:`, error);
      
      return {
        success: false,
        error: {
          code: 'OAUTH_URL_GENERATION_FAILED',
          message: `Failed to generate OAuth URL for ${provider}`,
          details: error
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: crypto.randomUUID()
        }
      };
    }
  }

  /**
   * 处理OAuth回调，交换授权码获取访问令牌
   */
  public async handleCallback(
    provider: EmailProvider, 
    code: string, 
    state: string
  ): Promise<ApiResponse<{ tokens: OAuthTokens; userInfo: any }>> {
    try {
      // 验证状态参数
      const stateInfo = this.parseState(state);
      if (!stateInfo || stateInfo.provider !== provider) {
        throw new Error('Invalid state parameter');
      }

      // 获取OAuth配置
      const oauthConfig = this.emailServiceFactory.getOAuthConfig(provider);
      if (!oauthConfig) {
        throw new Error(`OAuth not supported for provider: ${provider}`);
      }

      // 交换授权码获取令牌
      const tokens = await this.exchangeCodeForTokens(oauthConfig, code);
      
      // 获取用户信息
      const userInfo = await this.getUserInfo(provider, tokens);
      
      logger.info(`OAuth callback successful for ${provider}`, { 
        userId: stateInfo.userId, 
        provider,
        email: userInfo.email 
      });

      return {
        success: true,
        data: {
          tokens,
          userInfo
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: crypto.randomUUID()
        }
      };
    } catch (error) {
      logger.error(`OAuth callback failed for ${provider}:`, error);
      
      return {
        success: false,
        error: {
          code: 'OAUTH_CALLBACK_FAILED',
          message: `OAuth callback failed for ${provider}`,
          details: error
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: crypto.randomUUID()
        }
      };
    }
  }

  /**
   * 刷新访问令牌
   */
  public async refreshAccessToken(
    provider: EmailProvider, 
    refreshToken: string
  ): Promise<ApiResponse<OAuthTokens>> {
    try {
      const oauthConfig = this.emailServiceFactory.getOAuthConfig(provider);
      if (!oauthConfig) {
        throw new Error(`OAuth not supported for provider: ${provider}`);
      }

      const tokens = await this.refreshTokens(oauthConfig, refreshToken);
      
      logger.info(`Access token refreshed for ${provider}`);

      return {
        success: true,
        data: tokens,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: crypto.randomUUID()
        }
      };
    } catch (error) {
      logger.error(`Failed to refresh access token for ${provider}:`, error);
      
      return {
        success: false,
        error: {
          code: 'TOKEN_REFRESH_FAILED',
          message: `Failed to refresh access token for ${provider}`,
          details: error
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: crypto.randomUUID()
        }
      };
    }
  }

  /**
   * 撤销访问令牌
   */
  public async revokeToken(
    provider: EmailProvider, 
    token: string
  ): Promise<ApiResponse<void>> {
    try {
      await this.performTokenRevocation(provider, token);
      
      logger.info(`Token revoked for ${provider}`);

      return {
        success: true,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: crypto.randomUUID()
        }
      };
    } catch (error) {
      logger.error(`Failed to revoke token for ${provider}:`, error);
      
      return {
        success: false,
        error: {
          code: 'TOKEN_REVOCATION_FAILED',
          message: `Failed to revoke token for ${provider}`,
          details: error
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: crypto.randomUUID()
        }
      };
    }
  }

  /**
   * 验证访问令牌
   */
  public async validateToken(
    provider: EmailProvider, 
    accessToken: string
  ): Promise<ApiResponse<{ valid: boolean; userInfo?: any }>> {
    try {
      const userInfo = await this.getUserInfo(provider, { 
        accessToken,
        tokenType: 'Bearer',
        expiresIn: 3600,
        expiresAt: new Date(Date.now() + 3600000)
      });

      return {
        success: true,
        data: {
          valid: true,
          userInfo
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: crypto.randomUUID()
        }
      };
    } catch (error) {
      logger.warn(`Token validation failed for ${provider}:`, error);
      
      return {
        success: true,
        data: {
          valid: false
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: crypto.randomUUID()
        }
      };
    }
  }

  /**
   * 获取支持OAuth的提供商列表
   */
  public getSupportedProviders(): Array<{ 
    provider: EmailProvider; 
    displayName: string; 
    scopes: string[];
  }> {
    const providers = this.emailServiceFactory.getSupportedProviders();
    
    return providers
      .filter(config => config.authType === 'oauth2')
      .map(config => ({
        provider: config.provider,
        displayName: config.displayName,
        scopes: config.scopes || []
      }));
  }

  /**
   * 交换授权码获取访问令牌
   */
  private async exchangeCodeForTokens(config: OAuthConfig, code: string): Promise<OAuthTokens> {
    const requestData = {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri
    };

    const response = await axios.post(config.tokenUrl, requestData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const tokenData = response.data;
    
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      idToken: tokenData.id_token,
      tokenType: tokenData.token_type || 'Bearer',
      expiresIn: tokenData.expires_in,
      expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)),
      scope: tokenData.scope
    };
  }

  /**
   * 刷新访问令牌
   */
  private async refreshTokens(config: OAuthConfig, refreshToken: string): Promise<OAuthTokens> {
    const requestData = {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    };

    const response = await axios.post(config.tokenUrl, requestData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const tokenData = response.data;
    
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken, // 某些提供商不返回新的refresh_token
      tokenType: tokenData.token_type || 'Bearer',
      expiresIn: tokenData.expires_in,
      expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)),
      scope: tokenData.scope
    };
  }

  /**
   * 获取用户信息
   */
  private async getUserInfo(provider: EmailProvider, tokens: OAuthTokens): Promise<any> {
    const oauthConfig = this.emailServiceFactory.getOAuthConfig(provider);
    if (!oauthConfig?.userInfoUrl) {
      throw new Error(`User info URL not configured for ${provider}`);
    }

    const response = await axios.get(oauthConfig.userInfoUrl, {
      headers: {
        Authorization: `${tokens.tokenType} ${tokens.accessToken}`
      }
    });

    // 标准化用户信息格式
    const userInfo = response.data;
    
    switch (provider) {
      case 'microsoft':
        return {
          id: userInfo.id,
          email: userInfo.mail || userInfo.userPrincipalName,
          name: userInfo.displayName,
          avatar: null,
          provider: 'microsoft'
        };
        
      case 'gmail':
        return {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          avatar: userInfo.picture,
          provider: 'gmail'
        };
        
      default:
        return {
          id: userInfo.id || userInfo.email,
          email: userInfo.email,
          name: userInfo.name || userInfo.displayName,
          avatar: userInfo.avatar || userInfo.picture,
          provider
        };
    }
  }

  /**
   * 撤销令牌
   */
  private async performTokenRevocation(provider: EmailProvider, token: string): Promise<void> {
    switch (provider) {
      case 'microsoft':
        // Microsoft没有标准的撤销端点，令牌会自动过期
        logger.info('Microsoft tokens will expire automatically');
        break;
        
      case 'gmail':
        await axios.post('https://oauth2.googleapis.com/revoke', null, {
          params: { token }
        });
        break;
        
      default:
        logger.warn(`Token revocation not implemented for ${provider}`);
    }
  }

  /**
   * 生成状态参数
   */
  private generateState(provider: EmailProvider, userId: string): string {
    const stateData = {
      provider,
      userId,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex')
    };

    // 使用HMAC签名确保状态参数不被篡改
    const stateString = Buffer.from(JSON.stringify(stateData)).toString('base64');
    const signature = crypto
      .createHmac('sha256', config.env.JWT_SECRET)
      .update(stateString)
      .digest('hex');

    return `${stateString}.${signature}`;
  }

  /**
   * 解析状态参数
   */
  private parseState(state: string): { provider: EmailProvider; userId: string; timestamp: number } | null {
    try {
      const [stateString, signature] = state.split('.');
      
      // 验证签名
      const expectedSignature = crypto
        .createHmac('sha256', config.env.JWT_SECRET)
        .update(stateString)
        .digest('hex');

      if (signature !== expectedSignature) {
        logger.warn('Invalid state signature');
        return null;
      }

      const stateData = JSON.parse(Buffer.from(stateString, 'base64').toString());
      
      // 检查时间戳（防止重放攻击）
      const maxAge = 10 * 60 * 1000; // 10分钟
      if (Date.now() - stateData.timestamp > maxAge) {
        logger.warn('State parameter expired');
        return null;
      }

      return {
        provider: stateData.provider,
        userId: stateData.userId,
        timestamp: stateData.timestamp
      };
    } catch (error) {
      logger.error('Failed to parse state parameter:', error);
      return null;
    }
  }

  /**
   * 检查令牌是否即将过期
   */
  public isTokenExpiring(tokens: OAuthTokens, bufferMinutes: number = 5): boolean {
    const bufferTime = bufferMinutes * 60 * 1000;
    return tokens.expiresAt.getTime() - Date.now() < bufferTime;
  }

  /**
   * 自动刷新令牌（如果需要）
   */
  public async ensureValidToken(
    provider: EmailProvider, 
    tokens: OAuthTokens
  ): Promise<OAuthTokens> {
    if (!this.isTokenExpiring(tokens)) {
      return tokens;
    }

    if (!tokens.refreshToken) {
      throw new Error('No refresh token available');
    }

    const refreshResult = await this.refreshAccessToken(provider, tokens.refreshToken);
    if (!refreshResult.success) {
      throw new Error(`Failed to refresh token: ${refreshResult.error?.message}`);
    }

    return refreshResult.data!;
  }

  /**
   * 批量验证多个令牌
   */
  public async validateMultipleTokens(
    tokenInfos: Array<{ provider: EmailProvider; accessToken: string; accountId: string }>
  ): Promise<Array<{ accountId: string; valid: boolean; error?: string }>> {
    const results = await Promise.allSettled(
      tokenInfos.map(async ({ provider, accessToken, accountId }) => {
        const validation = await this.validateToken(provider, accessToken);
        return {
          accountId,
          valid: validation.data?.valid || false,
          error: validation.success ? undefined : validation.error?.message
        };
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          accountId: tokenInfos[index].accountId,
          valid: false,
          error: result.reason?.message || 'Validation failed'
        };
      }
    });
  }

  /**
   * 清理过期的状态参数缓存
   */
  public cleanupExpiredStates(): void {
    // 在实际实现中，这里应该清理存储在Redis或数据库中的过期状态参数
    logger.debug('Cleaning up expired OAuth states');
  }
}