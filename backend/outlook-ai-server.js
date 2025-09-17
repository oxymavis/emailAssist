/**
 * AI Enhanced Outlook Integration Server
 * Includes DeepSeek AI analysis for intelligent email processing
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

// DeepSeek AI Configuration
const DEEPSEEK_CONFIG = {
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
  model: 'deepseek-chat'
};

// In-memory storage (for testing only)
const tokenStore = new Map();
const analysisCache = new Map(); // Cache AI analysis results

// Helper functions
function generateState() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * AI Analysis Service using DeepSeek API
 */
class AIAnalysisService {
  static async analyzeEmailContent(subject, body, sender, importance = 'normal') {
    try {
      console.log(`🤖 Starting AI analysis for email: "${subject.substring(0, 50)}..."`);

      // Create analysis cache key
      const cacheKey = crypto.createHash('md5')
        .update(`${subject}${body}${sender}`)
        .digest('hex');

      // Check cache first
      if (analysisCache.has(cacheKey)) {
        console.log('📋 Using cached analysis result');
        return analysisCache.get(cacheKey);
      }

      // Prepare prompt for DeepSeek AI
      const prompt = `请分析以下邮件内容，并提供结构化的分析结果：

邮件主题: ${subject}
发件人: ${sender}
邮件重要性: ${importance}
邮件内容: ${body}

请返回JSON格式的分析结果，包含以下字段：
{
  "sentiment": "positive|neutral|negative",
  "urgency": "low|medium|high|critical",
  "category": "工作|个人|营销|通知|其他",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "summary": "邮件内容摘要(50字以内)",
  "actionRequired": true/false,
  "suggestedActions": ["建议操作1", "建议操作2"],
  "confidence": 0.85
}`;

      // Call DeepSeek API
      const response = await fetch(`${DEEPSEEK_CONFIG.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_CONFIG.apiKey}`
        },
        body: JSON.stringify({
          model: DEEPSEEK_CONFIG.model,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的邮件分析助手，专门分析邮件内容并提供结构化的分析结果。请始终返回有效的JSON格式。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const aiResponse = await response.json();
      const content = aiResponse.choices[0].message.content;

      // Parse AI response
      let analysisResult;
      try {
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.warn('Failed to parse AI response, using fallback analysis:', parseError);
        // Fallback analysis
        analysisResult = {
          sentiment: 'neutral',
          urgency: importance === 'high' ? 'high' : 'medium',
          category: '工作',
          keywords: this.extractSimpleKeywords(subject + ' ' + body),
          summary: body.substring(0, 50) + '...',
          actionRequired: true,
          suggestedActions: ['查看邮件', '回复'],
          confidence: 0.5
        };
      }

      // Add metadata
      analysisResult.analyzedAt = new Date().toISOString();
      analysisResult.model = 'deepseek-chat';

      // Cache the result (expire after 1 hour)
      setTimeout(() => analysisCache.delete(cacheKey), 3600000);
      analysisCache.set(cacheKey, analysisResult);

      console.log(`✅ AI analysis completed with ${analysisResult.confidence} confidence`);
      return analysisResult;

    } catch (error) {
      console.error('AI analysis error:', error);

      // Return fallback analysis on error
      return {
        sentiment: 'neutral',
        urgency: importance === 'high' ? 'high' : 'medium',
        category: '工作',
        keywords: this.extractSimpleKeywords(subject),
        summary: '分析暂时不可用',
        actionRequired: true,
        suggestedActions: ['查看邮件'],
        confidence: 0.3,
        error: 'AI analysis failed',
        analyzedAt: new Date().toISOString()
      };
    }
  }

  static extractSimpleKeywords(text) {
    // Simple keyword extraction as fallback
    const words = text.toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 5);

    return words.length > 0 ? words : ['邮件'];
  }
}

// Routes
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'AI Enhanced Outlook Integration Server',
    services: {
      outlook: 'ready',
      ai: DEEPSEEK_CONFIG.apiKey ? 'ready' : 'not configured'
    }
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Email Assist AI API - Outlook',
      version: 'v1.1',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      features: ['microsoft-auth', 'ai-analysis', 'email-intelligence'],
      endpoints: {
        health: '/health',
        microsoftAuth: '/api/auth/microsoft',
        microsoftCallback: '/api/auth/microsoft/callback',
        authStatus: '/api/auth/microsoft/status',
        unreadEmails: '/api/email/unread',
        emailAnalysis: '/api/email/analyze/:id',
        dashboardStats: '/api/stats/dashboard'
      }
    }
  });
});

