/**
 * Email Content Processor Service
 * 邮件内容解析和处理服务 - 结构化邮件数据并触发AI分析
 */

import DatabaseManager from '@/config/database';
import EmailMessageModel from '@/models/EmailMessage';

export interface EmailMessageData {
  id: string;
  subject: string;
  sender: string;
  body: string;
  receivedAt: Date;
  isRead: boolean;
  importance: 'low' | 'normal' | 'high';
  hasAttachments: boolean;
  attachments?: Array<{
    id: string;
    name: string;
    contentType: string;
    size: number;
  }>;
  
  // 添加缺失的属性
  body_html?: string;
  body_text?: string;
  preview_text?: string;
  sender_name?: string;
  sender_email?: string;
  recipients?: Array<{ name: string; email: string }>;
  received_at?: Date;
  account_id?: string;
  folder_id?: string;
  message_id?: string;
  internet_message_id?: string;
  thread_id?: string;
  conversation_id?: string;
  cc_recipients?: Array<{ name: string; email: string }>;
}
import EmailAnalysisCacheModel, { EmailAnalysisData, EntityData } from '@/models/EmailAnalysisCache';
import AIAnalysisService, { EmailContent, AnalysisResult } from './AIAnalysisService';
import logger from '@/utils/logger';
import { Pool } from 'pg';
import parseHTML from 'node-html-parser';
import compromise from 'compromise';

export interface ProcessingOptions {
  enable_ai_analysis?: boolean;
  extract_entities?: boolean;
  detect_language?: boolean;
  parse_attachments?: boolean;
  generate_summary?: boolean;
  batch_processing?: boolean;
  max_batch_size?: number;
}

export interface ProcessingResult {
  success: boolean;
  message_id: string;
  processed_content?: ProcessedEmailContent;
  analysis_result?: EmailAnalysisData;
  processing_duration_ms: number;
  errors?: string[];
}

export interface ProcessedEmailContent {
  plain_text: string;
  cleaned_html?: string;
  extracted_links: string[];
  extracted_emails: string[];
  extracted_phones: string[];
  key_phrases: string[];
  language_detected?: string;
  word_count: number;
  reading_time_minutes: number;
  has_signature: boolean;
  signature_content?: string;
}

export interface BatchProcessingResult {
  total_processed: number;
  successful: number;
  failed: number;
  processing_duration_ms: number;
  results: ProcessingResult[];
  error_summary?: Record<string, number>;
}

export class EmailContentProcessor {
  private static instance: EmailContentProcessor;
  private pool: Pool;
  private emailMessageModel: EmailMessageModel;
  private analysisModel: EmailAnalysisCacheModel;
  private aiAnalysisService: any;

  // 常见邮件签名标识符
  private readonly signatureIndicators = [
    'Best regards', '最好的祝福', 'Sincerely', 'Thank you', '谢谢',
    'Kind regards', 'Yours truly', 'Sent from my iPhone', '发自我的iPhone',
    'This email was sent from', '--', '___', '***'
  ];

  private constructor() {
    this.pool = DatabaseManager.getPool();
    this.emailMessageModel = new EmailMessageModel();
    this.analysisModel = new EmailAnalysisCacheModel();
    this.aiAnalysisService = AIAnalysisService;
  }

  public static getInstance(): EmailContentProcessor {
    if (!EmailContentProcessor.instance) {
      EmailContentProcessor.instance = new EmailContentProcessor();
    }
    return EmailContentProcessor.instance;
  }

