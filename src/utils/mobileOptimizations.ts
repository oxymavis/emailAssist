// 移动端性能优化工具

import { debounce, throttle } from 'lodash';

// 扩展CSSStyleDeclaration类型以支持webkit属性
declare global {
  interface CSSStyleDeclaration {
    webkitOverflowScrolling: string;
  }
}

export interface ViewportMeta {
  width: number;
  height: number;
  scale: number;
  orientation: 'portrait' | 'landscape';
}

export interface CustomTouchEvent {
  type: 'touchstart' | 'touchmove' | 'touchend';
  touches: Touch[];
  timestamp: number;
}

export class MobileOptimizationService {
  private static instance: MobileOptimizationService;
  private viewport: ViewportMeta;
  private touchEventQueue: CustomTouchEvent[] = [];
  private isInitialized = false;

  constructor() {
    this.viewport = this.getViewportInfo();
    this.init();
  }

  static getInstance(): MobileOptimizationService {
    if (!MobileOptimizationService.instance) {
      MobileOptimizationService.instance = new MobileOptimizationService();
    }
    return MobileOptimizationService.instance;
  }

  private init() {
    if (this.isInitialized) return;

    this.setupViewportOptimizations();
    this.setupTouchOptimizations();
    this.setupScrollOptimizations();
    this.setupImageOptimizations();
    this.setupFontOptimizations();
    this.setupMemoryOptimizations();

    this.isInitialized = true;
  }

