import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { testUsers, formValidationData } from '../fixtures/testData';

test.describe('用户登录功能', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    await loginPage.goto();
  });

  test('成功登录流程', async ({ page }) => {
    const user = testUsers.user;
    
    // 执行登录
    await loginPage.loginWithCredentials(user.email, user.password);
    
    // 验证重定向到仪表板
    await expect(page).toHaveURL('/dashboard');
    
    // 验证仪表板页面元素加载
    await expect(dashboardPage.totalEmailsCard).toBeVisible();
    await expect(dashboardPage.userMenu).toBeVisible();
  });

  test('管理员登录流程', async ({ page }) => {
    const admin = testUsers.admin;
    
    await loginPage.loginWithCredentials(admin.email, admin.password);
    
    // 验证管理员特有的元素
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByTestId('admin-panel-link')).toBeVisible();
  });

  test('无效邮箱格式验证', async () => {
    for (const invalidEmail of formValidationData.invalidEmails) {
      await loginPage.emailInput.fill(invalidEmail);
      await loginPage.passwordInput.fill('password123');
      
      // 点击登录按钮应该被禁用或显示验证错误
      const isEnabled = await loginPage.isLoginButtonEnabled();
      expect(isEnabled).toBeFalsy();
      
      // 清空输入框准备下一个测试
      await loginPage.emailInput.clear();
    }
  });

  test('错误的登录凭据', async () => {
    await loginPage.loginWithCredentials('wrong@email.com', 'wrongpassword');
    
    // 验证错误消息显示
    await expect(loginPage.errorMessage).toBeVisible();
    const errorText = await loginPage.getErrorMessage();
    expect(errorText).toContain('Invalid credentials');
    
    // 确保仍在登录页面
    await expect(loginPage.page).toHaveURL('/login');
  });

  test('空表单提交', async () => {
    await loginPage.loginButton.click();
    
    // 验证表单验证消息
    await expect(loginPage.emailInput).toHaveAttribute('aria-invalid', 'true');
    await expect(loginPage.passwordInput).toHaveAttribute('aria-invalid', 'true');
  });

  test('记住登录状态', async ({ page, context }) => {
    const user = testUsers.user;
    
    // 启用"记住我"选项（如果存在）
    const rememberMeCheckbox = page.getByTestId('remember-me-checkbox');
    if (await rememberMeCheckbox.isVisible()) {
      await rememberMeCheckbox.check();
    }
    
    await loginPage.loginWithCredentials(user.email, user.password);
    await expect(page).toHaveURL('/dashboard');
    
    // 关闭页面并重新打开
    await page.close();
    const newPage = await context.newPage();
    await newPage.goto('/');
    
    // 应该自动重定向到仪表板（如果session持久化）
    await expect(newPage).toHaveURL('/dashboard', { timeout: 5000 });
  });

  test('注销功能', async ({ page }) => {
    const user = testUsers.user;
    
    // 先登录
    await loginPage.loginWithCredentials(user.email, user.password);
    await expect(page).toHaveURL('/dashboard');
    
    // 执行注销
    await dashboardPage.logout();
    
    // 验证重定向到登录页面
    await expect(page).toHaveURL('/login');
    
    // 尝试直接访问仪表板应该重定向回登录
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });

  test('忘记密码链接', async ({ page }) => {
    await loginPage.clickForgotPassword();
    await expect(page).toHaveURL('/forgot-password');
    
    // 验证忘记密码页面元素
    await expect(page.getByTestId('email-input')).toBeVisible();
    await expect(page.getByTestId('reset-password-button')).toBeVisible();
  });

  test('注册链接', async ({ page }) => {
    await loginPage.clickSignup();
    await expect(page).toHaveURL('/signup');
    
    // 验证注册页面元素
    await expect(page.getByTestId('first-name-input')).toBeVisible();
    await expect(page.getByTestId('last-name-input')).toBeVisible();
    await expect(page.getByTestId('email-input')).toBeVisible();
  });

  test('登录页面可访问性检查', async ({ page }) => {
    // 检查必要的可访问性属性
    await expect(loginPage.emailInput).toHaveAttribute('type', 'email');
    await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
    
    // 验证表单标签
    const emailLabel = page.getByText('Email');
    const passwordLabel = page.getByText('Password');
    await expect(emailLabel).toBeVisible();
    await expect(passwordLabel).toBeVisible();
    
    // 键盘导航测试
    await page.keyboard.press('Tab');
    await expect(loginPage.emailInput).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(loginPage.passwordInput).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(loginPage.loginButton).toBeFocused();
  });
});