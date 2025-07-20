// pages/WebphonePage.js
class WebphonePage {
  /** INTERNAL constructor – use the static launch() instead. */
  constructor(page, context) {
    this.page     = page;
    this.context  = context; // keep a handle so tests can close it if needed

    /* locators */
    this.extensionInput = '//input[@placeholder="Extension"]';
    this.passwordInput  = '//input[@placeholder="Password"]';
    this.sipServerInput = 'input[placeholder="SIP Server (abc.com)"]';
    this.wssServerInput = 'input[placeholder="WSS Server (wss://abc.com:7443)"]';
    this.selectICE      = '//select[@name="ice_transport_policy"]';
    this.loginButton    = '//button[@id="loginBtn"]';
  }

  /* ─────────────────────────────────────────────
     STATIC FACTORY  →  build context + page + POM
  ──────────────────────────────────────────────*/
  static async launch(browser, {
    ignoreHTTPSErrors = true,
    viewport          = { width: 1280, height: 900 },
  } = {}) {
    const context = await browser.newContext({ ignoreHTTPSErrors, viewport });
    const page    = await context.newPage();
    return new WebphonePage(page, context);
  }

  /* standard page‑object methods */
  async gotoLoginPage() {
    await this.page.goto('https://webphone.expertflow.com/');
  }

  async login(ext, pwd, sipServer, wssServer) {
    await this.page.locator(this.extensionInput).fill(ext);
    await this.page.locator(this.passwordInput).fill(pwd);
    await this.page.locator(this.sipServerInput).fill(sipServer);
    await this.page.locator(this.wssServerInput).fill(wssServer);
    await this.page.locator(this.selectICE).selectOption('all');
    await this.page.locator(this.loginButton).click();
  }

  /* optional helper so tests can close the window cleanly */
  async close() {
    await this.context.close();
  }
}

module.exports = { WebphonePage };
