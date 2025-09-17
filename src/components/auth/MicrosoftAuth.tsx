/**
 * Microsoft OAuth2 Authentication Component
 * Handles Microsoft authentication flow and token management
 */

import React, { useState, useEffect } from 'react';
import {
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Snackbar
} from '@mui/material';
import { Microsoft } from '@mui/icons-material';
import { useAppStore } from '@/store';
import { toast } from 'react-toastify';

interface MicrosoftAuthProps {
  onSuccess?: (user: any) => void;
  onError?: (error: string) => void;
  variant?: 'contained' | 'outlined' | 'text';
  fullWidth?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const MicrosoftAuth: React.FC<MicrosoftAuthProps> = ({
  onSuccess,
  onError,
  variant = 'contained',
  fullWidth = false,
  size = 'large'
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setUser, setAuthToken } = useAppStore();

  // Handle OAuth callback
  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      if (error) {
        const errorMsg = `认证失败: ${error}`;
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }

      if (code && state) {
        setIsLoading(true);
        try {
          await handleAuthCallback(code, state);
        } catch (err) {
          console.error('OAuth callback error:', err);
        } finally {
          setIsLoading(false);
        }
      }
    };

    handleCallback();
  }, []);

  const handleAuthCallback = async (code: string, state: string) => {
    try {
      const response = await fetch('/api/v1/auth/microsoft/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, state }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '认证失败');
      }

      // Store auth token
      const token = data.accessToken || data.token;
      if (token) {
        localStorage.setItem('authToken', token);
        setAuthToken(token);
      }

      // Store user info
      if (data.user) {
        setUser(data.user);
        onSuccess?.(data.user);
        toast.success('登录成功！');
      }

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '认证失败';
      setError(errorMsg);
      onError?.(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/auth/microsoft/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          redirectUri: window.location.origin + window.location.pathname
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '获取认证URL失败');
      }

      if (data.authUrl) {
        // Redirect to Microsoft OAuth
        window.location.href = data.authUrl;
      } else {
        throw new Error('未收到认证URL');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '登录失败';
      setError(errorMsg);
      onError?.(errorMsg);
      setIsLoading(false);
      toast.error(errorMsg);
    }
  };

  return (
    <Box>
      <Button
        variant={variant}
        fullWidth={fullWidth}
        size={size}
        onClick={handleLogin}
        disabled={isLoading}
        startIcon={
          isLoading ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            <Microsoft />
          )
        }
        sx={{
          py: size === 'large' ? 1.5 : undefined,
          textTransform: 'none',
          backgroundColor: variant === 'contained' ? '#0078d4' : undefined,
          '&:hover': {
            backgroundColor: variant === 'contained' ? '#106ebe' : undefined,
          },
        }}
      >
        {isLoading ? '正在登录...' : '使用 Microsoft 账户登录'}
      </Button>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setError(null)}
          severity="error"
          variant="filled"
        >
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MicrosoftAuth;