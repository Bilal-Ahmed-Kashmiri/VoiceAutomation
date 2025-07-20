import { test, expect } from '@playwright/test';
import { LoginPage }    from '../pages/LoginPage.js';
import { WebphonePage } from '../pages/WebphonePage.js';

/* ───────────────────────────────
   🔐 1. Credentials & End‑points
──────────────────────────────── */
const AGENT_USERNAME  = process.env.AGENT_USERNAME  || 'bilal';
const AGENT_PASSWORD  = process.env.AGENT_PASSWORD  || '12345';

const WEBPHONE_USER   = process.env.WEBPHONE_USER   || '2208';
const WEBPHONE_PASS   = process.env.WEBPHONE_PASS   || '1234';
const WEBPHONE_DOMAIN = process.env.WEBPHONE_DOMAIN || '192.168.1.17';
const WEBPHONE_WSS    = process.env.WEBPHONE_WSS    || 'wss://192.168.1.17:7443';

/* ───────────────────────────────
   🎙  Microphone permission
──────────────────────────────── */
export async function allowMicrophone(page) {
  const origin = new URL(page.url()).origin;
  await page.context().grantPermissions(['microphone'], { origin });
}

/* ───────────────────────────────
   📷  Camera permission
──────────────────────────────── */
export async function allowCamera(page) {
  const origin = new URL(page.url()).origin;
  await page.context().grantPermissions(['camera'], { origin });
}

/* ───────────────────────────────
   🚀 2. Re‑usable login helpers
──────────────────────────────── */
async function loginAgentDesk(
  browser,
  { username = AGENT_USERNAME, password = AGENT_PASSWORD } = {}
) {
  const agentDesk = await LoginPage.launch(browser);
  await agentDesk.gotoLoginPage();
  await agentDesk.login(username, password);
  return agentDesk;
}

async function loginWebphone(
  browser,
  {
    user   = WEBPHONE_USER,
    pass   = WEBPHONE_PASS,
    domain = WEBPHONE_DOMAIN,
    wss    = WEBPHONE_WSS,
  } = {}
) {
  const webphone = await WebphonePage.launch(browser);
  await webphone.gotoLoginPage();
  await webphone.login(user, pass, domain, wss);
  return webphone;
}

/* ───────────────────────────────
   🔄 Toggle CX‑Voice MRD helper
──────────────────────────────── */
export async function makeAgentMrdReady(
  page,
  {
    grantPermissions = true,
    waitForReady     = true
  } = {}
) {
  await page.getByRole('button',  { name: 'Agent' }).click();
  await page.getByRole('button',  { name: 'Not Ready' }).click();
  await page.getByRole('menuitem', { name: 'Ready' }).click();
  await page.locator('.mat-slide-toggle-thumb').first().click();

  if (grantPermissions) {
    await allowMicrophone(page);
    await allowCamera(page);
  }

  if (waitForReady) {
    await expect(page.getByText('CX VOICE(READY)')).toBeVisible({ timeout: 10_000 });
  }
}

/* ───────────────────────────────
   🔄 Helper: toggle CX‑Voice MRD
──────────────────────────────── */
async function toggleCxVoice(page) {
  await page.getByRole('button',  { name: 'Agent' }).click();
  await page.locator('.mat-slide-toggle-thumb').first().click();
}

/* ───────────────────────────────
   ☎️ Helper: placeCall
──────────────────────────────── */
export async function placeCall(page, number) {
  await page.getByRole('textbox', { name: 'Enter number' }).click();
  for (const digit of number) {
    await page.getByRole('button', { name: digit }).click();
  }
  await page.getByRole('button', { name: 'Call' }).click();
}

/* ───────────────────────────────
   ✅ Helper: acceptInboundCall
──────────────────────────────── */
export async function acceptInboundCall(page, timeout = 15_000) {
  const acceptBtn = page.getByRole('button', { name: 'Accept' });
  await expect(acceptBtn).toBeVisible({ timeout });
  await acceptBtn.click();
  await expect(page.getByText(/Connected|On Call|00:0\d/)).toBeVisible({
    timeout: 5000,
  });
}

/* ───────────────────────────────
   🧪 4. Tests
──────────────────────────────── */
test('WebPhone Login should succeed', async ({ browser }) => {
  const webphone = await loginWebphone(browser);
  const page     = webphone.page;
  await placeCall(page, '2888');
  await allowMicrophone(page);
  await page.getByRole('button', { name: '' }).click();
  await page.locator('#hover-button0').click();
  await page.pause();
});

test('Agent Desk Login → deny first permission → banner → allow → READY', async ({ browser }) => {
  const agentDesk = await loginAgentDesk(browser);
  const page      = agentDesk.page;

  await makeAgentMrdReady(page, { grantPermissions: false, waitForReady: false });
  await page.locator('.cdk-overlay-backdrop').click();
  await page.context().grantPermissions([], { origin: new URL(page.url()).origin });

  await allowMicrophone(page);
  await allowCamera(page);
  await toggleCxVoice(page);

  await expect(page.getByText('CX VOICE(READY)')).toBeVisible({ timeout: 10_000 });

  // 📞 Accept inbound call
  await acceptInboundCall(page);

  //await page.pause();
});




