import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage.js';
import { WebphonePage } from '../../pages/WebphonePage.js';

import dotenv from 'dotenv';
dotenv.config();


/* ───────────────────────────────
   🔐 Credentials & Endpoints
──────────────────────────────── */
const AGENT_USERNAME  = process.env.AGENT_USERNAME  || 'bilal';
const AGENT_PASSWORD  = process.env.AGENT_PASSWORD  || '12345';
const WEBPHONE_USER   = process.env.WEBPHONE_USER   || '2208';
const WEBPHONE_PASS   = process.env.WEBPHONE_PASS   || '1234';
const WEBPHONE_DOMAIN = '192.168.1.17';
const WEBPHONE_WSS    = 'wss://192.168.1.17:7443';

const SERVICE_IDENTIFIER = process.env.IVR_DN || '6005'; 
const IS_WRAP_UP_ENABLED = process.env.WRAP_UP_ENABLED !== 'false';


/* ───────────────────────────────
   Permission helpers
──────────────────────────────── */
async function allowMicrophone(page) {
  await page.context().grantPermissions(['microphone'], {
    origin: new URL(page.url()).origin,
  });
}
async function allowCamera(page) {
  await page.context().grantPermissions(['camera'], {
    origin: new URL(page.url()).origin,
  });
}

/* ───────────────────────────────
   Re-usable action helpers
──────────────────────────────── */
async function makeAgentMrdReady(page) {
  //await page.getByRole('button', { name: 'Agent' }).click();
  await page.locator("//img[@alt='Agent']").click();
 // await page.getByRole('button', { name: 'Not Ready' }).click();
  await page.locator("//span[@class='ellipsis']").click();
  //await page.getByRole('menuitem', { name: 'Ready' }).click();
  await page.locator("button.mat-menu-item:has-text('Ready')").click();
// Toggle CX Voice
  const chatToggle = page.locator('text=CX VOICE').locator('..').locator('.mat-slide-toggle-thumb-container');
  await chatToggle.click();
  await allowMicrophone(page);
  await allowCamera(page);
  await expect(page.getByText('CX VOICE(READY)')).toBeVisible({ timeout: 10000 });
}


async function placeCall(page, number) {
  await page.getByRole('textbox', { name: 'Enter number' }).click();
  for (const d of number) {
    await page.getByRole('button', { name: d }).click();
  }
  await page.getByRole('button', { name: 'Call' }).click();
}

/** Press keypad icon then DTMF “0” to navigate IVR */
 async function sendDtmfZero(page) {
  // Open in-call keypad (icon glyph looks like a keyboard)
  await page.getByRole('button', { name: '' }).click();
  // Press the “0” button inside keypad
  await page.locator('#hover-button0').click();
} 


async function acceptInboundCall(page, timeout = 30_000) {
  const accept = page.getByRole('button', { name: 'Accept' });
  await expect(accept).toBeVisible({ timeout });
  await accept.click();
}

async function endCallWithoutWrapUp(page) { //maximized view
  // Click the red "call_end" icon to end the call
  await page.getByText('call_end').click();
  // Confirm ending the call without applying any wrap-up
  
  if (IS_WRAP_UP_ENABLED) {
    await page.locator("//span[normalize-space()='Leave Without Wrap-Up']").click();
  }
}

async function endCallFromMinimizedView(page) {
  // Open (or focus) the minimized call control bar
  await page.getByText('picture_in_picture_alt').click();
  // Click the red End-Call icon in that bar
  await page.getByRole('button').filter({ hasText: 'call_end' }).click();
  if (IS_WRAP_UP_ENABLED) {
    await page.locator("//span[normalize-space()='Leave Without Wrap-Up']").click();
  }
}

async function endCallFromWebphone(page) {
    //add some delay to ensure call is connected
      await page.waitForTimeout(2000);
    // End call from WebPhone
      await page.getByRole('button', { name: '' }).click();
}

async function clearDialerInput(page) {
  const textbox = page.getByRole('textbox', { name: 'Enter number' });
  await textbox.press('ControlOrMeta+a');
  await textbox.fill('');
}

async function verifyAgentDeskIsReady(agentDesk) {
    await agentDesk.page.locator("img[alt='Agent']").click(); // or the appropriate locator
    await expect(agentDesk.page.getByText('CX VOICE(READY)')).toBeVisible();
}

async function verifyWebPhoneIsReady(webphone) {
    await expect(webphone.page.getByRole('button', { name: 'Call' })).toBeVisible();
}

