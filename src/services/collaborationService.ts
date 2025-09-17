import { EventEmitter } from 'events';

export interface CollaborationItem {
  id: string;
  type: 'discussion' | 'task' | 'file' | 'meeting' | 'decision';
  title: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  teamId: string;
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'active' | 'completed' | 'archived';
  participants: string[];
  attachments: Array<{
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
  }>;
  reactions: Array<{
    emoji: string;
    count: number;
    users: string[];
  }>;
  comments: CollaborationComment[];
}

export interface CollaborationComment {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: Date;
  parentId?: string;
  reactions: Array<{
    emoji: string;
    count: number;
    users: string[];
  }>;
}

export interface CreateCollaborationItemData {
  type: 'discussion' | 'task' | 'file' | 'meeting' | 'decision';
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  teamId: string;
}

export interface AddCommentData {
  content: string;
  parentId?: string;
}

export interface ReactionData {
  emoji: string;
}

class CollaborationService extends EventEmitter {
  private items: CollaborationItem[] = [];
  private wsConnection: WebSocket | null = null;
  private isOnline: boolean = true;

  constructor() {
    super();
    this.initializeService();
  }

  private initializeService() {
    // 检查网络状态
    this.isOnline = navigator.onLine;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.emit('connectionChange', true);
      this.reconnectWebSocket();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.emit('connectionChange', false);
    });

    // 初始化WebSocket连接
    this.connectWebSocket();
  }

  private connectWebSocket() {
    if (!this.isOnline) return;

    try {
      const wsUrl = process.env.NODE_ENV === 'production'
        ? 'wss://your-domain.com/ws/collaboration'
        : 'ws://localhost:3001/ws/collaboration';

      this.wsConnection = new WebSocket(wsUrl);

      this.wsConnection.onopen = () => {
        console.log('Collaboration WebSocket connected');
        this.emit('connected');
      };

      this.wsConnection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.wsConnection.onclose = () => {
        console.log('Collaboration WebSocket disconnected');
        this.emit('disconnected');

        // 自动重连
        if (this.isOnline) {
          setTimeout(() => this.connectWebSocket(), 3000);
        }
      };

      this.wsConnection.onerror = (error) => {
        console.error('Collaboration WebSocket error:', error);
        this.emit('error', error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }

  private reconnectWebSocket() {
    if (this.wsConnection) {
      this.wsConnection.close();
    }
    this.connectWebSocket();
  }

  private handleWebSocketMessage(data: any) {
    switch (data.type) {
      case 'item_created':
        this.handleItemCreated(data.item);
        break;
      case 'item_updated':
        this.handleItemUpdated(data.item);
        break;
      case 'comment_added':
        this.handleCommentAdded(data.itemId, data.comment);
        break;
      case 'reaction_updated':
        this.handleReactionUpdated(data.itemId, data.reactions);
        break;
      default:
        console.warn('Unknown WebSocket message type:', data.type);
    }
  }

  private handleItemCreated(item: CollaborationItem) {
    this.items.unshift(item);
    this.emit('itemCreated', item);
  }

  private handleItemUpdated(updatedItem: CollaborationItem) {
    const index = this.items.findIndex(item => item.id === updatedItem.id);
    if (index !== -1) {
      this.items[index] = updatedItem;
      this.emit('itemUpdated', updatedItem);
    }
  }

  private handleCommentAdded(itemId: string, comment: CollaborationComment) {
    const item = this.items.find(item => item.id === itemId);
    if (item) {
      item.comments.push(comment);
      this.emit('commentAdded', itemId, comment);
    }
  }

  private handleReactionUpdated(itemId: string, reactions: any[]) {
    const item = this.items.find(item => item.id === itemId);
    if (item) {
      item.reactions = reactions;
      this.emit('reactionUpdated', itemId, reactions);
    }
  }

  private sendWebSocketMessage(message: any) {
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify(message));
    }
  }

  // 公共API方法

  /**
   * 获取协作项目列表
   */
  async getItems(teamId: string, filters?: {
    type?: string;
    search?: string;
    priority?: string;
    status?: string;
  }): Promise<CollaborationItem[]> {
    try {
      // 在实际应用中，这里会调用API
      let filteredItems = this.items.filter(item => item.teamId === teamId);

      if (filters) {
        if (filters.type && filters.type !== 'all') {
          filteredItems = filteredItems.filter(item => item.type === filters.type);
        }
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          filteredItems = filteredItems.filter(item =>
            item.title.toLowerCase().includes(searchLower) ||
            item.content.toLowerCase().includes(searchLower) ||
            item.tags.some(tag => tag.toLowerCase().includes(searchLower))
          );
        }
        if (filters.priority) {
          filteredItems = filteredItems.filter(item => item.priority === filters.priority);
        }
        if (filters.status) {
          filteredItems = filteredItems.filter(item => item.status === filters.status);
        }
      }

      return filteredItems.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (error) {
      console.error('Failed to get collaboration items:', error);
      throw error;
    }
  }

  /**
   * 创建新的协作项目
   */
  async createItem(data: CreateCollaborationItemData): Promise<CollaborationItem> {
    try {
      const newItem: CollaborationItem = {
        id: Date.now().toString(),
        ...data,
        author: {
          id: 'current-user',
          name: '当前用户',
          avatar: '',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'active',
        participants: ['current-user'],
        attachments: [],
        reactions: [],
        comments: [],
      };

      // 发送WebSocket消息
      this.sendWebSocketMessage({
        type: 'create_item',
        item: newItem,
      });

      // 本地添加（实际应用中会等待服务器确认）
      this.items.unshift(newItem);

      return newItem;
    } catch (error) {
      console.error('Failed to create collaboration item:', error);
      throw error;
    }
  }

  /**
   * 更新协作项目
   */
  async updateItem(itemId: string, updates: Partial<CollaborationItem>): Promise<CollaborationItem> {
    try {
      const itemIndex = this.items.findIndex(item => item.id === itemId);
      if (itemIndex === -1) {
        throw new Error('Item not found');
      }

      const updatedItem = {
        ...this.items[itemIndex],
        ...updates,
        updatedAt: new Date(),
      };

      // 发送WebSocket消息
      this.sendWebSocketMessage({
        type: 'update_item',
        itemId,
        updates: { ...updates, updatedAt: new Date() },
      });

      this.items[itemIndex] = updatedItem;

      return updatedItem;
    } catch (error) {
      console.error('Failed to update collaboration item:', error);
      throw error;
    }
  }

  /**
   * 删除协作项目
   */
  async deleteItem(itemId: string): Promise<void> {
    try {
      this.items = this.items.filter(item => item.id !== itemId);

      // 发送WebSocket消息
      this.sendWebSocketMessage({
        type: 'delete_item',
        itemId,
      });
    } catch (error) {
      console.error('Failed to delete collaboration item:', error);
      throw error;
    }
  }

  /**
   * 添加评论
   */
  async addComment(itemId: string, data: AddCommentData): Promise<CollaborationComment> {
    try {
      const comment: CollaborationComment = {
        id: Date.now().toString(),
        content: data.content,
        author: {
          id: 'current-user',
          name: '当前用户',
          avatar: '',
        },
        createdAt: new Date(),
        parentId: data.parentId,
        reactions: [],
      };

      const item = this.items.find(item => item.id === itemId);
      if (item) {
        item.comments.push(comment);
        item.updatedAt = new Date();
      }

      // 发送WebSocket消息
      this.sendWebSocketMessage({
        type: 'add_comment',
        itemId,
        comment,
      });

      return comment;
    } catch (error) {
      console.error('Failed to add comment:', error);
      throw error;
    }
  }

  /**
   * 添加或移除反应
   */
  async toggleReaction(itemId: string, emoji: string): Promise<void> {
    try {
      const item = this.items.find(item => item.id === itemId);
      if (!item) {
        throw new Error('Item not found');
      }

      const existingReaction = item.reactions.find(r => r.emoji === emoji);
      const currentUserId = 'current-user';

      if (existingReaction) {
        if (existingReaction.users.includes(currentUserId)) {
          // 移除反应
          existingReaction.count = Math.max(0, existingReaction.count - 1);
          existingReaction.users = existingReaction.users.filter(u => u !== currentUserId);

          if (existingReaction.count === 0) {
            item.reactions = item.reactions.filter(r => r.emoji !== emoji);
          }
        } else {
          // 添加反应
          existingReaction.count += 1;
          existingReaction.users.push(currentUserId);
        }
      } else {
        // 新反应
        item.reactions.push({
          emoji,
          count: 1,
          users: [currentUserId],
        });
      }

      item.updatedAt = new Date();

      // 发送WebSocket消息
      this.sendWebSocketMessage({
        type: 'toggle_reaction',
        itemId,
        emoji,
        userId: currentUserId,
      });
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
      throw error;
    }
  }

  /**
   * 添加参与者
   */
  async addParticipant(itemId: string, userId: string): Promise<void> {
    try {
      const item = this.items.find(item => item.id === itemId);
      if (item && !item.participants.includes(userId)) {
        item.participants.push(userId);
        item.updatedAt = new Date();

        // 发送WebSocket消息
        this.sendWebSocketMessage({
          type: 'add_participant',
          itemId,
          userId,
        });
      }
    } catch (error) {
      console.error('Failed to add participant:', error);
      throw error;
    }
  }

  /**
   * 移除参与者
   */
  async removeParticipant(itemId: string, userId: string): Promise<void> {
    try {
      const item = this.items.find(item => item.id === itemId);
      if (item) {
        item.participants = item.participants.filter(p => p !== userId);
        item.updatedAt = new Date();

        // 发送WebSocket消息
        this.sendWebSocketMessage({
          type: 'remove_participant',
          itemId,
          userId,
        });
      }
    } catch (error) {
      console.error('Failed to remove participant:', error);
      throw error;
    }
  }

  /**
   * 获取协作项目详情
   */
  async getItemById(itemId: string): Promise<CollaborationItem | null> {
    try {
      return this.items.find(item => item.id === itemId) || null;
    } catch (error) {
      console.error('Failed to get collaboration item:', error);
      throw error;
    }
  }

  /**
   * 搜索协作项目
   */
  async searchItems(teamId: string, query: string): Promise<CollaborationItem[]> {
    try {
      const queryLower = query.toLowerCase();
      return this.items
        .filter(item => item.teamId === teamId)
        .filter(item =>
          item.title.toLowerCase().includes(queryLower) ||
          item.content.toLowerCase().includes(queryLower) ||
          item.tags.some(tag => tag.toLowerCase().includes(queryLower)) ||
          item.comments.some(comment => comment.content.toLowerCase().includes(queryLower))
        )
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (error) {
      console.error('Failed to search collaboration items:', error);
      throw error;
    }
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
    this.removeAllListeners();
  }
}

// 单例实例
export const collaborationService = new CollaborationService();

export default collaborationService;