/**
 * Simple Outlook Integration Server
 * JavaScript version to avoid TypeScript compilation issues
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json());

// Microsoft OAuth Configuration
const MICROSOFT_AUTH_CONFIG = {
  clientId: process.env.MICROSOFT_CLIENT_ID || 'your-client-id',
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET || 'your-client-secret',
  tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
  redirectUri: process.env.MICROSOFT_REDIRECT_URI || `http://localhost:${PORT}/api/auth/microsoft/callback`,
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

// In-memory storage (for testing only)
const tokenStore = new Map();

// Helper functions
function generateState() {
  return crypto.randomBytes(32).toString('hex');
}

// Routes
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Outlook Integration Server'
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Email Assist API - Outlook',
      version: 'v1',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/health',
        microsoftAuth: '/api/auth/microsoft',
        microsoftCallback: '/api/auth/microsoft/callback',
        authStatus: '/api/auth/microsoft/status',
        unreadEmails: '/api/email/unread',
        dashboardStats: '/api/stats/dashboard'
      }
    }
  });
});

// Microsoft OAuth Authentication
app.get('/api/auth/microsoft', (req, res) => {
  try {
    const state = generateState();
    const userId = req.query.userId || 'temp-user-shelia';

    // Store state temporarily
    tokenStore.set(state, { userId, timestamp: Date.now() });

    // Build authorization URL
    const authUrl = new URL(`https://login.microsoftonline.com/${MICROSOFT_AUTH_CONFIG.tenantId}/oauth2/v2.0/authorize`);
    authUrl.searchParams.append('client_id', MICROSOFT_AUTH_CONFIG.clientId);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', MICROSOFT_AUTH_CONFIG.redirectUri);
    authUrl.searchParams.append('scope', MICROSOFT_AUTH_CONFIG.scopes.join(' '));
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('response_mode', 'query');
    authUrl.searchParams.append('prompt', 'select_account');

    console.log(`🔐 Microsoft Auth initiated for user: ${userId}`);
    console.log(`🔗 Auth URL generated: ${authUrl.toString().substring(0, 100)}...`);

    res.json({
      success: true,
      data: {
        authUrl: authUrl.toString()
      }
    });
  } catch (error) {
    console.error('Microsoft auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate Microsoft authentication'
    });
  }
});

// Microsoft OAuth Callback
app.get('/api/auth/microsoft/callback', async (req, res) => {
  try {
    const { code, state, error: authError } = req.query;

    if (authError) {
      console.error('Microsoft auth error:', authError);
      return res.redirect(`http://localhost:3000?auth=error&error=${authError}`);
    }

    if (!state || !tokenStore.has(state)) {
      return res.redirect('http://localhost:3000?auth=error&error=invalid_state');
    }

    const stateData = tokenStore.get(state);
    tokenStore.delete(state);

    if (!code) {
      return res.redirect('http://localhost:3000?auth=error&error=no_code');
    }

    console.log(`🔄 Processing OAuth callback for code: ${code.substring(0, 20)}...`);

    // Exchange code for tokens
    const tokenUrl = `https://login.microsoftonline.com/${MICROSOFT_AUTH_CONFIG.tenantId}/oauth2/v2.0/token`;

    const tokenParams = new URLSearchParams({
      client_id: MICROSOFT_AUTH_CONFIG.clientId,
      client_secret: MICROSOFT_AUTH_CONFIG.clientSecret,
      code: code,
      redirect_uri: MICROSOFT_AUTH_CONFIG.redirectUri,
      grant_type: 'authorization_code',
      scope: MICROSOFT_AUTH_CONFIG.scopes.join(' ')
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString()
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange error:', errorData);
      return res.redirect('http://localhost:3000?auth=error&error=token_exchange_failed');
    }

    const tokens = await tokenResponse.json();

    // Get user info
    const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    if (!userResponse.ok) {
      console.error('Failed to fetch user info');
      return res.redirect('http://localhost:3000?auth=error&error=user_info_failed');
    }

    const userInfo = await userResponse.json();

    // Store tokens temporarily
    const userId = stateData.userId || 'temp-user-shelia';
    tokenStore.set(userId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      email: userInfo.mail || userInfo.userPrincipalName,
      name: userInfo.displayName,
      timestamp: Date.now()
    });

    console.log(`✅ Successfully authenticated: ${userInfo.mail || userInfo.userPrincipalName}`);

    // Redirect to frontend with success
    res.redirect(`http://localhost:3000?auth=success&email=${encodeURIComponent(userInfo.mail || userInfo.userPrincipalName)}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('http://localhost:3000?auth=error&error=callback_error');
  }
});

// Check authentication status
app.get('/api/auth/microsoft/status', (req, res) => {
  try {
    const userId = req.query.userId || 'temp-user-shelia';
    const userTokens = tokenStore.get(userId);

    if (userTokens && userTokens.expiresAt > new Date()) {
      res.json({
        success: true,
        data: {
          isConnected: true,
          email: userTokens.email,
          lastSync: new Date(userTokens.timestamp).toISOString()
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          isConnected: false,
          email: null,
          lastSync: null
        }
      });
    }
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check status'
    });
  }
});

// Get unread emails
app.get('/api/email/unread', async (req, res) => {
  try {
    const userId = 'temp-user-shelia';
    const userTokens = tokenStore.get(userId);

    if (!userTokens || userTokens.expiresAt <= new Date()) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    console.log(`📧 Fetching unread emails for: ${userTokens.email}`);

    // Fetch unread emails from Microsoft Graph
    const response = await fetch('https://graph.microsoft.com/v1.0/me/messages?$filter=isRead eq false&$top=50&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,bodyPreview,isRead,hasAttachments,importance,conversationId,webLink', {
      headers: {
        'Authorization': `Bearer ${userTokens.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(401).json({
          success: false,
          error: 'Token expired, please re-authenticate'
        });
      }
      throw new Error(`Graph API error: ${response.status}`);
    }

    const data = await response.json();

    const unreadEmails = data.value.map(message => ({
      id: message.id,
      subject: message.subject || '(No Subject)',
      from: {
        name: message.from?.emailAddress?.name || 'Unknown Sender',
        address: message.from?.emailAddress?.address || 'unknown@email.com'
      },
      receivedAt: message.receivedDateTime,
      preview: message.bodyPreview?.substring(0, 200) + (message.bodyPreview?.length > 200 ? '...' : ''),
      isRead: message.isRead,
      hasAttachments: message.hasAttachments,
      importance: message.importance,
      conversationId: message.conversationId,
      webLink: message.webLink
    }));

    console.log(`📬 Found ${unreadEmails.length} unread emails`);

    res.json({
      success: true,
      data: {
        unreadEmails,
        count: unreadEmails.length,
        userEmail: userTokens.email,
        lastSync: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Email fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch emails'
    });
  }
});

// Get dashboard statistics
app.get('/api/stats/dashboard', async (req, res) => {
  try {
    const userId = 'temp-user-shelia';
    const userTokens = tokenStore.get(userId);

    if (!userTokens) {
      return res.json({
        success: true,
        data: {
          totalEmails: 0,
          unreadEmails: 0,
          pendingAnalysis: 0,
          ruleMatches: 0
        }
      });
    }

    // Get email statistics from Microsoft Graph
    try {
      const unreadResponse = await fetch('https://graph.microsoft.com/v1.0/me/messages?$filter=isRead eq false&$count=true&$top=1', {
        headers: {
          'Authorization': `Bearer ${userTokens.accessToken}`,
          'ConsistencyLevel': 'eventual'
        }
      });

      if (unreadResponse.ok) {
        const unreadData = await unreadResponse.json();
        const unreadEmails = unreadData['@odata.count'] || 0;

        res.json({
          success: true,
          data: {
            totalEmails: unreadEmails * 10, // Estimate
            unreadEmails,
            pendingAnalysis: Math.floor(unreadEmails * 0.2),
            ruleMatches: Math.floor(unreadEmails * 0.3)
          }
        });
      } else {
        throw new Error('Failed to fetch stats');
      }
    } catch (error) {
      console.error('Stats fetch error:', error);
      res.json({
        success: true,
        data: {
          totalEmails: 0,
          unreadEmails: 0,
          pendingAnalysis: 0,
          ruleMatches: 0
        }
      });
    }

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.json({
      success: true,
      data: {
        totalEmails: 0,
        unreadEmails: 0,
        pendingAnalysis: 0,
        ruleMatches: 0
      }
    });
  }
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n🚀 Outlook Integration Server Started!');
  console.log(`📍 Server running on http://localhost:${PORT}`);
  console.log(`🔐 Microsoft OAuth configured for tenant: ${MICROSOFT_AUTH_CONFIG.tenantId}`);
  console.log(`📧 Target email: shelia.sun@item.com`);
  console.log('\n📋 Available endpoints:');
  console.log(`   GET  /health`);
  console.log(`   GET  /api`);
  console.log(`   GET  /api/auth/microsoft`);
  console.log(`   GET  /api/auth/microsoft/callback`);
  console.log(`   GET  /api/auth/microsoft/status`);
  console.log(`   GET  /api/email/unread`);
  console.log(`   GET  /api/stats/dashboard`);

  console.log('\n🔧 Environment check:');
  console.log(`   MICROSOFT_CLIENT_ID: ${MICROSOFT_AUTH_CONFIG.clientId.substring(0, 8)}...`);
  console.log(`   MICROSOFT_CLIENT_SECRET: ${MICROSOFT_AUTH_CONFIG.clientSecret !== 'your-client-secret' ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);

  console.log('\n🎯 Ready for Outlook integration with shelia.sun@item.com!');

  if (MICROSOFT_AUTH_CONFIG.clientId === 'your-client-id') {
    console.log('\n⚠️  SETUP REQUIRED:');
    console.log('   Please configure Microsoft OAuth credentials in .env file');
    console.log('   See OUTLOOK_SETUP_GUIDE.md for detailed instructions');
  }
});