  /**
   * 处理单个邮件内容
   */
  async processEmailContent(
    message_id: string, 
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    logger.info('Starting email content processing', { 
      message_id, 
      options 
    });

    try {
      // 获取邮件数据
      const email = await this.getEmailMessage(message_id);
      if (!email) {
        throw new Error('Email message not found');
      }

      // 更新邮件分析状态
      await this.updateEmailAnalysisStatus(message_id, 'processing');

      // 解析邮件内容
      const processedContent = await this.parseEmailContent(email);

      // 执行AI分析（如果启用）
      let analysisResult: EmailAnalysisData | undefined;
      if (options.enable_ai_analysis !== false) {
        try {
          analysisResult = await this.performAIAnalysis(email, processedContent);
          
          // 保存分析结果
          if (analysisResult) {
            await this.analysisModel.create(analysisResult);
            logger.info('AI analysis completed and cached', { message_id });
          }
        } catch (analysisError) {
          logger.error('AI analysis failed', { message_id, error: analysisError });
          errors.push(`AI analysis failed: ${analysisError.message}`);
        }
      }

      // 更新邮件分析状态
      await this.updateEmailAnalysisStatus(
        message_id, 
        analysisResult ? 'completed' : 'failed'
      );

      const processingDuration = Date.now() - startTime;

      logger.info('Email content processing completed', {
        message_id,
        processingDuration,
        hasAnalysis: !!analysisResult,
        errors: errors.length
      });

      return {
        success: errors.length === 0,
        message_id,
        processed_content: processedContent,
        analysis_result: analysisResult,
        processing_duration_ms: processingDuration,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      await this.updateEmailAnalysisStatus(message_id, 'failed');
      
      const processingDuration = Date.now() - startTime;
      logger.error('Email content processing failed', { message_id, error, processingDuration });

      return {
        success: false,
        message_id,
        processing_duration_ms: processingDuration,
        errors: [error.message]
      };
    }
  }

  /**
   * 批量处理邮件内容
   */
  async processEmailBatch(
    message_ids: string[],
    options: ProcessingOptions = {}
  ): Promise<BatchProcessingResult> {
    const startTime = Date.now();
    const batchSize = options.max_batch_size || 20;
    const results: ProcessingResult[] = [];
    let successful = 0;
    let failed = 0;
    const errorSummary: Record<string, number> = {};

    logger.info('Starting batch email processing', {
      totalEmails: message_ids.length,
      batchSize,
      options
    });

    // 分批处理
    for (let i = 0; i < message_ids.length; i += batchSize) {
      const batch = message_ids.slice(i, i + batchSize);
      
      logger.debug('Processing batch', {
        batchIndex: Math.floor(i / batchSize) + 1,
        batchSize: batch.length,
        totalBatches: Math.ceil(message_ids.length / batchSize)
      });

      // 并行处理批次内的邮件
      const batchPromises = batch.map(messageId => 
        this.processEmailContent(messageId, options)
          .catch(error => ({
            success: false,
            message_id: messageId,
            processing_duration_ms: 0,
            errors: [error.message]
          } as ProcessingResult))
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 统计结果
      for (const result of batchResults) {
        if (result.success) {
          successful++;
        } else {
          failed++;
          
          // 统计错误类型
          if (result.errors) {
            for (const error of result.errors) {
              const errorType = this.categorizeError(error);
              errorSummary[errorType] = (errorSummary[errorType] || 0) + 1;
            }
          }
        }
      }

      // 批次间短暂延迟，避免系统压力
      if (i + batchSize < message_ids.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const totalProcessingTime = Date.now() - startTime;

    logger.info('Batch email processing completed', {
      totalProcessed: results.length,
      successful,
      failed,
      processingTimeMs: totalProcessingTime,
      averageTimePerEmail: Math.round(totalProcessingTime / results.length)
    });

    return {
      total_processed: results.length,
      successful,
      failed,
      processing_duration_ms: totalProcessingTime,
      results,
      error_summary: Object.keys(errorSummary).length > 0 ? errorSummary : undefined
    };
  }

  /**
   * 解析邮件内容
   */
  private async parseEmailContent(email: EmailMessageData): Promise<ProcessedEmailContent> {
    const html = email.body_html || '';
    const text = email.body_text || email.preview_text || '';

    // HTML内容清理
    let cleanedHtml = '';
    let plainText = text;
    
    if (html) {
      const root = parseHTML(html);
      
      // 移除脚本和样式标签
      root.querySelectorAll('script, style').forEach(el => el.remove());
      
      cleanedHtml = root.innerHTML;
      
      // 提取纯文本（如果原始文本为空）
      if (!plainText) {
        plainText = root.text.replace(/\s+/g, ' ').trim();
      }
    }

    // 检测和移除签名
    const { content: contentWithoutSignature, signature } = this.extractSignature(plainText);
    plainText = contentWithoutSignature;

    // 提取各种数据
    const extractedLinks = this.extractUrls(html + ' ' + plainText);
    const extractedEmails = this.extractEmails(plainText);
    const extractedPhones = this.extractPhones(plainText);
    const keyPhrases = await this.extractKeyPhrases(plainText);
    
    // 计算阅读时间（基于平均阅读速度200词/分钟）
    const wordCount = plainText.split(/\s+/).length;
    const readingTimeMinutes = Math.ceil(wordCount / 200);

    // 语言检测（简单实现）
    const languageDetected = this.detectLanguage(plainText);

    return {
      plain_text: plainText,
      cleaned_html: cleanedHtml || undefined,
      extracted_links: extractedLinks,
      extracted_emails: extractedEmails,
      extracted_phones: extractedPhones,
      key_phrases: keyPhrases,
      language_detected: languageDetected,
      word_count: wordCount,
      reading_time_minutes: readingTimeMinutes,
      has_signature: !!signature,
      signature_content: signature
    };
  }

  /**
   * 执行AI分析
   */
  private async performAIAnalysis(
    email: EmailMessageData, 
    processedContent: ProcessedEmailContent
  ): Promise<EmailAnalysisData> {
    // 构建AI分析输入
    const emailContent: EmailContent = {
      subject: email.subject,
      bodyText: processedContent.plain_text,
      bodyHtml: email.body_html,
      from: {
        name: email.sender_name || '',
        email: email.sender_email
      },
      to: email.recipients.map(r => ({
        name: r.name,
        email: r.email
      })),
      receivedAt: email.received_at
    };

    // 执行AI分析
    const analysisResult: AnalysisResult = await this.aiAnalysisService.analyzeEmail(emailContent);

    // 转换为缓存数据格式
    return {
      message_id: email.id!,
      sentiment_score: this.mapSentimentToScore(analysisResult.sentiment.label),
      sentiment_label: analysisResult.sentiment.label,
      priority_score: this.mapPriorityToScore(analysisResult.priority.level),
      priority_label: this.mapPriorityLabel(analysisResult.priority.level),
      keywords: analysisResult.keywords,
      entities: this.convertEntities(analysisResult.entities),
      topics: processedContent.key_phrases,
      language_detected: processedContent.language_detected,
      category: analysisResult.category.primary,
      is_spam: this.detectSpam(processedContent.plain_text, analysisResult),
      is_promotional: this.detectPromotional(processedContent.plain_text),
      is_automated: this.detectAutomated(email, processedContent),
      urgency_indicators: this.extractUrgencyIndicators(processedContent.plain_text),
      action_required: analysisResult.suggestedActions.length > 0,
      estimated_response_time: this.estimateResponseTime(analysisResult),
      model_version: 'deepseek-v1',
      analysis_duration_ms: analysisResult.processingTime,
      confidence_score: analysisResult.sentiment.confidence
    };
  }

  /**
   * 提取邮件签名
   */
  private extractSignature(text: string): { content: string; signature?: string } {
    const lines = text.split('\n');
    let signatureStartIndex = -1;

    // 查找签名开始位置
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      
      if (this.signatureIndicators.some(indicator => 
        line.includes(indicator) || line.toLowerCase().includes(indicator.toLowerCase())
      )) {
        signatureStartIndex = i;
        break;
      }
    }

    if (signatureStartIndex >= 0) {
      const content = lines.slice(0, signatureStartIndex).join('\n').trim();
      const signature = lines.slice(signatureStartIndex).join('\n').trim();
      return { content, signature };
    }

    return { content: text };
  }

  /**
   * 提取URL链接
   */
  private extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
    const matches = text.match(urlRegex);
    return matches ? [...new Set(matches)] : [];
  }

  /**
   * 提取邮箱地址
   */
  private extractEmails(text: string): string[] {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex);
    return matches ? [...new Set(matches)] : [];
  }

  /**
   * 提取电话号码
   */
  private extractPhones(text: string): string[] {
    const phoneRegex = /(\+?[1-9]\d{1,14}|\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/g;
    const matches = text.match(phoneRegex);
    return matches ? [...new Set(matches)] : [];
  }

  /**
   * 提取关键短语
   */
  private async extractKeyPhrases(text: string): Promise<string[]> {
    try {
      const doc = compromise(text);
      
      // 提取名词短语和重要术语
      const nouns = doc.nouns().out('array');
      const topics = doc.topics().out('array');
      const places = doc.places().out('array');
      
      const keyPhrases = [...nouns, ...topics, ...places]
        .filter(phrase => phrase.length > 2)
        .slice(0, 10);

      return [...new Set(keyPhrases)];
    } catch (error) {
      logger.error('Failed to extract key phrases', { error });
      return [];
    }
  }

  /**
   * 简单语言检测
   */
  private detectLanguage(text: string): string {
    // 简单的中英文检测
    const chineseCharCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const totalChars = text.length;
    
    if (chineseCharCount / totalChars > 0.1) {
      return 'zh-CN';
    }
    
    return 'en';
  }

  /**
   * 检测垃圾邮件特征
   */
  private detectSpam(text: string, analysis: AnalysisResult): boolean {
    const spamKeywords = [
      'free money', 'click here', 'limited time', 'act now',
      'urgent', 'congratulations', '中奖', '免费', '紧急'
    ];
    
    const lowerText = text.toLowerCase();
    const spamScore = spamKeywords.reduce((score, keyword) => {
      return lowerText.includes(keyword.toLowerCase()) ? score + 1 : score;
    }, 0);
    
    return spamScore > 2 || analysis.sentiment.label === 'negative';
  }

  /**
   * 检测推广邮件
   */
  private detectPromotional(text: string): boolean {
    const promotionalKeywords = [
      'sale', 'discount', 'offer', 'deal', 'promotion',
      '优惠', '折扣', '促销', '特价', '活动'
    ];
    
    const lowerText = text.toLowerCase();
    return promotionalKeywords.some(keyword => 
      lowerText.includes(keyword.toLowerCase())
    );
  }

  /**
   * 检测自动化邮件
   */
  private detectAutomated(email: EmailMessageData, content: ProcessedEmailContent): boolean {
    const automatedIndicators = [
      'noreply', 'no-reply', 'automated', 'automatic',
      'system', 'notification', '系统', '通知'
    ];
    
    const fromEmail = email.sender_email.toLowerCase();
    const subject = email.subject.toLowerCase();
    
    return automatedIndicators.some(indicator => 
      fromEmail.includes(indicator) || subject.includes(indicator)
    );
  }

  /**
   * 提取紧急性指标
   */
  private extractUrgencyIndicators(text: string): string[] {
    const urgencyKeywords = [
      'urgent', 'asap', 'immediate', 'emergency', 'critical',
      'deadline', 'time sensitive', '紧急', '急', '立即', '马上'
    ];
    
    const lowerText = text.toLowerCase();
    return urgencyKeywords.filter(keyword => 
      lowerText.includes(keyword.toLowerCase())
    );
  }

  /**
   * 估算响应时间
   */
  private estimateResponseTime(analysis: AnalysisResult): number {
    const priorityTimeMap = {
      'critical': 15,   // 15分钟
      'high': 60,       // 1小时
      'medium': 240,    // 4小时
      'low': 1440       // 24小时
    };
    
    return priorityTimeMap[analysis.priority.level] || 240;
  }

  // 映射方法
  private mapSentimentToScore(label: string): number {
    const scoreMap = { 'positive': 0.8, 'neutral': 0.0, 'negative': -0.8 };
    return scoreMap[label] || 0.0;
  }

  private mapPriorityToScore(level: string): number {
    const scoreMap = { 'critical': 1.0, 'high': 0.8, 'medium': 0.5, 'low': 0.2 };
    return scoreMap[level] || 0.5;
  }

  private mapPriorityLabel(level: string): 'low' | 'medium' | 'high' | 'urgent' {
    const labelMap = { 'critical': 'urgent', 'high': 'high', 'medium': 'medium', 'low': 'low' };
    return labelMap[level] as any || 'medium';
  }

  private convertEntities(entities: any[]): EntityData[] {
    return entities.map(entity => ({
      type: entity.type as EntityData['type'],
      value: entity.value,
      confidence: entity.confidence || 0.8
    }));
  }

  // 工具方法
  private async getEmailMessage(message_id: string): Promise<EmailMessageData | null> {
    const client = await this.pool.connect();
    
    try {
      const query = 'SELECT * FROM email_messages WHERE id = $1';
      const result = await client.query(query, [message_id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapDbRowToEmailData(result.rows[0]);
    } finally {
      client.release();
    }
  }

  private async updateEmailAnalysisStatus(
    message_id: string, 
    status: 'pending' | 'processing' | 'completed' | 'failed'
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        UPDATE email_messages 
        SET analysis_status = $1, analysis_updated_at = NOW() 
        WHERE id = $2
      `;
      await client.query(query, [status, message_id]);
    } catch (error) {
      logger.error('Failed to update email analysis status', { message_id, status, error });
    } finally {
      client.release();
    }
  }

  private categorizeError(error: string): string {
    if (error.includes('AI analysis')) return 'ai_analysis_error';
    if (error.includes('parsing')) return 'content_parsing_error';
    if (error.includes('database')) return 'database_error';
    if (error.includes('not found')) return 'email_not_found';
    return 'unknown_error';
  }

  private mapDbRowToEmailData(row: any): EmailMessageData {
    return {
      id: row.id,
      account_id: row.account_id,
      folder_id: row.folder_id,
      message_id: row.message_id,
      internet_message_id: row.internet_message_id,
      thread_id: row.thread_id,
      conversation_id: row.conversation_id,
      subject: row.subject,
      sender_email: row.sender_email,
      sender_name: row.sender_name,
      recipients: typeof row.recipients === 'string' ? JSON.parse(row.recipients) : row.recipients,
      cc_recipients: typeof row.cc_recipients === 'string' ? JSON.parse(row.cc_recipients) : row.cc_recipients,
      bcc_recipients: typeof row.bcc_recipients === 'string' ? JSON.parse(row.bcc_recipients) : row.bcc_recipients,
      body_text: row.body_text,
      body_html: row.body_html,
      preview_text: row.preview_text,
      importance: row.importance,
      sensitivity: row.sensitivity,
      is_read: row.is_read,
      is_flagged: row.is_flagged,
      is_draft: row.is_draft,
      has_attachments: row.has_attachments,
      attachment_count: row.attachment_count,
      sent_at: new Date(row.sent_at),
      received_at: new Date(row.received_at),
      analysis_status: row.analysis_status,
      analysis_updated_at: row.analysis_updated_at ? new Date(row.analysis_updated_at) : undefined,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  }
}

export default EmailContentProcessor.getInstance();