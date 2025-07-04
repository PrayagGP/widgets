// filepath: /Users/prayprab/UI_automation/widgets/playwright/basic-task-controls-test.spec.ts
import { test, expect, Page, BrowserContext } from '@playwright/test';
import {
  enableAllWidgets,
  enableMultiLogin,
  initialiseWidgets,
  loginViaAccessToken,
} from './Utils/initUtils';
import { stationLogout, telephonyLogin } from './Utils/stationLoginUtils';
import { changeUserState, verifyCurrentState } from './Utils/userStateUtils';
import { 
  createCallTask, 
  createChatTask, 
  createEmailTask,
  acceptIncomingTask,
  loginExtension
} from './Utils/incomingTaskUtils';
import { callTaskControlCheck, chatTaskControlCheck, emailTaskControlCheck } from './Utils/taskControlUtils';
import { submitWrapup } from './Utils/wrapupUtils';
import { USER_STATES, LOGIN_MODE, TASK_TYPES, WRAPUP_REASONS } from './constants';
import dotenv from 'dotenv';

dotenv.config();

let page: Page;
let context: BrowserContext;
let callerPage: Page;
let chatPage: Page;
let context2: BrowserContext;
const maxRetries = 3;

const pageSetup = async (page: Page, loginMode: string) => {
  await loginViaAccessToken(page, 'AGENT1');
  await enableAllWidgets(page);
  await enableMultiLogin(page);

  for (let i = 0; i < maxRetries; i++) {
    try {
      await initialiseWidgets(page);
      await page.getByTestId('station-login-widget').waitFor({ state: 'visible', timeout: 30000 });
      break;
    } catch (error) {
      if (i == maxRetries - 1) {
        throw new Error(`Failed to initialise widgets after ${maxRetries} attempts: ${error}`);
      }
    }
  }

  const loginButtonExists = await page
    .getByTestId('login-button')
    .isVisible()
    .catch(() => false);
  if (loginButtonExists) {
    await telephonyLogin(page, loginMode);
  } else {
    await stationLogout(page);
    await telephonyLogin(page, loginMode);
  }

  await page.waitForTimeout(2000);
  await changeUserState(page, USER_STATES.AVAILABLE);
  await page.waitForTimeout(4000);
};

test.describe('Basic Task Controls Tests', () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    context2 = await browser.newContext();
    page = await context.newPage();
    chatPage = await context.newPage();
    callerPage = await context2.newPage();

    await Promise.all([
      (async () => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            await loginExtension(callerPage, process.env.PW_AGENT2_USERNAME ?? '', process.env.PW_PASSWORD ?? '');
            break;
          } catch (error) {
            if (i == maxRetries - 1) {
              throw new Error(`Failed to login extension after ${maxRetries} attempts: ${error}`);
            }
          }
        }
      })(),
      (async () => {
        await pageSetup(page, LOGIN_MODE.DESKTOP);
      })(),
    ]);
  });

  test.afterAll(async () => {
    await stationLogout(page);
    await context.close();
    await context2.close();
  });

  test('Call task - verify all control buttons are visible, end call, and wrap up', async () => {
    // Create call task
    await createCallTask(callerPage);
    await changeUserState(page, USER_STATES.AVAILABLE);
    
    // Wait for incoming call notification
    const incomingTaskDiv = page.getByTestId('samples:incoming-task-telephony').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await page.waitForTimeout(3000);
    
    // Accept the incoming call
    await acceptIncomingTask(page, TASK_TYPES.CALL);
    await page.waitForTimeout(5000);
    
    // Verify agent state changed to engaged
    await verifyCurrentState(page, USER_STATES.ENGAGED);
    
    // Use utility to check all call control buttons are visible
    await callTaskControlCheck(page);
    
    // End the call by clicking the end button
    console.log('Ending call task...');
    const endButton = page.getByTestId('call-control:end-call').nth(0);
    await endButton.waitFor({ state: 'visible', timeout: 30000 });
    await endButton.click();
    await page.waitForTimeout(3000);
    
    // Submit wrapup
    console.log('Submitting wrapup for call task...');
    await submitWrapup(page, WRAPUP_REASONS.RESOLVED);
    await page.waitForTimeout(2000);
    
    console.log('Call task control test completed successfully - all buttons verified, call ended, and wrapped up');
  });

  test('Chat task - verify transfer and end buttons are visible, end chat, and wrap up', async () => {
    // Create chat task
    await createChatTask(chatPage);
    await changeUserState(page, USER_STATES.AVAILABLE);
    
    // Wait for incoming chat notification
    const incomingTaskDiv = page.getByTestId('samples:incoming-task-chat').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await page.waitForTimeout(3000);
    
    // Accept the incoming chat
    await acceptIncomingTask(page, TASK_TYPES.CHAT);
    await page.waitForTimeout(5000);
    
    // Verify agent state changed to engaged
    await verifyCurrentState(page, USER_STATES.ENGAGED);
    
    // Use utility to check chat control buttons are visible
    await chatTaskControlCheck(page);
    
    // End the chat by clicking the end button
    console.log('Ending chat task...');
    const endButton = page.getByTestId('call-control:end-call').nth(0);
    await endButton.waitFor({ state: 'visible', timeout: 30000 });
    await endButton.click();
    await page.waitForTimeout(3000);
    
    // Submit wrapup
    console.log('Submitting wrapup for chat task...');
    await submitWrapup(page, WRAPUP_REASONS.RESOLVED);
    await page.waitForTimeout(2000);
    
    console.log('Chat task control test completed successfully - transfer and end buttons verified, chat ended, and wrapped up');
  });

  test('Email task - verify transfer and end buttons are visible, end email, and wrap up', async () => {
    // Create email task
    await createEmailTask();
    await changeUserState(page, USER_STATES.AVAILABLE);
    
    // Wait for incoming email notification (emails may take longer)
    const incomingTaskDiv = page.getByTestId('samples:incoming-task-email').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 180000 }); // 3 minutes for email
    await page.waitForTimeout(3000);
    
    // Accept the incoming email
    await acceptIncomingTask(page, TASK_TYPES.EMAIL);
    await page.waitForTimeout(5000);
    
    // Verify agent state changed to engaged
    await verifyCurrentState(page, USER_STATES.ENGAGED);
    
    // Use utility to check email control buttons are visible
    await emailTaskControlCheck(page);
    
    // End the email by clicking the end button
    console.log('Ending email task...');
    const endButton = page.getByTestId('call-control:end-call').nth(0);
    await endButton.waitFor({ state: 'visible', timeout: 30000 });
    await endButton.click();
    await page.waitForTimeout(3000);
    
    // Submit wrapup
    console.log('Submitting wrapup for email task...');
    await submitWrapup(page, WRAPUP_REASONS.RESOLVED);
    await page.waitForTimeout(2000);
    
    console.log('Email task control test completed successfully - transfer and end buttons verified, email ended, and wrapped up');
  });
});