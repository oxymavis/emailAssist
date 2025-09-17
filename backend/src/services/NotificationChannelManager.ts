import { NotificationChannel, NotificationTemplate, Notification } from '../types';
import { TemplateEngine } from './TemplateEngine';
import nodemailer from 'nodemailer';
import axios from 'axios';
import { Server as SocketIOServer } from 'socket.io';

export interface DeliveryResult {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  responseData?: any;
}

export class NotificationChannelManager {
  private templateEngine: TemplateEngine;
  private socketIO?: SocketIOServer;
  
  // Email transporter cache
  private emailTransporters: Map<string, nodemailer.Transporter> = new Map();

  constructor(templateEngine: TemplateEngine, socketIO?: SocketIOServer) {
    this.templateEngine = templateEngine;
    this.socketIO = socketIO;
  }

  /**
   * Send notification through specified channel
   */
  async sendNotification(
    channel: NotificationChannel,
    notification: Notification,
    template: NotificationTemplate
  ): Promise<DeliveryResult> {
    try {
      if (!channel.isEnabled) {
        return {
          success: false,
          errorCode: 'CHANNEL_DISABLED',
          errorMessage: 'Notification channel is disabled'
        };
      }

      // Render template content
      const renderedContent = await this.templateEngine.renderTemplate(
        template,
        channel.id,
        notification.data || {}
      );

      // Send through appropriate channel
      switch (channel.type) {
        case 'websocket':
          return await this.sendWebSocketNotification(channel, notification, renderedContent);
        
        case 'email':
          return await this.sendEmailNotification(channel, notification, renderedContent);
        
        case 'webhook':
          return await this.sendWebhookNotification(channel, notification, renderedContent);
        
        case 'sms':
          return await this.sendSMSNotification(channel, notification, renderedContent);
        
        default:
          return {
            success: false,
            errorCode: 'UNSUPPORTED_CHANNEL',
            errorMessage: `Channel type ${channel.type} is not supported`
          };
      }
    } catch (error) {
      console.error(`Error sending notification through ${channel.type} channel:`, error);
      return {
        success: false,
        errorCode: 'SEND_ERROR',
        errorMessage: error.message
      };
    }
  }

