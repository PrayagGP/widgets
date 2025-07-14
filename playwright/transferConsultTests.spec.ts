import { test, expect, Page, BrowserContext } from '@playwright/test';
import {
  consultViaAgent,
  consultViaQueue,
  transferViaAgent,
  transferViaQueue,
  cancelConsult,
  transferAfterConsult,
  endConsult,
  setupAdvancedConsoleLogging,
  clearAdvancedCapturedLogs,
  verifyTransferSuccessLogs,
  verifyConsultStartSuccessLogs,
  verifyConsultEndSuccessLogs,
  verifyConsultFailedLogs,
  verifyConsultTransferredLogs,
  verifyAdvancedEndLogs,
  verifySpecificLog
} from './Utils/advancedTaskControlUtils';
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
  declineIncomingTask
} from './Utils/incomingTaskUtils';
import { submitWrapup } from './Utils/wrapupUtils';
import { USER_STATES, LOGIN_MODE, TASK_TYPES, WRAPUP_REASONS } from './constants';
import { holdCallToggle, endTask, setupConsoleLogging, clearCapturedLogs } from './Utils/taskControlUtils';

/**
 * Transfer and Consult Tests
 * 
 * Comprehensive test suite covering:
 * - Blind Transfer Operations (Agent to Agent, Agent to Queue)
 * - Consult Transfer Operations (with acceptance, decline, timeout scenarios)
 * - Queue Consult Operations (multi-agent scenarios)
 * - Multi-stage Consult Transfer Operations
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
  
  // Setup console logging for callbacks
  setupConsoleLogging(page);
  setupAdvancedConsoleLogging(page);
};
/*
// =============================================================================
// TEST SUITE: BLIND TRANSFER
// =============================================================================

test.describe('Blind Transfer Tests', () => {

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
    await Promise.all([
      (async () => {
        if(await getCurrentState(agent1Page) === USER_STATES.ENGAGED) {
          await endTask(agent1Page);
          await agent1Page.waitForTimeout(3000);
          await submitWrapup(agent1Page, WRAPUP_REASONS.RESOLVED);
          await agent1Page.waitForTimeout(2000);
        }
        await stationLogout(agent1Page);
      })(),
      (async () => {
        if(await getCurrentState(agent2Page) === USER_STATES.ENGAGED) {
          await endTask(agent2Page);
          await agent2Page.waitForTimeout(3000);
          await submitWrapup(agent2Page, WRAPUP_REASONS.RESOLVED);
          await agent2Page.waitForTimeout(2000);
        }
        await stationLogout(agent2Page);
      })(),
    ]);
    await agent1Context.close();
    await agent2Context.close();
    await callerContext.close();
  });

  test('Normal Call Blind Transferred by Agent to Another Agent', async () => {
    await changeUserState(agent2Page, USER_STATES.MEETING);
    // Create call task and agent 1 accepts it
    await createCallTask(callerPage);
    
    const incomingTaskDiv = agent1Page.getByTestId('samples:incoming-task-telephony').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await agent1Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent1Page, TASK_TYPES.CALL);
    await changeUserState(agent2Page, USER_STATES.AVAILABLE);
    await agent1Page.waitForTimeout(5000);
    
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);

    // Clear console logs to track transfer events
    clearAdvancedCapturedLogs();

    // Agent 1 performs blind transfer to Agent 2
    await transferViaAgent(agent1Page, 'User2 Agent2');
    
    // Verify transfer success in console logs
    await agent1Page.waitForTimeout(3000);
    verifyTransferSuccessLogs();
    
    // Verify Agent 1 goes to wrapup state  
    await submitWrapup(agent1Page, WRAPUP_REASONS.SALE);
    // Agent 2 should receive the transfer and accept it
    const incomingTransferDiv = agent2Page.getByTestId('samples:incoming-task-telephony').first();
    await incomingTransferDiv.waitFor({ state: 'visible', timeout: 60000 });
    await agent2Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent2Page, TASK_TYPES.CALL);
    await agent2Page.waitForTimeout(3000);

    // Verify Agent 2 now has the call and is engaged
    await verifyCurrentState(agent2Page, USER_STATES.ENGAGED);
    await expect(agent2Page.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();
    
    // Verify transfer success was logged
    await agent2Page.waitForTimeout(2000);
    verifyTransferSuccessLogs();
    
    // // End the call and complete wrapup to clean up for next test
    // await endTask(agent2Page);
    // await agent2Page.waitForTimeout(3000);
    // await submitWrapup(agent2Page, WRAPUP_REASONS.RESOLVED);
    // await agent2Page.waitForTimeout(2000);
  });

  test('Normal Call Blind Transferred to Queue', async () => {
    // // Create new call for this test
    // await createCallTask(callerPage);
    
    // const incomingTaskDiv = agent2Page.getByTestId('samples:incoming-task-telephony').first();
    // await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    // await agent2Page.waitForTimeout(3000);
    
    // await acceptIncomingTask(agent2Page, TASK_TYPES.CALL);
    // await agent2Page.waitForTimeout(5000);
    
    await verifyCurrentState(agent2Page, USER_STATES.ENGAGED);

    // Clear console logs to track transfer events
    clearAdvancedCapturedLogs();

    // Agent 2 transfers call to queue
    await transferViaQueue(agent2Page, 'Queue-1');
    
    // Verify transfer success was logged
    await agent2Page.waitForTimeout(3000);
    verifyTransferSuccessLogs();

    // Verify Agent 2 goes to wrapup after transfer
    await submitWrapup(agent2Page, WRAPUP_REASONS.RESOLVED);
    await agent2Page.waitForTimeout(2000);
    
    // Verify Agent 2 is no longer engaged
    await verifyCurrentState(agent2Page, USER_STATES.AVAILABLE);
    await acceptIncomingTask(agent1Page, TASK_TYPES.CALL);
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);


    // Note: Call should now be in queue for next available agent
    // In a real scenario, another agent would pick up from queue
  });
  test('Agent 1 Blind Transfers to Agent 2 via Agent and Vice Versa', async () => {
    // // Create new call for this test
    // await createCallTask(callerPage);
    // await changeUserState(agent1Page, USER_STATES.MEETING);
    
    // const incomingTaskDiv = agent2Page.getByTestId('samples:incoming-task-telephony').first();
    // await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    // await agent2Page.waitForTimeout(3000);
    
    // await acceptIncomingTask(agent2Page, TASK_TYPES.CALL);
    // await changeUserState(agent1Page, USER_STATES.AVAILABLE);
    // await agent2Page.waitForTimeout(5000);
    
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);

    // Clear logs before transfer
    clearAdvancedCapturedLogs();

    // Agent 2 blind transfers to Agent 1
    await transferViaAgent(agent1Page, 'User2 Agent2');
    
    // Verify transfer success
    await agent1Page.waitForTimeout(3000);
    verifyTransferSuccessLogs();

    await submitWrapup(agent1Page, WRAPUP_REASONS.SALE);
    // Agent 1 receives and accepts transferred call
    const incomingTransferDiv = agent2Page.getByTestId('samples:incoming-task-telephony').first();
    await incomingTransferDiv.waitFor({ state: 'visible', timeout: 60000 });
    await agent2Page.waitForTimeout(3000);

    await acceptIncomingTask(agent2Page, TASK_TYPES.CALL);
    await agent2Page.waitForTimeout(3000);
    await verifyCurrentState(agent2Page, USER_STATES.ENGAGED);

    // Clear logs before transfer
    clearAdvancedCapturedLogs();

    // Agent 1 transfers back to Agent 2
    await transferViaAgent(agent2Page, 'User1 Agent1');
    
    // Verify transfer success
    await agent2Page.waitForTimeout(3000);
    verifyTransferSuccessLogs();

    await submitWrapup(agent2Page, WRAPUP_REASONS.SALE);
    // Agent 1 receives and accepts the return transfer
    const returnTransferDiv = agent1Page.getByTestId('samples:incoming-task-telephony').first();
    await returnTransferDiv.waitFor({ state: 'visible', timeout: 60000 });
    await agent1Page.waitForTimeout(3000);

    await acceptIncomingTask(agent1Page, TASK_TYPES.CALL);
    await agent1Page.waitForTimeout(3000);
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);
    
    // // End the call and complete wrapup to clean up for next test
    // await endTask(agent1Page);
    // await agent1Page.waitForTimeout(3000);
    // await submitWrapup(agent1Page, WRAPUP_REASONS.RESOLVED);
    // await agent2Page.waitForTimeout(2000);
  });

  test('Agent 1 Blind Transfers to Agent 2 via Queue and Vice Versa', async () => {
    // // Create new call for this test
    // await createCallTask(callerPage);
    // await changeUserState(agent1Page, USER_STATES.MEETING);
    
    // const incomingTaskDiv = agent2Page.getByTestId('samples:incoming-task-telephony').first();
    // await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    // await agent2Page.waitForTimeout(3000);
    
    // await acceptIncomingTask(agent2Page, TASK_TYPES.CALL);
    // await changeUserState(agent1Page, USER_STATES.AVAILABLE);
    // await agent2Page.waitForTimeout(5000);
    
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);

    // Clear logs before transfer
    clearAdvancedCapturedLogs();

    // Agent 2 blind transfers to Agent 1
    await transferViaQueue(agent1Page, 'Queue-1');

    // Verify transfer success
    await agent1Page.waitForTimeout(3000);
    verifyTransferSuccessLogs();

    await submitWrapup(agent1Page, WRAPUP_REASONS.SALE);
    // Agent 1 receives and accepts transferred call
    const incomingTransferDiv = agent2Page.getByTestId('samples:incoming-task-telephony').first();
    await incomingTransferDiv.waitFor({ state: 'visible', timeout: 60000 });
    await agent2Page.waitForTimeout(3000);

    await acceptIncomingTask(agent2Page, TASK_TYPES.CALL);
    await agent2Page.waitForTimeout(3000);
    await verifyCurrentState(agent2Page, USER_STATES.ENGAGED);

    // Clear logs before transfer
    clearAdvancedCapturedLogs();

    // Agent 1 transfers back to Agent 2
    await transferViaQueue(agent2Page, 'Queue-1');

    // Verify transfer success
    await agent2Page.waitForTimeout(3000);
    verifyTransferSuccessLogs();

    await submitWrapup(agent2Page, WRAPUP_REASONS.SALE);
    // Agent 1 receives and accepts the return transfer
    const returnTransferDiv = agent1Page.getByTestId('samples:incoming-task-telephony').first();
    await returnTransferDiv.waitFor({ state: 'visible', timeout: 60000 });
    await agent1Page.waitForTimeout(3000);

    await acceptIncomingTask(agent1Page, TASK_TYPES.CALL);
    await agent1Page.waitForTimeout(3000);
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);
    
    // End the call and complete wrapup to clean up for next test
    await endTask(agent1Page);
    await agent1Page.waitForTimeout(3000);
    await submitWrapup(agent1Page, WRAPUP_REASONS.RESOLVED);
    await agent2Page.waitForTimeout(2000);
  });
});

// =============================================================================
// TEST SUITE: CONSULT TRANSFER
// =============================================================================

test.describe('Consult Transfer Tests', () => {

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
    await Promise.all([
      (async () => {
        if(await getCurrentState(agent1Page) === USER_STATES.ENGAGED) {
          await endTask(agent1Page);
          await agent1Page.waitForTimeout(3000);
          await submitWrapup(agent1Page, WRAPUP_REASONS.RESOLVED);
          await agent1Page.waitForTimeout(2000);
        }
        await stationLogout(agent1Page);
      })(),
      (async () => {
        if(await getCurrentState(agent2Page) === USER_STATES.ENGAGED) {
          await endTask(agent2Page);
          await agent2Page.waitForTimeout(3000);
          await submitWrapup(agent2Page, WRAPUP_REASONS.RESOLVED);
          await agent2Page.waitForTimeout(2000);
        }
        await stationLogout(agent2Page);
      })(),
    ]);
    await agent1Context.close();
    await agent2Context.close();
    await callerContext.close();
  });

  test('Normal Call Consulted via Agent and Accepted (A1 → A2)', async () => {
    // Create call task and agent 1 accepts it
    await createCallTask(callerPage);
    
    const incomingTaskDiv = agent1Page.getByTestId('samples:incoming-task-telephony').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await agent1Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent1Page, TASK_TYPES.CALL);
    await agent1Page.waitForTimeout(5000);
    
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);

    // Clear console logs to track consult events
    clearAdvancedCapturedLogs();

    // Agent 1 initiates consult with Agent 2
    await consultViaAgent(agent1Page, 'User2 Agent2');

    // Verify consult UI elements are visible
    await expect(agent1Page.getByTestId('cancel-consult-btn')).toBeVisible();
    await expect(agent1Page.getByTestId('transfer-consult-btn')).toBeVisible();

    // Agent 2 receives and accepts the consult
    const consultRequestDiv = agent2Page.getByTestId('samples:incoming-task-telephony').first();
    await consultRequestDiv.waitFor({ state: 'visible', timeout: 60000 });
    await agent2Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent2Page, TASK_TYPES.CALL);
    await agent2Page.waitForTimeout(3000);

    // Verify both agents are in consult state
    await expect(agent1Page.getByTestId('transfer-consult-btn')).toBeVisible();
    await expect(agent2Page.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();
    
    // Verify consult start success was logged
    await agent1Page.waitForTimeout(2000);
    verifyConsultStartSuccessLogs();
    
    // End the consult and verify state
    await endConsult(agent1Page);
    
    // Agent 2 should complete wrapup
    await submitWrapup(agent2Page, WRAPUP_REASONS.RESOLVED);    
    // Verify consult end success was logged
    await agent1Page.waitForTimeout(2000);
    verifyConsultEndSuccessLogs();
    
    // End the call and complete wrapup to clean up for next test
    await endTask(agent1Page);
    await agent1Page.waitForTimeout(3000);
    await submitWrapup(agent1Page, WRAPUP_REASONS.RESOLVED);
    await agent1Page.waitForTimeout(2000);
  });

  test('Normal Call Consulted via Agent and Declined (A1 → A2)', async () => {
    // Create a new call for this test
    await createCallTask(callerPage);
    
    const incomingTaskDiv = agent1Page.getByTestId('samples:incoming-task-telephony').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await agent1Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent1Page, TASK_TYPES.CALL);
    await agent1Page.waitForTimeout(5000);
    
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);

    // Clear logs before consult
    clearAdvancedCapturedLogs();

    // Agent 1 initiates another consult with Agent 2
    await consultViaAgent(agent1Page, 'User2 Agent2');

    // Agent 2 receives and declines the consult
    const consultRequestDiv = agent2Page.getByTestId('samples:incoming-task-telephony').first();
    await consultRequestDiv.waitFor({ state: 'visible', timeout: 60000 });
    await agent2Page.waitForTimeout(3000);
    
    await declineIncomingTask(agent2Page, TASK_TYPES.CALL);

    // Verify Agent 1 returns to normal call state
    await expect(agent1Page.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();
    await expect(agent1Page.getByTestId('cancel-consult-btn')).not.toBeVisible();
    
    // Agent 1 should still be engaged with customer call
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);
    
    // End the call and complete wrapup to clean up for next test
    await endTask(agent1Page);
    await agent1Page.waitForTimeout(3000);
    await submitWrapup(agent1Page, WRAPUP_REASONS.RESOLVED);
    await agent1Page.waitForTimeout(2000);
  });

  test('Normal Call Consulted via Agent and Not Picked Up by Agent 2', async () => {
    // Create a new call for this test
    await createCallTask(callerPage);
    
    const incomingTaskDiv = agent1Page.getByTestId('samples:incoming-task-telephony').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await agent1Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent1Page, TASK_TYPES.CALL);
    await agent1Page.waitForTimeout(5000);
    
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);

    // Clear logs before consult
    clearAdvancedCapturedLogs();

    // Agent 1 initiates consult with Agent 2
    await consultViaAgent(agent1Page, 'User2 Agent2');

    // Wait for consult to timeout (Agent 2 doesn't respond)
    // This should timeout after some time and return to normal state
    await agent1Page.waitForTimeout(30000); // Wait for timeout

    // Verify Agent 1 returns to call state (call should still be on hold)
    await expect(agent1Page.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();
    
    // Customer call should return to connected state but might remain on hold
    // Agent can resume the call if needed
    
    // End the call and complete wrapup to clean up for next test
    await endTask(agent1Page);
    await agent1Page.waitForTimeout(3000);
    await submitWrapup(agent1Page, WRAPUP_REASONS.RESOLVED);
    await agent1Page.waitForTimeout(2000);
  });

  test('Consult Transfer - Normal Call to Agent 2', async () => {
    // Create a new call for this test
    await createCallTask(callerPage);
    
    const incomingTaskDiv = agent1Page.getByTestId('samples:incoming-task-telephony').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await agent1Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent1Page, TASK_TYPES.CALL);
    await agent1Page.waitForTimeout(5000);
    
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);

    // Clear logs before consult transfer
    clearAdvancedCapturedLogs();

    // Agent 1 performs consult transfer
    await transferAfterConsult(agent1Page, 'User2 Agent2');

    // Agent 2 accepts the consult first
    const consultRequestDiv = agent2Page.getByTestId('samples:incoming-task-telephony').first();
    await consultRequestDiv.waitFor({ state: 'visible', timeout: 60000 });
    await agent2Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent2Page, TASK_TYPES.CALL);
    await agent2Page.waitForTimeout(3000);

    // Agent 1 completes the transfer and goes to wrapup
await submitWrapup(agent1Page, WRAPUP_REASONS.SALE);
    // Verify Agent 2 has the transferred call
    await verifyCurrentState(agent2Page, USER_STATES.ENGAGED);
    await expect(agent2Page.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();
    
    // Verify consult start and transfer success were logged
    await agent2Page.waitForTimeout(2000);
    verifyConsultStartSuccessLogs();
    verifyTransferSuccessLogs();
    
    // End the call and complete wrapup to clean up for next test
    await endTask(agent2Page);
    await agent2Page.waitForTimeout(3000);
    await submitWrapup(agent2Page, WRAPUP_REASONS.RESOLVED);
    await agent2Page.waitForTimeout(2000);
  });
});

// =============================================================================
// TEST SUITE: QUEUE CONSULT
// =============================================================================

test.describe('Queue Consult Tests', () => {

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
        // Set Agent 2 to idle for some tests
        await changeUserState(agent2Page, USER_STATES.AVAILABLE);
      })(),
    ]);
  });

  test.afterAll(async () => {
    await Promise.all([
      (async () => {
        if(await getCurrentState(agent1Page) === USER_STATES.ENGAGED) {
          await endTask(agent1Page);
          await agent1Page.waitForTimeout(3000);
          await submitWrapup(agent1Page, WRAPUP_REASONS.RESOLVED);
          await agent1Page.waitForTimeout(2000);
        }
        await stationLogout(agent1Page);
      })(),
      (async () => {
        if(await getCurrentState(agent2Page) === USER_STATES.ENGAGED) {
          await endTask(agent2Page);
          await agent2Page.waitForTimeout(3000);
          await submitWrapup(agent2Page, WRAPUP_REASONS.RESOLVED);
          await agent2Page.waitForTimeout(2000);
        }
        await stationLogout(agent2Page);
      })(),
    ]);
    await agent1Context.close();
    await agent2Context.close();
    await callerContext.close();
  });

  test('Agent 1 Consults via Queue When Agent 2 is Idle, Then Cancels the Consultation', async () => {
    // Create call task and agent 1 accepts it
    await createCallTask(callerPage);
    
    const incomingTaskDiv = agent1Page.getByTestId('samples:incoming-task-telephony').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await agent1Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent1Page, TASK_TYPES.CALL);
    await agent1Page.waitForTimeout(5000);
    
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);

    // Clear logs before consult
    clearAdvancedCapturedLogs();

    // Agent 1 initiates queue consult
    await consultViaQueue(agent1Page, 'Customer Service Queue');

    // Verify consult UI elements are visible
    await expect(agent1Page.getByTestId('cancel-consult-btn')).toBeVisible();

    // Agent 1 cancels consult before Agent 2 responds
    await cancelConsult(agent1Page);

    // Verify customer call returns to regular connected state
    await expect(agent1Page.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();
    await expect(agent1Page.getByTestId('cancel-consult-btn')).not.toBeVisible();
    
    // Verify Agent 2 remains unaffected
    await verifyCurrentState(agent2Page, USER_STATES.AVAILABLE);
    
    // End the call and complete wrapup to clean up for next test
    await endTask(agent1Page);
    await agent1Page.waitForTimeout(3000);
    await submitWrapup(agent1Page, WRAPUP_REASONS.RESOLVED);
    await agent1Page.waitForTimeout(2000);
  });

  test('Customer Terminates Call During Queue Consultation with Idle Agent 2', async () => {
    // Create new call for this test
    await createCallTask(callerPage);
    
    const incomingTaskDiv = agent1Page.getByTestId('samples:incoming-task-telephony').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await agent1Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent1Page, TASK_TYPES.CALL);
    await agent1Page.waitForTimeout(5000);
    
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);

    // Clear logs before consult
    clearAdvancedCapturedLogs();

    // Agent 1 initiates queue consultation
    await consultViaQueue(agent1Page, 'Customer Service Queue');

    // Simulate customer ending call by ending it from caller side
    // In real scenario, customer would hang up
    await endTask(agent1Page); // Simulating customer termination

    // Agent 1 should see wrap-up required
    await agent1Page.waitForTimeout(3000);
    
    // Agent 1 enters wrap-up mode
    await submitWrapup(agent1Page, WRAPUP_REASONS.RESOLVED);
    
    // Verify Agent 2 remains unaffected
    await verifyCurrentState(agent2Page, USER_STATES.AVAILABLE);
  });

  test('Agent 1 Consults via Queue with Available Agent 2, Then Ends Consultation', async () => {
    // Create new call for this test
    await createCallTask(callerPage);
    
    const incomingTaskDiv = agent1Page.getByTestId('samples:incoming-task-telephony').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await agent1Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent1Page, TASK_TYPES.CALL);
    await agent1Page.waitForTimeout(5000);
    
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);

    // Clear logs before consult
    clearAdvancedCapturedLogs();

    // Agent 1 initiates queue consult
    await consultViaQueue(agent1Page, 'Customer Service Queue');
    
    // Verify consult start success was logged
    await agent1Page.waitForTimeout(2000);
    verifyConsultStartSuccessLogs();

    // Agent 2 accepts the consult
    const consultRequestDiv = agent2Page.getByTestId('samples:incoming-task-telephony').first();
    await consultRequestDiv.waitFor({ state: 'visible', timeout: 60000 });
    await agent2Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent2Page, TASK_TYPES.CALL);
    await agent2Page.waitForTimeout(3000);

    // Agent 1 ends the consultation
    await endConsult(agent1Page);

    // Agent 2 completes wrapup
    await submitWrapup(agent2Page, WRAPUP_REASONS.RESOLVED);
    
    // Verify call returns to Agent 1
    await expect(agent1Page.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();
    
    // Verify consult end success was logged
    await agent1Page.waitForTimeout(2000);
    verifyConsultEndSuccessLogs();
    
    // End the call and complete wrapup to clean up for next test
    await endTask(agent1Page);
    await agent1Page.waitForTimeout(3000);
    await submitWrapup(agent1Page, WRAPUP_REASONS.RESOLVED);
    await agent1Page.waitForTimeout(2000);
  });

  test('Agent 2 Ends the Consultation Initiated by Agent 1 via Queue', async () => {
    // Create new call for this test
    await createCallTask(callerPage);
    
    const incomingTaskDiv = agent1Page.getByTestId('samples:incoming-task-telephony').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await agent1Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent1Page, TASK_TYPES.CALL);
    await agent1Page.waitForTimeout(5000);
    
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);

    // Clear logs before consult
    clearAdvancedCapturedLogs();

    // Agent 1 initiates queue consult
    await consultViaQueue(agent1Page, 'Customer Service Queue');

    // Agent 2 accepts the consult
    const consultRequestDiv = agent2Page.getByTestId('samples:incoming-task-telephony').first();
    await consultRequestDiv.waitFor({ state: 'visible', timeout: 60000 });
    await agent2Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent2Page, TASK_TYPES.CALL);
    await agent2Page.waitForTimeout(3000);

    // Agent 2 ends the consultation from their side
    await endTask(agent2Page);
    await agent2Page.waitForTimeout(3000);
    await submitWrapup(agent2Page, WRAPUP_REASONS.RESOLVED);

    // Customer call should return to Agent 1
    await expect(agent1Page.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();
    
    // Note: AgentConsultFailed should be visible in console
    verifyConsultFailedLogs();
    
    // End the call and complete wrapup to clean up for next test
    await endTask(agent1Page);
    await agent1Page.waitForTimeout(3000);
    await submitWrapup(agent1Page, WRAPUP_REASONS.RESOLVED);
    await agent1Page.waitForTimeout(2000);
  });

  test('Agent 2 Accepts Queue Consultation from Agent 1', async () => {
    // Create new call for this test
    await createCallTask(callerPage);
    
    const incomingTaskDiv = agent1Page.getByTestId('samples:incoming-task-telephony').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await agent1Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent1Page, TASK_TYPES.CALL);
    await agent1Page.waitForTimeout(5000);
    
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);

    // Clear logs before consult
    clearAdvancedCapturedLogs();

    // Agent 1 initiates queue consult
    await consultViaQueue(agent1Page, 'Customer Service Queue');

    // Agent 2 accepts the consultation
    const consultRequestDiv = agent2Page.getByTestId('samples:incoming-task-telephony').first();
    await consultRequestDiv.waitFor({ state: 'visible', timeout: 60000 });
    await agent2Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent2Page, TASK_TYPES.CALL);
    await agent2Page.waitForTimeout(3000);

    // Verify customer remains on hold with Agent 1
    await expect(agent1Page.getByTestId('transfer-consult-btn')).toBeVisible();
    
    // Verify Agent 2 is in consult state
    await expect(agent2Page.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();
    
    // Verify consult start success was logged
    await agent1Page.waitForTimeout(2000);
    verifyConsultStartSuccessLogs();
  });

  test('Agent 2 Accepts Consultation, Then Agent 1 Ends It and Returns to Customer', async () => {
    // Continue from previous test - both agents should be in consult
    await expect(agent1Page.getByTestId('transfer-consult-btn')).toBeVisible();
    await expect(agent2Page.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();

    // Agent 1 ends consultation
    await endConsult(agent1Page);

    // Agent 2 returns to Available state
    await submitWrapup(agent2Page, WRAPUP_REASONS.RESOLVED);
    await verifyCurrentState(agent2Page, USER_STATES.AVAILABLE);

    // Customer call returns to Agent 1
    await expect(agent1Page.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);
    
    // Verify consult end success was logged
    await agent1Page.waitForTimeout(2000);
    verifyConsultEndSuccessLogs();
    
    // End the call and complete wrapup to clean up for next test
    await endTask(agent1Page);
    await agent1Page.waitForTimeout(3000);
    await submitWrapup(agent1Page, WRAPUP_REASONS.RESOLVED);
    await agent1Page.waitForTimeout(2000);
  });

  test('Customer Terminates Call While Agent 1 is Consulting with Agent 2', async () => {
    // Create new call for this test
    await createCallTask(callerPage);
    
    const incomingTaskDiv = agent1Page.getByTestId('samples:incoming-task-telephony').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await agent1Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent1Page, TASK_TYPES.CALL);
    await agent1Page.waitForTimeout(5000);
    
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);

    // Clear logs before consult
    clearAdvancedCapturedLogs();

    // Agent 1 initiates queue consult
    await consultViaQueue(agent1Page, 'Customer Service Queue');

    // Agent 2 accepts the consultation
    const consultRequestDiv = agent2Page.getByTestId('samples:incoming-task-telephony').first();
    await consultRequestDiv.waitFor({ state: 'visible', timeout: 60000 });
    await agent2Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent2Page, TASK_TYPES.CALL);
    await agent2Page.waitForTimeout(3000);

    // Simulate customer terminating call
    await endTask(agent1Page);
    await agent1Page.waitForTimeout(3000);

    // Agent 1 enters wrap-up mode
    await submitWrapup(agent1Page, WRAPUP_REASONS.RESOLVED);
    
    // Agent 2 should return to Available state
    await agent2Page.waitForTimeout(3000);
    // Note: onEnd callback should appear in Agent 1's console
    verifyAdvancedEndLogs();
  });

  test('Agent 1 Consults via Queue with Agent 2, Then Transfers Call to Agent 2', async () => {
    // Create new call for this test
    await createCallTask(callerPage);
    
    const incomingTaskDiv = agent1Page.getByTestId('samples:incoming-task-telephony').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await agent1Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent1Page, TASK_TYPES.CALL);
    await agent1Page.waitForTimeout(5000);
    
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);

    // Clear logs before consult
    clearAdvancedCapturedLogs();

    // Agent 1 initiates queue consult
    await consultViaQueue(agent1Page, 'Customer Service Queue');

    // Agent 2 accepts the consultation
    const consultRequestDiv = agent2Page.getByTestId('samples:incoming-task-telephony').first();
    await consultRequestDiv.waitFor({ state: 'visible', timeout: 60000 });
    await agent2Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent2Page, TASK_TYPES.CALL);
    await agent2Page.waitForTimeout(3000);

    // Agent 1 transfers the call to Agent 2
    await agent1Page.getByTestId('transfer-consult-btn').click();
    await agent1Page.waitForTimeout(2000);

    // Agent 1 enters wrap-up state
    await submitWrapup(agent1Page, WRAPUP_REASONS.SALE);

    // Verify ownership shifts to Agent 2
    await verifyCurrentState(agent2Page, USER_STATES.ENGAGED);
    await expect(agent2Page.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();
    
    // Verify consult start and transfer success were logged
    await agent2Page.waitForTimeout(2000);
    verifyConsultStartSuccessLogs();
    verifyConsultTransferredLogs();
    
    // End the call and complete wrapup to clean up for next test
    await endTask(agent2Page);
    await agent2Page.waitForTimeout(3000);
    await submitWrapup(agent2Page, WRAPUP_REASONS.RESOLVED);
    await agent2Page.waitForTimeout(2000);
  });
});*/

