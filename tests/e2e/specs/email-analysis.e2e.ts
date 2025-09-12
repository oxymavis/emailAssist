import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage'; 
import { EmailAnalysisPage } from '../pages/EmailAnalysisPage';
import { testUsers, emailTestData } from '../fixtures/testData';

test.describe('邮件分析功能', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let emailAnalysisPage: EmailAnalysisPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    emailAnalysisPage = new EmailAnalysisPage(page);
    
    // 登录到应用
    await loginPage.goto();
    await loginPage.loginWithCredentials(testUsers.user.email, testUsers.user.password);
    await expect(page).toHaveURL('/dashboard');
  });

  test('邮件分析概览显示', async ({ page }) => {
    // 导航到邮件分析页面
    await dashboardPage.navigateToEmailAnalysis();
    await expect(page).toHaveURL('/analysis');
    
    // 验证关键分析组件显示
    await expect(emailAnalysisPage.sentimentChart).toBeVisible();
    await expect(emailAnalysisPage.priorityDistribution).toBeVisible();
    await expect(emailAnalysisPage.emailVolumeChart).toBeVisible();
    await expect(emailAnalysisPage.keywordCloud).toBeVisible();
    
    // 验证统计数据卡片
    await expect(emailAnalysisPage.totalEmailsCard).toBeVisible();
    await expect(emailAnalysisPage.processedEmailsCard).toBeVisible();
    await expect(emailAnalysisPage.averageResponseTimeCard).toBeVisible();
    
    // 检查数据是否已加载（非零值）
    const totalEmails = await emailAnalysisPage.getTotalEmailsCount();
    expect(totalEmails).toBeGreaterThan(0);
  });

  test('实时邮件分析处理', async ({ page }) => {
    await dashboardPage.navigateToEmailAnalysis();
    
    // 模拟新邮件到达
    await emailAnalysisPage.clickNewEmailAnalysis();
    
    // 输入邮件内容进行分析
    await emailAnalysisPage.fillEmailContent(emailTestData.urgentEmail.content);
    await emailAnalysisPage.fillFromField(emailTestData.urgentEmail.from);
    await emailAnalysisPage.fillSubjectField(emailTestData.urgentEmail.subject);
    
    // 启动分析
    await emailAnalysisPage.clickAnalyzeButton();
    
    // 验证分析进度显示
    await expect(emailAnalysisPage.analysisProgressBar).toBeVisible();
    
    // 等待分析完成并验证结果
    await expect(emailAnalysisPage.analysisResults).toBeVisible({ timeout: 15000 });
    
    // 验证分析结果的准确性
    const sentiment = await emailAnalysisPage.getSentimentResult();
    const priority = await emailAnalysisPage.getPriorityResult();
    
    // 紧急邮件应该被识别为高优先级
    expect(priority).toBe('High');
    expect(['Negative', 'Neutral']).toContain(sentiment);
    
    // 验证关键词提取
    const keywords = await emailAnalysisPage.getExtractedKeywords();
    expect(keywords).toContain('URGENT');
  });

  test('批量邮件分析功能', async ({ page }) => {
    await dashboardPage.navigateToEmailAnalysis();
    
    // 启动批量分析
    await emailAnalysisPage.clickBatchAnalysis();
    await expect(emailAnalysisPage.batchAnalysisModal).toBeVisible();
    
    // 上传邮件文件或选择邮件源
    await emailAnalysisPage.selectEmailSource('inbox');
    await emailAnalysisPage.setDateRange('2024-08-01', '2024-08-31');
    await emailAnalysisPage.setAnalysisFilters(['urgent', 'customer']);
    
    // 开始批量分析
    await emailAnalysisPage.clickStartBatchAnalysis();
    
    // 验证分析队列显示
    await expect(emailAnalysisPage.batchAnalysisQueue).toBeVisible();
    
    // 等待一些邮件处理完成
    await page.waitForSelector('[data-testid="batch-progress-bar"][aria-valuenow="100"]', { 
      timeout: 60000 
    });
    
    // 验证批量分析结果
    const processedCount = await emailAnalysisPage.getBatchProcessedCount();
    expect(processedCount).toBeGreaterThan(0);
    
    // 验证分析汇总显示
    await expect(emailAnalysisPage.batchAnalysisSummary).toBeVisible();
  });

  test('邮件情感分析准确性验证', async ({ page }) => {
    await dashboardPage.navigateToEmailAnalysis();
    
    // 测试正面情感邮件
    await emailAnalysisPage.clickNewEmailAnalysis();
    await emailAnalysisPage.fillEmailContent(emailTestData.positiveEmail.content);
    await emailAnalysisPage.clickAnalyzeButton();
    await expect(emailAnalysisPage.analysisResults).toBeVisible({ timeout: 10000 });
    
    let sentiment = await emailAnalysisPage.getSentimentResult();
    expect(sentiment).toBe('Positive');
    
    // 清空并测试负面情感邮件
    await emailAnalysisPage.clearEmailContent();
    await emailAnalysisPage.fillEmailContent(emailTestData.negativeEmail.content);
    await emailAnalysisPage.clickAnalyzeButton();
    await expect(emailAnalysisPage.analysisResults).toBeVisible({ timeout: 10000 });
    
    sentiment = await emailAnalysisPage.getSentimentResult();
    expect(sentiment).toBe('Negative');
    
    // 测试中性邮件
    await emailAnalysisPage.clearEmailContent();
    await emailAnalysisPage.fillEmailContent(emailTestData.neutralEmail.content);
    await emailAnalysisPage.clickAnalyzeButton();
    await expect(emailAnalysisPage.analysisResults).toBeVisible({ timeout: 10000 });
    
    sentiment = await emailAnalysisPage.getSentimentResult();
    expect(sentiment).toBe('Neutral');
  });

  test('邮件优先级分类功能', async ({ page }) => {
    await dashboardPage.navigateToEmailAnalysis();
    
    // 测试不同优先级的邮件
    const priorityTests = [
      { email: emailTestData.highPriorityEmail, expectedPriority: 'High' },
      { email: emailTestData.mediumPriorityEmail, expectedPriority: 'Medium' },
      { email: emailTestData.lowPriorityEmail, expectedPriority: 'Low' }
    ];
    
    for (const testCase of priorityTests) {
      await emailAnalysisPage.clickNewEmailAnalysis();
      await emailAnalysisPage.fillEmailContent(testCase.email.content);
      await emailAnalysisPage.fillSubjectField(testCase.email.subject);
      await emailAnalysisPage.clickAnalyzeButton();
      
      await expect(emailAnalysisPage.analysisResults).toBeVisible({ timeout: 10000 });
      
      const priority = await emailAnalysisPage.getPriorityResult();
      expect(priority).toBe(testCase.expectedPriority);
      
      // 清空准备下一个测试
      await emailAnalysisPage.clearAllFields();
    }
  });

  test('关键词提取和分类', async ({ page }) => {
    await dashboardPage.navigateToEmailAnalysis();
    
    // 分析包含特定关键词的邮件
    await emailAnalysisPage.clickNewEmailAnalysis();
    await emailAnalysisPage.fillEmailContent(emailTestData.keywordRichEmail.content);
    await emailAnalysisPage.clickAnalyzeButton();
    
    await expect(emailAnalysisPage.analysisResults).toBeVisible({ timeout: 10000 });
    
    // 验证关键词提取
    const keywords = await emailAnalysisPage.getExtractedKeywords();
    const expectedKeywords = ['project', 'deadline', 'urgent', 'meeting', 'budget'];
    
    // 检查至少提取到一些预期的关键词
    const foundKeywords = expectedKeywords.filter(keyword => 
      keywords.some(extractedKeyword => 
        extractedKeyword.toLowerCase().includes(keyword.toLowerCase())
      )
    );
    
    expect(foundKeywords.length).toBeGreaterThan(2);
    
    // 验证关键词分类
    const categories = await emailAnalysisPage.getKeywordCategories();
    expect(categories).toContain('Business');
  });

  test('邮件分析历史记录', async ({ page }) => {
    await dashboardPage.navigateToEmailAnalysis();
    
    // 查看分析历史
    await emailAnalysisPage.clickAnalysisHistory();
    await expect(emailAnalysisPage.historyTable).toBeVisible();
    
    // 验证历史记录列表显示
    const historyCount = await emailAnalysisPage.getHistoryRecordsCount();
    expect(historyCount).toBeGreaterThan(0);
    
    // 验证历史记录详情
    await emailAnalysisPage.clickFirstHistoryRecord();
    await expect(emailAnalysisPage.historyDetailModal).toBeVisible();
    
    // 验证历史记录包含必要信息
    await expect(emailAnalysisPage.historyEmailContent).toBeVisible();
    await expect(emailAnalysisPage.historyAnalysisResult).toBeVisible();
    await expect(emailAnalysisPage.historyTimestamp).toBeVisible();
  });

  test('分析结果导出功能', async ({ page }) => {
    await dashboardPage.navigateToEmailAnalysis();
    
    // 执行一次分析
    await emailAnalysisPage.clickNewEmailAnalysis();
    await emailAnalysisPage.fillEmailContent(emailTestData.sampleEmail.content);
    await emailAnalysisPage.clickAnalyzeButton();
    await expect(emailAnalysisPage.analysisResults).toBeVisible({ timeout: 10000 });
    
    // 测试导出功能
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      emailAnalysisPage.clickExportResults()
    ]);
    
    // 验证下载文件
    expect(download.suggestedFilename()).toMatch(/email-analysis-.*\.(pdf|xlsx|csv)$/);
    
    // 验证导出选项
    await emailAnalysisPage.clickExportOptionsDropdown();
    await expect(emailAnalysisPage.exportAsPDFOption).toBeVisible();
    await expect(emailAnalysisPage.exportAsExcelOption).toBeVisible();
    await expect(emailAnalysisPage.exportAsCSVOption).toBeVisible();
  });

  test('分析过滤和搜索功能', async ({ page }) => {
    await dashboardPage.navigateToEmailAnalysis();
    await emailAnalysisPage.clickAnalysisHistory();
    
    // 测试按情感过滤
    await emailAnalysisPage.applySentimentFilter('Positive');
    await page.waitForTimeout(1000); // 等待过滤结果加载
    
    const positiveResults = await emailAnalysisPage.getFilteredResults();
    for (const result of positiveResults) {
      const sentiment = await result.getAttribute('data-sentiment');
      expect(sentiment).toBe('positive');
    }
    
    // 清除过滤器
    await emailAnalysisPage.clearFilters();
    
    // 测试按优先级过滤
    await emailAnalysisPage.applyPriorityFilter('High');
    await page.waitForTimeout(1000);
    
    const highPriorityResults = await emailAnalysisPage.getFilteredResults();
    for (const result of highPriorityResults) {
      const priority = await result.getAttribute('data-priority');
      expect(priority).toBe('high');
    }
    
    // 测试搜索功能
    await emailAnalysisPage.clearFilters();
    await emailAnalysisPage.searchAnalysis('urgent');
    await page.waitForTimeout(1000);
    
    const searchResults = await emailAnalysisPage.getSearchResults();
    expect(searchResults.length).toBeGreaterThan(0);
  });

  test('分析错误处理', async ({ page }) => {
    await dashboardPage.navigateToEmailAnalysis();
    
    // 测试空内容分析
    await emailAnalysisPage.clickNewEmailAnalysis();
    await emailAnalysisPage.clickAnalyzeButton();
    
    // 验证验证错误显示
    await expect(emailAnalysisPage.contentValidationError).toBeVisible();
    expect(await emailAnalysisPage.getValidationErrorMessage()).toContain('Email content is required');
    
    // 测试无效邮件格式
    await emailAnalysisPage.fillEmailContent('Valid content');
    await emailAnalysisPage.fillFromField('invalid-email-format');
    await emailAnalysisPage.clickAnalyzeButton();
    
    await expect(emailAnalysisPage.fromValidationError).toBeVisible();
    expect(await emailAnalysisPage.getFromValidationMessage()).toContain('Invalid email format');
    
    // 测试服务不可用时的处理
    // 这里可能需要mock网络请求来模拟服务错误
    // 或者通过intercepting API calls来测试错误状态
  });

  test('响应式布局测试', async ({ page }) => {
    await dashboardPage.navigateToEmailAnalysis();
    
    // 测试移动端布局
    await page.setViewportSize({ width: 375, height: 812 });
    
    // 验证移动端布局调整
    await expect(emailAnalysisPage.mobileAnalysisView).toBeVisible();
    await expect(emailAnalysisPage.mobileStatsCards).toBeVisible();
    
    // 验证图表在移动端的响应式显示
    await expect(emailAnalysisPage.responsiveSentimentChart).toBeVisible();
    
    // 测试平板布局
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await expect(emailAnalysisPage.tabletAnalysisLayout).toBeVisible();
    
    // 恢复桌面布局
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    await expect(emailAnalysisPage.desktopAnalysisLayout).toBeVisible();
  });

  test('分析性能监控', async ({ page }) => {
    await dashboardPage.navigateToEmailAnalysis();
    
    // 监控分析请求性能
    const startTime = Date.now();
    
    await emailAnalysisPage.clickNewEmailAnalysis();
    await emailAnalysisPage.fillEmailContent(emailTestData.largeEmail.content);
    await emailAnalysisPage.clickAnalyzeButton();
    
    // 等待分析完成
    await expect(emailAnalysisPage.analysisResults).toBeVisible({ timeout: 15000 });
    
    const endTime = Date.now();
    const analysisTime = endTime - startTime;
    
    // 验证分析时间在合理范围内（15秒以内）
    expect(analysisTime).toBeLessThan(15000);
    
    // 验证页面性能指标
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        firstPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-paint')?.startTime,
      };
    });
    
    // 验证关键性能指标
    expect(performanceMetrics.loadTime).toBeLessThan(3000); // 3秒内完成加载
    expect(performanceMetrics.domContentLoaded).toBeLessThan(2000); // 2秒内DOM加载完成
  });

  test('多语言邮件分析', async ({ page }) => {
    await dashboardPage.navigateToEmailAnalysis();
    
    // 测试中文邮件分析
    await emailAnalysisPage.clickNewEmailAnalysis();
    await emailAnalysisPage.fillEmailContent(emailTestData.chineseEmail.content);
    await emailAnalysisPage.clickAnalyzeButton();
    
    await expect(emailAnalysisPage.analysisResults).toBeVisible({ timeout: 10000 });
    
    // 验证中文邮件也能正确分析
    const sentiment = await emailAnalysisPage.getSentimentResult();
    const keywords = await emailAnalysisPage.getExtractedKeywords();
    
    expect(['Positive', 'Negative', 'Neutral']).toContain(sentiment);
    expect(keywords.length).toBeGreaterThan(0);
    
    // 测试英文邮件分析
    await emailAnalysisPage.clearAllFields();
    await emailAnalysisPage.fillEmailContent(emailTestData.englishEmail.content);
    await emailAnalysisPage.clickAnalyzeButton();
    
    await expect(emailAnalysisPage.analysisResults).toBeVisible({ timeout: 10000 });
    
    const englishSentiment = await emailAnalysisPage.getSentimentResult();
    const englishKeywords = await emailAnalysisPage.getExtractedKeywords();
    
    expect(['Positive', 'Negative', 'Neutral']).toContain(englishSentiment);
    expect(englishKeywords.length).toBeGreaterThan(0);
  });
});