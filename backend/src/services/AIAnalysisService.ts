/**
 * AI Analysis Service
 * 集成DeepSeek API进行邮件内容智能分析
 */

import OpenAI from 'openai';
import natural from 'natural';
import compromise from 'compromise';
import config, { DEEPSEEK_CONFIG, AI_CONFIG } from '@/config';
import logger from '@/utils/logger';
import {
  SentimentAnalysis,
  PriorityAnalysis,
  CategoryAnalysis,
  EntityAnalysis,
  SuggestedAction
} from '@/models/EmailAnalysis';

export interface EmailContent {
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  from: {
    name: string;
    email: string;
  };
  to: Array<{
    name: string;
    email: string;
  }>;
  receivedAt: Date;
}

export interface AnalysisResult {
  sentiment: SentimentAnalysis;
  priority: PriorityAnalysis;
  category: CategoryAnalysis;
  keywords: string[];
  entities: EntityAnalysis[];
  summary: string;
  suggestedActions: SuggestedAction[];
  processingTime: number;
}

export class AIAnalysisService {
  private openai: OpenAI;
  private stemmer: any;
  private sentiment: any;

  constructor() {
    this.openai = new OpenAI({
      apiKey: DEEPSEEK_CONFIG.API_KEY,
      baseURL: DEEPSEEK_CONFIG.BASE_URL,
    });
    
    // 初始化自然语言处理工具
    this.stemmer = natural.PorterStemmer;
    this.sentiment = new natural.SentimentAnalyzer(
      'English',
      natural.PorterStemmer,
      'afinn'
    );
  }

  /**
   * 分析邮件内容
   */
  async analyzeEmail(emailContent: EmailContent): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      logger.info('Starting email analysis', { 
        subject: emailContent.subject,
        from: emailContent.from.email 
      });

      // 预处理邮件内容
      const processedContent = this.preprocessContent(emailContent);

      // 并行执行各种分析
      const [
        sentiment,
        priority,
        category,
        keywords,
        entities,
        summary,
        suggestedActions
      ] = await Promise.all([
        this.analyzeSentiment(processedContent),
        this.analyzePriority(emailContent, processedContent),
        this.analyzeCategory(processedContent),
        this.extractKeywords(processedContent),
        this.extractEntities(processedContent),
        this.generateSummary(emailContent, processedContent),
        this.suggestActions(emailContent, processedContent)
      ]);

      const processingTime = Date.now() - startTime;

      logger.info('Email analysis completed', {
        subject: emailContent.subject,
        priority: priority.level,
        sentiment: sentiment.label,
        processingTime
      });

