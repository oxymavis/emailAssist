/**
 * Trello Integration Service
 * Handles integration with Trello project management system
 */

import axios, { AxiosInstance } from 'axios';
import logger from '@/utils/logger';
import { EmailMessage } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export interface TrelloConfig {
  apiKey: string;
  apiToken: string;
  boardId?: string;
  defaultListId?: string;
}

export interface TrelloCard {
  id?: string;
  name: string;
  desc: string;
  idList: string;
  idMembers?: string[];
  due?: Date;
  labels?: TrelloLabel[];
  attachments?: any[];
  pos?: number | 'top' | 'bottom';
}

export interface TrelloLabel {
  id?: string;
  name: string;
  color: string;
}

export interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
  pos: number;
}

export interface TrelloBoard {
  id: string;
  name: string;
  desc: string;
  lists?: TrelloList[];
}

export class TrelloIntegration {
  private apiClient: AxiosInstance;
  private config: TrelloConfig;
  private baseURL = 'https://api.trello.com/1';
  
  constructor(config: TrelloConfig) {
    this.config = config;
    
    this.apiClient = axios.create({
      baseURL: this.baseURL,
      params: {
        key: config.apiKey,
        token: config.apiToken
      },
      timeout: 10000
    });
    
    // Add request/response interceptors for logging
    this.apiClient.interceptors.request.use(
      (config) => {
        logger.debug('Trello API request', { 
          method: config.method,
          url: config.url 
        });
        return config;
      },
      (error) => {
        logger.error('Trello API request error', error);
        return Promise.reject(error);
      }
    );
    
    this.apiClient.interceptors.response.use(
      (response) => {
        logger.debug('Trello API response', { 
          status: response.status,
          url: response.config.url 
        });
        return response;
      },
      (error) => {
        logger.error('Trello API response error', { 
          status: error.response?.status,
          message: error.message 
        });
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Test Trello connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.apiClient.get('/members/me');
      logger.info('Trello connection successful', { 
        username: response.data.username 
      });
      return true;
    } catch (error) {
      logger.error('Trello connection failed', error);
      return false;
    }
  }
  
  /**
   * Get all boards
   */
  async getBoards(): Promise<TrelloBoard[]> {
    try {
      const response = await this.apiClient.get('/members/me/boards');
      return response.data;
    } catch (error) {
      logger.error('Failed to get Trello boards', error);
      throw error;
    }
  }
  
  /**
   * Get lists for a board
   */
  async getBoardLists(boardId?: string): Promise<TrelloList[]> {
    try {
      const id = boardId || this.config.boardId;
      if (!id) {
        throw new Error('Board ID is required');
      }
      
      const response = await this.apiClient.get(`/boards/${id}/lists`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get board lists', error);
      throw error;
    }
  }
  
  /**
   * Create a card from email
   */
  async createCardFromEmail(
    email: EmailMessage,
    listId?: string,
    options: {
      addAttachments?: boolean;
      addLabels?: string[];
      assignMembers?: string[];
      dueDate?: Date;
    } = {}
  ): Promise<TrelloCard> {
    try {
      const targetListId = listId || this.config.defaultListId;
      if (!targetListId) {
        throw new Error('List ID is required');
      }
      
      // Prepare card data
      const cardData: TrelloCard = {
        name: this.truncateTitle(email.subject || 'Email Task'),
        desc: this.formatEmailDescription(email),
        idList: targetListId,
        pos: 'top'
      };
      
      // Add optional fields
      if (options.dueDate) {
        cardData.due = options.dueDate;
      }
      
      if (options.assignMembers && options.assignMembers.length > 0) {
        cardData.idMembers = options.assignMembers;
      }
      
      // Create the card
      const response = await this.apiClient.post('/cards', cardData);
      const card = response.data;
      
      logger.info('Trello card created from email', { 
        cardId: card.id,
        emailId: email.id 
      });
      
      // Add labels if specified
      if (options.addLabels && options.addLabels.length > 0) {
        await this.addLabelsToCard(card.id, options.addLabels);
      }
      
      // Add email as attachment
      if (options.addAttachments && email.attachments) {
        await this.addEmailAttachments(card.id, email);
      }
      
      // Add email link as attachment
      await this.addEmailLinkAttachment(card.id, email);
      
      return card;
    } catch (error) {
      logger.error('Failed to create Trello card from email', { 
        emailId: email.id,
        error 
      });
      throw error;
    }
  }
  
  /**
   * Create multiple cards from emails (batch)
   */
  async createCardsFromEmails(
    emails: EmailMessage[],
    listId?: string
  ): Promise<TrelloCard[]> {
    const cards: TrelloCard[] = [];
    
    for (const email of emails) {
      try {
        const card = await this.createCardFromEmail(email, listId);
        cards.push(card);
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        logger.error('Failed to create card for email', { 
          emailId: email.id,
          error 
        });
      }
    }
    
    logger.info('Batch card creation completed', { 
      total: emails.length,
      successful: cards.length 
    });
    
    return cards;
  }
  
  /**
   * Update card
   */
  async updateCard(cardId: string, updates: Partial<TrelloCard>): Promise<TrelloCard> {
    try {
      const response = await this.apiClient.put(`/cards/${cardId}`, updates);
      
      logger.info('Trello card updated', { cardId });
      return response.data;
    } catch (error) {
      logger.error('Failed to update Trello card', { cardId, error });
      throw error;
    }
  }
  
  /**
   * Move card to another list
   */
  async moveCard(cardId: string, listId: string): Promise<void> {
    try {
      await this.apiClient.put(`/cards/${cardId}`, { idList: listId });
      
      logger.info('Trello card moved', { cardId, listId });
    } catch (error) {
      logger.error('Failed to move Trello card', { cardId, error });
      throw error;
    }
  }
  
  /**
   * Add comment to card
   */
  async addComment(cardId: string, text: string): Promise<void> {
    try {
      await this.apiClient.post(`/cards/${cardId}/actions/comments`, { text });
      
      logger.info('Comment added to Trello card', { cardId });
    } catch (error) {
      logger.error('Failed to add comment to Trello card', { cardId, error });
      throw error;
    }
  }
  
  /**
   * Add labels to card
   */
  async addLabelsToCard(cardId: string, labelIds: string[]): Promise<void> {
    try {
      for (const labelId of labelIds) {
        await this.apiClient.post(`/cards/${cardId}/idLabels`, { 
          value: labelId 
        });
      }
      
      logger.info('Labels added to Trello card', { cardId, labelCount: labelIds.length });
    } catch (error) {
      logger.error('Failed to add labels to Trello card', { cardId, error });
    }
  }
  
  /**
   * Add email link as attachment
   */
  async addEmailLinkAttachment(cardId: string, email: EmailMessage): Promise<void> {
    try {
      const attachmentData = {
        name: `Email: ${email.subject}`,
        url: `email://${email.id}` // Custom URL scheme for email reference
      };
      
      await this.apiClient.post(`/cards/${cardId}/attachments`, attachmentData);
      
      logger.info('Email link attached to Trello card', { cardId, emailId: email.id });
    } catch (error) {
      logger.error('Failed to attach email link', { cardId, error });
    }
  }
  
  /**
   * Add email attachments
   */
  async addEmailAttachments(cardId: string, email: EmailMessage): Promise<void> {
    if (!email.attachments || email.attachments.length === 0) {
      return;
    }
    
    for (const attachment of email.attachments) {
      try {
        // Note: Actual file upload would require file content
        // This is a placeholder for attachment reference
        await this.apiClient.post(`/cards/${cardId}/attachments`, {
          name: attachment.name,
          url: attachment.url || `attachment://${attachment.id}`
        });
      } catch (error) {
        logger.error('Failed to add attachment', { 
          cardId,
          attachmentName: attachment.name,
          error 
        });
      }
    }
  }
  
  /**
   * Search cards
   */
  async searchCards(query: string, boardId?: string): Promise<TrelloCard[]> {
    try {
      const searchQuery = boardId 
        ? `board:${boardId} ${query}`
        : query;
      
      const response = await this.apiClient.get('/search', {
        params: {
          query: searchQuery,
          modelTypes: 'cards',
          cards_limit: 100
        }
      });
      
      return response.data.cards || [];
    } catch (error) {
      logger.error('Failed to search Trello cards', error);
      throw error;
    }
  }
  
  /**
   * Create webhook for board updates
   */
  async createWebhook(callbackURL: string, boardId?: string): Promise<string> {
    try {
      const id = boardId || this.config.boardId;
      if (!id) {
        throw new Error('Board ID is required');
      }
      
      const response = await this.apiClient.post('/webhooks', {
        callbackURL,
        idModel: id,
        description: 'Email Assist Integration Webhook'
      });
      
      logger.info('Trello webhook created', { 
        webhookId: response.data.id,
        boardId: id 
      });
      
      return response.data.id;
    } catch (error) {
      logger.error('Failed to create Trello webhook', error);
      throw error;
    }
  }
  
  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    try {
      await this.apiClient.delete(`/webhooks/${webhookId}`);
      
      logger.info('Trello webhook deleted', { webhookId });
    } catch (error) {
      logger.error('Failed to delete Trello webhook', { webhookId, error });
      throw error;
    }
  }
  
  /**
   * Format email description for Trello card
   */
  private formatEmailDescription(email: EmailMessage): string {
    const lines: string[] = [];
    
    lines.push(`**From:** ${email.from?.name || email.from?.email || 'Unknown'}`);
    lines.push(`**Date:** ${email.receivedAt?.toLocaleString() || 'Unknown'}`);
    
    if (email.to && email.to.length > 0) {
      lines.push(`**To:** ${email.to.map(r => r.email).join(', ')}`);
    }
    
    lines.push('');
    lines.push('---');
    lines.push('');
    
    // Add email body (truncated if too long)
    const maxBodyLength = 2000;
    const body = email.body || 'No content';
    
    if (body.length > maxBodyLength) {
      lines.push(body.substring(0, maxBodyLength) + '...');
      lines.push('');
      lines.push('*[Email content truncated]*');
    } else {
      lines.push(body);
    }
    
    // Add email metadata
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(`**Email ID:** ${email.id}`);
    
    if (email.importance) {
      lines.push(`**Importance:** ${email.importance}`);
    }
    
    if (email.categories && email.categories.length > 0) {
      lines.push(`**Categories:** ${email.categories.join(', ')}`);
    }
    
    return lines.join('\n');
  }
  
  /**
   * Truncate title to Trello's limit
   */
  private truncateTitle(title: string, maxLength = 100): string {
    if (title.length <= maxLength) {
      return title;
    }
    
    return title.substring(0, maxLength - 3) + '...';
  }
  
  /**
   * Get card by email ID
   */
  async getCardByEmailId(emailId: string): Promise<TrelloCard | null> {
    try {
      const cards = await this.searchCards(`"Email ID: ${emailId}"`);
      return cards.length > 0 ? cards[0] : null;
    } catch (error) {
      logger.error('Failed to get card by email ID', { emailId, error });
      return null;
    }
  }
  
  /**
   * Sync email status with Trello card
   */
  async syncEmailStatus(
    emailId: string,
    status: 'read' | 'unread' | 'archived' | 'deleted'
  ): Promise<void> {
    try {
      const card = await this.getCardByEmailId(emailId);
      
      if (!card || !card.id) {
        logger.warn('No Trello card found for email', { emailId });
        return;
      }
      
      // Update card based on status
      switch (status) {
        case 'archived':
        case 'deleted':
          // Move to Done/Archive list if configured
          if (this.config.defaultListId) {
            const lists = await this.getBoardLists();
            const doneList = lists.find(l => 
              l.name.toLowerCase().includes('done') || 
              l.name.toLowerCase().includes('archive')
            );
            
            if (doneList) {
              await this.moveCard(card.id, doneList.id);
            }
          }
          break;
        
        case 'read':
          // Add a comment indicating email was read
          await this.addComment(card.id, '✓ Email marked as read');
          break;
      }
      
      logger.info('Email status synced with Trello', { emailId, status });
    } catch (error) {
      logger.error('Failed to sync email status with Trello', { 
        emailId,
        status,
        error 
      });
    }
  }
}