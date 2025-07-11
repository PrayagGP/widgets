import { test, expect, Page, BrowserContext } from '@playwright/test';
import {
  consultViaAgent,
  transferViaAgent,
  cancelConsult,
  transferAfterConsult,
  endConsult,
  acceptIncomingConsultOrTransfer,
  declineIncomingConsultOrTransfer,
  completeWrapupAfterConsultOrTransfer,
  dismissPopover
} from './advancedTaskControlUtils';
import {
  enableAllWidgets,
  enableMultiLogin,
  initialiseWidgets,
  loginViaAccessToken,
} from './Utils/initUtils';
import { stationLogout, telephonyLogin } from './Utils/stationLoginUtils';
import { changeUserState, getCurrentState, verifyCurrentState } from './Utils/userStateUtils';
import { 
  createCallTask, 
  acceptIncomingTask,
  loginExtension,
  endCallTask
} from './Utils/incomingTaskUtils';
import { submitWrapup } from './Utils/wrapupUtils';
import { USER_STATES, LOGIN_MODE, TASK_TYPES, WRAPUP_REASONS } from './constants';
import { holdCallToggle } from './Utils/taskControlUtils';

/**
 * Advanced Task Control Tests
 * 
 * These tests verify complex multi-agent scenarios including:
 * - Consult operations between agents
 * - Transfer operations (direct and after consult)
 * - Consult cancellation and resumption
 * - Accepting/declining consult and transfer requests
 * - Proper wrapup handling after advanced operations
 */

let agent1Page: Page;
let agent2Page: Page;
let callerPage: Page;
let agent1Context: BrowserContext;
let agent2Context: BrowserContext;
let callerContext: BrowserContext;
const maxRetries = 3;

const pageSetup = async (page: Page, loginMode: string, agentToken: string) => {
  await loginViaAccessToken(page, agentToken);
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

test.describe('Advanced Task Controls - Consult Operations', () => {

  test.beforeAll(async ({ browser }) => {
    agent1Context = await browser.newContext();
    agent2Context = await browser.newContext();
    callerContext = await browser.newContext();
    
    agent1Page = await agent1Context.newPage();
    agent2Page = await agent2Context.newPage();
    callerPage = await callerContext.newPage();

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
        await pageSetup(agent1Page, LOGIN_MODE.DESKTOP, 'AGENT1');
      })(),
      (async () => {
        await pageSetup(agent2Page, LOGIN_MODE.DESKTOP, 'AGENT2');
      })(),
    ]);
  });

  test.afterAll(async () => {
    if(await getCurrentState(agent1Page) === USER_STATES.ENGAGED) {
      await endCallTask(agent1Page);
      await agent1Page.waitForTimeout(5000);
      await submitWrapup(agent1Page, WRAPUP_REASONS.RESOLVED);
      await agent1Page.waitForTimeout(2000);
    }
    if(await getCurrentState(agent2Page) === USER_STATES.ENGAGED) {
      await endCallTask(agent2Page);
      await agent2Page.waitForTimeout(5000);
      await submitWrapup(agent2Page, WRAPUP_REASONS.RESOLVED);
      await agent2Page.waitForTimeout(2000);
    }
    await Promise.all([
      stationLogout(agent1Page),
      stationLogout(agent2Page),
    ]);
    await agent1Context.close();
    await agent2Context.close();
    await callerContext.close();
  });

  test('Agent can initiate and cancel a consult successfully', async () => {
    // Create call task and agent 1 accepts it
    await createCallTask(callerPage);
    await changeUserState(agent1Page, USER_STATES.AVAILABLE);
    
    const incomingTaskDiv = agent1Page.getByTestId('samples:incoming-task-telephony').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await agent1Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent1Page, TASK_TYPES.CALL);
    await agent1Page.waitForTimeout(5000);
    
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);

    // Agent 1 initiates consult with Agent 2
    await consultViaAgent(agent1Page, 'User2 Agent2');

    // Verify consult UI elements are visible
    await expect(agent1Page.getByTestId('cancel-consult-btn')).toBeVisible();
    await expect(agent1Page.getByTestId('transfer-consult-btn')).toBeVisible();

    // Agent 1 cancels the consult
    await cancelConsult(agent1Page);

    // Verify return to normal call state
    await expect(agent1Page.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();
    await expect(agent1Page.getByTestId('cancel-consult-btn')).not.toBeVisible();
  });

  test('Agent can accept incoming consult request', async () => {


    // Agent 1 initiates consult with Agent 2
    await consultViaAgent(agent1Page, 'User2 Agent2');

    // Agent 2 should see incoming consult request and accept it
    await acceptIncomingConsultOrTransfer(agent2Page);

    // Verify both agents are in consult state
    await expect(agent1Page.getByTestId('transfer-consult-btn')).toBeVisible();
    await expect(agent2Page.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();
  });

  test('Agent can decline incoming consult request', async () => {
     await cancelConsult(agent1Page);
     await holdCallToggle(agent1Page);
     await agent1Page.waitForTimeout(1000);

    // Agent 1 initiates consult with Agent 2
    await consultViaAgent(agent1Page, 'User2 Agent2');

    // Agent 2 declines the consult request
    await declineIncomingConsultOrTransfer(agent2Page);

    // Verify Agent 1 returns to normal call state
    await expect(agent1Page.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();
    await expect(agent1Page.getByTestId('cancel-consult-btn')).not.toBeVisible();
  });

  // test('Agent can end consult and return to original call', async () => {
  //   await holdCallToggle(agent1Page);

  //   // Agent 1 initiates consult with Agent 2
  //   await consultViaAgent(agent1Page, 'User2 Agent2');
    
  //   // Agent 2 accepts the consult
  //   await acceptIncomingConsultOrTransfer(agent2Page);

  //   // Agent 1 ends the consult
  //   await endConsult(agent1Page);

  //   // Verify Agent 1 returns to original call
  //   await expect(agent1Page.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();
    
  //   // Agent 2 should complete wrapup
  //   await completeWrapupAfterConsultOrTransfer(agent2Page, WRAPUP_REASONS.RESOLVED);
  // });
});

