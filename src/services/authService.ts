import axios from 'axios';
import {
  ApiResponse,
  MicrosoftAuthResponse,
  AuthTokens,
  User,
  LoginCredentials
} from '@/types';

// API基础配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// 创建axios实例
const authApi = axios.create({
  baseURL: `${API_BASE_URL}/v1/auth`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// 请求拦截器 - 自动添加认证令牌
authApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理令牌过期
authApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await refreshAccessToken(refreshToken);
          localStorage.setItem('accessToken', response.data.tokens.accessToken);
          localStorage.setItem('refreshToken', response.data.tokens.refreshToken);

          // 重试原请求
          return authApi(original);
        }
      } catch (refreshError) {
        // 刷新令牌失败，清除存储并重定向到登录
        clearAuthTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// 认证服务类
export class AuthService {
  /**
   * 获取Microsoft OAuth2授权URL
   */
  static async getMicrosoftAuthUrl(): Promise<ApiResponse<{ authUrl: string }>> {
    try {
      const response = await authApi.post('/microsoft/login');
      return response.data;
    } catch (error: any) {
      console.error('获取Microsoft授权URL失败:', error);
      return {
        success: false,
        error: error.response?.data?.message || '获取授权URL失败',
      };
    }
  }

  /**
   * 处理Microsoft OAuth2回调
   */
  static async handleMicrosoftCallback(code: string): Promise<ApiResponse<MicrosoftAuthResponse>> {
    try {
      const response = await authApi.get(`/microsoft/callback?code=${code}`);

      if (response.data.success) {
        // 存储令牌
        const { tokens } = response.data.data;
        this.storeAuthTokens(tokens);
      }

      return response.data;
    } catch (error: any) {
      console.error('Microsoft OAuth回调处理失败:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'OAuth认证失败',
      };
    }
  }

  /**
   * 刷新访问令牌
   */
  static async refreshAccessToken(refreshToken: string): Promise<ApiResponse<{ tokens: AuthTokens }>> {
    try {
      const response = await authApi.post('/microsoft/refresh', {
        refreshToken,
      });
      return response.data;
    } catch (error: any) {
      console.error('刷新令牌失败:', error);
      return {
        success: false,
        error: error.response?.data?.message || '令牌刷新失败',
      };
    }
  }

  /**
   * 获取当前用户信息
   */
  static async getCurrentUser(): Promise<ApiResponse<User>> {
    try {
      const response = await authApi.get('/user');
      return response.data;
    } catch (error: any) {
      console.error('获取用户信息失败:', error);
      return {
        success: false,
        error: error.response?.data?.message || '获取用户信息失败',
      };
    }
  }

  /**
   * 注销用户
   */
  static async logout(): Promise<ApiResponse<void>> {
    try {
      const response = await authApi.post('/logout');
      this.clearAuthTokens();
      return response.data;
    } catch (error: any) {
      console.error('注销失败:', error);
      // 即使服务端注销失败，也要清除本地令牌
      this.clearAuthTokens();
      return {
        success: false,
        error: error.response?.data?.message || '注销失败',
      };
    }
  }

  /**
   * 验证令牌有效性
   */
  static async validateToken(): Promise<boolean> {
    try {
      const response = await authApi.get('/validate');
      return response.data.success;
    } catch (error) {
      console.error('令牌验证失败:', error);
      return false;
    }
  }

  /**
   * 存储认证令牌
   */
  static storeAuthTokens(tokens: AuthTokens): void {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem('tokenExpiry', String(Date.now() + tokens.expiresIn * 1000));
  }

  /**
   * 清除认证令牌
   */
  static clearAuthTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenExpiry');
  }

  /**
   * 检查令牌是否过期
   */
  static isTokenExpired(): boolean {
    const expiry = localStorage.getItem('tokenExpiry');
    if (!expiry) return true;

    return Date.now() > parseInt(expiry, 10);
  }

  /**
   * 获取存储的访问令牌
   */
  static getStoredAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  /**
   * 获取存储的刷新令牌
   */
  static getStoredRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }
}

// 导出默认函数
export default AuthService;

// 便捷函数
export const clearAuthTokens = () => AuthService.clearAuthTokens();
export const isTokenExpired = () => AuthService.isTokenExpired();
export const getStoredAccessToken = () => AuthService.getStoredAccessToken();
export const getStoredRefreshToken = () => AuthService.getStoredRefreshToken();

// 导出刷新令牌函数供axios拦截器使用
export const refreshAccessToken = (refreshToken: string) =>
  AuthService.refreshAccessToken(refreshToken);