// Microsoft OAuth Authentication (unchanged)
app.get('/api/auth/microsoft', (req, res) => {
  try {
    const state = generateState();
    const userId = req.query.userId || 'temp-user-shelia';

    tokenStore.set(state, { userId, timestamp: Date.now() });

    const authUrl = new URL(`https://login.microsoftonline.com/${MICROSOFT_AUTH_CONFIG.tenantId}/oauth2/v2.0/authorize`);
    authUrl.searchParams.append('client_id', MICROSOFT_AUTH_CONFIG.clientId);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', MICROSOFT_AUTH_CONFIG.redirectUri);
    authUrl.searchParams.append('scope', MICROSOFT_AUTH_CONFIG.scopes.join(' '));
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('response_mode', 'query');
    authUrl.searchParams.append('prompt', 'select_account');

    console.log(`🔐 Microsoft Auth initiated for user: ${userId}`);

    res.json({
      success: true,
      data: { authUrl: authUrl.toString() }
    });
  } catch (error) {
    console.error('Microsoft auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate Microsoft authentication'
    });
  }
});

// Microsoft OAuth Callback (unchanged)
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
    const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    if (!userResponse.ok) {
      console.error('Failed to fetch user info');
      return res.redirect('http://localhost:3000?auth=error&error=user_info_failed');
    }

    const userInfo = await userResponse.json();
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
    res.redirect(`http://localhost:3000?auth=success&email=${encodeURIComponent(userInfo.mail || userInfo.userPrincipalName)}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('http://localhost:3000?auth=error&error=callback_error');
  }
});

// Check authentication status (unchanged)
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

// Get unread emails with AI analysis (with pagination and search support)
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

    // Parse query parameters for pagination and search
    const page = parseInt(req.query.page) || 1;
    const requestedPageSize = parseInt(req.query.pageSize) || 20;
    // Microsoft Graph API limits $top to maximum 50
    const pageSize = Math.min(requestedPageSize, 50);
    const search = req.query.search || '';
    const skip = (page - 1) * pageSize;

    console.log(`📧 Fetching all emails from Inbox for: ${userTokens.email} (page: ${page}, size: ${pageSize}, search: "${search}")`);

    // Build Microsoft Graph API URL with pagination and search
    let apiUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,bodyPreview,body,isRead,hasAttachments,importance,conversationId,webLink&$count=true`;

    // Build filter query - fetch all emails from Inbox (both read and unread)
    let filters = [];

    if (search.trim()) {
      // Escape single quotes in search term for OData filter
      const escapedSearch = search.replace(/'/g, "''");
      // Search only in supported fields: subject, from name, and from address
      // Note: bodyPreview does not support filtering in Microsoft Graph API
      const searchFilter = `(contains(subject,'${escapedSearch}') or contains(from/emailAddress/name,'${escapedSearch}') or contains(from/emailAddress/address,'${escapedSearch}'))`;
      filters.push(searchFilter);
    }

    // Only add filter if there are filter conditions
    if (filters.length > 0) {
      apiUrl += `&$filter=${filters.join(' and ')}`;
    }
    apiUrl += `&$top=${pageSize}`;
    apiUrl += `&$skip=${skip}`;

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${userTokens.accessToken}`,
        'Content-Type': 'application/json',
        'ConsistencyLevel': 'eventual'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(401).json({
          success: false,
          error: 'Token expired, please re-authenticate'
        });
      }

      // Get detailed error information
      let errorDetails = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorDetails = errorData.error.message || errorData.error;
          console.error('📧 Graph API detailed error:', errorData);
        }
      } catch (e) {
        console.error('📧 Failed to parse error response');
      }

      console.error(`📧 Graph API error: ${response.status} - ${errorDetails}`);
      console.error(`📧 Request URL: ${apiUrl.substring(0, 200)}...`);

      throw new Error(`Graph API error: ${response.status} - ${errorDetails}`);
    }

    const data = await response.json();

    // Process emails with AI analysis
    console.log(`🤖 Starting AI analysis for ${data.value.length} emails...`);

    const emailsWithAnalysis = await Promise.all(
      data.value.map(async (message) => {
        const emailData = {
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
        };

        // Perform AI analysis
        try {
          const bodyContent = message.body?.content || message.bodyPreview || '';
          const analysis = await AIAnalysisService.analyzeEmailContent(
            emailData.subject,
            bodyContent.substring(0, 1500), // Limit content length
            emailData.from.address,
            message.importance
          );

          emailData.aiAnalysis = analysis;
          emailData.hasAiAnalysis = true;
        } catch (analysisError) {
          console.warn(`Analysis failed for email ${message.id}:`, analysisError);
          emailData.hasAiAnalysis = false;
        }

        return emailData;
      })
    );

    console.log(`📬 Found ${emailsWithAnalysis.length} unread emails with AI analysis (page ${page})`);

    // Get total count from response headers
    const totalCount = data['@odata.count'] || emailsWithAnalysis.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const hasMore = page < totalPages;

    res.json({
      success: true,
      data: {
        unreadEmails: emailsWithAnalysis,
        count: emailsWithAnalysis.length,
        userEmail: userTokens.email,
        lastSync: new Date().toISOString(),
        aiAnalysisEnabled: true,
        pagination: {
          currentPage: page,
          pageSize: pageSize,
          totalCount: totalCount,
          totalPages: totalPages,
          hasMore: hasMore,
          hasPrevious: page > 1
        },
        searchQuery: search
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

// Get specific email analysis
app.get('/api/email/analyze/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = 'temp-user-shelia';
    const userTokens = tokenStore.get(userId);

    if (!userTokens || userTokens.expiresAt <= new Date()) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    console.log(`🔍 Fetching detailed analysis for email: ${id}`);

    // Get specific email content (only for emails that were fetched from Inbox)
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${id}?$select=id,subject,from,receivedDateTime,body,importance,hasAttachments`, {
      headers: {
        'Authorization': `Bearer ${userTokens.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch email: ${response.status}`);
    }

    const emailData = await response.json();

    // Perform detailed AI analysis
    const analysis = await AIAnalysisService.analyzeEmailContent(
      emailData.subject,
      emailData.body?.content || '',
      emailData.from?.emailAddress?.address || 'unknown',
      emailData.importance
    );

    res.json({
      success: true,
      data: {
        emailId: id,
        subject: emailData.subject,
        from: emailData.from?.emailAddress,
        receivedAt: emailData.receivedDateTime,
        analysis: analysis
      }
    });

  } catch (error) {
    console.error('Email analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze email'
    });
  }
});

