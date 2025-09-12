import { Page, Locator } from '@playwright/test';

export class EmailAnalysisPage {
  readonly page: Page;
  
  // 主要分析界面元素
  readonly sentimentChart: Locator;
  readonly priorityDistribution: Locator;
  readonly emailVolumeChart: Locator;
  readonly keywordCloud: Locator;
  
  // 统计数据卡片
  readonly totalEmailsCard: Locator;
  readonly processedEmailsCard: Locator;
  readonly averageResponseTimeCard: Locator;
  
  // 邮件分析表单
  readonly newEmailAnalysisButton: Locator;
  readonly emailContentTextarea: Locator;
  readonly fromFieldInput: Locator;
  readonly subjectFieldInput: Locator;
  readonly analyzeButton: Locator;
  readonly clearFormButton: Locator;
  
  // 分析结果显示
  readonly analysisProgressBar: Locator;
  readonly analysisResults: Locator;
  readonly sentimentResult: Locator;
  readonly priorityResult: Locator;
  readonly keywordsContainer: Locator;
  readonly confidenceScore: Locator;
  
  // 批量分析
  readonly batchAnalysisButton: Locator;
  readonly batchAnalysisModal: Locator;
  readonly emailSourceSelect: Locator;
  readonly dateRangeStartInput: Locator;
  readonly dateRangeEndInput: Locator;
  readonly analysisFiltersInput: Locator;
  readonly startBatchAnalysisButton: Locator;
  readonly batchAnalysisQueue: Locator;
  readonly batchAnalysisSummary: Locator;
  
  // 历史记录
  readonly analysisHistoryButton: Locator;
  readonly historyTable: Locator;
  readonly historyDetailModal: Locator;
  readonly historyEmailContent: Locator;
  readonly historyAnalysisResult: Locator;
  readonly historyTimestamp: Locator;
  
  // 导出功能
  readonly exportResultsButton: Locator;
  readonly exportOptionsDropdown: Locator;
  readonly exportAsPDFOption: Locator;
  readonly exportAsExcelOption: Locator;
  readonly exportAsCSVOption: Locator;
  
  // 过滤和搜索
  readonly sentimentFilterSelect: Locator;
  readonly priorityFilterSelect: Locator;
  readonly clearFiltersButton: Locator;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  
  // 验证错误信息
  readonly contentValidationError: Locator;
  readonly fromValidationError: Locator;
  
  // 响应式布局元素
  readonly mobileAnalysisView: Locator;
  readonly mobileStatsCards: Locator;
  readonly responsiveSentimentChart: Locator;
  readonly tabletAnalysisLayout: Locator;
  readonly desktopAnalysisLayout: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // 主要分析界面元素
    this.sentimentChart = page.getByTestId('sentiment-chart');
    this.priorityDistribution = page.getByTestId('priority-distribution-chart');
    this.emailVolumeChart = page.getByTestId('email-volume-chart');
    this.keywordCloud = page.getByTestId('keyword-cloud');
    
    // 统计数据卡片
    this.totalEmailsCard = page.getByTestId('total-emails-card');
    this.processedEmailsCard = page.getByTestId('processed-emails-card');
    this.averageResponseTimeCard = page.getByTestId('avg-response-time-card');
    
    // 邮件分析表单
    this.newEmailAnalysisButton = page.getByTestId('new-email-analysis-btn');
    this.emailContentTextarea = page.getByTestId('email-content-textarea');
    this.fromFieldInput = page.getByTestId('from-field-input');
    this.subjectFieldInput = page.getByTestId('subject-field-input');
    this.analyzeButton = page.getByTestId('analyze-button');
    this.clearFormButton = page.getByTestId('clear-form-button');
    
    // 分析结果显示
    this.analysisProgressBar = page.getByTestId('analysis-progress-bar');
    this.analysisResults = page.getByTestId('analysis-results');
    this.sentimentResult = page.getByTestId('sentiment-result');
    this.priorityResult = page.getByTestId('priority-result');
    this.keywordsContainer = page.getByTestId('keywords-container');
    this.confidenceScore = page.getByTestId('confidence-score');
    
    // 批量分析
    this.batchAnalysisButton = page.getByTestId('batch-analysis-btn');
    this.batchAnalysisModal = page.getByTestId('batch-analysis-modal');
    this.emailSourceSelect = page.getByTestId('email-source-select');
    this.dateRangeStartInput = page.getByTestId('date-range-start');
    this.dateRangeEndInput = page.getByTestId('date-range-end');
    this.analysisFiltersInput = page.getByTestId('analysis-filters-input');
    this.startBatchAnalysisButton = page.getByTestId('start-batch-analysis-btn');
    this.batchAnalysisQueue = page.getByTestId('batch-analysis-queue');
    this.batchAnalysisSummary = page.getByTestId('batch-analysis-summary');
    