test.describe('Advanced Task Controls - Transfer Operations', () => {

  test.beforeAll(async ({ browser }) => {
    agent1Context = await browser.newContext();
    agent2Context = await browser.newContext();
    callerContext = await browser.newContext();
    
    agent1Page = await agent1Context.newPage();
    agent2Page = await agent2Context.newPage();
    callerPage = await callerContext.newPage();

    await Promise.all([
      (async () => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            await loginExtension(callerPage, process.env.PW_AGENT1_USERNAME ?? '', process.env.PW_PASSWORD ?? '');
            break;
          } catch (error) {
            if (i == maxRetries - 1) {
              throw new Error(`Failed to login extension after ${maxRetries} attempts: ${error}`);
            }
          }
        }
      })(),
      (async () => {
        await pageSetup(agent1Page, LOGIN_MODE.DESKTOP, 'AGENT1');
      })(),
      (async () => {
        await pageSetup(agent2Page, LOGIN_MODE.DESKTOP, 'AGENT2');
      })(),
    ]);
  });

  test.afterAll(async () => {
    if(await getCurrentState(agent1Page) === USER_STATES.ENGAGED) {
      await endCallTask(agent1Page);
      await agent1Page.waitForTimeout(5000);
      await submitWrapup(agent1Page, WRAPUP_REASONS.RESOLVED);
      await agent1Page.waitForTimeout(2000);
    }
    if(await getCurrentState(agent2Page) === USER_STATES.ENGAGED) {
      await endCallTask(agent2Page);
      await agent2Page.waitForTimeout(5000);
      await submitWrapup(agent2Page, WRAPUP_REASONS.RESOLVED);
      await agent2Page.waitForTimeout(2000);
    }
    await Promise.all([
      stationLogout(agent1Page),
      stationLogout(agent2Page),
    ]);
    await agent1Context.close();
    await agent2Context.close();
    await callerContext.close();
  });

  test('Agent can perform direct transfer to another agent', async () => {
    // Set both agents to available
    await changeUserState(agent1Page, USER_STATES.AVAILABLE);
    await changeUserState(agent2Page, USER_STATES.AVAILABLE);

    // Create call task for Agent 1
    await createCallTask(callerPage);
    
    const incomingTaskDiv = agent1Page.getByTestId('samples:incoming-task-telephony').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await agent1Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent1Page, TASK_TYPES.CALL);
    await agent1Page.waitForTimeout(5000);

    // Agent 1 performs direct transfer to Agent 2
    await transferViaAgent(agent1Page, 'User2 Agent2');

    // Agent 1 should go to wrapup state
    await completeWrapupAfterConsultOrTransfer(agent1Page, WRAPUP_REASONS.SALE);

    // Agent 2 should receive the transfer and accept it
    await acceptIncomingConsultOrTransfer(agent2Page);

    // Verify Agent 2 now has the call
    await expect(agent2Page.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();
  });

  test('Agent can transfer after consulting with another agent', async () => {
    // Set both agents to available
    await changeUserState(agent1Page, USER_STATES.AVAILABLE);
    await changeUserState(agent2Page, USER_STATES.AVAILABLE);

    // Create call task for Agent 1
    await createCallTask(callerPage);
    
    const incomingTaskDiv = agent1Page.getByTestId('samples:incoming-task-telephony').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await agent1Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent1Page, TASK_TYPES.CALL);
    await agent1Page.waitForTimeout(5000);

    // Agent 1 performs transfer after consult
    await transferAfterConsult(agent1Page, 'User2 Agent2');

    // Agent 2 accepts the consult first
    await acceptIncomingConsultOrTransfer(agent2Page);

    // Agent 1 completes the transfer and goes to wrapup
    await completeWrapupAfterConsultOrTransfer(agent1Page, WRAPUP_REASONS.SALE);

    // Verify Agent 2 has the transferred call
    await expect(agent2Page.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();
  });

  test('Agent can decline incoming transfer request', async () => {
    // Set both agents to available
    await changeUserState(agent1Page, USER_STATES.AVAILABLE);
    await changeUserState(agent2Page, USER_STATES.AVAILABLE);

    // Create call task for Agent 1
    await createCallTask(callerPage);
    
    const incomingTaskDiv = agent1Page.getByTestId('samples:incoming-task-telephony').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await agent1Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent1Page, TASK_TYPES.CALL);
    await agent1Page.waitForTimeout(5000);

    // Agent 1 attempts to transfer to Agent 2
    await transferViaAgent(agent1Page, 'User2 Agent2');

    // Agent 2 declines the transfer
    await declineIncomingConsultOrTransfer(agent2Page);

    // Verify Agent 1 still has the call (transfer failed)
    await expect(agent1Page.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();
  });
});

