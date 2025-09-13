import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';
import config from '@/config';
import logger from '@/utils/logger';
import { AuthenticationError, TokenExpiredError } from '@/utils/errors';

/**
 * Microsoft Graph API OAuth2 认证服务
 * 处理Microsoft账户的OAuth2认证流程和token管理
 */
export interface MicrosoftTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

export interface UserInfo {
  id: string;
  email: string;
  displayName: string;
  userPrincipalName: string;
  avatar?: string;
}

export class MicrosoftAuthService {
  private static instance: MicrosoftAuthService;
  
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly tenantId: string;
  private readonly scopes: string[];
  
  // Microsoft OAuth2 endpoints
  private readonly authorizeUrl = 'https://login.microsoftonline.com';
  private readonly tokenUrl = 'https://login.microsoftonline.com';
  private readonly graphUrl = 'https://graph.microsoft.com/v1.0';

  private constructor() {
    this.clientId = config.env.MICROSOFT_CLIENT_ID;
    this.clientSecret = config.env.MICROSOFT_CLIENT_SECRET;
    this.redirectUri = config.env.MICROSOFT_REDIRECT_URI;
    this.tenantId = config.env.MICROSOFT_TENANT_ID || 'common';
    this.scopes = (config.env.MICROSOFT_GRAPH_SCOPE || '').split(' ').filter(s => s);
    
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new Error('Microsoft OAuth2 configuration is incomplete');
    }
  }

  public static getInstance(): MicrosoftAuthService {
    if (!MicrosoftAuthService.instance) {
      MicrosoftAuthService.instance = new MicrosoftAuthService();
    }
    return MicrosoftAuthService.instance;
  }

  /**
   * 生成OAuth2授权URL
   */
  public generateAuthUrl(state?: string): string {
    const authState = state || crypto.randomBytes(16).toString('hex');
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(' '),
      response_mode: 'query',
      state: authState,
      prompt: 'consent', // Force consent to get refresh token
    });

    const authUrl = `${this.authorizeUrl}/${this.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
    
    logger.info('Generated Microsoft auth URL', {
      tenantId: this.tenantId,
      scopes: this.scopes,
      state: authState
    });

    return authUrl;
  }

  /**
   * 使用授权码换取访问令牌
   */
  public async exchangeCodeForTokens(code: string): Promise<MicrosoftTokens> {
    try {
      const tokenEndpoint = `${this.tokenUrl}/${this.tenantId}/oauth2/v2.0/token`;
      
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
        scope: this.scopes.join(' ')
      });

      logger.info('Exchanging code for tokens', { code: code.substring(0, 10) + '...' });

      const response: AxiosResponse = await axios.post(tokenEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      const tokens: MicrosoftTokens = {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in,
        expires_at: Date.now() + (response.data.expires_in * 1000),
        scope: response.data.scope,
        token_type: response.data.token_type,
        id_token: response.data.id_token
      };

      logger.info('Successfully exchanged code for tokens', {
        expires_in: tokens.expires_in,
        scope: tokens.scope
      });

      return tokens;
    } catch (error: any) {
      logger.error('Failed to exchange code for tokens', {
        error: error.response?.data || error.message,
        status: error.response?.status
      });
      throw new AuthenticationError('Failed to exchange authorization code for tokens');
    }
  }

  /**
   * 刷新访问令牌
   */
  public async refreshAccessToken(refreshToken: string): Promise<MicrosoftTokens> {
    try {
      const tokenEndpoint = `${this.tokenUrl}/${this.tenantId}/oauth2/v2.0/token`;
      
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: this.scopes.join(' ')
      });

      logger.info('Refreshing access token');

      const response: AxiosResponse = await axios.post(tokenEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      const tokens: MicrosoftTokens = {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token || refreshToken, // Keep old refresh token if not provided
        expires_in: response.data.expires_in,
        expires_at: Date.now() + (response.data.expires_in * 1000),
        scope: response.data.scope,
        token_type: response.data.token_type,
        id_token: response.data.id_token
      };

      logger.info('Successfully refreshed access token', {
        expires_in: tokens.expires_in
      });

      return tokens;
    } catch (error: any) {
      logger.error('Failed to refresh access token', {
        error: error.response?.data || error.message,
        status: error.response?.status
      });
      throw new TokenExpiredError('Failed to refresh access token');
    }
  }

  /**
   * 获取用户信息
   */
  public async getUserInfo(accessToken: string): Promise<UserInfo> {
    try {
      const response: AxiosResponse = await axios.get(`${this.graphUrl}/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      const userInfo: UserInfo = {
        id: response.data.id,
        email: response.data.mail || response.data.userPrincipalName,
        displayName: response.data.displayName,
        userPrincipalName: response.data.userPrincipalName
      };

      // Try to get user photo
      try {
        const photoResponse = await axios.get(`${this.graphUrl}/me/photo/$value`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          responseType: 'arraybuffer',
          timeout: 5000
        });

        if (photoResponse.status === 200) {
          const photoBuffer = Buffer.from(photoResponse.data);
          userInfo.avatar = `data:image/jpeg;base64,${photoBuffer.toString('base64')}`;
        }
      } catch (photoError) {
        logger.debug('Could not fetch user photo', photoError);
        // Photo fetch is optional, continue without it
      }

      logger.info('Successfully retrieved user info', {
        id: userInfo.id,
        email: userInfo.email,
        displayName: userInfo.displayName
      });

      return userInfo;
    } catch (error: any) {
      logger.error('Failed to get user info', {
        error: error.response?.data || error.message,
        status: error.response?.status
      });
      throw new AuthenticationError('Failed to retrieve user information');
    }
  }

  /**
   * 验证访问令牌是否有效
   */
  public async validateToken(accessToken: string): Promise<boolean> {
    try {
      await axios.get(`${this.graphUrl}/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        timeout: 5000
      });
      return true;
    } catch (error: any) {
      logger.debug('Token validation failed', {
        status: error.response?.status,
        error: error.response?.data?.error?.code
      });
      return false;
    }
  }

  /**
   * 检查token是否即将过期（30分钟内）
   */
  public isTokenExpiringSoon(tokens: MicrosoftTokens): boolean {
    const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds
    return tokens.expires_at - Date.now() < thirtyMinutes;
  }

  /**
   * 撤销访问令牌 (登出)
   */
  public async revokeToken(accessToken: string): Promise<void> {
    try {
      const logoutUrl = `${this.authorizeUrl}/${this.tenantId}/oauth2/v2.0/logout`;
      
      // Microsoft doesn't provide a direct token revocation endpoint
      // The logout URL will invalidate the session
      logger.info('Token revocation requested', { 
        logoutUrl,
        message: 'Use logout URL to invalidate session' 
      });
      
    } catch (error: any) {
      logger.error('Failed to revoke token', error);
      // Don't throw error as this is not critical
    }
  }

  /**
   * 确保token有效性，如有需要自动刷新
   */
  public async ensureValidToken(tokens: MicrosoftTokens): Promise<MicrosoftTokens> {
    // Check if token is expired or expiring soon
    if (this.isTokenExpiringSoon(tokens)) {
      logger.info('Token is expiring soon, refreshing...');
      return await this.refreshAccessToken(tokens.refresh_token);
    }

    // Validate current token
    const isValid = await this.validateToken(tokens.access_token);
    if (!isValid) {
      logger.info('Token is invalid, refreshing...');
      return await this.refreshAccessToken(tokens.refresh_token);
    }

    return tokens;
  }

  /**
   * 获取用户邮箱列表
   */
  public async getUserMailboxes(accessToken: string): Promise<any[]> {
    try {
      const response: AxiosResponse = await axios.get(`${this.graphUrl}/me/mailFolders`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      logger.info('Successfully retrieved user mailboxes', {
        count: response.data.value?.length || 0
      });

      return response.data.value || [];
    } catch (error: any) {
      logger.error('Failed to get user mailboxes', {
        error: error.response?.data || error.message,
        status: error.response?.status
      });
      throw new AuthenticationError('Failed to retrieve user mailboxes');
    }
  }
}

export default MicrosoftAuthService;