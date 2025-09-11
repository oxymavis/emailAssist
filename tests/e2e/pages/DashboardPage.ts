import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly totalEmailsCard: Locator;
  readonly urgentEmailsCard: Locator;
  readonly processedEmailsCard: Locator;
  readonly emailTrendChart: Locator;
  readonly sentimentPieChart: Locator;
  readonly aiAnalysisButton: Locator;
  readonly mobileMenuButton: Locator;
  readonly desktopSidebar: Locator;
  readonly tabletLayout: Locator;
  readonly userMenu: Locator;
  readonly settingsLink: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.totalEmailsCard = page.getByTestId('total-emails-card');
    this.urgentEmailsCard = page.getByTestId('urgent-emails-card');
    this.processedEmailsCard = page.getByTestId('processed-emails-card');
    this.emailTrendChart = page.getByTestId('email-trend-chart');
    this.sentimentPieChart = page.getByTestId('sentiment-pie-chart');
    this.aiAnalysisButton = page.getByTestId('ai-analysis-button');
    this.mobileMenuButton = page.getByTestId('mobile-menu-button');
    this.desktopSidebar = page.getByTestId('desktop-sidebar');
    this.tabletLayout = page.getByTestId('tablet-layout');
    this.userMenu = page.getByTestId('user-menu');
    this.settingsLink = page.getByTestId('settings-link');
    this.logoutButton = page.getByTestId('logout-button');
  }

  async goto() {
    await this.page.goto('/dashboard');
  }

  async getTotalEmailsCount(): Promise<number> {
    const countText = await this.totalEmailsCard.locator('.count').textContent();
    return parseInt(countText || '0', 10);
  }

  async getUrgentEmailsCount(): Promise<number> {
    const countText = await this.urgentEmailsCard.locator('.count').textContent();
    return parseInt(countText || '0', 10);
  }

  async clickAIAnalysis() {
    await this.aiAnalysisButton.click();
  }

  async openUserMenu() {
    await this.userMenu.click();
  }

  async navigateToSettings() {
    await this.openUserMenu();
    await this.settingsLink.click();
  }

  async logout() {
    await this.openUserMenu();
    await this.logoutButton.click();
  }

  async waitForDataLoad() {
    // 等待图表加载完成
    await this.emailTrendChart.waitFor({ state: 'visible' });
    await this.sentimentPieChart.waitFor({ state: 'visible' });
    
    // 等待数据加载完成的指示器
    await this.page.waitForSelector('[data-testid="loading-spinner"]', { 
      state: 'hidden', 
      timeout: 10000 
    });
  }

  async refreshDashboard() {
    const refreshButton = this.page.getByTestId('refresh-button');
    await refreshButton.click();
    await this.waitForDataLoad();
  }
}