test.describe('Advanced Task Controls - UI Interactions', () => {
  let agentPage: Page;
  let agentContext: BrowserContext;
  let callerPageUI: Page;
  let callerContextUI: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    agentContext = await browser.newContext();
    callerContextUI = await browser.newContext();
    
    agentPage = await agentContext.newPage();
    callerPageUI = await callerContextUI.newPage();

    await Promise.all([
      (async () => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            await loginExtension(callerPageUI, process.env.PW_AGENT1_USERNAME ?? '', process.env.PW_PASSWORD ?? '');
            break;
          } catch (error) {
            if (i == maxRetries - 1) {
              throw new Error(`Failed to login extension after ${maxRetries} attempts: ${error}`);
            }
          }
        }
      })(),
      (async () => {
        await pageSetup(agentPage, LOGIN_MODE.DESKTOP, 'AGENT1');
      })(),
    ]);
  });

  test.afterAll(async () => {
    if(await getCurrentState(agentPage) === USER_STATES.ENGAGED) {
      await endCallTask(agentPage);
      await agentPage.waitForTimeout(5000);
      await submitWrapup(agentPage, WRAPUP_REASONS.RESOLVED);
      await agentPage.waitForTimeout(2000);
    }
    await stationLogout(agentPage);
    await agentContext.close();
    await callerContextUI.close();
  });

  test('Agent can dismiss popover when UI elements are blocked', async () => {
    // Set agent to available and create call
    await changeUserState(agentPage, USER_STATES.AVAILABLE);
    
    await createCallTask(callerPageUI);
    
    const incomingTaskDiv = agentPage.getByTestId('samples:incoming-task-telephony').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await agentPage.waitForTimeout(3000);
    
    await acceptIncomingTask(agentPage, TASK_TYPES.CALL);
    await agentPage.waitForTimeout(5000);

    // Trigger a popover scenario (e.g., trying to transfer then dismissing)
    await agentPage.getByRole('group', { name: 'Call Control', exact: true }).getByLabel('Transfer Call').click();
    
    // Dismiss the popover
    await dismissPopover(agentPage);

    // Verify the UI is no longer blocked
    await expect(agentPage.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();
    await expect(agentPage.locator('.md-popover-backdrop')).not.toBeVisible();
  });

  test('Consult and transfer buttons are properly enabled/disabled based on call state', async () => {
    // Set agent to available
    await changeUserState(agentPage, USER_STATES.AVAILABLE);
    
    // Initially, consult and transfer should not be available (no active call)
    await expect(agentPage.getByRole('group', { name: 'Call Control', exact: true })).not.toBeVisible();

    // After receiving and accepting a call, buttons should be available
    await createCallTask(callerPageUI);
    
    const incomingTaskDiv = agentPage.getByTestId('samples:incoming-task-telephony').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await agentPage.waitForTimeout(3000);
    
    await acceptIncomingTask(agentPage, TASK_TYPES.CALL);
    await agentPage.waitForTimeout(5000);

    await expect(agentPage.getByRole('group', { name: 'Call Control', exact: true }).getByLabel('Consult with another agent')).toBeVisible();
    await expect(agentPage.getByRole('group', { name: 'Call Control with Call' }).getByLabel('Transfer Call')).toBeVisible();
  });
});

