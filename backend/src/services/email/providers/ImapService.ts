import * as nodemailer from 'nodemailer';
import * as Imap from 'imap';
import { 
  OAuthTokens, 
  UnifiedEmailMessage, 
  EmailSearchQuery, 
  EmailSendRequest, 
  EmailOperationResult,
  ImapMessage,
  RateLimitConfig
} from '../../../types';
import { BaseEmailService } from '../BaseEmailService';
import logger from '../../../utils/logger';

/**
 * IMAP/SMTP通用邮件服务实现
 * 支持大多数邮件提供商的IMAP/SMTP协议
 */
export class ImapService extends BaseEmailService {
  private imapConnection?: Imap;
  private smtpTransporter?: nodemailer.Transporter;
  private config: {
    imap: {
      host: string;
      port: number;
      secure: boolean;
      username: string;
      password: string;
      tls?: {
        rejectUnauthorized: boolean;
      };
    };
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      username: string;
      password: string;
    };
  };
  private accountId: string = '';

  constructor(config: any, rateLimitConfig: RateLimitConfig) {
    super('imap', config, rateLimitConfig);
    this.config = config;
  }

  /**
   * 连接到IMAP/SMTP服务器
   */
  public async connect(config: {
    imap: any;
    smtp: any;
    accountId: string;
  }): Promise<void> {
    try {
      this.config = config;
      this.accountId = config.accountId;
      
      // 创建IMAP连接
      this.imapConnection = new (require('imap'))(this.config.imap);
      
      // 创建SMTP传输器
      this.smtpTransporter = nodemailer.createTransport({
        host: this.config.smtp.host,
        port: this.config.smtp.port,
        secure: this.config.smtp.secure,
        auth: {
          user: this.config.smtp.username,
          pass: this.config.smtp.password
        }
      });

      // 测试连接
      await this.testConnections();
      
      this.setConnectionStatus(true);
      logger.info(`IMAP service connected for account: ${this.accountId}`);
    } catch (error) {
      logger.error('Failed to connect IMAP service:', error);
      this.setConnectionStatus(false);
      throw error;
    }
  }

  /**
   * 断开连接
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.imapConnection) {
        this.imapConnection.end();
        this.imapConnection = undefined;
      }
      
      if (this.smtpTransporter) {
        this.smtpTransporter.close();
        this.smtpTransporter = undefined;
      }
      
      this.setConnectionStatus(false);
      logger.info('IMAP service disconnected');
    } catch (error) {
      logger.error('Error disconnecting IMAP service:', error);
    }
  }

  /**
   * 认证（IMAP/SMTP使用基本认证）
   */
  public async authenticate(tokens: OAuthTokens): Promise<boolean> {
    // IMAP/SMTP服务通常使用基本认证，OAuth tokens在这里不适用
    // 连接时已经进行了认证
    return this._isConnected;
  }

  /**
   * 刷新令牌（IMAP/SMTP不需要）
   */
  public async refreshTokens(): Promise<OAuthTokens> {
    throw new Error('IMAP/SMTP does not support token refresh');
  }

  /**
   * 获取邮件列表
   */
  public async getMessages(query?: EmailSearchQuery): Promise<UnifiedEmailMessage[]> {
    this.validateSearchQuery(query);
    
    return new Promise((resolve, reject) => {
      if (!this.imapConnection) {
        reject(new Error('IMAP connection not established'));
        return;
      }

      this.imapConnection.once('ready', () => {
        const folder = this.mapFolderName(query?.folder || 'INBOX');
        
        this.imapConnection!.openBox(folder, true, (err, box) => {
          if (err) {
            reject(err);
            return;
          }

          const searchCriteria = this.buildSearchCriteria(query);
          
          this.imapConnection!.search(searchCriteria, (err, results) => {
            if (err) {
              reject(err);
              return;
            }

            if (!results || results.length === 0) {
              resolve([]);
              return;
            }

            // 应用限制和偏移
            const limit = query?.limit || 50;
            const offset = query?.offset || 0;
            const limitedResults = results.slice(offset, offset + limit);

            const fetchOptions = {
              bodies: 'HEADER.FIELDS (FROM TO CC BCC SUBJECT DATE MESSAGE-ID)',
              struct: true,
              envelope: true
            };

            const fetch = this.imapConnection!.fetch(limitedResults, fetchOptions);
            const messages: UnifiedEmailMessage[] = [];

            fetch.on('message', (msg, seqno) => {
              const message: Partial<ImapMessage> = { uid: seqno };

              msg.on('body', (stream, info) => {
                let buffer = '';
                stream.on('data', (chunk) => {
                  buffer += chunk.toString('ascii');
                });
                stream.once('end', () => {
                  // 解析头部信息
                  message.envelope = this.parseHeaders(buffer);
                });
              });

              msg.once('attributes', (attrs) => {
                message.flags = attrs.flags;
                message.date = attrs.date;
                message.struct = attrs.struct;
                message.size = attrs.size;
              });

              msg.once('end', () => {
                if (message.envelope) {
                  messages.push(this.convertToUnifiedMessage(message as ImapMessage, this.accountId));
                }
              });
            });

            fetch.once('error', reject);

            fetch.once('end', () => {
              resolve(messages);
            });
          });
        });
      });

      this.imapConnection.once('error', reject);
      this.imapConnection.connect();
    });
  }

  /**
   * 获取单条邮件
   */
  public async getMessage(messageId: string): Promise<UnifiedEmailMessage> {
    return new Promise((resolve, reject) => {
      if (!this.imapConnection) {
        reject(new Error('IMAP connection not established'));
        return;
      }

      this.imapConnection.once('ready', () => {
        this.imapConnection!.openBox('INBOX', true, (err, box) => {
          if (err) {
            reject(err);
            return;
          }

          const fetch = this.imapConnection!.fetch(messageId, {
            bodies: '',
            struct: true,
            envelope: true
          });

          let message: Partial<ImapMessage> = {};

          fetch.on('message', (msg, seqno) => {
            msg.on('body', (stream, info) => {
              let buffer = '';
              stream.on('data', (chunk) => {
                buffer += chunk.toString('ascii');
              });
              stream.once('end', () => {
                message.envelope = this.parseHeaders(buffer);
              });
            });

            msg.once('attributes', (attrs) => {
              message.uid = seqno;
              message.flags = attrs.flags;
              message.date = attrs.date;
              message.struct = attrs.struct;
              message.size = attrs.size;
            });

            msg.once('end', () => {
              if (message.envelope) {
                resolve(this.convertToUnifiedMessage(message as ImapMessage, this.accountId));
              } else {
                reject(new Error('Failed to parse message'));
              }
            });
          });

          fetch.once('error', reject);
        });
      });

      this.imapConnection.connect();
    });
  }

  /**
   * 发送邮件
   */
  public async sendMessage(message: EmailSendRequest): Promise<EmailOperationResult> {
    this.validateSendRequest(message);
    
    if (!this.smtpTransporter) {
      return this.createErrorResult(new Error('SMTP transporter not available'), 'sendMessage');
    }

    const startTime = new Date();
    
    try {
      const mailOptions = {
        from: this.config.smtp.username,
        to: message.to.map(r => r.name ? `${r.name} <${r.address}>` : r.address),
        cc: message.cc?.map(r => r.name ? `${r.name} <${r.address}>` : r.address),
        bcc: message.bcc?.map(r => r.name ? `${r.name} <${r.address}>` : r.address),
        subject: message.subject,
        text: message.body.text,
        html: message.body.html,
        attachments: message.attachments?.map(att => ({
          filename: att.name,
          content: att.content,
          contentType: att.contentType
        }))
      };

      await this.executeApiCall(
        () => this.smtpTransporter!.sendMail(mailOptions),
        'sendMessage'
      );

      return this.createSuccessResult(null, 'sendMessage', startTime);
    } catch (error) {
      return this.createErrorResult(error as Error, 'sendMessage');
    }
  }

  /**
   * 删除邮件
   */
  public async deleteMessage(messageId: string): Promise<EmailOperationResult> {
    const startTime = new Date();
    
    return new Promise((resolve) => {
      if (!this.imapConnection) {
        resolve(this.createErrorResult(new Error('IMAP connection not established'), 'deleteMessage'));
        return;
      }

      this.imapConnection.once('ready', () => {
        this.imapConnection!.openBox('INBOX', false, (err, box) => {
          if (err) {
            resolve(this.createErrorResult(err, 'deleteMessage'));
            return;
          }

          this.imapConnection!.addFlags(messageId, ['\\Deleted'], (err) => {
            if (err) {
              resolve(this.createErrorResult(err, 'deleteMessage'));
              return;
            }

            this.imapConnection!.expunge((err) => {
              if (err) {
                resolve(this.createErrorResult(err, 'deleteMessage'));
              } else {
                resolve(this.createSuccessResult(null, 'deleteMessage', startTime));
              }
            });
          });
        });
      });

      this.imapConnection.connect();
    });
  }

  /**
   * 标记邮件为已读/未读
   */
  public async markAsRead(messageId: string, isRead: boolean): Promise<EmailOperationResult> {
    const startTime = new Date();
    
    return new Promise((resolve) => {
      if (!this.imapConnection) {
        resolve(this.createErrorResult(new Error('IMAP connection not established'), 'markAsRead'));
        return;
      }

      this.imapConnection.once('ready', () => {
        this.imapConnection!.openBox('INBOX', false, (err, box) => {
          if (err) {
            resolve(this.createErrorResult(err, 'markAsRead'));
            return;
          }

          const action = isRead ? this.imapConnection!.addFlags : this.imapConnection!.delFlags;
          
          action.call(this.imapConnection, messageId, ['\\Seen'], (err) => {
            if (err) {
              resolve(this.createErrorResult(err, 'markAsRead'));
            } else {
              resolve(this.createSuccessResult(null, 'markAsRead', startTime));
            }
          });
        });
      });

      this.imapConnection.connect();
    });
  }

  /**
   * 获取文件夹列表
   */
  public async getFolders(): Promise<Array<{ id: string; name: string; type: string }>> {
    return new Promise((resolve, reject) => {
      if (!this.imapConnection) {
        reject(new Error('IMAP connection not established'));
        return;
      }

      this.imapConnection.once('ready', () => {
        this.imapConnection!.getBoxes((err, boxes) => {
          if (err) {
            reject(err);
            return;
          }

          const folders = this.flattenFolders(boxes).map(folder => ({
            id: folder.name,
            name: folder.displayName,
            type: this.mapFolderType(folder.name)
          }));

          resolve(folders);
        });
      });

      this.imapConnection.connect();
    });
  }

  /**
   * 移动邮件到指定文件夹
   */
  public async moveMessage(messageId: string, folderId: string): Promise<EmailOperationResult> {
    const startTime = new Date();
    
    return new Promise((resolve) => {
      if (!this.imapConnection) {
        resolve(this.createErrorResult(new Error('IMAP connection not established'), 'moveMessage'));
        return;
      }

      this.imapConnection.once('ready', () => {
        this.imapConnection!.openBox('INBOX', false, (err, box) => {
          if (err) {
            resolve(this.createErrorResult(err, 'moveMessage'));
            return;
          }

          this.imapConnection!.move(messageId, folderId, (err) => {
            if (err) {
              resolve(this.createErrorResult(err, 'moveMessage'));
            } else {
              resolve(this.createSuccessResult(null, 'moveMessage', startTime));
            }
          });
        });
      });

      this.imapConnection.connect();
    });
  }

  /**
   * 同步邮件
   */
  public async syncMessages(options?: { incremental?: boolean; folderId?: string }): Promise<{
    newMessages: UnifiedEmailMessage[];
    updatedMessages: UnifiedEmailMessage[];
    deletedMessageIds: string[];
  }> {
    try {
      const query: EmailSearchQuery = {
        folder: options?.folderId || 'INBOX',
        limit: 100,
        orderBy: 'date',
        orderDirection: 'desc'
      };

      if (options?.incremental) {
        // 只同步最近的邮件
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        query.dateRange = {
          start: yesterday,
          end: new Date()
        };
      }

      const messages = await this.getMessages(query);

      // IMAP不直接支持增量同步的变更检测
      // 这里简化处理，将所有消息视为新消息
      return {
        newMessages: messages,
        updatedMessages: [],
        deletedMessageIds: []
      };
    } catch (error) {
      logger.error('Failed to sync IMAP messages:', error);
      throw error;
    }
  }

  /**
   * 获取用户信息
   */
  public async getUserInfo(): Promise<{
    email: string;
    name: string;
    quota?: {
      used: number;
      total: number;
    };
  }> {
    return {
      email: this.config.imap.username,
      name: this.config.imap.username,
      quota: undefined // IMAP通常不提供配额信息
    };
  }

  /**
   * 将IMAP消息转换为统一格式
   */
  protected convertToUnifiedMessage(message: ImapMessage, accountId: string): UnifiedEmailMessage {
    const envelope = message.envelope!;
    
    return {
      id: message.uid!.toString(),
      providerId: message.uid!.toString(),
      provider: 'imap',
      accountId: accountId,
      subject: envelope.subject || '',
      sender: {
        name: envelope.from?.[0]?.name,
        address: `${envelope.from?.[0]?.mailbox}@${envelope.from?.[0]?.host}` || ''
      },
      recipients: {
        to: envelope.to?.map(addr => ({
          name: addr.name,
          address: `${addr.mailbox}@${addr.host}`
        })) || [],
        cc: envelope.cc?.map(addr => ({
          name: addr.name,
          address: `${addr.mailbox}@${addr.host}`
        })) || []
      },
      content: {
        text: undefined, // 需要额外获取邮件体内容
        html: undefined,
        snippet: undefined
      },
      receivedAt: message.date || new Date(),
      sentAt: envelope.date || new Date(),
      importance: 'normal', // IMAP不直接提供重要性信息
      isRead: !message.flags?.includes('\\Seen'),
      isDraft: message.flags?.includes('\\Draft') || false,
      hasAttachments: this.hasAttachments(message.struct),
      attachments: [],
      labels: [],
      folders: [],
      flags: message.flags || [],
      internetMessageId: envelope.messageId,
      metadata: {
        originalData: message
      }
    };
  }

  /**
   * 测试IMAP和SMTP连接
   */
  private async testConnections(): Promise<void> {
    // 测试IMAP连接
    await new Promise<void>((resolve, reject) => {
      if (!this.imapConnection) {
        reject(new Error('IMAP connection not created'));
        return;
      }

      this.imapConnection.once('ready', () => resolve());
      this.imapConnection.once('error', reject);
      this.imapConnection.connect();
    });

    // 测试SMTP连接
    if (this.smtpTransporter) {
      await this.smtpTransporter.verify();
    }
  }

  /**
   * 构建IMAP搜索条件
   */
  private buildSearchCriteria(query?: EmailSearchQuery): any[] {
    const criteria = ['ALL'];
    
    if (!query) return criteria;
    
    if (query.from) {
      criteria.push(['FROM', query.from]);
    }
    
    if (query.to) {
      criteria.push(['TO', query.to]);
    }
    
    if (query.subject) {
      criteria.push(['SUBJECT', query.subject]);
    }
    
    if (query.isRead === false) {
      criteria.push('UNSEEN');
    } else if (query.isRead === true) {
      criteria.push('SEEN');
    }
    
    if (query.dateRange) {
      criteria.push(['SINCE', query.dateRange.start]);
      criteria.push(['BEFORE', query.dateRange.end]);
    }
    
    return criteria;
  }

  /**
   * 解析邮件头部
   */
  private parseHeaders(headerString: string): any {
    // 简化的头部解析实现
    const headers: any = {};
    const lines = headerString.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        const [, name, value] = match;
        headers[name.toLowerCase()] = value.trim();
      }
    }
    
    return {
      date: new Date(headers.date || Date.now()),
      subject: headers.subject || '',
      from: this.parseAddressList(headers.from),
      to: this.parseAddressList(headers.to),
      cc: this.parseAddressList(headers.cc),
      messageId: headers['message-id']
    };
  }

  /**
   * 解析地址列表
   */
  private parseAddressList(addressString?: string): Array<{ name?: string; mailbox: string; host: string }> {
    if (!addressString) return [];
    
    // 简化的地址解析
    return addressString.split(',').map(addr => {
      const emailMatch = addr.match(/([^@]+)@([^@]+)/);
      if (emailMatch) {
        return {
          name: undefined,
          mailbox: emailMatch[1].trim(),
          host: emailMatch[2].trim()
        };
      }
      return {
        name: undefined,
        mailbox: addr.trim(),
        host: ''
      };
    }).filter(addr => addr.mailbox);
  }

  /**
   * 扁平化文件夹结构
   */
  private flattenFolders(boxes: any, prefix = ''): Array<{ name: string; displayName: string }> {
    const folders: Array<{ name: string; displayName: string }> = [];
    
    for (const [name, box] of Object.entries(boxes)) {
      const fullName = prefix ? `${prefix}/${name}` : name;
      folders.push({
        name: fullName,
        displayName: name
      });
      
      if ((box as any).children) {
        folders.push(...this.flattenFolders((box as any).children, fullName));
      }
    }
    
    return folders;
  }

  /**
   * 映射文件夹名称
   */
  private mapFolderName(folder: string): string {
    const folderMap: Record<string, string> = {
      'inbox': 'INBOX',
      'sent': 'Sent',
      'drafts': 'Drafts',
      'trash': 'Trash',
      'spam': 'Spam'
    };
    
    return folderMap[folder.toLowerCase()] || folder;
  }

  /**
   * 映射文件夹类型
   */
  private mapFolderType(folderName: string): string {
    const lowerName = folderName.toLowerCase();
    if (lowerName.includes('inbox')) return 'inbox';
    if (lowerName.includes('sent')) return 'sent';
    if (lowerName.includes('draft')) return 'drafts';
    if (lowerName.includes('trash')) return 'trash';
    if (lowerName.includes('spam')) return 'spam';
    return 'custom';
  }

  /**
   * 检查是否有附件
   */
  private hasAttachments(struct: any): boolean {
    if (!struct) return false;
    
    // 简化的附件检测
    if (Array.isArray(struct)) {
      return struct.some(part => 
        part.disposition && part.disposition.type === 'attachment'
      );
    }
    
    return false;
  }
}