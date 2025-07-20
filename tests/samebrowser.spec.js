// tests/samebrowser.spec.js
const { test } = require('@playwright/test');

test('Login two users in different browser contexts', async ({ browser }) => {
  // First context (normal)
  const context1 = await browser.newContext();
  const page1 = await context1.newPage();
  await page1.goto('https://efcx4-voice.expertflow.com/unified-agent/#/login');

  // Login with first user
  await page1.fill('#username', 'bilal');
  await page1.fill('#password', '12345');
  await page1.click('//button[@class="button flip-in-ver-right form-control"]');

  // Second context (acts as incognito)
  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await page2.goto('https://efcx4-voice.expertflow.com/unified-agent/#/login');

  // Login with second user
  await page2.fill('#username', 'bilal1');
  await page2.fill('#password', '12345');
  await page2.click('//button[@class="button flip-in-ver-right form-control"]');

  // Optional: wait or assert something on both pages
  await page1.waitForTimeout(5000);
  await page2.waitForTimeout(5000);
});