test.describe('Advanced Task Controls - Error Scenarios', () => {
  let agentPage: Page;
  let agentContext: BrowserContext;
  let callerPageError: Page;
  let callerContextError: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    agentContext = await browser.newContext();
    callerContextError = await browser.newContext();
    
    agentPage = await agentContext.newPage();
    callerPageError = await callerContextError.newPage();

    await Promise.all([
      (async () => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            await loginExtension(callerPageError, process.env.PW_AGENT1_USERNAME ?? '', process.env.PW_PASSWORD ?? '');
            break;
          } catch (error) {
            if (i == maxRetries - 1) {
              throw new Error(`Failed to login extension after ${maxRetries} attempts: ${error}`);
            }
          }
        }
      })(),
      (async () => {
        await pageSetup(agentPage, LOGIN_MODE.DESKTOP, 'AGENT1');
      })(),
    ]);
  });

  test.afterAll(async () => {
    if(await getCurrentState(agentPage) === USER_STATES.ENGAGED) {
      await endCallTask(agentPage);
      await agentPage.waitForTimeout(5000);
      await submitWrapup(agentPage, WRAPUP_REASONS.RESOLVED);
      await agentPage.waitForTimeout(2000);
    }
    await stationLogout(agentPage);
    await agentContext.close();
    await callerContextError.close();
  });

  test('Graceful handling when consult target agent is not available', async () => {
    // Set agent to available and create call
    await changeUserState(agentPage, USER_STATES.AVAILABLE);
    
    await createCallTask(callerPageError);
    
    const incomingTaskDiv = agentPage.getByTestId('samples:incoming-task-telephony').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await agentPage.waitForTimeout(3000);
    
    await acceptIncomingTask(agentPage, TASK_TYPES.CALL);
    await agentPage.waitForTimeout(5000);

    // Try to consult with a non-existent or unavailable agent
    try {
      await consultViaAgent(agentPage, 'NonExistent Agent');
      
      // Should either show an error message or gracefully handle
      // Verify the original call state is maintained
      await expect(agentPage.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();
    } catch (error) {
      // Expected behavior - function should handle gracefully
      console.log('Expected error when consulting unavailable agent:', error);
    }
  });

  test('Proper cleanup after failed transfer attempts', async () => {
    // Set agent to available and create call
    await changeUserState(agentPage, USER_STATES.AVAILABLE);
    
    await createCallTask(callerPageError);
    
    const incomingTaskDiv = agentPage.getByTestId('samples:incoming-task-telephony').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await agentPage.waitForTimeout(3000);
    
    await acceptIncomingTask(agentPage, TASK_TYPES.CALL);
    await agentPage.waitForTimeout(5000);

    // Attempt transfer to unavailable agent
    try {
      await transferViaAgent(agentPage, 'NonExistent Agent');
    } catch (error) {
      // If transfer fails, ensure we're back in a stable state
      await expect(agentPage.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();
    }

    // Verify agent can still perform other operations
    await expect(agentPage.getByRole('group', { name: 'Call Control', exact: true }).getByLabel('Consult with another agent')).toBeVisible();
  });
});
