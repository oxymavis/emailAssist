/**
 * Email Analysis Service
 * Provides AI-powered email content analysis using DeepSeek API
 */

import axios from 'axios';
import database from '@/config/database';
import logger from '@/utils/logger';
import { EmailAnalysisResult, EmailSentiment, EmailUrgency } from '@/types';
import { DatabaseError } from '@/utils/errors';

export interface EmailAnalysisInput {
  emailId: string;
  subject: string;
  sender: string;
  body: string;
  attachments?: string[];
  receivedAt: Date;
}

export class EmailAnalysisService {
  private static readonly DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
  private static readonly API_KEY = process.env.DEEPSEEK_API_KEY;

  private static async callDeepSeekAPI(messages: any[], model: string = 'deepseek-chat'): Promise<any> {
    if (!this.API_KEY) {
      throw new Error('DEEPSEEK_API_KEY is not configured');
    }

    const response = await axios.post(this.DEEPSEEK_API_URL, {
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2000
    }, {
      headers: {
        'Authorization': `Bearer ${this.API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }

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
        id: `analysis_${input.emailId}_${Date.now()}`,
        emailId: input.emailId,
        sentiment,
        urgency,
        category,
        keyTopics,
        summary,
        actionRequired,
        suggestedResponse,
        confidence: 0.85, // Default confidence
        processedAt: new Date().toISOString()
      };

      // Save to database
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
      
      const response = await this.callDeepSeekAPI([
        { role: 'system', content: 'You are an email sentiment analyzer. Return only one word: positive, neutral, negative, or mixed.' },
        { role: 'user', content: prompt }
      ]);
      
      const sentiment = response.choices[0]?.message?.content?.trim().toLowerCase();
      
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
      
      const response = await this.callDeepSeekAPI([
        { role: 'system', content: 'You are an email urgency analyzer. Return only one word: low, medium, high, or critical.' },
        { role: 'user', content: prompt }
      ]);
      
      const urgency = response.choices[0]?.message?.content?.trim().toLowerCase();
      
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
        Categorize this email into one of these categories:
        - Work
        - Personal
        - Marketing
        - Finance
        - Travel
        - Health
        - Education
        - Other
        
        Subject: ${input.subject}
        Body: ${input.body}
        
        Return only the category name.
      `;
      
      const response = await this.callDeepSeekAPI([
        { role: 'system', content: 'You are an email categorizer. Return only the category name.' },
        { role: 'user', content: prompt }
      ]);
      
      return response.choices[0]?.message?.content?.trim() || 'Other';
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
        Generate a concise summary of this email in 1-2 sentences.
        
        Subject: ${input.subject}
        Body: ${input.body}
      `;
      
      const response = await this.callDeepSeekAPI([
        { role: 'system', content: 'You are an email summarizer. Generate concise summaries.' },
        { role: 'user', content: prompt }
      ]);
      
      return response.choices[0]?.message?.content?.trim() || 'Email summary not available.';
    } catch (error) {
      logger.error('Summary generation failed', error);
      return 'Email summary not available.';
    }
  }

  /**
   * Extract key topics
   */
  static async extractKeyTopics(input: EmailAnalysisInput): Promise<string[]> {
    try {
      const prompt = `
        Extract the main topics and keywords from this email.
        Return them as a comma-separated list.
        
        Subject: ${input.subject}
        Body: ${input.body}
      `;
      
      const response = await this.callDeepSeekAPI([
        { role: 'system', content: 'You are a topic extractor. Return topics as a comma-separated list.' },
        { role: 'user', content: prompt }
      ]);
      
      const topics = response.choices[0]?.message?.content?.trim();
      return topics ? topics.split(',').map(t => t.trim()) : [];
    } catch (error) {
      logger.error('Topic extraction failed', error);
      return [];
    }
  }

  /**
   * Extract entities
   */
  static async extractEntities(input: EmailAnalysisInput): Promise<any> {
    try {
      const prompt = `
        Extract entities from this email and return as JSON:
        {
          "people": ["person1", "person2"],
          "organizations": ["org1", "org2"],
          "locations": ["location1", "location2"],
          "dates": ["date1", "date2"],
          "amounts": ["amount1", "amount2"]
        }
        
        Subject: ${input.subject}
        Body: ${input.body}
      `;
      
      const response = await this.callDeepSeekAPI([
        { role: 'system', content: 'You are an entity extractor. Return valid JSON only.' },
        { role: 'user', content: prompt }
      ]);
      
      try {
        const entities = JSON.parse(response.choices[0]?.message?.content || '{}');
        return entities;
      } catch {
        return {
          people: [],
          organizations: [],
          locations: [],
          dates: [],
          amounts: []
        };
      }
    } catch (error) {
      logger.error('Entity extraction failed', error);
      return {
        people: [],
        organizations: [],
        locations: [],
        dates: [],
        amounts: []
      };
    }
  }

  /**
   * Detect if action is required
   */
  static async detectActionRequired(input: EmailAnalysisInput): Promise<boolean> {
    try {
      const prompt = `
        Determine if this email requires any action or response from the recipient.
        Consider questions, requests, deadlines, and action items.
        
        Subject: ${input.subject}
        Body: ${input.body}
        
        Answer with: yes or no
      `;
      
      const response = await this.callDeepSeekAPI([
        { role: 'system', content: 'You are an action detector. Answer only yes or no.' },
        { role: 'user', content: prompt }
      ]);
      
      const answer = response.choices[0]?.message?.content?.trim().toLowerCase();
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
      const actionRequired = await this.detectActionRequired(input);
      
      if (!actionRequired) {
        return undefined;
      }

      const prompt = `
        Generate a professional response suggestion for this email.
        Keep it concise and appropriate for the context.
        
        Subject: ${input.subject}
        Body: ${input.body}
      `;
      
      const response = await this.callDeepSeekAPI([
        { role: 'system', content: 'You are a professional email assistant. Generate appropriate responses.' },
        { role: 'user', content: prompt }
      ]);
      
      return response.choices[0]?.message?.content?.trim();
    } catch (error) {
      logger.error('Response generation failed', error);
      return undefined;
    }
  }

  /**
   * Detect language
   */
  static async detectLanguage(text: string): Promise<string> {
    try {
      const prompt = `Detect the language of this text and return the ISO 639-1 code (e.g., en, zh, es): ${text.substring(0, 200)}`;
      
      const response = await this.callDeepSeekAPI([
        { role: 'system', content: 'You are a language detector. Return only the ISO 639-1 language code.' },
        { role: 'user', content: prompt }
      ]);
      
      return response.choices[0]?.message?.content?.trim().toLowerCase() || 'en';
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
          id,
          email_id,
          sentiment,
          urgency,
          category,
          key_topics,
          summary,
          action_required,
          suggested_response,
          confidence,
          processed_at,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          sentiment = EXCLUDED.sentiment,
          urgency = EXCLUDED.urgency,
          category = EXCLUDED.category,
          key_topics = EXCLUDED.key_topics,
          summary = EXCLUDED.summary,
          action_required = EXCLUDED.action_required,
          suggested_response = EXCLUDED.suggested_response,
          confidence = EXCLUDED.confidence,
          processed_at = EXCLUDED.processed_at,
          updated_at = NOW()
      `;

      const values = [
        result.id,
        result.emailId,
        result.sentiment,
        result.urgency,
        result.category,
        JSON.stringify(result.keyTopics),
        result.summary,
        result.actionRequired,
        result.suggestedResponse,
        result.confidence,
        result.processedAt
      ];

      await database.query(query, values);
      logger.info('Analysis result saved to database', { emailId: result.emailId });
    } catch (error) {
      logger.error('Failed to save analysis result', error);
      throw new DatabaseError('Failed to save analysis result', error);
    }
  }

  /**
   * Batch analyze multiple emails
   */
  static async batchAnalyze(emails: EmailAnalysisInput[]): Promise<EmailAnalysisResult[]> {
    try {
      logger.info('Starting batch email analysis', { count: emails.length });
      
      // Process in chunks to avoid overwhelming the API
      const chunkSize = 5;
      const results: EmailAnalysisResult[] = [];

      for (let i = 0; i < emails.length; i += chunkSize) {
        const chunk = emails.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(
          chunk.map(email => this.analyzeEmail(email))
        );
        results.push(...chunkResults);
        
        // Add delay between chunks
        if (i + chunkSize < emails.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.info('Batch analysis completed', { 
        total: emails.length, 
        processed: results.length 
      });

      return results;
    } catch (error) {
      logger.error('Batch analysis failed', error);
      throw error;
    }
  }
}

export default EmailAnalysisService;