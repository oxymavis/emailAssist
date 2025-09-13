/**
 * Email Analysis Service
 * Provides AI-powered email content analysis using DeepSeek API
 */

import { Configuration, OpenAIApi } from 'openai';
import database from '@/config/database';
import logger from '@/utils/logger';
import { EmailAnalysisResult, EmailSentiment, EmailUrgency } from '@/types';
import { DatabaseError } from '@/utils/errors';

// Configure DeepSeek API (compatible with OpenAI interface)
const configuration = new Configuration({
  apiKey: process.env.DEEPSEEK_API_KEY,
  basePath: process.env.DEEPSEEK_BASE_URL
});
const openai = new OpenAIApi(configuration);

export interface EmailAnalysisInput {
  emailId: string;
  subject: string;
  sender: string;
  body: string;
  attachments?: string[];
  receivedAt: Date;
}

export class EmailAnalysisService {
  /**
   * Analyze email content using AI
   */
  static async analyzeEmail(input: EmailAnalysisInput): Promise<EmailAnalysisResult> {
    try {
      logger.info('Starting email analysis', { emailId: input.emailId });
      
      // Perform multiple analysis tasks in parallel
      const [
        sentiment,
        urgency,
        category,
        summary,
        keyTopics,
        entities,
        actionRequired,
        suggestedResponse
      ] = await Promise.all([
        this.analyzeSentiment(input),
        this.analyzeUrgency(input),
        this.categorizeEmail(input),
        this.generateSummary(input),
        this.extractKeyTopics(input),
        this.extractEntities(input),
        this.detectActionRequired(input),
        this.generateSuggestedResponse(input)
      ]);
      
      const result: EmailAnalysisResult = {
        emailId: input.emailId,
        sentiment,
        urgency,
        category,
        keyTopics,
        entities,
        summary,
        actionRequired,
        suggestedResponse,
        confidenceScore: 0.85, // Will be calculated based on model confidence
        language: await this.detectLanguage(input.body),
        analysisVersion: '1.0.0',
        processedAt: new Date()
      };
      
      // Save analysis result to database
      await this.saveAnalysisResult(result);
      
      logger.info('Email analysis completed', { 
        emailId: input.emailId,
        category,
        urgency,
        sentiment 
      });
      
      return result;
    } catch (error) {
      logger.error('Email analysis failed', { emailId: input.emailId, error });
      throw error;
    }
  }
  
  /**
   * Analyze email sentiment
   */
  static async analyzeSentiment(input: EmailAnalysisInput): Promise<EmailSentiment> {
    try {
      const prompt = `
        Analyze the sentiment of this email and classify it as one of: positive, neutral, negative, or mixed.
        
        Subject: ${input.subject}
        Body: ${input.body}
        
        Return only the sentiment classification.
      `;
      
      const response = await openai.createChatCompletion({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are an email sentiment analyzer. Return only one word: positive, neutral, negative, or mixed.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 10
      });
      
      const sentiment = response.data.choices[0]?.message?.content?.trim().toLowerCase();
      
      if (['positive', 'neutral', 'negative', 'mixed'].includes(sentiment as string)) {
        return sentiment as EmailSentiment;
      }
      
      return 'neutral';
    } catch (error) {
      logger.error('Sentiment analysis failed', error);
      return 'neutral';
    }
  }
  
  /**
   * Analyze email urgency
   */
  static async analyzeUrgency(input: EmailAnalysisInput): Promise<EmailUrgency> {
    try {
      const prompt = `
        Analyze the urgency level of this email based on its content, keywords, and context.
        Consider deadlines, action items, and language indicating time sensitivity.
        
        Subject: ${input.subject}
        Body: ${input.body}
        
        Classify as: low, medium, high, or critical
      `;
      
      const response = await openai.createChatCompletion({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are an email urgency analyzer. Return only one word: low, medium, high, or critical.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 10
      });
      
      const urgency = response.data.choices[0]?.message?.content?.trim().toLowerCase();
      
      if (['low', 'medium', 'high', 'critical'].includes(urgency as string)) {
        return urgency as EmailUrgency;
      }
      
      return 'medium';
    } catch (error) {
      logger.error('Urgency analysis failed', error);
      return 'medium';
    }
  }
  