    // 历史记录
    this.analysisHistoryButton = page.getByTestId('analysis-history-btn');
    this.historyTable = page.getByTestId('history-table');
    this.historyDetailModal = page.getByTestId('history-detail-modal');
    this.historyEmailContent = page.getByTestId('history-email-content');
    this.historyAnalysisResult = page.getByTestId('history-analysis-result');
    this.historyTimestamp = page.getByTestId('history-timestamp');
    
    // 导出功能
    this.exportResultsButton = page.getByTestId('export-results-btn');
    this.exportOptionsDropdown = page.getByTestId('export-options-dropdown');
    this.exportAsPDFOption = page.getByTestId('export-pdf-option');
    this.exportAsExcelOption = page.getByTestId('export-excel-option');
    this.exportAsCSVOption = page.getByTestId('export-csv-option');
    
    // 过滤和搜索
    this.sentimentFilterSelect = page.getByTestId('sentiment-filter-select');
    this.priorityFilterSelect = page.getByTestId('priority-filter-select');
    this.clearFiltersButton = page.getByTestId('clear-filters-btn');
    this.searchInput = page.getByTestId('search-input');
    this.searchButton = page.getByTestId('search-btn');
    
    // 验证错误信息
    this.contentValidationError = page.getByTestId('content-validation-error');
    this.fromValidationError = page.getByTestId('from-validation-error');
    
