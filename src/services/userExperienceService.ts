import { EventEmitter } from 'events';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS选择器或元素ID
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'click' | 'input' | 'scroll' | 'hover' | 'wait';
  duration?: number; // 持续时间（毫秒）
  skippable?: boolean;
  required?: boolean;
  nextCondition?: 'auto' | 'click' | 'custom';
  customContent?: React.ReactNode;
  media?: {
    type: 'image' | 'video' | 'gif';
    url: string;
    alt?: string;
  };
  interactive?: {
    highlightElement?: boolean;
    disableInteraction?: boolean;
    showProgress?: boolean;
  };
}

export interface OnboardingFlow {
  id: string;
  name: string;
  description: string;
  version: string;
  targetAudience: 'new_user' | 'existing_user' | 'admin' | 'power_user' | 'all';
  triggerCondition: 'first_visit' | 'feature_access' | 'manual' | 'conditional';
  steps: OnboardingStep[];
  completionCriteria: {
    requiredSteps: string[];
    timeLimit?: number;
    retryLimit?: number;
  };
  settings: {
    allowSkip: boolean;
    showProgress: boolean;
    enableKeyboardNavigation: boolean;
    responsiveDesign: boolean;
    autoSave: boolean;
  };
  analytics: {
    trackCompletion: boolean;
    trackDropoff: boolean;
    trackInteraction: boolean;
    customEvents: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProgress {
  userId: string;
  flowId: string;
  currentStep: number;
  completedSteps: string[];
  skippedSteps: string[];
  startedAt: Date;
  lastActiveAt: Date;
  completedAt?: Date;
  status: 'not_started' | 'in_progress' | 'completed' | 'abandoned';
  metadata: {
    userAgent: string;
    viewport: { width: number; height: number };
    interactions: Array<{
      stepId: string;
      action: string;
      timestamp: Date;
      duration: number;
    }>;
  };
}

export interface TooltipConfig {
  id: string;
  target: string;
  content: string;
  title?: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  trigger: 'hover' | 'click' | 'focus' | 'manual';
  delay?: number;
  duration?: number;
  arrow?: boolean;
  interactive?: boolean;
  theme?: 'light' | 'dark' | 'custom';
  animation?: 'fade' | 'slide' | 'bounce' | 'none';
  persistent?: boolean;
  conditions?: {
    viewport?: { min?: number; max?: number };
    userType?: string[];
    featureFlag?: string;
  };
}

export interface HelpContent {
  id: string;
  category: 'getting_started' | 'features' | 'troubleshooting' | 'advanced' | 'faq';
  title: string;
  content: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number; // 分钟
  prerequisites?: string[];
  relatedArticles?: string[];
  lastUpdated: Date;
  author: string;
  rating?: {
    average: number;
    count: number;
  };
  searchKeywords: string[];
}

export interface InteractionAnalytics {
  sessionId: string;
  userId: string;
  events: Array<{
    type: 'click' | 'hover' | 'scroll' | 'focus' | 'input' | 'navigation';
    element: string;
    timestamp: Date;
    duration?: number;
    metadata?: Record<string, any>;
  }>;
  heatmapData: Array<{
    x: number;
    y: number;
    intensity: number;
    timestamp: Date;
  }>;
  scrollDepth: Array<{
    page: string;
    maxDepth: number;
    timeToMaxDepth: number;
    timestamp: Date;
  }>;
  performance: {
    pageLoadTime: number;
    timeToInteractive: number;
    errorCount: number;
    crashes: number;
  };
}

export interface AccessibilityOptions {
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  screenReader: boolean;
  keyboardNavigation: boolean;
  focusIndicator: boolean;
  colorBlind: {
    enabled: boolean;
    type?: 'protanopia' | 'deuteranopia' | 'tritanopia';
  };
  dyslexiaFriendly: boolean;
  autoReadAloud: boolean;
}

class UserExperienceService extends EventEmitter {
  private flows: Map<string, OnboardingFlow> = new Map();
  private userProgress: Map<string, UserProgress> = new Map();
  private tooltips: Map<string, TooltipConfig> = new Map();
  private helpContent: Map<string, HelpContent> = new Map();
  private analytics: Map<string, InteractionAnalytics> = new Map();
  private accessibilitySettings: AccessibilityOptions;

  constructor() {
    super();
    this.accessibilitySettings = this.getDefaultAccessibilitySettings();
    this.initializeDefaultContent();
  }

  // 引导流程管理
  async createOnboardingFlow(flow: Omit<OnboardingFlow, 'id' | 'createdAt' | 'updatedAt'>): Promise<OnboardingFlow> {
    const id = `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const newFlow: OnboardingFlow = {
      ...flow,
      id,
      createdAt: now,
      updatedAt: now
    };

    this.flows.set(id, newFlow);
    this.emit('flowCreated', newFlow);
    return newFlow;
  }

  async updateOnboardingFlow(id: string, updates: Partial<OnboardingFlow>): Promise<OnboardingFlow | null> {
    const flow = this.flows.get(id);
    if (!flow) return null;

    const updatedFlow = {
      ...flow,
      ...updates,
      updatedAt: new Date()
    };

    this.flows.set(id, updatedFlow);
    this.emit('flowUpdated', updatedFlow);
    return updatedFlow;
  }

  getOnboardingFlow(id: string): OnboardingFlow | null {
    return this.flows.get(id) || null;
  }

  getAllOnboardingFlows(): OnboardingFlow[] {
    return Array.from(this.flows.values());
  }

  async startOnboardingFlow(flowId: string, userId: string): Promise<UserProgress> {
    const flow = this.flows.get(flowId);
    if (!flow) throw new Error(`Flow ${flowId} not found`);

    const progressId = `${userId}_${flowId}`;
    const progress: UserProgress = {
      userId,
      flowId,
      currentStep: 0,
      completedSteps: [],
      skippedSteps: [],
      startedAt: new Date(),
      lastActiveAt: new Date(),
      status: 'in_progress',
      metadata: {
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        interactions: []
      }
    };

    this.userProgress.set(progressId, progress);
    this.emit('flowStarted', progress);
    return progress;
  }

  async updateUserProgress(userId: string, flowId: string, updates: Partial<UserProgress>): Promise<UserProgress | null> {
    const progressId = `${userId}_${flowId}`;
    const progress = this.userProgress.get(progressId);
    if (!progress) return null;

    const updatedProgress = {
      ...progress,
      ...updates,
      lastActiveAt: new Date()
    };

    this.userProgress.set(progressId, updatedProgress);
    this.emit('progressUpdated', updatedProgress);
    return updatedProgress;
  }

  getUserProgress(userId: string, flowId: string): UserProgress | null {
    const progressId = `${userId}_${flowId}`;
    return this.userProgress.get(progressId) || null;
  }

  async completeStep(userId: string, flowId: string, stepId: string, duration: number): Promise<void> {
    const progress = await this.updateUserProgress(userId, flowId, {
      completedSteps: [...(this.getUserProgress(userId, flowId)?.completedSteps || []), stepId]
    });

    if (progress) {
      progress.metadata.interactions.push({
        stepId,
        action: 'complete',
        timestamp: new Date(),
        duration
      });

      this.emit('stepCompleted', { progress, stepId, duration });
    }
  }

  async skipStep(userId: string, flowId: string, stepId: string): Promise<void> {
    const progress = await this.updateUserProgress(userId, flowId, {
      skippedSteps: [...(this.getUserProgress(userId, flowId)?.skippedSteps || []), stepId]
    });

    if (progress) {
      this.emit('stepSkipped', { progress, stepId });
    }
  }

  // 智能提示系统
  async createTooltip(config: Omit<TooltipConfig, 'id'>): Promise<TooltipConfig> {
    const id = `tooltip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tooltip: TooltipConfig = { ...config, id };

    this.tooltips.set(id, tooltip);
    this.emit('tooltipCreated', tooltip);
    return tooltip;
  }

  getTooltip(id: string): TooltipConfig | null {
    return this.tooltips.get(id) || null;
  }

  getTooltipsForTarget(target: string): TooltipConfig[] {
    return Array.from(this.tooltips.values()).filter(t => t.target === target);
  }

  async showContextualHelp(element: string, context: Record<string, any>): Promise<TooltipConfig[]> {
    // 基于上下文和用户行为智能显示相关帮助
    const relevantTooltips = this.getTooltipsForTarget(element);

    return relevantTooltips.filter(tooltip => {
      if (!tooltip.conditions) return true;

      // 检查视口条件
      if (tooltip.conditions.viewport) {
        const width = window.innerWidth;
        if (tooltip.conditions.viewport.min && width < tooltip.conditions.viewport.min) return false;
        if (tooltip.conditions.viewport.max && width > tooltip.conditions.viewport.max) return false;
      }

      // 检查用户类型条件
      if (tooltip.conditions.userType && !tooltip.conditions.userType.includes(context.userType)) {
        return false;
      }

      return true;
    });
  }

  // 帮助内容管理
  async createHelpContent(content: Omit<HelpContent, 'id'>): Promise<HelpContent> {
    const id = `help_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const helpArticle: HelpContent = { ...content, id };

    this.helpContent.set(id, helpArticle);
    this.emit('helpContentCreated', helpArticle);
    return helpArticle;
  }

  getHelpContent(id: string): HelpContent | null {
    return this.helpContent.get(id) || null;
  }

  searchHelpContent(query: string, filters?: {
    category?: HelpContent['category'];
    difficulty?: HelpContent['difficulty'];
    tags?: string[];
  }): HelpContent[] {
    const allContent = Array.from(this.helpContent.values());
    const queryLower = query.toLowerCase();

    return allContent.filter(content => {
      // 文本搜索
      const matchesQuery =
        content.title.toLowerCase().includes(queryLower) ||
        content.content.toLowerCase().includes(queryLower) ||
        content.searchKeywords.some(keyword => keyword.toLowerCase().includes(queryLower)) ||
        content.tags.some(tag => tag.toLowerCase().includes(queryLower));

      if (!matchesQuery) return false;

      // 分类过滤
      if (filters?.category && content.category !== filters.category) return false;

      // 难度过滤
      if (filters?.difficulty && content.difficulty !== filters.difficulty) return false;

      // 标签过滤
      if (filters?.tags && !filters.tags.every(tag => content.tags.includes(tag))) return false;

      return true;
    }).sort((a, b) => {
      // 按相关性和评分排序
      const aScore = (a.rating?.average || 0) * (a.rating?.count || 1);
      const bScore = (b.rating?.average || 0) * (b.rating?.count || 1);
      return bScore - aScore;
    });
  }

  // 交互分析
  async trackInteraction(sessionId: string, userId: string, event: InteractionAnalytics['events'][0]): Promise<void> {
    let analytics = this.analytics.get(sessionId);

    if (!analytics) {
      analytics = {
        sessionId,
        userId,
        events: [],
        heatmapData: [],
        scrollDepth: [],
        performance: {
          pageLoadTime: 0,
          timeToInteractive: 0,
          errorCount: 0,
          crashes: 0
        }
      };
      this.analytics.set(sessionId, analytics);
    }

    analytics.events.push(event);
    this.emit('interactionTracked', { sessionId, event });
  }

  async trackHeatmapData(sessionId: string, x: number, y: number, intensity: number): Promise<void> {
    const analytics = this.analytics.get(sessionId);
    if (analytics) {
      analytics.heatmapData.push({
        x, y, intensity,
        timestamp: new Date()
      });
    }
  }

  getInteractionAnalytics(sessionId: string): InteractionAnalytics | null {
    return this.analytics.get(sessionId) || null;
  }

  // 无障碍功能
  updateAccessibilitySettings(settings: Partial<AccessibilityOptions>): void {
    this.accessibilitySettings = { ...this.accessibilitySettings, ...settings };
    this.applyAccessibilitySettings();
    this.emit('accessibilitySettingsUpdated', this.accessibilitySettings);
  }

  getAccessibilitySettings(): AccessibilityOptions {
    return { ...this.accessibilitySettings };
  }

  private applyAccessibilitySettings(): void {
    const root = document.documentElement;

    // 高对比度
    if (this.accessibilitySettings.highContrast) {
      root.style.setProperty('--contrast-filter', 'contrast(150%)');
    } else {
      root.style.removeProperty('--contrast-filter');
    }

    // 大字体
    if (this.accessibilitySettings.largeText) {
      root.style.setProperty('--font-scale', '1.2');
    } else {
      root.style.removeProperty('--font-scale');
    }

    // 减少动画
    if (this.accessibilitySettings.reducedMotion) {
      root.style.setProperty('--animation-duration', '0.01ms');
    } else {
      root.style.removeProperty('--animation-duration');
    }

    // 焦点指示器
    if (this.accessibilitySettings.focusIndicator) {
      root.style.setProperty('--focus-ring', '3px solid #0066cc');
    } else {
      root.style.removeProperty('--focus-ring');
    }
  }

  // 个性化推荐
  async getPersonalizedRecommendations(userId: string, context: Record<string, any>): Promise<Array<{
    type: 'tutorial' | 'feature' | 'shortcut' | 'tip';
    title: string;
    description: string;
    action?: string;
    priority: number;
  }>> {
    // 基于用户行为和上下文生成个性化推荐
    const userProgress = Array.from(this.userProgress.values()).filter(p => p.userId === userId);
    const recommendations = [];

    // 分析用户的学习进度
    const completionRate = userProgress.reduce((acc, progress) => {
      const flow = this.flows.get(progress.flowId);
      if (flow) {
        return acc + (progress.completedSteps.length / flow.steps.length);
      }
      return acc;
    }, 0) / Math.max(userProgress.length, 1);

    if (completionRate < 0.5) {
      recommendations.push({
        type: 'tutorial',
        title: '继续新手引导',
        description: '完成引导流程来更好地了解功能',
        action: 'resume_onboarding',
        priority: 10
      });
    }

    // 基于使用频率推荐功能
    const sessionAnalytics = Array.from(this.analytics.values()).filter(a => a.userId === userId);
    const frequentActions = new Map<string, number>();

    sessionAnalytics.forEach(analytics => {
      analytics.events.forEach(event => {
        const count = frequentActions.get(event.element) || 0;
        frequentActions.set(event.element, count + 1);
      });
    });

    // 推荐相关快捷键
    if (frequentActions.size > 0) {
      recommendations.push({
        type: 'shortcut',
        title: '键盘快捷键',
        description: '使用快捷键提高工作效率',
        priority: 8
      });
    }

    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  // 性能监控
  async trackPerformanceMetrics(sessionId: string, metrics: Partial<InteractionAnalytics['performance']>): Promise<void> {
    const analytics = this.analytics.get(sessionId);
    if (analytics) {
      analytics.performance = { ...analytics.performance, ...metrics };
      this.emit('performanceTracked', { sessionId, metrics });
    }
  }

  // A/B测试支持
  async getVariantForUser(userId: string, testName: string): Promise<string> {
    // 简单的确定性A/B测试分配
    const hash = this.hashString(`${userId}_${testName}`);
    return hash % 2 === 0 ? 'A' : 'B';
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private getDefaultAccessibilitySettings(): AccessibilityOptions {
    return {
      highContrast: false,
      largeText: false,
      reducedMotion: false,
      screenReader: false,
      keyboardNavigation: true,
      focusIndicator: true,
      colorBlind: { enabled: false },
      dyslexiaFriendly: false,
      autoReadAloud: false
    };
  }

  private initializeDefaultContent(): void {
    // 初始化默认的帮助内容
    this.createHelpContent({
      category: 'getting_started',
      title: '快速开始指南',
      content: '欢迎使用Email Assist！这是一个智能邮件管理系统...',
      tags: ['入门', '基础'],
      difficulty: 'beginner',
      estimatedTime: 5,
      lastUpdated: new Date(),
      author: 'Email Assist Team',
      searchKeywords: ['开始', '入门', '新手', '指南']
    });

    this.createHelpContent({
      category: 'features',
      title: 'AI邮件分析功能',
      content: '了解如何使用AI功能分析邮件内容、情感和优先级...',
      tags: ['AI', '分析', '功能'],
      difficulty: 'intermediate',
      estimatedTime: 10,
      lastUpdated: new Date(),
      author: 'Email Assist Team',
      searchKeywords: ['AI', '人工智能', '分析', '邮件']
    });

    // 初始化默认的引导流程
    this.createOnboardingFlow({
      name: '新用户引导',
      description: '帮助新用户快速了解和使用Email Assist',
      version: '1.0.0',
      targetAudience: 'new_user',
      triggerCondition: 'first_visit',
      steps: [
        {
          id: 'welcome',
          title: '欢迎使用Email Assist',
          description: '欢迎！让我们快速了解一下Email Assist的主要功能。',
          position: 'center',
          nextCondition: 'click',
          skippable: true,
          interactive: { showProgress: true }
        },
        {
          id: 'dashboard_tour',
          title: '仪表板概览',
          description: '这里是您的邮件管理中心，可以查看关键指标和统计信息。',
          target: '#dashboard',
          position: 'bottom',
          nextCondition: 'click',
          interactive: { highlightElement: true, showProgress: true }
        },
        {
          id: 'ai_features',
          title: 'AI智能分析',
          description: '点击这里访问AI邮件分析功能，自动分类和优先级排序。',
          target: '#ai-analysis',
          position: 'right',
          action: 'click',
          interactive: { highlightElement: true, showProgress: true }
        }
      ],
      completionCriteria: {
        requiredSteps: ['welcome', 'dashboard_tour']
      },
      settings: {
        allowSkip: true,
        showProgress: true,
        enableKeyboardNavigation: true,
        responsiveDesign: true,
        autoSave: true
      },
      analytics: {
        trackCompletion: true,
        trackDropoff: true,
        trackInteraction: true,
        customEvents: ['feature_discovery', 'engagement_level']
      }
    });
  }
}

export const userExperienceService = new UserExperienceService();