  /**
   * Send WebSocket notification
   */
  private async sendWebSocketNotification(
    channel: NotificationChannel,
    notification: Notification,
    content: any
  ): Promise<DeliveryResult> {
    try {
      if (!this.socketIO) {
        return {
          success: false,
          errorCode: 'WEBSOCKET_NOT_CONFIGURED',
          errorMessage: 'WebSocket server not configured'
        };
      }

      const socketNamespace = channel.config.socketNamespace || '/notifications';
      const io = socketNamespace === '/' 
        ? this.socketIO 
        : this.socketIO.of(socketNamespace);

      // Emit to specific user room
      const userRoom = `user:${notification.userId}`;
      
      const socketData = {
        id: notification.id,
        type: 'notification',
        title: content.title || notification.title,
        message: content.message || notification.message,
        icon: content.icon,
        priority: notification.priority,
        data: notification.data,
        timestamp: new Date()
      };

      io.to(userRoom).emit('notification', socketData);

      return {
        success: true,
        responseData: {
          room: userRoom,
          namespace: socketNamespace,
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        errorCode: 'WEBSOCKET_ERROR',
        errorMessage: error.message
      };
    }
  }

  /**
   * Send Email notification
   */
  private async sendEmailNotification(
    channel: NotificationChannel,
    notification: Notification,
    content: any
  ): Promise<DeliveryResult> {
    try {
      const smtpSettings = channel.config.smtpSettings;
      if (!smtpSettings) {
        return {
          success: false,
          errorCode: 'SMTP_NOT_CONFIGURED',
          errorMessage: 'SMTP settings not configured for email channel'
        };
      }

      // Get or create transporter
      const transporter = await this.getEmailTransporter(channel.id, smtpSettings);

      // Get recipient from notification data or user info
      const recipient = notification.data?.recipientEmail || notification.data?.userEmail;
      if (!recipient) {
        return {
          success: false,
          errorCode: 'NO_RECIPIENT',
          errorMessage: 'No email recipient specified'
        };
      }

      const mailOptions = {
        from: smtpSettings.auth.user,
        to: recipient,
        subject: content.subject || notification.title,
        text: content.textBody || notification.message,
        html: content.htmlBody || `<p>${notification.message}</p>`,
        headers: {
          'X-Notification-ID': notification.id,
          'X-User-ID': notification.userId
        }
      };

      const result = await transporter.sendMail(mailOptions);

      return {
        success: true,
        responseData: {
          messageId: result.messageId,
          response: result.response,
          recipient,
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        errorCode: 'EMAIL_SEND_ERROR',
        errorMessage: error.message
      };
    }
  }

  /**
   * Send Webhook notification
   */
  private async sendWebhookNotification(
    channel: NotificationChannel,
    notification: Notification,
    content: any
  ): Promise<DeliveryResult> {
    try {
      const webhookConfig = channel.config;
      if (!webhookConfig.webhookUrl) {
        return {
          success: false,
          errorCode: 'WEBHOOK_URL_MISSING',
          errorMessage: 'Webhook URL not configured'
        };
      }

      const payload = content.payload || {
        id: notification.id,
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        data: notification.data,
        timestamp: new Date()
      };

      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'EmailAssist-Notification-Service',
        'X-Notification-ID': notification.id,
        ...webhookConfig.webhookHeaders
      };

      // Add webhook signature if secret is configured
      if (webhookConfig.webhookSecret) {
        const crypto = require('crypto');
        const signature = crypto
          .createHmac('sha256', webhookConfig.webhookSecret)
          .update(JSON.stringify(payload))
          .digest('hex');
        headers['X-Signature'] = `sha256=${signature}`;
      }

      const response = await axios.post(webhookConfig.webhookUrl, payload, {
        headers,
        timeout: 30000, // 30 seconds timeout
        maxRedirects: 3
      });

      return {
        success: response.status >= 200 && response.status < 300,
        responseData: {
          statusCode: response.status,
          statusText: response.statusText,
          responseHeaders: response.headers,
          responseData: response.data,
          timestamp: new Date()
        }
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          errorCode: 'WEBHOOK_HTTP_ERROR',
          errorMessage: `HTTP ${error.response?.status}: ${error.response?.statusText || error.message}`,
          responseData: {
            statusCode: error.response?.status,
            responseData: error.response?.data
          }
        };
      }

      return {
        success: false,
        errorCode: 'WEBHOOK_ERROR',
        errorMessage: error.message
      };
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(
    channel: NotificationChannel,
    notification: Notification,
    content: any
  ): Promise<DeliveryResult> {
    try {
      const smsConfig = channel.config.smsConfig;
      const provider = channel.config.smsProvider;

      if (!provider || !smsConfig) {
        return {
          success: false,
          errorCode: 'SMS_NOT_CONFIGURED',
          errorMessage: 'SMS provider not configured'
        };
      }

      // Get phone number from notification data
      const phoneNumber = notification.data?.phoneNumber;
      if (!phoneNumber) {
        return {
          success: false,
          errorCode: 'NO_PHONE_NUMBER',
          errorMessage: 'No phone number specified for SMS notification'
        };
      }

      const message = content.textBody || content.message || notification.message;

      switch (provider) {
        case 'twilio':
          return await this.sendTwilioSMS(smsConfig, phoneNumber, message);
        
        case 'aws-sns':
          return await this.sendAWSSnsSMS(smsConfig, phoneNumber, message);
        
        default:
          return {
            success: false,
            errorCode: 'UNSUPPORTED_SMS_PROVIDER',
            errorMessage: `SMS provider ${provider} is not supported`
          };
      }
    } catch (error) {
      return {
        success: false,
        errorCode: 'SMS_SEND_ERROR',
        errorMessage: error.message
      };
    }
  }

  /**
   * Send SMS via Twilio
   */
  private async sendTwilioSMS(config: any, to: string, message: string): Promise<DeliveryResult> {
    try {
      const response = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
        new URLSearchParams({
          From: config.from,
          To: to,
          Body: message
        }),
        {
          auth: {
            username: config.accountSid,
            password: config.authToken
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return {
        success: true,
        responseData: {
          sid: response.data.sid,
          status: response.data.status,
          to: response.data.to,
          from: response.data.from
        }
      };
    } catch (error) {
      return {
        success: false,
        errorCode: 'TWILIO_ERROR',
        errorMessage: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Send SMS via AWS SNS
   */
  private async sendAWSSnsSMS(config: any, to: string, message: string): Promise<DeliveryResult> {
    try {
      // This would require AWS SDK integration
      // For now, return a placeholder implementation
      console.log('AWS SNS SMS sending not implemented yet');
      
      return {
        success: false,
        errorCode: 'NOT_IMPLEMENTED',
        errorMessage: 'AWS SNS SMS integration not implemented'
      };
    } catch (error) {
      return {
        success: false,
        errorCode: 'AWS_SNS_ERROR',
        errorMessage: error.message
      };
    }
  }

  /**
   * Get or create email transporter
   */
  private async getEmailTransporter(channelId: string, smtpSettings: any): Promise<nodemailer.Transporter> {
    if (this.emailTransporters.has(channelId)) {
      return this.emailTransporters.get(channelId)!;
    }

    const transporter = nodemailer.createTransport({
      host: smtpSettings.host,
      port: smtpSettings.port,
      secure: smtpSettings.secure,
      auth: {
        user: smtpSettings.auth.user,
        pass: smtpSettings.auth.pass
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000, // 1 second
      rateLimit: 10    // 10 emails per second
    });

    // Verify connection
    await transporter.verify();

    this.emailTransporters.set(channelId, transporter);
    return transporter;
  }

  /**
   * Test channel configuration
   */
  async testChannel(channel: NotificationChannel): Promise<DeliveryResult> {
    try {
      const testNotification: Notification = {
        id: 'test-notification',
        userId: 'test-user',
        templateId: 'test-template',
        channelId: channel.id,
        priority: 1,
        status: 'pending',
        title: 'Test Notification',
        message: 'This is a test notification to verify channel configuration.',
        data: {
          recipientEmail: 'test@example.com',
          phoneNumber: '+1234567890'
        },
        metadata: {
          sourceType: 'manual',
          retryCount: 0
        },
        deliveryResults: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const testTemplate: NotificationTemplate = {
        id: 'test-template',
        name: 'Test Template',
        category: 'system_alert',
        channels: [{
          channelId: channel.id,
          isEnabled: true,
          templateContent: {
            subject: 'Test Subject',
            textBody: 'Test message',
            htmlBody: '<p>Test message</p>',
            title: 'Test Title',
            message: 'Test Message',
            payload: { test: true }
          }
        }],
        variables: [],
        isSystem: true,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return await this.sendNotification(channel, testNotification, testTemplate);
    } catch (error) {
      return {
        success: false,
        errorCode: 'TEST_ERROR',
        errorMessage: error.message
      };
    }
  }

  /**
   * Get channel statistics
   */
  async getChannelStats(channelId: string): Promise<{
    totalSent: number;
    successRate: number;
    avgDeliveryTime: number;
    recentErrors: Array<{ error: string; count: number; lastOccurred: Date }>;
  }> {
    // This would typically query from analytics database
    // For now, return placeholder data
    return {
      totalSent: 0,
      successRate: 100,
      avgDeliveryTime: 0,
      recentErrors: []
    };
  }

  /**
   * Validate channel configuration
   */
  validateChannelConfig(channel: NotificationChannel): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (channel.type) {
      case 'websocket':
        // WebSocket validation
        if (!channel.config.socketNamespace) {
          errors.push('Socket namespace is required for WebSocket channel');
        }
        break;

      case 'email':
        // Email validation
        const smtp = channel.config.smtpSettings;
        if (!smtp) {
          errors.push('SMTP settings are required for email channel');
        } else {
          if (!smtp.host) errors.push('SMTP host is required');
          if (!smtp.port) errors.push('SMTP port is required');
          if (!smtp.auth?.user) errors.push('SMTP username is required');
          if (!smtp.auth?.pass) errors.push('SMTP password is required');
        }
        break;

      case 'webhook':
        // Webhook validation
        if (!channel.config.webhookUrl) {
          errors.push('Webhook URL is required for webhook channel');
        } else {
          try {
            new URL(channel.config.webhookUrl);
          } catch {
            errors.push('Invalid webhook URL format');
          }
        }
        break;

      case 'sms':
        // SMS validation
        if (!channel.config.smsProvider) {
          errors.push('SMS provider is required for SMS channel');
        }
        if (!channel.config.smsConfig) {
          errors.push('SMS configuration is required for SMS channel');
        }
        break;

      default:
        errors.push(`Unsupported channel type: ${channel.type}`);
    }

    // Validate retry configuration
    if (channel.retryConfig) {
      if (channel.retryConfig.maxAttempts < 1 || channel.retryConfig.maxAttempts > 10) {
        errors.push('Max retry attempts must be between 1 and 10');
      }
      if (channel.retryConfig.retryDelay < 10 || channel.retryConfig.retryDelay > 3600) {
        errors.push('Retry delay must be between 10 and 3600 seconds');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    // Close email transporters
    for (const transporter of this.emailTransporters.values()) {
      transporter.close();
    }
    this.emailTransporters.clear();

    console.log('Notification channel manager closed');
  }

  /**
   * Set Socket.IO instance
   */
  setSocketIO(socketIO: SocketIOServer): void {
    this.socketIO = socketIO;
  }
}