    // 响应式布局元素
    this.mobileAnalysisView = page.getByTestId('mobile-analysis-view');
    this.mobileStatsCards = page.getByTestId('mobile-stats-cards');
    this.responsiveSentimentChart = page.getByTestId('responsive-sentiment-chart');
    this.tabletAnalysisLayout = page.getByTestId('tablet-analysis-layout');
    this.desktopAnalysisLayout = page.getByTestId('desktop-analysis-layout');
  }

  // 导航和基本操作
  async clickNewEmailAnalysis(): Promise<void> {
    await this.newEmailAnalysisButton.click();
  }

  async clickBatchAnalysis(): Promise<void> {
    await this.batchAnalysisButton.click();
  }

  async clickAnalysisHistory(): Promise<void> {
    await this.analysisHistoryButton.click();
  }

  // 表单填写操作
  async fillEmailContent(content: string): Promise<void> {
    await this.emailContentTextarea.fill(content);
  }

  async fillFromField(from: string): Promise<void> {
    await this.fromFieldInput.fill(from);
  }

  async fillSubjectField(subject: string): Promise<void> {
    await this.subjectFieldInput.fill(subject);
  }

  async clickAnalyzeButton(): Promise<void> {
    await this.analyzeButton.click();
  }

  async clearEmailContent(): Promise<void> {
    await this.emailContentTextarea.clear();
  }

  async clearAllFields(): Promise<void> {
    await this.emailContentTextarea.clear();
    await this.fromFieldInput.clear();
    await this.subjectFieldInput.clear();
  }

  // 分析结果获取
  async getSentimentResult(): Promise<string> {
    return await this.sentimentResult.textContent() || '';
  }

  async getPriorityResult(): Promise<string> {
    return await this.priorityResult.textContent() || '';
  }

  async getExtractedKeywords(): Promise<string[]> {
    const keywordElements = await this.keywordsContainer.locator('[data-testid="keyword-tag"]').all();
    const keywords = [];
    for (const element of keywordElements) {
      keywords.push(await element.textContent() || '');
    }
    return keywords;
  }

  async getKeywordCategories(): Promise<string[]> {
    const categoryElements = await this.keywordsContainer.locator('[data-testid="keyword-category"]').all();
    const categories = [];
    for (const element of categoryElements) {
      categories.push(await element.textContent() || '');
    }
    return categories;
  }

  async getConfidenceScore(): Promise<number> {
    const scoreText = await this.confidenceScore.textContent() || '0';
    return parseFloat(scoreText.replace('%', '')) / 100;
  }

  // 统计数据获取
  async getTotalEmailsCount(): Promise<number> {
    const countText = await this.totalEmailsCard.locator('[data-testid="count-value"]').textContent() || '0';
    return parseInt(countText.replace(/,/g, ''));
  }

  async getProcessedEmailsCount(): Promise<number> {
    const countText = await this.processedEmailsCard.locator('[data-testid="count-value"]').textContent() || '0';
    return parseInt(countText.replace(/,/g, ''));
  }

  // 批量分析操作
  async selectEmailSource(source: string): Promise<void> {
    await this.emailSourceSelect.selectOption(source);
  }

  async setDateRange(startDate: string, endDate: string): Promise<void> {
    await this.dateRangeStartInput.fill(startDate);
    await this.dateRangeEndInput.fill(endDate);
  }

  async setAnalysisFilters(filters: string[]): Promise<void> {
    await this.analysisFiltersInput.fill(filters.join(','));
  }

  async clickStartBatchAnalysis(): Promise<void> {
    await this.startBatchAnalysisButton.click();
  }

  async getBatchProcessedCount(): Promise<number> {
    const countText = await this.batchAnalysisSummary.locator('[data-testid="batch-processed-count"]').textContent() || '0';
    return parseInt(countText);
  }

  // 历史记录操作
  async getHistoryRecordsCount(): Promise<number> {
    const rows = await this.historyTable.locator('tbody tr').count();
    return rows;
  }

  async clickFirstHistoryRecord(): Promise<void> {
    await this.historyTable.locator('tbody tr').first().click();
  }

  // 导出功能
  async clickExportResults(): Promise<void> {
    await this.exportResultsButton.click();
  }

  async clickExportOptionsDropdown(): Promise<void> {
    await this.exportOptionsDropdown.click();
  }

  // 过滤和搜索
  async applySentimentFilter(sentiment: string): Promise<void> {
    await this.sentimentFilterSelect.selectOption(sentiment);
  }

  async applyPriorityFilter(priority: string): Promise<void> {
    await this.priorityFilterSelect.selectOption(priority);
  }

  async clearFilters(): Promise<void> {
    await this.clearFiltersButton.click();
  }

  async searchAnalysis(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchButton.click();
  }

  async getFilteredResults(): Promise<any[]> {
    const resultElements = await this.historyTable.locator('tbody tr').all();
    return resultElements;
  }

  async getSearchResults(): Promise<any[]> {
    const resultElements = await this.historyTable.locator('tbody tr').all();
    return resultElements;
  }

  // 错误处理
  async getValidationErrorMessage(): Promise<string> {
    return await this.contentValidationError.textContent() || '';
  }

  async getFromValidationMessage(): Promise<string> {
    return await this.fromValidationError.textContent() || '';
  }

  // 图表交互
  async clickSentimentChartSegment(sentiment: string): Promise<void> {
    await this.sentimentChart.locator(`[data-sentiment="${sentiment}"]`).click();
  }

  async hoverOverPriorityChart(): Promise<void> {
    await this.priorityDistribution.hover();
  }

  async getChartTooltipText(): Promise<string> {
    const tooltip = this.page.getByTestId('chart-tooltip');
    return await tooltip.textContent() || '';
  }

  // 实时数据更新检查
  async waitForDataUpdate(): Promise<void> {
    // 等待数据加载指示器消失
    await this.page.waitForSelector('[data-testid="data-loading"]', { state: 'hidden', timeout: 10000 });
  }

  async checkRealTimeUpdates(): Promise<boolean> {
    const initialCount = await this.getTotalEmailsCount();
    
    // 等待可能的实时更新
    await this.page.waitForTimeout(5000);
    
    const updatedCount = await this.getTotalEmailsCount();
    return updatedCount !== initialCount;
  }

  // 性能监控
  async measureAnalysisTime(analysisFunction: () => Promise<void>): Promise<number> {
    const startTime = Date.now();
    await analysisFunction();
    const endTime = Date.now();
    return endTime - startTime;
  }

  // 可访问性检查
  async checkAccessibility(): Promise<boolean> {
    // 检查关键元素的ARIA属性
    const hasAriaLabel = await this.analyzeButton.getAttribute('aria-label') !== null;
    const hasRole = await this.analysisResults.getAttribute('role') !== null;
    const hasTabIndex = await this.emailContentTextarea.getAttribute('tabindex') !== null;
    
    return hasAriaLabel && hasRole && hasTabIndex;
  }

  // 键盘导航测试
  async testKeyboardNavigation(): Promise<boolean> {
    // 测试Tab键导航
    await this.page.keyboard.press('Tab');
    const firstFocusedElement = await this.page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    
    await this.page.keyboard.press('Tab');
    const secondFocusedElement = await this.page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    
    return firstFocusedElement !== secondFocusedElement;
  }

  // 数据验证辅助方法
  async validateAnalysisResult(expectedSentiment?: string, expectedPriority?: string): Promise<boolean> {
    const sentiment = await this.getSentimentResult();
    const priority = await this.getPriorityResult();
    const confidence = await this.getConfidenceScore();
    
    let isValid = true;
    
    if (expectedSentiment && sentiment !== expectedSentiment) {
      isValid = false;
    }
    
    if (expectedPriority && priority !== expectedPriority) {
      isValid = false;
    }
    
    // 置信度应该在合理范围内
    if (confidence < 0 || confidence > 1) {
      isValid = false;
    }
    
    return isValid;
  }

  // 错误状态检查
  async hasAnalysisError(): Promise<boolean> {
    const errorElement = this.page.getByTestId('analysis-error');
    return await errorElement.isVisible();
  }

  async getAnalysisErrorMessage(): Promise<string> {
    const errorElement = this.page.getByTestId('analysis-error-message');
    return await errorElement.textContent() || '';
  }

  // 图表数据验证
  async validateChartData(): Promise<boolean> {
    // 检查图表是否有数据
    const sentimentChartHasData = await this.sentimentChart.locator('[data-value]').count() > 0;
    const priorityChartHasData = await this.priorityDistribution.locator('[data-value]').count() > 0;
    
    return sentimentChartHasData && priorityChartHasData;
  }
}