      return {
        sentiment,
        priority,
        category,
        keywords,
        entities,
        summary,
        suggestedActions,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Email analysis failed', { 
        error, 
        subject: emailContent.subject,
        processingTime 
      });
      throw error;
    }
  }

  /**
   * 预处理邮件内容
   */
  private preprocessContent(emailContent: EmailContent): string {
    let content = emailContent.subject || '';
    
    if (emailContent.bodyText) {
      content += '\n\n' + emailContent.bodyText;
    } else if (emailContent.bodyHtml) {
      // 简单的HTML标签移除
      const textContent = emailContent.bodyHtml
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      content += '\n\n' + textContent;
    }

    // 清理和标准化文本
    return content
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\.\,\!\?\-\@]/g, '')
      .trim();
  }

  /**
   * 情感分析
   */
  private async analyzeSentiment(content: string): Promise<SentimentAnalysis> {
    try {
      const prompt = `
        Analyze the sentiment of the following email content and provide a detailed emotional breakdown.
        
        Email content: "${content}"
        
        Please respond with a JSON object containing:
        {
          "label": "positive|negative|neutral",
          "confidence": 0.0-1.0,
          "emotions": {
            "joy": 0.0-1.0,
            "anger": 0.0-1.0,
            "fear": 0.0-1.0,
            "sadness": 0.0-1.0
          }
        }
        
        Consider context, tone, and emotional indicators in the text.
      `;

      const response = await this.openai.chat.completions.create({
        model: DEEPSEEK_CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: DEEPSEEK_CONFIG.MAX_TOKENS,
        temperature: DEEPSEEK_CONFIG.TEMPERATURE,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      // 验证和标准化结果
      return {
        label: this.validateSentimentLabel(result.label),
        confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
        emotions: {
          joy: Math.max(0, Math.min(1, result.emotions?.joy || 0)),
          anger: Math.max(0, Math.min(1, result.emotions?.anger || 0)),
          fear: Math.max(0, Math.min(1, result.emotions?.fear || 0)),
          sadness: Math.max(0, Math.min(1, result.emotions?.sadness || 0))
        }
      };

    } catch (error) {
      logger.error('Sentiment analysis failed', { error });
      
      // 回退到基础情感分析
      return this.fallbackSentimentAnalysis(content);
    }
  }

  /**
   * 优先级分析
   */
  private async analyzePriority(
    emailContent: EmailContent, 
    processedContent: string
  ): Promise<PriorityAnalysis> {
    try {
      const contextInfo = {
        sender: emailContent.from.email,
        subject: emailContent.subject,
        receivedAt: emailContent.receivedAt.toISOString(),
        recipientCount: emailContent.to.length
      };

      const prompt = `
        Analyze the priority level of this email based on content, context, and urgency indicators.
        
        Email context:
        - Sender: ${contextInfo.sender}
        - Subject: ${contextInfo.subject}
        - Received: ${contextInfo.receivedAt}
        - Recipients: ${contextInfo.recipientCount}
        
        Email content: "${processedContent}"
        
        Consider these factors:
        - Urgency words (urgent, ASAP, deadline, emergency)
        - Business impact keywords
        - Sender authority/importance
        - Time sensitivity
        - Action requirements
        
        Respond with JSON:
        {
          "level": "critical|high|medium|low",
          "confidence": 0.0-1.0,
          "reasons": ["reason1", "reason2", ...]
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: DEEPSEEK_CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: DEEPSEEK_CONFIG.MAX_TOKENS,
        temperature: DEEPSEEK_CONFIG.TEMPERATURE,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      return {
        level: this.validatePriorityLevel(result.level),
        confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
        reasons: Array.isArray(result.reasons) ? result.reasons : []
      };

    } catch (error) {
      logger.error('Priority analysis failed', { error });
      
      // 回退到基于关键词的优先级分析
      return this.fallbackPriorityAnalysis(processedContent);
    }
  }

  /**
   * 分类分析
   */
  private async analyzeCategory(content: string): Promise<CategoryAnalysis> {
    try {
      const prompt = `
        Classify this email content into appropriate business categories.
        
        Email content: "${content}"
        
        Common categories include:
        - Project Management
        - Customer Support
        - Sales & Marketing
        - Human Resources
        - Finance & Accounting
        - Technical Support
        - Internal Communication
        - External Communication
        - Meetings & Events
        - Legal & Compliance
        
        Respond with JSON:
        {
          "primary": "primary_category",
          "secondary": "secondary_category_if_applicable",
          "confidence": 0.0-1.0
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: DEEPSEEK_CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: DEEPSEEK_CONFIG.MAX_TOKENS,
        temperature: DEEPSEEK_CONFIG.TEMPERATURE,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      return {
        primary: result.primary || 'General',
        secondary: result.secondary,
        confidence: Math.max(0, Math.min(1, result.confidence || 0.5))
      };

    } catch (error) {
      logger.error('Category analysis failed', { error });
      
      return {
        primary: 'General',
        confidence: 0.3
      };
    }
  }

  /**
   * 关键词提取
   */
  private async extractKeywords(content: string): Promise<string[]> {
    try {
      // 使用compromise进行关键词提取
      const doc = compromise(content);
      
      // 提取重要的名词、形容词和专有名词
      const nouns = doc.nouns().out('array');
      const adjectives = doc.adjectives().out('array');
      const topics = doc.topics().out('array');
      
      // 合并并去重
      const allKeywords = [...nouns, ...adjectives, ...topics];
      const uniqueKeywords = [...new Set(allKeywords)];
      
      // 过滤和清理关键词
      const filteredKeywords = uniqueKeywords
        .filter(keyword => keyword.length > 2)
        .filter(keyword => !this.isStopWord(keyword))
        .map(keyword => keyword.toLowerCase())
        .slice(0, 15); // 限制关键词数量

      return filteredKeywords;

    } catch (error) {
      logger.error('Keyword extraction failed', { error });
      return [];
    }
  }

  /**
   * 实体识别
   */
  private async extractEntities(content: string): Promise<EntityAnalysis[]> {
    try {
      const prompt = `
        Extract named entities from this email content.
        
        Email content: "${content}"
        
        Find and classify entities as:
        - person: People names
        - organization: Company/organization names
        - location: Places, cities, countries
        - datetime: Dates, times, deadlines
        - project: Project names or references
        - task: Specific tasks or actions mentioned
        
        Respond with JSON array:
        [
          {
            "type": "entity_type",
            "value": "entity_value",
            "confidence": 0.0-1.0
          }
        ]
        
        Only include entities with confidence > 0.7
      `;

      const response = await this.openai.chat.completions.create({
        model: DEEPSEEK_CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: DEEPSEEK_CONFIG.MAX_TOKENS,
        temperature: DEEPSEEK_CONFIG.TEMPERATURE,
      });

      const result = JSON.parse(response.choices[0].message.content || '[]');
      
      return Array.isArray(result) ? result : [];

    } catch (error) {
      logger.error('Entity extraction failed', { error });
      return [];
    }
  }

  /**
   * 摘要生成
   */
  private async generateSummary(
    emailContent: EmailContent, 
    processedContent: string
  ): Promise<string> {
    try {
      const prompt = `
        Generate a concise, professional summary of this email.
        
        Email metadata:
        - From: ${emailContent.from.name} <${emailContent.from.email}>
        - Subject: ${emailContent.subject}
        
        Email content: "${processedContent}"
        
        Create a 1-2 sentence summary that captures:
        - Main purpose/request
        - Key action items or information
        - Important deadlines or context
        
        Keep it under 150 characters and professional.
      `;

      const response = await this.openai.chat.completions.create({
        model: DEEPSEEK_CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.3,
      });

      const summary = response.choices[0].message.content?.trim() || '';
      
      // 确保摘要不为空且长度合理
      if (summary.length === 0) {
        return this.fallbackSummary(emailContent);
      }
      
      return summary.length > 200 ? summary.substring(0, 197) + '...' : summary;

    } catch (error) {
      logger.error('Summary generation failed', { error });
      return this.fallbackSummary(emailContent);
    }
  }

  /**
   * 建议操作生成
   */
  private async suggestActions(
    emailContent: EmailContent,
    processedContent: string
  ): Promise<SuggestedAction[]> {
    try {
      const prompt = `
        Suggest appropriate actions for this email based on its content and context.
        
        Email from: ${emailContent.from.name} <${emailContent.from.email}>
        Subject: ${emailContent.subject}
        Content: "${processedContent}"
        
        Consider these action types:
        - reply: Needs a response
        - forward: Should be forwarded to someone
        - create_task: Requires creating a task/todo
        - escalate: Needs manager/team attention
        - archive: Can be archived (FYI only)
        - schedule: Needs scheduling/calendar action
        
        Respond with JSON array (max 3 actions):
        [
          {
            "type": "action_type",
            "description": "brief description of action",
            "priority": 1-5 (1=highest)
          }
        ]
      `;

      const response = await this.openai.chat.completions.create({
        model: DEEPSEEK_CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: DEEPSEEK_CONFIG.MAX_TOKENS,
        temperature: DEEPSEEK_CONFIG.TEMPERATURE,
      });

      const result = JSON.parse(response.choices[0].message.content || '[]');
      
      return Array.isArray(result) ? result.slice(0, 3) : [];

    } catch (error) {
      logger.error('Action suggestion failed', { error });
      return this.fallbackActions(emailContent);
    }
  }

  /**
   * 批量分析邮件
   */
  async analyzeEmailsBatch(emails: EmailContent[]): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    const batchSize = AI_CONFIG.BATCH_SIZE || 5;

    logger.info('Starting batch email analysis', { count: emails.length });

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      try {
        const batchResults = await Promise.all(
          batch.map(email => this.analyzeEmail(email))
        );
        
        results.push(...batchResults);
        
        // 短暂延迟避免API限制
        if (i + batchSize < emails.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        logger.error('Batch analysis failed', { error, batchIndex: i });
        
        // 对失败的批次逐个处理
        for (const email of batch) {
          try {
            const result = await this.analyzeEmail(email);
            results.push(result);
          } catch (emailError) {
            logger.error('Individual email analysis failed', { 
              error: emailError, 
              subject: email.subject 
            });
          }
        }
      }
    }

    logger.info('Batch email analysis completed', { 
      total: emails.length, 
      successful: results.length 
    });

    return results;
  }

  // 工具方法

  private validateSentimentLabel(label: string): 'positive' | 'negative' | 'neutral' {
    const validLabels = ['positive', 'negative', 'neutral'];
    return validLabels.includes(label) ? label as any : 'neutral';
  }

  private validatePriorityLevel(level: string): 'critical' | 'high' | 'medium' | 'low' {
    const validLevels = ['critical', 'high', 'medium', 'low'];
    return validLevels.includes(level) ? level as any : 'medium';
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over',
      'under', 'again', 'further', 'then', 'once'
    ]);
    return stopWords.has(word.toLowerCase());
  }

  // 回退方法

  private fallbackSentimentAnalysis(content: string): SentimentAnalysis {
    const words = new natural.WordTokenizer().tokenize(content.toLowerCase()) || [];
    const stems = words.map(word => this.stemmer.stem(word));
    const score = this.sentiment.getSentiment(stems);
    
    let label: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (score > 0.1) label = 'positive';
    else if (score < -0.1) label = 'negative';

    return {
      label,
      confidence: Math.min(0.8, Math.abs(score) + 0.3),
      emotions: {
        joy: label === 'positive' ? Math.max(0, score) : 0,
        anger: label === 'negative' ? Math.abs(Math.min(0, score)) : 0,
        fear: 0,
        sadness: label === 'negative' ? Math.abs(Math.min(0, score)) * 0.5 : 0
      }
    };
  }

  private fallbackPriorityAnalysis(content: string): PriorityAnalysis {
    const urgentKeywords = ['urgent', 'asap', 'emergency', 'critical', 'deadline', 'important'];
    const highKeywords = ['soon', 'quickly', 'priority', 'needed', 'required'];
    
    const lowerContent = content.toLowerCase();
    const urgentCount = urgentKeywords.filter(keyword => lowerContent.includes(keyword)).length;
    const highCount = highKeywords.filter(keyword => lowerContent.includes(keyword)).length;

    let level: 'critical' | 'high' | 'medium' | 'low' = 'medium';
    let confidence = 0.5;

    if (urgentCount > 0) {
      level = urgentCount > 1 ? 'critical' : 'high';
      confidence = 0.7;
    } else if (highCount > 0) {
      level = 'medium';
      confidence = 0.6;
    } else {
      level = 'low';
      confidence = 0.4;
    }

    return {
      level,
      confidence,
      reasons: urgentCount > 0 ? ['Contains urgency keywords'] : ['No urgency indicators found']
    };
  }

  private fallbackSummary(emailContent: EmailContent): string {
    const subject = emailContent.subject || 'No subject';
    const sender = emailContent.from.name || emailContent.from.email;
    return `Email from ${sender}: ${subject}`;
  }

  private fallbackActions(emailContent: EmailContent): SuggestedAction[] {
    const hasQuestion = /\?/.test(emailContent.subject + ' ' + (emailContent.bodyText || ''));
    
    const actions: SuggestedAction[] = [
      {
        type: 'reply',
        description: hasQuestion ? 'Response needed' : 'Acknowledge receipt',
        priority: hasQuestion ? 2 : 4
      }
    ];

    return actions;
  }
}

export default new AIAnalysisService();