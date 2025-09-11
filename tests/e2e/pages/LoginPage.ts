import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;
  readonly forgotPasswordLink: Locator;
  readonly signupLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByTestId('email-input');
    this.passwordInput = page.getByTestId('password-input');
    this.loginButton = page.getByTestId('login-button');
    this.errorMessage = page.getByTestId('error-message');
    this.forgotPasswordLink = page.getByTestId('forgot-password-link');
    this.signupLink = page.getByTestId('signup-link');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async loginWithCredentials(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async getErrorMessage(): Promise<string | null> {
    try {
      return await this.errorMessage.textContent();
    } catch {
      return null;
    }
  }

  async isLoginButtonEnabled(): Promise<boolean> {
    return await this.loginButton.isEnabled();
  }

  async clickForgotPassword() {
    await this.forgotPasswordLink.click();
  }

  async clickSignup() {
    await this.signupLink.click();
  }
}