async function endCallByRefresh(page) {
  await page.reload();
  await page.waitForTimeout(2000);

  if (!IS_WRAP_UP_ENABLED) return;

  const leaveWrapupBtn = page.getByRole('button', { name: 'Leave Without Wrap-Up' });
  if (await leaveWrapupBtn.isVisible().catch(() => false)) {
    await leaveWrapupBtn.click();
    return;
  }

  const closeBtn = page.getByRole('button').filter({ hasText: 'close' });
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click();
    const confirmBtn = page.getByRole('button', { name: 'Confirm' });
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
    }
    if (await leaveWrapupBtn.isVisible().catch(() => false)) {
      await leaveWrapupBtn.click();
    }
  }
}

/** Clicks the 'Customer Interaction' button (question_answer icon) on Agent Desk. */
async function openCustomerInteractionPanel(page) {
  await page.getByRole('button').filter({ hasText: 'question_answer' }).click();
}


/**
 * Puts the current call on hold.
 * - Clicks pause button
 * - Verifies call is on hold via dynamic timer text
 */
async function holdCall(page) {
  // Click the pause button to put the call on hold
  await page.locator('vg-controls').getByText('pause').click();
  // Assert call is on hold by checking timer like "Call On Hold - 00:xx"
  await expect(page.getByText(/Call On Hold - 00:\d{2}/)).toBeVisible();
  // Wait to ensure hold state is applied
  await page.waitForTimeout(2000);
}

/**
 * Resumes the current held call.
 * - Clicks resume icon (phone_paused)
 * - Verifies call has resumed using dynamic call timer like "00:xx"
 */
async function resumeCall(page) {
  // Click the resume button (typically "phone_paused" icon)
  await page.getByText('phone_paused').click();
  // Wait to ensure resume action reflects in UI
  await page.waitForTimeout(2000);
  // Assert timer text like "00:17" is visible (resumed state)
  await expect(page.locator('text=/^\\d{2}:\\d{2}$/')).toBeVisible();
  await page.waitForTimeout(2000);
}

/**
 * Mutes the microphone by clicking the 'mic_off' icon.
 * Verifies that the mute state is active by checking the presence of 'mic' icon.
 */
async function muteMicrophone(page) {
  await expect(page.locator("//mat-icon[normalize-space()='mic']")).toBeVisible();
  await page.getByText('mic').click();
  // Assert that mic icon (unmute) appears, indicating the mic is now muted
  await expect(page.locator("//mat-icon[normalize-space()='mic_off']")).toBeVisible();
  //add wait to ensure UI updates
  await page.waitForTimeout(2000);
}

/**
 * Unmutes the microphone by clicking the 'mic' icon.
 * Verifies that the unmute state is active by checking the presence of 'mic_off' icon.
 */
async function unmuteMicrophone(page) {
  await expect(page.locator("//mat-icon[normalize-space()='mic_off']")).toBeVisible();
  await page.getByText('mic_off').click();
  // Assert that mic_off icon (mute) reappears, indicating mic is now unmuted
  await expect(page.locator("//mat-icon[normalize-space()='mic']")).toBeVisible();
  //add wait to ensure UI updates
  await page.waitForTimeout(2000);
}

