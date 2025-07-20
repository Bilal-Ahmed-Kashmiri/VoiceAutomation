const AGENT_DESK_URL = process.env.AGENT_DESK_URL || 'https://efcx4-voice.expertflow.com/unified-agent';

class LoginPage {
  /** INTERNAL constructor – use LoginPage.launch() instead */
  constructor(page, context) {
    this.page    = page;
    this.context = context;          // so tests can close the window later

    /* locators */
    this.usernameInput = '#username';
    this.passwordInput = '#password';
    this.loginButton   = '//button[@class="button flip-in-ver-right form-control"]';
  }

  /*──────────────────────────────────────────────
    STATIC FACTORY – creates context + page + POM
  ──────────────────────────────────────────────*/
  static async launch(
    browser,
    {
      ignoreHTTPSErrors = true,
      viewport          = { width: 1280, height: 900 },
    } = {}
  ) {
    const context = await browser.newContext({ ignoreHTTPSErrors, viewport });
    const page    = await context.newPage();
    return new LoginPage(page, context);
  }

  /*──────────────────────────────────────────────
    Page‑object actions
  ──────────────────────────────────────────────*/
  async gotoLoginPage() {
    try {
      await this.page.goto(
        AGENT_DESK_URL,
        { waitUntil: 'domcontentloaded' }
      );
    } catch (err) {
      console.warn('Navigation threw (likely SSL). Bypassing ➜', err.message);
      await this._bypassSslInterstitial();
    }

    // Guard in case navigation succeeded but the warning is still visible
    if (
      await this.page
        .getByRole('button', { name: 'Advanced' })
        .isVisible({ timeout: 1_000 })
        .catch(() => false)
    ) {
      await this._bypassSslInterstitial();
    }
  }

  /** Clicks through Chromium’s certificate warning. */
  async _bypassSslInterstitial() {
    await this.page.getByRole('button', { name: 'Advanced' }).click();
    await this.page
      .getByRole('link', { name: /Proceed to .* \(unsafe\)?/i })
      .click();
  }

  /** Logs in to Agent Desk. */
  async login(username, password) {
    await this.page.locator(this.usernameInput).fill(username);
    await this.page.locator(this.passwordInput).fill(password);
    await this.page.locator(this.loginButton).click();
  }

  /** Optional: cleanly close the window & context. */
  async close() {
    await this.context.close();
  }
}

module.exports = { LoginPage };