  // 获取视口信息
  private getViewportInfo(): ViewportMeta {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      scale: window.devicePixelRatio || 1,
      orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
    };
  }

  // 设置视口优化
  private setupViewportOptimizations() {
    // 防止缩放
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      viewportMeta.setAttribute('content',
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
      );
    } else {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
      document.head.appendChild(meta);
    }

    // 监听视口变化
    window.addEventListener('resize', throttle(() => {
      this.viewport = this.getViewportInfo();
      this.handleViewportChange();
    }, 100));

    window.addEventListener('orientationchange', debounce(() => {
      setTimeout(() => {
        this.viewport = this.getViewportInfo();
        this.handleViewportChange();
      }, 100);
    }, 300));
  }

  // 处理视口变化
  private handleViewportChange() {
    // 重新计算布局
    document.body.style.height = `${this.viewport.height}px`;

    // 发送自定义事件
    window.dispatchEvent(new CustomEvent('viewportChange', {
      detail: this.viewport
    }));
  }

  // 设置触摸优化
  private setupTouchOptimizations() {
    // 禁用双击缩放
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, { passive: false });

    // 优化触摸事件处理
    const handleTouchStart = (e: globalThis.TouchEvent) => {
      this.touchEventQueue.push({
        type: 'touchstart',
        touches: Array.from(e.touches),
        timestamp: Date.now(),
      });
    };

    const handleTouchMove = throttle((e: globalThis.TouchEvent) => {
      this.touchEventQueue.push({
        type: 'touchmove',
        touches: Array.from(e.touches),
        timestamp: Date.now(),
      });
    }, 16); // 60fps

    const handleTouchEnd = (e: globalThis.TouchEvent) => {
      this.touchEventQueue.push({
        type: 'touchend',
        touches: Array.from(e.touches),
        timestamp: Date.now(),
      });

      // 清理旧的触摸事件
      const cutoff = Date.now() - 1000;
      this.touchEventQueue = this.touchEventQueue.filter(event => event.timestamp > cutoff);
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
  }

  // 设置滚动优化
  private setupScrollOptimizations() {
    // 平滑滚动
    document.documentElement.style.scrollBehavior = 'smooth';

    // iOS 滚动优化
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      document.body.style.webkitOverflowScrolling = 'touch';
    }

    // 滚动性能优化
    const scrollables = document.querySelectorAll('[data-scrollable]');
    scrollables.forEach(element => {
      (element as HTMLElement).style.webkitOverflowScrolling = 'touch';
      (element as HTMLElement).style.willChange = 'scroll-position';
    });
  }

  // 设置图片优化
  private setupImageOptimizations() {
    // 懒加载图片
    const images = document.querySelectorAll('img[data-src]');

    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            img.src = img.dataset.src || '';
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
          }
        });
      }, {
        rootMargin: '50px',
        threshold: 0.1,
      });

      images.forEach(img => imageObserver.observe(img));
    }

    // 响应式图片
    this.setupResponsiveImages();
  }

  // 设置响应式图片
  private setupResponsiveImages() {
    const images = document.querySelectorAll('img[data-responsive]');

    images.forEach(img => {
      const imageElement = img as HTMLImageElement;
      const baseSrc = imageElement.dataset.responsive;

      if (baseSrc) {
        const pixelRatio = window.devicePixelRatio || 1;
        const width = imageElement.offsetWidth * pixelRatio;

        // 根据设备像素比和宽度选择合适的图片
        let suffix = '';
        if (width <= 400) suffix = '_small';
        else if (width <= 800) suffix = '_medium';
        else if (width <= 1200) suffix = '_large';
        else suffix = '_xlarge';

        if (pixelRatio > 1) suffix += '@2x';

        const optimizedSrc = baseSrc.replace(/(\.[^.]+)$/, `${suffix}$1`);
        imageElement.src = optimizedSrc;
      }
    });
  }

  // 设置字体优化
  private setupFontOptimizations() {
    // 字体显示策略
    const style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-family: 'Roboto';
        font-display: swap;
      }

      body {
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
    `;
    document.head.appendChild(style);

    // 预加载关键字体
    const fontPreloads = [
      'Roboto-Regular.woff2',
      'Roboto-Medium.woff2',
      'Roboto-Bold.woff2',
    ];

    fontPreloads.forEach(font => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'font';
      link.type = 'font/woff2';
      link.crossOrigin = 'anonymous';
      link.href = `/fonts/${font}`;
      document.head.appendChild(link);
    });
  }

  // 设置内存优化
  private setupMemoryOptimizations() {
    // 监听内存压力
    if ('memory' in performance && 'usedJSHeapSize' in (performance as any).memory) {
      const checkMemory = () => {
        const memory = (performance as any).memory;
        const usedRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

        if (usedRatio > 0.8) {
          this.handleMemoryPressure();
        }
      };

      setInterval(checkMemory, 10000); // 每10秒检查一次
    }

    // 页面可见性API优化
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.handlePageHidden();
      } else {
        this.handlePageVisible();
      }
    });
  }

  // 处理内存压力
  private handleMemoryPressure() {
    // 清理缓存
    this.clearImageCache();

    // 强制垃圾回收（如果支持）
    if ('gc' in window) {
      (window as any).gc();
    }

    // 减少DOM元素
    this.cleanupDOMElements();
  }

  // 清理图片缓存
  private clearImageCache() {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      // 移除不在视口中的图片源
      if (!this.isElementInViewport(img)) {
        const src = img.src;
        img.src = '';
        img.dataset.originalSrc = src;
      }
    });
  }

  // 检查元素是否在视口中
  private isElementInViewport(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );
  }

  // 清理DOM元素
  private cleanupDOMElements() {
    // 移除隐藏的元素
    const hiddenElements = document.querySelectorAll('[style*="display: none"]');
    hiddenElements.forEach(element => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });

    // 清理事件监听器
    this.cleanupEventListeners();
  }

  // 清理事件监听器
  private cleanupEventListeners() {
    // 移除不必要的事件监听器
    const elements = document.querySelectorAll('[data-cleanup-listeners]');
    elements.forEach(element => {
      const clonedElement = element.cloneNode(true);
      element.parentNode?.replaceChild(clonedElement, element);
    });
  }

  // 处理页面隐藏
  private handlePageHidden() {
    // 暂停动画
    this.pauseAnimations();

    // 降低定时器频率
    this.reduceTimerFrequency();

    // 暂停网络请求
    this.pauseNetworkRequests();
  }

  // 处理页面可见
  private handlePageVisible() {
    // 恢复动画
    this.resumeAnimations();

    // 恢复定时器频率
    this.resumeTimerFrequency();

    // 恢复网络请求
    this.resumeNetworkRequests();
  }

  // 暂停动画
  private pauseAnimations() {
    const animatedElements = document.querySelectorAll('[data-animated]');
    animatedElements.forEach(element => {
      (element as HTMLElement).style.animationPlayState = 'paused';
    });
  }

  // 恢复动画
  private resumeAnimations() {
    const animatedElements = document.querySelectorAll('[data-animated]');
    animatedElements.forEach(element => {
      (element as HTMLElement).style.animationPlayState = 'running';
    });
  }

  // 降低定时器频率
  private reduceTimerFrequency() {
    // 实现定时器频率控制逻辑
    window.dispatchEvent(new CustomEvent('reduceTimerFrequency'));
  }

  // 恢复定时器频率
  private resumeTimerFrequency() {
    // 实现定时器频率恢复逻辑
    window.dispatchEvent(new CustomEvent('resumeTimerFrequency'));
  }

  // 暂停网络请求
  private pauseNetworkRequests() {
    // 实现网络请求暂停逻辑
    window.dispatchEvent(new CustomEvent('pauseNetworkRequests'));
  }

  // 恢复网络请求
  private resumeNetworkRequests() {
    // 实现网络请求恢复逻辑
    window.dispatchEvent(new CustomEvent('resumeNetworkRequests'));
  }

  // 公共API方法

  // 获取当前视口信息
  public getViewport(): ViewportMeta {
    return { ...this.viewport };
  }

  // 检查设备是否为移动设备
  public isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  // 检查是否为低端设备
  public isLowEndDevice(): boolean {
    if ('hardwareConcurrency' in navigator && navigator.hardwareConcurrency <= 2) {
      return true;
    }

    if ('memory' in performance && (performance as any).memory.jsHeapSizeLimit < 1000000000) {
      return true;
    }

    return false;
  }

  // 优化图片加载
  public optimizeImageLoading(imageSelector: string) {
    const images = document.querySelectorAll(imageSelector);

    images.forEach(img => {
      const imageElement = img as HTMLImageElement;

      // 懒加载
      imageElement.loading = 'lazy';

      // 响应式处理
      imageElement.dataset.responsive = imageElement.src;
      this.setupResponsiveImages();
    });
  }

  // 预加载关键资源
  public preloadCriticalResources(resources: string[]) {
    resources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'preload';

      if (resource.endsWith('.css')) {
        link.as = 'style';
      } else if (resource.endsWith('.js')) {
        link.as = 'script';
      } else if (resource.match(/\.(jpg|jpeg|png|webp|avif)$/)) {
        link.as = 'image';
      } else if (resource.match(/\.(woff|woff2|ttf|otf)$/)) {
        link.as = 'font';
        link.crossOrigin = 'anonymous';
      }

      link.href = resource;
      document.head.appendChild(link);
    });
  }

  // 获取性能指标
  public getPerformanceMetrics() {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    return {
      // Core Web Vitals
      FCP: this.getFCP(),
      LCP: this.getLCP(),
      CLS: this.getCLS(),
      FID: this.getFID(),

      // Other metrics
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      totalLoadTime: navigation.loadEventEnd - navigation.fetchStart,

      // Memory (if available)
      memory: ('memory' in performance) ? (performance as any).memory : null,
    };
  }

  // 获取 First Contentful Paint
  private getFCP(): number | null {
    const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
    return fcpEntry ? fcpEntry.startTime : null;
  }

  // 获取 Largest Contentful Paint
  private getLCP(): number | null {
    return new Promise((resolve) => {
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry ? lastEntry.startTime : null);
        });
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
      } else {
        resolve(null);
      }
    }) as any;
  }

  // 获取 Cumulative Layout Shift
  private getCLS(): number | null {
    return new Promise((resolve) => {
      if ('PerformanceObserver' in window) {
        let clsValue = 0;
        const observer = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
        });
        observer.observe({ entryTypes: ['layout-shift'] });

        // Return CLS value after 5 seconds
        setTimeout(() => resolve(clsValue), 5000);
      } else {
        resolve(null);
      }
    }) as any;
  }

  // 获取 First Input Delay
  private getFID(): number | null {
    return new Promise((resolve) => {
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((entryList) => {
          const firstEntry = entryList.getEntries()[0];
          resolve(firstEntry ? (firstEntry as any).processingStart - firstEntry.startTime : null);
        });
        observer.observe({ entryTypes: ['first-input'] });
      } else {
        resolve(null);
      }
    }) as any;
  }
}

// 导出单例实例
export const mobileOptimizations = MobileOptimizationService.getInstance();

// 工具函数
export const isMobile = () => mobileOptimizations.isMobileDevice();
export const isLowEndDevice = () => mobileOptimizations.isLowEndDevice();
export const getViewport = () => mobileOptimizations.getViewport();

export default mobileOptimizations;