// =============================================================================
// TEST SUITE: MULTI-STAGE CONSULT TRANSFER
// =============================================================================

test.describe('Multi-stage Consult Transfer Tests', () => {

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
    await Promise.all([
      (async () => {
        if(await getCurrentState(agent1Page) === USER_STATES.ENGAGED) {
          await endTask(agent1Page);
          await agent1Page.waitForTimeout(3000);
          await submitWrapup(agent1Page, WRAPUP_REASONS.RESOLVED);
          await agent1Page.waitForTimeout(2000);
        }
        await stationLogout(agent1Page);
      })(),
      (async () => {
        if(await getCurrentState(agent2Page) === USER_STATES.ENGAGED) {
          await endTask(agent2Page);
          await agent2Page.waitForTimeout(3000);
          await submitWrapup(agent2Page, WRAPUP_REASONS.RESOLVED);
          await agent2Page.waitForTimeout(2000);
        }
        await stationLogout(agent2Page);
      })(),
    ]);
    await agent1Context.close();
    await agent2Context.close();
    await callerContext.close();
  });

  test('Multi-Stage Consult and Transfer Between A1 and A2', async () => {
    await changeUserState(agent2Page, USER_STATES.MEETING);
    // Create initial call for Agent 1
    await createCallTask(callerPage);
    
    const incomingTaskDiv = agent1Page.getByTestId('samples:incoming-task-telephony').first();
    await incomingTaskDiv.waitFor({ state: 'visible', timeout: 120000 });
    await agent1Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent1Page, TASK_TYPES.CALL);
    await changeUserState(agent2Page, USER_STATES.AVAILABLE);
    await agent1Page.waitForTimeout(5000);
    
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);

    // Stage 1: Agent 1 consults with Agent 2
    clearAdvancedCapturedLogs();
    await consultViaAgent(agent1Page, 'User2 Agent2');

    const consultRequestDiv = agent2Page.getByTestId('samples:incoming-task-telephony').first();
    await consultRequestDiv.waitFor({ state: 'visible', timeout: 60000 });
    await agent2Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent2Page, TASK_TYPES.CALL);
    await agent2Page.waitForTimeout(3000);
    await verifyCurrentState(agent2Page, USER_STATES.ENGAGED);
    // Verify consult start success
    verifyConsultStartSuccessLogs();

    // Stage 2: Agent 1 transfers the call to Agent 2 and enters wrap-up
    await agent1Page.getByTestId('transfer-consult-btn').click();
    await agent1Page.waitForTimeout(2000);
    
    await submitWrapup(agent1Page, WRAPUP_REASONS.SALE);
  //  await acceptIncomingTask(agent2Page, TASK_TYPES.CALL);
    await agent2Page.waitForTimeout(3000);
    await verifyCurrentState(agent2Page, USER_STATES.ENGAGED);
    
    // Verify transfer success
    verifyTransferSuccessLogs();

    // Stage 3: Agent 2 consults back with Agent 1
    clearAdvancedCapturedLogs();
    await consultViaAgent(agent2Page, 'User1 Agent1');

    const returnConsultDiv = agent1Page.getByTestId('samples:incoming-task-telephony').first();
    await returnConsultDiv.waitFor({ state: 'visible', timeout: 60000 });
    await agent1Page.waitForTimeout(3000);
    
    await acceptIncomingTask(agent1Page, TASK_TYPES.CALL);
    await agent1Page.waitForTimeout(3000);

    // Verify second consult start success
    verifyConsultStartSuccessLogs();

    // Stage 4: Agent 2 transfers the call back to Agent 1 and enters wrap-up
    await agent2Page.getByTestId('transfer-consult-btn').click();
    await agent2Page.waitForTimeout(2000);
    
    await submitWrapup(agent2Page, WRAPUP_REASONS.RESOLVED);
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);
    
    // Verify second transfer success
    verifyTransferSuccessLogs();

    // Stage 5: Agent 1 can initiate another consult (verify seamless transitions)
    clearAdvancedCapturedLogs();
    await consultViaAgent(agent1Page, 'User2 Agent2');

    // Verify consult UI is available again
    await expect(agent1Page.getByTestId('cancel-consult-btn')).toBeVisible();
    await expect(agent1Page.getByTestId('transfer-consult-btn')).toBeVisible();

    // Cancel this final consult to clean up
    await cancelConsult(agent1Page);

    // Verify call state is maintained correctly
    await expect(agent1Page.getByRole('group', { name: 'Call Control with Call' })).toBeVisible();
    await verifyCurrentState(agent1Page, USER_STATES.ENGAGED);
    
    // End the call and complete wrapup to clean up
    await endTask(agent1Page);
    await agent1Page.waitForTimeout(3000);
    await submitWrapup(agent1Page, WRAPUP_REASONS.RESOLVED);
    await agent1Page.waitForTimeout(2000);
  });
});
