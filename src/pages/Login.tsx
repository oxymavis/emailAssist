/**
 * Login Page Component
 * Provides user authentication interface
 */

import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Divider,
  useTheme,
  useMediaQuery,
  Stack
} from '@mui/material';
import { Email, Security, TrendingUp, Group } from '@mui/icons-material';
import { useAppStore } from '@/store';
import MicrosoftAuth from '@/components/auth/MicrosoftAuth';

const Login: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAppStore();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [user, navigate, location]);

  const handleLoginSuccess = (user: any) => {
    console.log('Login successful:', user);
    const from = (location.state as any)?.from?.pathname || '/';
    navigate(from, { replace: true });
  };

  const handleLoginError = (error: string) => {
    console.error('Login error:', error);
  };

  const features = [
    {
      icon: <Email color="primary" />,
      title: 'AI 邮件分析',
      description: '智能识别邮件内容、情感倾向和优先级'
    },
    {
      icon: <TrendingUp color="primary" />,
      title: '自动报告生成',
      description: '定时生成邮件处理统计报告，节省80%时间'
    },
    {
      icon: <Group color="primary" />,
      title: '团队协作',
      description: '邮件分配、评论协作，提高团队整体效率'
    },
    {
      icon: <Security color="primary" />,
      title: '安全可靠',
      description: 'OAuth2认证，企业级安全保障'
    }
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${theme.palette.primary.main}15 0%, ${theme.palette.secondary.main}15 100%)`,
        display: 'flex',
        alignItems: 'center',
        py: 4
      }}
    >
      <Container maxWidth="lg">
        <Box
          display="flex"
          flexDirection={isMobile ? 'column' : 'row'}
          alignItems="center"
          gap={6}
        >
          {/* Left Side - Brand & Features */}
          <Box flex={1} textAlign={isMobile ? 'center' : 'left'}>
            <Typography
              variant="h3"
              component="h1"
              fontWeight="bold"
              color="primary"
              gutterBottom
            >
              Email Assist
            </Typography>

            <Typography
              variant="h5"
              color="text.secondary"
              gutterBottom
              sx={{ mb: 4 }}
            >
              AI驱动的智能邮件管理系统
            </Typography>

            <Typography
              variant="body1"
              color="text.secondary"
              paragraph
              sx={{ mb: 4, fontSize: '1.1rem' }}
            >
              专为技术支持和项目管理人员打造，通过AI分析提升邮件处理效率，
              自动化工作流程，让您专注于更重要的工作。
            </Typography>

            {/* Features Grid */}
            <Box
              display="grid"
              gridTemplateColumns={isMobile ? '1fr' : 'repeat(2, 1fr)'}
              gap={3}
              sx={{ mt: 4 }}
            >
              {features.map((feature, index) => (
                <Box
                  key={index}
                  display="flex"
                  alignItems="flex-start"
                  gap={2}
                >
                  <Box sx={{ mt: 0.5 }}>
                    {feature.icon}
                  </Box>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {feature.description}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Right Side - Login Form */}
          <Box flex={isMobile ? 'none' : 0.6} width="100%" maxWidth="400px">
            <Paper
              elevation={8}
              sx={{
                p: 4,
                borderRadius: 3,
                background: theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Box textAlign="center" mb={3}>
                <Typography variant="h4" component="h2" gutterBottom>
                  欢迎回来
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  使用您的 Microsoft 账户登录
                </Typography>
              </Box>

              <Divider sx={{ my: 3 }} />

              <Stack spacing={3}>
                <MicrosoftAuth
                  onSuccess={handleLoginSuccess}
                  onError={handleLoginError}
                  variant="contained"
                  fullWidth
                  size="large"
                />

                <Box textAlign="center">
                  <Typography variant="caption" color="text.secondary">
                    登录即表示您同意我们的服务条款和隐私政策
                  </Typography>
                </Box>
              </Stack>

              {/* Additional Info */}
              <Box mt={4}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  🔒 使用企业级 OAuth2 认证<br />
                  🚀 即刻体验 AI 智能邮件管理
                </Typography>
              </Box>
            </Paper>
          </Box>
        </Box>

        {/* Footer */}
        <Box textAlign="center" mt={6}>
          <Typography variant="body2" color="text.secondary">
            © 2024 Email Assist. 专业的邮件智能管理解决方案.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Login;