  /**
   * Categorize email
   */
  static async categorizeEmail(input: EmailAnalysisInput): Promise<string> {
    try {
      const prompt = `
        Categorize this email into one of the following categories:
        - Work/Business
        - Personal
        - Marketing/Promotional
        - Newsletter
        - Social
        - Finance/Banking
        - Travel
        - Support/Customer Service
        - Notification/Alert
        - Spam
        - Other
        
        Subject: ${input.subject}
        Sender: ${input.sender}
        Body: ${input.body.substring(0, 500)}
        
        Return only the category name.
      `;
      
      const response = await openai.createChatCompletion({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are an email categorizer. Return only the category name.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 20
      });
      
      return response.data.choices[0]?.message?.content?.trim() || 'Other';
    } catch (error) {
      logger.error('Email categorization failed', error);
      return 'Other';
    }
  }
  
  /**
   * Generate email summary
   */
  static async generateSummary(input: EmailAnalysisInput): Promise<string> {
    try {
      const prompt = `
        Create a concise summary of this email in 2-3 sentences.
        Focus on the main point and any action items.
        
        Subject: ${input.subject}
        Body: ${input.body}
      `;
      
      const response = await openai.createChatCompletion({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are an email summarizer. Provide concise, informative summaries.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 100
      });
      
      return response.data.choices[0]?.message?.content?.trim() || 'Email summary not available.';
    } catch (error) {
      logger.error('Summary generation failed', error);
      return 'Unable to generate summary.';
    }
  }
  
  /**
   * Extract key topics
   */
  static async extractKeyTopics(input: EmailAnalysisInput): Promise<string[]> {
    try {
      const prompt = `
        Extract 3-5 key topics or keywords from this email.
        Return as a comma-separated list.
        
        Subject: ${input.subject}
        Body: ${input.body}
      `;
      
      const response = await openai.createChatCompletion({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a keyword extractor. Return only comma-separated keywords.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 50
      });
      
      const topics = response.data.choices[0]?.message?.content?.trim();
      return topics ? topics.split(',').map(t => t.trim()) : [];
    } catch (error) {
      logger.error('Topic extraction failed', error);
      return [];
    }
  }
  
  /**
   * Extract named entities
   */
  static async extractEntities(input: EmailAnalysisInput): Promise<any> {
    try {
      const prompt = `
        Extract named entities from this email and categorize them:
        - People (names)
        - Organizations (companies, institutions)
        - Locations (cities, countries, addresses)
        - Dates (specific dates, deadlines)
        - Money (amounts, currencies)
        - Products (product names, services)
        
        Body: ${input.body}
        
        Return as JSON format.
      `;
      
      const response = await openai.createChatCompletion({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are an entity extractor. Return valid JSON with extracted entities.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 200
      });
      
      try {
        const entities = JSON.parse(response.data.choices[0]?.message?.content || '{}');
        return entities;
      } catch {
        return {
          people: [],
          organizations: [],
          locations: [],
          dates: [],
          money: [],
          products: []
        };
      }
    } catch (error) {
      logger.error('Entity extraction failed', error);
      return {};
    }
  }
  
  /**
   * Detect if action is required
   */
  static async detectActionRequired(input: EmailAnalysisInput): Promise<boolean> {
    try {
      const prompt = `
        Does this email require action from the recipient?
        Look for: questions, requests, deadlines, meeting invitations, tasks, or follow-up items.
        
        Subject: ${input.subject}
        Body: ${input.body}
        
        Answer only: yes or no
      `;
      
      const response = await openai.createChatCompletion({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are an email action detector. Answer only yes or no.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 5
      });
      
      const answer = response.data.choices[0]?.message?.content?.trim().toLowerCase();
      return answer === 'yes';
    } catch (error) {
      logger.error('Action detection failed', error);
      return false;
    }
  }
  