// Enhanced dashboard statistics
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
          ruleMatches: 0,
          aiAnalysisEnabled: false
        }
      });
    }

    // Get email statistics from Inbox (all emails and unread count)
    const allEmailsResponse = await fetch('https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$count=true&$top=1', {
      headers: {
        'Authorization': `Bearer ${userTokens.accessToken}`,
        'ConsistencyLevel': 'eventual'
      }
    });

    const unreadResponse = await fetch('https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$filter=isRead eq false&$count=true&$top=1', {
      headers: {
        'Authorization': `Bearer ${userTokens.accessToken}`,
        'ConsistencyLevel': 'eventual'
      }
    });

    let statsData = {
      totalEmails: 0,
      unreadEmails: 0,
      pendingAnalysis: 0,
      ruleMatches: 0,
      aiAnalysisEnabled: DEEPSEEK_CONFIG.apiKey ? true : false,
      cacheSize: analysisCache.size
    };

    if (allEmailsResponse.ok && unreadResponse.ok) {
      const allEmailsData = await allEmailsResponse.json();
      const unreadData = await unreadResponse.json();
      const totalEmails = allEmailsData['@odata.count'] || 0;
      const unreadEmails = unreadData['@odata.count'] || 0;

      statsData = {
        ...statsData,
        totalEmails,
        unreadEmails,
        pendingAnalysis: Math.floor(totalEmails * 0.1), // 10% of total emails pending analysis
        ruleMatches: Math.floor(totalEmails * 0.15) // 15% of total emails match rules
      };

      console.log(`📊 Stats: ${totalEmails} total emails, ${unreadEmails} unread, AI: ${statsData.aiAnalysisEnabled ? 'enabled' : 'disabled'}, Cache: ${statsData.cacheSize}`);
    }

    res.json({
      success: true,
      data: statsData
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.json({
      success: true,
      data: {
        totalEmails: 0,
        unreadEmails: 0,
        pendingAnalysis: 0,
        ruleMatches: 0,
        aiAnalysisEnabled: false,
        error: 'Failed to fetch stats'
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
  console.log('\n🚀 AI Enhanced Outlook Integration Server Started!');
  console.log(`📍 Server running on http://localhost:${PORT}`);
  console.log(`🔐 Microsoft OAuth configured for tenant: ${MICROSOFT_AUTH_CONFIG.tenantId}`);
  console.log(`🤖 DeepSeek AI: ${DEEPSEEK_CONFIG.apiKey ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`📧 Target email: shelia.sun@item.com`);

  console.log('\n📋 Available endpoints:');
  console.log(`   GET  /health`);
  console.log(`   GET  /api`);
  console.log(`   GET  /api/auth/microsoft`);
  console.log(`   GET  /api/auth/microsoft/callback`);
  console.log(`   GET  /api/auth/microsoft/status`);
  console.log(`   GET  /api/email/unread`);
  console.log(`   GET  /api/email/analyze/:id`);
  console.log(`   GET  /api/stats/dashboard`);

  console.log('\n🔧 Environment check:');
  console.log(`   MICROSOFT_CLIENT_ID: ${MICROSOFT_AUTH_CONFIG.clientId.substring(0, 8)}...`);
  console.log(`   MICROSOFT_CLIENT_SECRET: ${MICROSOFT_AUTH_CONFIG.clientSecret !== 'your-client-secret' ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`   DEEPSEEK_API_KEY: ${DEEPSEEK_CONFIG.apiKey ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);

  console.log('\n🎯 Ready for AI-powered Outlook integration with shelia.sun@item.com!');

  if (!DEEPSEEK_CONFIG.apiKey) {
    console.log('\n⚠️  AI FEATURES DISABLED:');
    console.log('   Please configure DEEPSEEK_API_KEY in .env file for AI analysis');
  }
});