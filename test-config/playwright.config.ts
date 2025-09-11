import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 测试配置
 * Email Assist 项目专用配置
 */
export default defineConfig({
  // 测试目录
  testDir: '../tests/e2e',
  
  // 全局设置
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  // 报告配置
  reporter: [
    ['html', { outputFolder: '../test-reports/playwright-report' }],
    ['junit', { outputFile: '../test-reports/junit/playwright-results.xml' }],
    ['json', { outputFile: '../test-reports/playwright-report/results.json' }]
  ],
  
  // 全局配置
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // 用户代理和视窗设置
    actionTimeout: 0,
    navigationTimeout: 30 * 1000,
  },

  // 项目配置 - 多浏览器测试
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    
    // 移动端测试
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    
    // 平板测试
    {
      name: 'tablet',
      use: {
        ...devices['iPad Pro'],
      },
    }
  ],

  // 本地开发服务器配置
  webServer: process.env.CI ? undefined : [
    {
      command: 'npm run dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'cd backend && npm run dev',
      port: 3001,
      reuseExistingServer: !process.env.CI,
    }
  ],
  
  // 超时配置
  timeout: 30 * 1000,
  expect: {
    timeout: 5 * 1000,
  },
  
  // 输出目录
  outputDir: '../test-reports/playwright-results/',
});