async function verifyParticipantsList(page) {
  // Open Participants panel
  await page.getByRole('button', { name: 'Participants' }).click();
  // Assertions
  await expect(page.getByRole('heading', { name: 'Participants' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Customer' })).toBeVisible();
  // Assert agent name is present dynamically as "Primary(you)"
  await expect(
    page.getByRole('menuitem', { name: /Primary\(you\)$/i })
  ).toBeVisible();
}

async function webphoneCallAndAgentAccept(wpPage, adPage, SERVICE_IDENTIFIER) {
  // Clear dialer, place call, and send DTMF “0”
  await clearDialerInput(wpPage);
  await placeCall(wpPage, SERVICE_IDENTIFIER);
  await allowMicrophone(wpPage);
  await sendDtmfZero(wpPage);
  // Agent Desk accepts the ringing call
  await acceptInboundCall(adPage);
  // Close the “Call connected” overlay/backdrop if present
const backdrop = adPage.locator('.cdk-overlay-backdrop');
if (await backdrop.first().isVisible().catch(() => false)) {
  await backdrop.first().click({ force: true });
}

}

async function logoutAgent(page) {
  await page.getByRole('button', { name: 'Agent' }).click();
  await page.getByRole('button', { name: 'Ready' }).click();
  await page.getByRole('menuitem', { name: 'Short Break' }).click();
  await page.getByRole('menuitem', { name: 'Logout' }).click();
  await page.getByRole('button', { name: 'Logout' }).click(); // Confirm logout
  await page.waitForTimeout(2000);
}

/* ───────────────────────────────
   Serial end-to-end flow
──────────────────────────────── */
test.describe.serial('Inbound CX-Voice flow TestSuite ', () => {
  let agentDesk;   // LoginPage wrapper
  let webphone;    // WebphonePage wrapper

test.beforeAll(async ({ browser }) => {
  test.setTimeout(90_000); // Set for long operations in headless mode
  agentDesk = await LoginPage.launch(browser);
  await agentDesk.gotoLoginPage();
  await agentDesk.login(AGENT_USERNAME, AGENT_PASSWORD);
  await openCustomerInteractionPanel(agentDesk.page);
  await makeAgentMrdReady(agentDesk.page);

  webphone = await WebphonePage.launch(browser);
  await webphone.gotoLoginPage();
  await webphone.login(WEBPHONE_USER, WEBPHONE_PASS, WEBPHONE_DOMAIN, WEBPHONE_WSS);
});


  test.afterAll(async () => {
      if (agentDesk?.page) {
    await logoutAgent(agentDesk.page);  // 🔁 Proper logout before closing
    console.log('✅ Agent successfully logged out.');
  }
    await agentDesk?.close();
    await webphone?.close();
    //await logoutAgent(agentDesk.page);
  });



  test('Agent Desk is logged in & MRD READY', async () => {
    await expect(agentDesk.page.getByText('CX VOICE(READY)')).toBeVisible();
  });

  test('WebPhone is logged in', async () => {
    await expect(webphone.page.getByRole('button', { name: 'Call' })).toBeVisible();
  });

  test('WebPhone places a call and sends DTMF “0”', async () => {
    await placeCall(webphone.page, SERVICE_IDENTIFIER);
    await allowMicrophone(webphone.page);
    await sendDtmfZero(webphone.page);
  });

  test('Agent Desk accepts the ringing call', async () => {
    
    await acceptInboundCall(agentDesk.page);
    //await agentDesk.page.locator('.cdk-overlay-backdrop').click();
    await expect(agentDesk.page.getByRole('img', { name: 'customer' })).toBeVisible();
    //await endCallWithoutWrapUp(agentDesk.page);
  });

  test('Agent ends call full view and skips wrap-up', async () => {
  await endCallWithoutWrapUp(agentDesk.page);
  
});

    test('Agent Desk is back to MRD READY state', async () => {
        await agentDesk.page.getByRole('button', { name: 'Agent' }).click();
        await expect(agentDesk.page.getByText('CX VOICE(READY)')).toBeVisible();
    });

    test('WebPhone is ready for next call', async () => {

        await expect(webphone.page.getByRole('button', { name: 'Call' })).toBeVisible();
    });

    test('WebPhone places another call and Agent Desk accepts it', async () => {
          // Prepare for next call
        await clearDialerInput(webphone.page);
        await placeCall(webphone.page, SERVICE_IDENTIFIER);
        await allowMicrophone(webphone.page);
        await sendDtmfZero(webphone.page);
        await acceptInboundCall(agentDesk.page);
        //await agentDesk.page.getByLabel('Third Party Apps').click();
        //await agentDesk.page.getByRole('button').filter({ hasText: 'picture_in_picture_alt' }).click();
        await endCallWithoutWrapUp(agentDesk.page);
        //await agentDesk.page.locator('.cdk-overlay-backdrop').click();
    });
    
    test('Agent Desk handles and ends call via compact/minimized call UI', async () => {
        await clearDialerInput(webphone.page);
        await placeCall(webphone.page, SERVICE_IDENTIFIER);
        await allowMicrophone(webphone.page);
        await sendDtmfZero(webphone.page);
        await acceptInboundCall(agentDesk.page);
        await expect(agentDesk.page.getByRole('img', { name: 'customer' })).toBeVisible();
        await endCallFromMinimizedView(agentDesk.page);
    });

/*       test.skip('End call from Agent Desk by refreshing the page', async () => {
         // Place a call from WebPhone and let Agent Desk accept it
        await webphoneCallAndAgentAccept(webphone.page, agentDesk.page, SERVICE_IDENTIFIER);
        // Refresh Agent Desk tab to terminate the call
        await endCallByRefresh(agentDesk.page);
  
});  */

    test('End call from Customer(WebPhone)', async () => {
        await webphoneCallAndAgentAccept(webphone.page, agentDesk.page, SERVICE_IDENTIFIER);
        await endCallFromWebphone(webphone.page);// End call from Customer
        //await agentDesk.page.locator('.cdk-overlay-backdrop').click();
        if (IS_WRAP_UP_ENABLED) {
        await agentDesk.page.getByRole('button', { name: 'Leave Without Wrap-Up' }).click();
}

});

    test('End call from agent desk using cross button', async () => {
        await webphoneCallAndAgentAccept(webphone.page, agentDesk.page, SERVICE_IDENTIFIER); // Place call and accept on agent desk
        //await agentDesk.page.locator('.cdk-overlay-backdrop').click();
        //await agentDesk.page.getByRole('button').filter({ hasText: 'close' }).click();
        await agentDesk.page.locator("mat-icon:has-text('close')").click();
        await expect(agentDesk.page.getByText('Are you sure you want to')).toBeVisible();
        //await agentDesk.page.getByRole('button', { name: 'Confirm' }).click();
        await agentDesk.page.locator("//button[@class='mat-focus-indicator confirm-btn mat-raised-button mat-button-base']").click();
        await expect(agentDesk.page.getByText('Call in progress, Are you')).toBeVisible();
        //await agentDesk.page.getByRole('button', { name: 'Confirm' }).click();
        await agentDesk.page.locator("//span[normalize-space()='Confirm']").click();
        if (IS_WRAP_UP_ENABLED) {
        await agentDesk.page.getByRole('button', { name: 'Leave Without Wrap-Up' }).click();
        }
    });

    //Mute and Unmute
    test('Agent Desk mutes and unmutes the call', async () => {
        await webphoneCallAndAgentAccept(webphone.page, agentDesk.page, SERVICE_IDENTIFIER);
        await muteMicrophone(agentDesk.page);     // click mic_off, assert mic visible
        await unmuteMicrophone(agentDesk.page);   // click mic, assert mic_off visible
        await endCallWithoutWrapUp(agentDesk.page);
    });

        //hold call and Resume
    test('Agent Desk holds the call and resumes it', async () => {
        await webphoneCallAndAgentAccept(webphone.page, agentDesk.page, SERVICE_IDENTIFIER);
        await holdCall(agentDesk.page);
        await resumeCall(agentDesk.page);
        await endCallWithoutWrapUp(agentDesk.page);
    });


// verify Agent desk UI and elements mimimized view and mazimized view
    test('Agent Desk UI elements in minimized and maximized view', async () => {
        await webphoneCallAndAgentAccept(webphone.page, agentDesk.page, SERVICE_IDENTIFIER);
        // Verify minimized view elements
        await expect(agentDesk.page.getByRole('img', { name: 'customer' })).toBeVisible();
        await agentDesk.page.getByText('picture_in_picture_alt').click(); // Minimize call UI
        //add wait to ensure UI updates
        await agentDesk.page.waitForTimeout(2000);
        // Verify maximized view elements
        await agentDesk.page.getByText('picture_in_picture_alt').click(); // Maximize call UI
        //add wait to ensure UI updates
        await agentDesk.page.waitForTimeout(2000);
        //check if call timer is visible
        await expect(agentDesk.page.locator('text=/^\\d{2}:\\d{2}$/')).toBeVisible();
        // verify UI
        await agentDesk.page.getByRole('button').filter({ hasText: 'navigate_next' }).click();
        await agentDesk.page.getByRole('button').filter({ hasText: 'navigate_before' }).click();
        await agentDesk.page.locator("//button[@aria-label='Chat']//mat-icon[@role='img'][normalize-space()='question_answer']").click();
        await agentDesk.page.getByRole('button').filter({ hasText: 'navigate_next' }).click();
        await agentDesk.page.locator("//button[@aria-label='Chat']//mat-icon[@role='img'][normalize-space()='question_answer']").click();
        await agentDesk.page.locator("//button[@aria-label='Chat']//mat-icon[@role='img'][normalize-space()='question_answer']").click();
        await agentDesk.page.locator('button').filter({ hasText: 'call' }).click();
        await agentDesk.page.locator('button').filter({ hasText: 'call' }).click();
        await agentDesk.page.locator("//button[@aria-label='Chat']//mat-icon[@role='img'][normalize-space()='question_answer']").click();
        await agentDesk.page.getByRole('button').filter({ hasText: 'navigate_before' }).click();
        await agentDesk.page.locator('button').filter({ hasText: 'call' }).click();
        // End call without wrap-up
        await endCallWithoutWrapUp(agentDesk.page);
    });

    // Verify Participants list
    test('Agent Desk verifies participants list', async () => { 
        await webphoneCallAndAgentAccept(webphone.page, agentDesk.page, SERVICE_IDENTIFIER);
        await verifyParticipantsList(agentDesk.page);
        await agentDesk.page.locator('.cdk-overlay-backdrop').click();
        await endCallWithoutWrapUp(agentDesk.page);
    });


    test.skip('end call from agent desk and end with wrap-up', async () => 
      {
        await webphoneCallAndAgentAccept(webphone.page, agentDesk.page, SERVICE_IDENTIFIER);
      })

});