  /**
   * Generate suggested response
   */
  static async generateSuggestedResponse(input: EmailAnalysisInput): Promise<string | undefined> {
    try {
      // Only generate response if action is required
      const actionRequired = await this.detectActionRequired(input);
      if (!actionRequired) {
        return undefined;
      }
      
      const prompt = `
        Generate a professional email response to this email.
        Keep it concise and appropriate to the context.
        
        Original Email:
        Subject: ${input.subject}
        From: ${input.sender}
        Body: ${input.body}
        
        Generate a response that addresses the main points.
      `;
      
      const response = await openai.createChatCompletion({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a professional email response generator. Create appropriate, concise responses.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 200
      });
      
      return response.data.choices[0]?.message?.content?.trim();
    } catch (error) {
      logger.error('Response generation failed', error);
      return undefined;
    }
  }
  
  /**
   * Detect email language
   */
  static async detectLanguage(text: string): Promise<string> {
    try {
      const prompt = `Detect the language of this text and return the ISO 639-1 code (e.g., en, zh, es): ${text.substring(0, 200)}`;
      
      const response = await openai.createChatCompletion({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a language detector. Return only the 2-letter ISO 639-1 language code.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 5
      });
      
      return response.data.choices[0]?.message?.content?.trim().toLowerCase() || 'en';
    } catch (error) {
      logger.error('Language detection failed', error);
      return 'en';
    }
  }
  
  /**
   * Save analysis result to database
   */
  static async saveAnalysisResult(result: EmailAnalysisResult): Promise<void> {
    try {
      const query = `
        INSERT INTO email_analysis (
          email_id, sentiment, urgency, category, key_topics,
          entities, summary, action_required, suggested_response,
          confidence_score, language, analysis_version, processed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (email_id) 
        DO UPDATE SET
          sentiment = EXCLUDED.sentiment,
          urgency = EXCLUDED.urgency,
          category = EXCLUDED.category,
          key_topics = EXCLUDED.key_topics,
          entities = EXCLUDED.entities,
          summary = EXCLUDED.summary,
          action_required = EXCLUDED.action_required,
          suggested_response = EXCLUDED.suggested_response,
          confidence_score = EXCLUDED.confidence_score,
          language = EXCLUDED.language,
          analysis_version = EXCLUDED.analysis_version,
          processed_at = EXCLUDED.processed_at
      `;
      
      const values = [
        result.emailId,
        result.sentiment,
        result.urgency,
        result.category,
        result.keyTopics,
        JSON.stringify(result.entities),
        result.summary,
        result.actionRequired,
        result.suggestedResponse,
        result.confidenceScore,
        result.language,
        result.analysisVersion,
        result.processedAt
      ];
      
      await database.query(query, values);
      logger.info('Analysis result saved to database', { emailId: result.emailId });
    } catch (error) {
      logger.error('Failed to save analysis result', { emailId: result.emailId, error });
      throw new DatabaseError('Failed to save analysis result');
    }
  }
  
  /**
   * Batch analyze multiple emails
   */
  static async batchAnalyze(emails: EmailAnalysisInput[]): Promise<EmailAnalysisResult[]> {
    try {
      logger.info('Starting batch email analysis', { count: emails.length });
      
      // Process in chunks to avoid rate limits
      const chunkSize = 5;
      const results: EmailAnalysisResult[] = [];
      
      for (let i = 0; i < emails.length; i += chunkSize) {
        const chunk = emails.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(
          chunk.map(email => this.analyzeEmail(email))
        );
        results.push(...chunkResults);
        
        // Add delay between chunks to respect rate limits
        if (i + chunkSize < emails.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      logger.info('Batch email analysis completed', { 
        total: emails.length,
        successful: results.length 
      });
      
      return results;
    } catch (error) {
      logger.error('Batch analysis failed', error);
      throw error;
    }
  }
}