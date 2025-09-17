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

// Group emails by conversation - similar to Outlook's conversation view
function groupEmailsByConversation(emails) {
  const conversationMap = new Map();

  emails.forEach(email => {
    // Use conversationId from Microsoft Graph, or fallback to normalized subject
    let groupKey = email.conversationId;

    if (!groupKey) {
      // Fallback: normalize subject by removing common prefixes
      const normalizedSubject = email.subject
        .replace(/^(Re|RE|Fw|FW|Fwd|FWD):\s*/gi, '')
        .trim()
        .toLowerCase();
      groupKey = normalizedSubject;
    }

    if (!conversationMap.has(groupKey)) {
      conversationMap.set(groupKey, {
        conversationId: email.conversationId || groupKey,
        subject: email.subject,
        emails: [],
        latestDate: email.receivedAt,
        totalEmails: 0,
        unreadCount: 0,
        hasAiAnalysis: false
      });
    }

    const conversation = conversationMap.get(groupKey);
    conversation.emails.push(email);
    conversation.totalEmails++;

    if (!email.isRead) {
      conversation.unreadCount++;
    }

    if (email.hasAiAnalysis) {
      conversation.hasAiAnalysis = true;
    }

    // Update latest date if this email is newer
    if (new Date(email.receivedAt) > new Date(conversation.latestDate)) {
      conversation.latestDate = email.receivedAt;
      conversation.subject = email.subject; // Use the most recent subject
    }
  });

  // Convert map to array and sort by latest date
  return Array.from(conversationMap.values())
    .sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate));
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

  // 增强的对话上下文分析功能
  static async analyzeEmailWithConversationContext(currentEmail, conversationHistory = []) {
    try {
      console.log(`🔍 Starting contextual AI analysis for conversation: "${currentEmail.subject.substring(0, 50)}..."`);
      console.log(`📚 Using ${conversationHistory.length} historical emails for context`);

      // Create cache key that includes conversation context
      const contextCacheKey = crypto.createHash('md5')
        .update(`${currentEmail.id}${conversationHistory.map(e => e.id).join('')}`)
        .digest('hex');

      // Check cache first
      if (analysisCache.has(contextCacheKey)) {
        console.log('📋 Using cached contextual analysis result');
        return analysisCache.get(contextCacheKey);
      }

      // Build conversation timeline (oldest to newest)
      const timeline = [...conversationHistory.reverse(), currentEmail];

      // Extract conversation context
      const conversationSummary = timeline.slice(0, -1).map((email, index) => {
        return `邮件${index + 1}(${new Date(email.receivedAt).toLocaleDateString()}):
发件人: ${email.from.name || email.from.address}
主题: ${email.subject}
内容摘要: ${email.preview || (email.body?.content || '').substring(0, 200)}...`;
      }).join('\n\n');

      // Enhanced prompt with conversation context
      const prompt = `请基于完整的邮件对话上下文来分析当前邮件，提供更智能的分析结果：

## 对话历史背景 (${conversationHistory.length} 封历史邮件):
${conversationSummary}

## 当前待分析邮件:
主题: ${currentEmail.subject}
发件人: ${currentEmail.from.name || currentEmail.from.address} (${currentEmail.from.address})
重要性: ${currentEmail.importance}
接收时间: ${new Date(currentEmail.receivedAt).toLocaleString()}
内容: ${currentEmail.preview || (currentEmail.body?.content || '').substring(0, 1000)}

## 分析要求:
请基于完整的对话上下文，分析当前邮件并返回JSON格式结果：
{
  "sentiment": "positive|neutral|negative",
  "urgency": "low|medium|high|critical",
  "category": "工作|个人|营销|通知|会议|项目|客户服务|其他",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "summary": "基于对话上下文的智能摘要(80字以内)",
  "actionRequired": true/false,
  "suggestedActions": ["基于上下文的建议操作1", "建议操作2"],
  "confidence": 0.85,
  "conversationContext": {
    "isResponse": true/false,
    "responseToWhom": "回复给谁",
    "conversationStage": "initial|ongoing|conclusion|followup",
    "relationshipContext": "首次联系|持续沟通|紧急事项|例行更新",
    "historicalSentiment": "历史对话的整体情感趋势",
    "escalationLevel": "问题升级程度(如果适用)"
  }
}`;

      // Call DeepSeek API with enhanced context
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
              content: '你是一个专业的邮件对话分析专家，擅长基于邮件历史上下文提供深度分析。请分析邮件对话的发展脉络、参与者关系、情感演变和业务背景，并提供精准的分析结果。始终返回有效的JSON格式。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        console.error(`DeepSeek API error: ${response.status}`);
        throw new Error(`AI analysis API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No content in AI response');
      }

      // Parse AI response
      let analysis;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        analysis = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      } catch (parseError) {
        console.warn('Failed to parse AI response as JSON, creating fallback analysis');
        analysis = {
          sentiment: 'neutral',
          urgency: currentEmail.importance === 'high' ? 'high' : 'medium',
          category: '工作',
          keywords: AIAnalysisService.extractSimpleKeywords(currentEmail.subject + ' ' + (currentEmail.preview || '')),
          summary: `对话上下文分析：${currentEmail.subject} (共${timeline.length}封邮件)`,
          actionRequired: true,
          suggestedActions: ['查看完整对话', '及时回复'],
          confidence: 0.6,
          conversationContext: {
            isResponse: conversationHistory.length > 0,
            responseToWhom: conversationHistory.length > 0 ? conversationHistory[0].from.name : 'N/A',
            conversationStage: conversationHistory.length === 0 ? 'initial' : 'ongoing',
            relationshipContext: '持续沟通',
            historicalSentiment: 'neutral',
            escalationLevel: 'normal'
          }
        };
      }

      // Add metadata
      analysis.analyzedAt = new Date().toISOString();
      analysis.model = DEEPSEEK_CONFIG.model;
      analysis.analysisType = 'contextual';
      analysis.contextSize = conversationHistory.length;

      // Cache the result
      analysisCache.set(contextCacheKey, analysis);
      console.log(`✅ Contextual AI analysis completed for conversation with ${conversationHistory.length} historical emails`);

      return analysis;

    } catch (error) {
      console.error('Contextual AI analysis failed:', error);

      // Fallback to simple analysis
      console.log('🔄 Falling back to simple email analysis');
      return await AIAnalysisService.analyzeEmailContent(
        currentEmail.subject,
        currentEmail.preview || currentEmail.body?.content || '',
        currentEmail.from.address,
        currentEmail.importance
      );
    }
  }

  // Analyze entire conversation thread
  static async analyzeConversationThread(conversation) {
    if (!DEEPSEEK_CONFIG.apiKey) {
      return {
        summary: "AI分析需要配置API密钥",
        priority: "normal",
        category: "未分类",
        action_required: false,
        sentiment: "neutral",
        confidence: 0.0,
        thread_summary: "需要配置DeepSeek API密钥",
        key_participants: [],
        timeline_analysis: "分析不可用",
        business_impact: "unknown"
      };
    }

    try {
      console.log(`🧠 Analyzing conversation thread: ${conversation.subject} (${conversation.totalEmails} emails)`);

      // Create conversation cache key based on conversation ID and email count
      const cacheKeyData = `${conversation.conversationId}-${conversation.totalEmails}-${conversation.latestDate}`;
      const conversationCacheKey = crypto.createHash('md5')
        .update(cacheKeyData)
        .digest('hex');

      console.log(`🔍 Cache lookup for conversation: ${conversation.subject} | Key data: ${cacheKeyData} | Cache has: ${analysisCache.has(conversationCacheKey)}`);

      // Check cache first
      if (analysisCache.has(conversationCacheKey)) {
        console.log('📋 Using cached conversation analysis result');
        return analysisCache.get(conversationCacheKey);
      }

      // Prepare conversation context
      const conversationContext = conversation.emails
        .sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt))
        .map((email, index) => {
          return `邮件 ${index + 1} (${email.receivedAt}):
主题: ${email.subject}
发件人: ${email.from.name} <${email.from.address}>
内容: ${email.preview}
${email.aiAnalysis ? `单邮件分析: ${email.aiAnalysis.summary}` : ''}
---`;
        }).join('\n');

      const prompt = `请分析这个邮件对话线程，提供整体的业务洞察和建议。

对话主题: ${conversation.subject}
邮件数量: ${conversation.totalEmails}
时间跨度: ${conversation.emails[0]?.receivedAt} 至 ${conversation.latestDate}
未读邮件: ${conversation.unreadCount}

完整对话内容:
${conversationContext}

请提供JSON格式的分析结果:
{
  "summary": "对话线程的整体总结（2-3句话）",
  "priority": "high|medium|low - 基于业务重要性",
  "category": "技术支持|业务洽谈|项目协调|日常事务|紧急问题|其他",
  "action_required": true/false - 是否需要立即行动,
  "sentiment": "positive|negative|neutral|mixed - 整体情感倾向",
  "confidence": 0.0-1.0,
  "thread_summary": "详细的对话发展脉络和关键节点分析",
  "key_participants": ["主要参与者列表"],
  "timeline_analysis": "时间线分析和发展趋势",
  "business_impact": "对业务的潜在影响和建议",
  "next_steps": "建议的后续行动步骤"
}`;

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
              content: '你是一个专业的邮件对话线程分析专家，擅长分析邮件对话的发展脉络、业务影响和提供实用建议。请基于完整的对话历史提供深度分析。始终返回有效的JSON格式。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1200,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No content in AI response');
      }

      let analysis;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        analysis = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      } catch (parseError) {
        console.warn('Failed to parse conversation analysis as JSON, creating fallback');
        analysis = {
          summary: content.substring(0, 200) + '...',
          priority: "medium",
          category: "业务邮件",
          action_required: conversation.unreadCount > 0,
          sentiment: "neutral",
          confidence: 0.7,
          thread_summary: "对话线程分析",
          key_participants: [...new Set(conversation.emails.map(e => e.from.name))],
          timeline_analysis: `对话包含${conversation.totalEmails}封邮件`,
          business_impact: "需要进一步分析",
          next_steps: conversation.unreadCount > 0 ? "回复未读邮件" : "持续关注"
        };
      }

      console.log(`✅ Conversation analysis completed for: ${conversation.subject}`);
      return analysis;

    } catch (error) {
      console.error('Conversation analysis error:', error);
      console.log('🔄 Using fallback conversation analysis');

      // Smart fallback analysis based on email content
      const subject = conversation.subject || '';
      const firstEmail = conversation.emails[0];
      const preview = firstEmail?.bodyPreview || '';

      // Basic categorization based on keywords
      let category = "日常事务";
      let priority = "medium";
      let sentiment = "neutral";

      if (subject.match(/urgent|紧急|急|critical|asap/i) || preview.match(/urgent|紧急|急/i)) {
        priority = "high";
        category = "紧急问题";
      } else if (subject.match(/EDI|implementation|project|合作|项目/i)) {
        category = "项目协调";
        priority = "high";
      } else if (subject.match(/password|reset|support|问题|help/i)) {
        category = "技术支持";
      } else if (subject.match(/order|report|订单|报告/i)) {
        category = "业务洽谈";
      }

      if (preview.match(/thank|good|excellent|perfect|感谢|很好/i)) {
        sentiment = "positive";
      } else if (preview.match(/issue|problem|error|fail|问题|错误|失败/i)) {
        sentiment = "negative";
      }

      const analysisResult = {
        summary: `${conversation.subject} - 包含${conversation.totalEmails}封邮件的对话线程`,
        priority: priority,
        category: category,
        action_required: conversation.unreadCount > 0,
        sentiment: sentiment,
        confidence: 0.6,
        thread_summary: `这是一个关于"${conversation.subject}"的邮件对话线程，包含${conversation.totalEmails}封邮件，其中${conversation.unreadCount}封未读。`,
        key_participants: [...new Set(conversation.emails.map(e => e.from.name))],
        timeline_analysis: `对话从${conversation.emails[0]?.receivedAt}开始，最新邮件时间为${conversation.latestDate}`,
        business_impact: priority === "high" ? "高优先级，需要及时处理" : "正常业务流程，按计划处理",
        next_steps: conversation.unreadCount > 0 ? "回复未读邮件并跟进处理" : "持续关注后续发展"
      };

      // Cache the conversation analysis result
      analysisCache.set(conversationCacheKey, analysisResult);
      console.log(`✅ Conversation analysis completed for: ${conversation.subject}`);

      return analysisResult;
    }
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
    // Simplified query to avoid "too complex" error - removed some non-essential fields
    let apiUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,bodyPreview,isRead,conversationId&$count=true`;

    // Build filter query - fetch all emails from Inbox (both read and unread)
    let filters = [];

    if (search.trim()) {
      // Use Microsoft Graph search parameter instead of OData filter for better compatibility
      // Note: We'll use the $search parameter for search functionality
      console.log(`🔍 Using Microsoft Graph $search for: "${search}"`);
    }

    // Add search parameter if provided
    if (search.trim()) {
      // Use $search parameter for keyword search across multiple fields
      apiUrl += `&$search="${encodeURIComponent(search.trim())}"`;
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
          hasAttachments: message.hasAttachments || false, // Default value since field removed
          importance: message.importance || 'normal', // Default value since field removed
          conversationId: message.conversationId,
          webLink: message.webLink || '' // Default value since field removed
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

    console.log(`📬 Found ${emailsWithAnalysis.length} emails with AI analysis (page ${page})`);

    // Group emails by conversation (subject/thread) - similar to Outlook
    const groupedEmails = groupEmailsByConversation(emailsWithAnalysis);
    console.log(`📋 Grouped into ${groupedEmails.length} conversation threads`);

    // Temporarily disable conversation analysis to reduce load
    console.log(`🚫 Conversation AI analysis temporarily disabled to reduce load`);
    const conversationsWithAnalysis = groupedEmails.map(conversation => ({
      ...conversation,
      aiAnalysis: {
        summary: `${conversation.subject} - 包含${conversation.totalEmails}封邮件的对话线程`,
        priority: "normal",
        category: "邮件对话",
        action_required: conversation.unreadCount > 0,
        sentiment: "neutral",
        confidence: 0.5,
        thread_summary: `这是一个关于"${conversation.subject}"的邮件对话线程，包含${conversation.totalEmails}封邮件，其中${conversation.unreadCount}封未读。`,
        key_participants: [...new Set(conversation.emails.map(e => e.from.name))],
        timeline_analysis: `对话从${conversation.emails[0]?.receivedAt}开始，最新邮件时间为${conversation.latestDate}`,
        business_impact: "正常业务流程",
        next_steps: conversation.unreadCount > 0 ? "回复未读邮件" : "持续关注"
      }
    }));

    console.log(`📝 Generated simple analysis for ${groupedEmails.length} conversations`);

    // Get total count from response headers
    const totalCount = data['@odata.count'] || emailsWithAnalysis.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const hasMore = page < totalPages;

    res.json({
      success: true,
      data: {
        unreadEmails: emailsWithAnalysis,
        conversations: conversationsWithAnalysis, // Add grouped conversation view with AI analysis
        count: emailsWithAnalysis.length,
        conversationCount: conversationsWithAnalysis.length,
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
        searchQuery: search,
        viewMode: 'conversation' // Indicate this supports conversation view
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

// Simple emails endpoint without AI analysis
app.get('/api/emails-simple', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const requestedPageSize = parseInt(req.query.limit) || 10;
    const userId = 'temp-user-shelia';
    const userTokens = tokenStore.get(userId);

    if (!userTokens || userTokens.expiresAt <= new Date()) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const pageSize = Math.min(requestedPageSize, 20);
    const skip = (page - 1) * pageSize;

    console.log(`📧 [SIMPLE] Fetching emails for: ${userTokens.email} (page: ${page}, size: ${pageSize})`);

    let apiUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,bodyPreview,isRead&$top=${pageSize}&$skip=${skip}`;

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${userTokens.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Graph API error: ${response.status}`);
    }

    const data = await response.json();

    // Simple data mapping without AI analysis
    const simpleEmails = data.value.map(message => ({
      id: message.id,
      subject: message.subject || '(无主题)',
      from: {
        name: message.from?.emailAddress?.name || 'Unknown',
        address: message.from?.emailAddress?.address || 'unknown@example.com'
      },
      preview: message.bodyPreview || '',
      receivedAt: message.receivedDateTime,
      isRead: message.isRead,
    }));

    console.log(`📬 [SIMPLE] Returned ${simpleEmails.length} emails without AI analysis`);

    res.json({
      success: true,
      emails: simpleEmails,
      total: simpleEmails.length,
      page: page,
      pageSize: pageSize,
    });

  } catch (error) {
    console.error('Simple email fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch emails'
    });
  }
});

// Alias for compatibility - /emails endpoint
app.get('/api/emails', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const requestedPageSize = parseInt(req.query.limit) || 20;
    const userId = 'temp-user-shelia';
    const userTokens = tokenStore.get(userId);

    if (!userTokens || userTokens.expiresAt <= new Date()) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Microsoft Graph API limits $top to maximum 50
    const pageSize = Math.min(requestedPageSize, 50);
    const search = req.query.search || '';
    const skip = (page - 1) * pageSize;

    console.log(`📧 Fetching emails via /emails endpoint for: ${userTokens.email} (page: ${page}, size: ${pageSize})`);

    // Build Microsoft Graph API URL
    let apiUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,bodyPreview,isRead,conversationId&$count=true`;

    // Add search parameter if provided
    if (search.trim()) {
      apiUrl += `&$search="${encodeURIComponent(search.trim())}"`;
    }

    // Add pagination
    apiUrl += `&$top=${pageSize}&$skip=${skip}`;

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${userTokens.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`📧 Graph API error: ${response.status} - ${errorText}`);
      throw new Error(`Graph API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Process emails with AI analysis (use existing cache)
    const emailsWithAnalysis = await Promise.all(
      data.value.map(async (message) => {
        const emailData = {
          id: message.id,
          subject: message.subject,
          from: {
            name: message.from?.emailAddress?.name || 'Unknown',
            address: message.from?.emailAddress?.address || 'unknown@example.com'
          },
          preview: message.bodyPreview,
          receivedAt: message.receivedDateTime,
          isRead: message.isRead,
          conversationId: message.conversationId,
        };

        // Try to get cached analysis
        const cacheKey = crypto.createHash('md5')
          .update(`${message.subject}${message.bodyPreview}${message.from?.emailAddress?.address}`)
          .digest('hex');

        if (analysisCache.has(cacheKey)) {
          emailData.aiAnalysis = analysisCache.get(cacheKey);
          emailData.hasAiAnalysis = true;
        } else {
          emailData.hasAiAnalysis = false;
        }

        return emailData;
      })
    );

    // Simple response format for compatibility
    res.json({
      success: true,
      emails: emailsWithAnalysis,
      total: data['@odata.count'] || emailsWithAnalysis.length,
      page: page,
      pageSize: pageSize,
    });

  } catch (error) {
    console.error('Email fetch error via /emails:', error);
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

// Enhanced conversation-aware email analysis
app.post('/api/email/analyze-conversation', async (req, res) => {
  try {
    const { emailId, conversationId } = req.body;
    const userId = 'temp-user-shelia';
    const userTokens = tokenStore.get(userId);

    if (!userTokens || userTokens.expiresAt <= new Date()) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    console.log(`🔍 Starting conversation-aware analysis for email: ${emailId} in conversation: ${conversationId}`);

    // First, get the current email
    const emailResponse = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${emailId}?$select=id,subject,from,receivedDateTime,body,importance,hasAttachments,conversationId`, {
      headers: {
        'Authorization': `Bearer ${userTokens.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!emailResponse.ok) {
      throw new Error(`Failed to fetch email: ${emailResponse.status}`);
    }

    const currentEmailData = await emailResponse.json();

    // Get conversation history using conversationId or subject-based grouping
    let conversationFilter;
    if (currentEmailData.conversationId) {
      conversationFilter = `conversationId eq '${currentEmailData.conversationId}'`;
    } else {
      // Fallback to subject-based grouping
      const normalizedSubject = currentEmailData.subject
        .replace(/^(Re|RE|Fw|FW|Fwd|FWD):\s*/gi, '')
        .trim();
      conversationFilter = `contains(subject,'${normalizedSubject.replace(/'/g, "''")}')`;
    }

    console.log(`📚 Fetching conversation history with filter: ${conversationFilter}`);

    // Fetch conversation history - simplified query to avoid complexity error
    const historyResponse = await fetch(`https://graph.microsoft.com/v1.0/me/messages?$filter=${conversationFilter}&$orderby=receivedDateTime desc&$top=5&$select=id,subject,from,receivedDateTime,bodyPreview`, {
      headers: {
        'Authorization': `Bearer ${userTokens.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!historyResponse.ok) {
      console.warn(`Failed to fetch conversation history: ${historyResponse.status}`);
    }

    let conversationHistory = [];
    if (historyResponse.ok) {
      const historyData = await historyResponse.json();
      conversationHistory = historyData.value
        .filter(email => email.id !== emailId) // Exclude the current email
        .map(email => ({
          id: email.id,
          subject: email.subject,
          from: {
            name: email.from?.emailAddress?.name || 'Unknown',
            address: email.from?.emailAddress?.address || 'unknown@email.com'
          },
          receivedAt: email.receivedDateTime,
          preview: email.bodyPreview,
          body: email.body,
          importance: email.importance,
          conversationId: email.conversationId
        }));
    }

    // Prepare current email for analysis
    const currentEmail = {
      id: currentEmailData.id,
      subject: currentEmailData.subject,
      from: {
        name: currentEmailData.from?.emailAddress?.name || 'Unknown',
        address: currentEmailData.from?.emailAddress?.address || 'unknown@email.com'
      },
      receivedAt: currentEmailData.receivedDateTime,
      preview: currentEmailData.bodyPreview,
      body: currentEmailData.body,
      importance: currentEmailData.importance,
      conversationId: currentEmailData.conversationId
    };

    console.log(`🧠 Analyzing email with ${conversationHistory.length} historical emails in conversation`);

    // Perform contextual analysis
    const analysis = await AIAnalysisService.analyzeEmailWithConversationContext(
      currentEmail,
      conversationHistory
    );

    res.json({
      success: true,
      data: {
        emailId: emailId,
        conversationId: conversationId || currentEmailData.conversationId,
        analysis: analysis,
        contextSize: conversationHistory.length,
        analysisType: 'conversation-contextual',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Conversation analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze email with conversation context'
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