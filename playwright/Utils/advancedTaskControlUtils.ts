import { Page, expect } from '@playwright/test';
import { WRAPUP_REASONS } from '../constants';

/**
 * Utility functions for advanced task controls testing.
 * Provides functions for consult operations, transfer operations, and end consult actions.
 * These utilities handle complex multi-agent scenarios and task state transitions.
 *
 * @packageDocumentation
 */

// Array to store captured console logs for verification
let capturedAdvancedLogs: string[] = [];

/**
 * Sets up console logging to capture transfer and consult related callback logs.
 * Captures transfer success, consult start/end success, and related SDK messages.
 * @param page - The agent's main page
 * @returns Function to remove the console handler
 */
export function setupAdvancedConsoleLogging(page: Page): () => void {
  capturedAdvancedLogs.length = 0;

  const consoleHandler = (msg) => {
    const logText = msg.text();
    if (logText.includes('WXCC_SDK_TASK_TRANSFER_SUCCESS') ||
        logText.includes('WXCC_SDK_TASK_CONSULT_START_SUCCESS') ||
        logText.includes('WXCC_SDK_TASK_CONSULT_END_SUCCESS') ||
        logText.includes('AgentConsultFailed') ||
        logText.includes('AgentConsultTransferred') ||
        logText.includes('onEnd invoked') ||
        logText.includes('onTransfer invoked') ||
        logText.includes('onConsult invoked')) {
      capturedAdvancedLogs.push(logText);
    }
  };

  page.on('console', consoleHandler);
  return () => page.off('console', consoleHandler);
}

/**
 * Clears the captured advanced logs array.
 * Should be called before each test or verification to ensure clean state.
 */
export function clearAdvancedCapturedLogs(): void {
  capturedAdvancedLogs.length = 0;
}

/**
 * Verifies that transfer success logs are present.
 * @throws Error if verification fails with detailed error message
 */
export function verifyTransferSuccessLogs(): void {
  const transferLogs = capturedAdvancedLogs.filter(log => log.includes('WXCC_SDK_TASK_TRANSFER_SUCCESS'));
  
  if (transferLogs.length === 0) {
    throw new Error(`No 'WXCC_SDK_TASK_TRANSFER_SUCCESS' logs found. Captured logs: ${JSON.stringify(capturedAdvancedLogs)}`);
  }
  
  console.log(`✅ Transfer success verified: ${transferLogs[transferLogs.length - 1]}`);
}

/**
 * Verifies that consult start success logs are present.
 * @throws Error if verification fails with detailed error message
 */
export function verifyConsultStartSuccessLogs(): void {
  const consultStartLogs = capturedAdvancedLogs.filter(log => log.includes('WXCC_SDK_TASK_CONSULT_START_SUCCESS'));
  
  if (consultStartLogs.length === 0) {
    throw new Error(`No 'WXCC_SDK_TASK_CONSULT_START_SUCCESS' logs found. Captured logs: ${JSON.stringify(capturedAdvancedLogs)}`);
  }
  
  console.log(`✅ Consult start success verified: ${consultStartLogs[consultStartLogs.length - 1]}`);
}

/**
 * Verifies that consult end success logs are present.
 * @throws Error if verification fails with detailed error message
 */
export function verifyConsultEndSuccessLogs(): void {
  const consultEndLogs = capturedAdvancedLogs.filter(log => log.includes('WXCC_SDK_TASK_CONSULT_END_SUCCESS'));
  
  if (consultEndLogs.length === 0) {
    throw new Error(`No 'WXCC_SDK_TASK_CONSULT_END_SUCCESS' logs found. Captured logs: ${JSON.stringify(capturedAdvancedLogs)}`);
  }
  
  console.log(`✅ Consult end success verified: ${consultEndLogs[consultEndLogs.length - 1]}`);
}

/**
 * Verifies that agent consult failed logs are present (when consult times out or fails).
 * @throws Error if verification fails with detailed error message
 */
export function verifyConsultFailedLogs(): void {
  const consultFailedLogs = capturedAdvancedLogs.filter(log => log.includes('AgentConsultFailed'));
  
  if (consultFailedLogs.length === 0) {
    throw new Error(`No 'AgentConsultFailed' logs found. Captured logs: ${JSON.stringify(capturedAdvancedLogs)}`);
  }
  
  console.log(`✅ Consult failed verified: ${consultFailedLogs[consultFailedLogs.length - 1]}`);
}

/**
 * Verifies that agent consult transferred logs are present (when consult is converted to transfer).
 * @throws Error if verification fails with detailed error message
 */
export function verifyConsultTransferredLogs(): void {
  const consultTransferredLogs = capturedAdvancedLogs.filter(log => log.includes('AgentConsultTransferred'));
  
  if (consultTransferredLogs.length === 0) {
    throw new Error(`No 'AgentConsultTransferred' logs found. Captured logs: ${JSON.stringify(capturedAdvancedLogs)}`);
  }
  
  console.log(`✅ Consult transferred verified: ${consultTransferredLogs[consultTransferredLogs.length - 1]}`);
}

/**
 * Verifies that onEnd callback logs are present when tasks are ended during transfer/consult operations.
 * @throws Error if verification fails with detailed error message
 */
export function verifyAdvancedEndLogs(): void {
  const endLogs = capturedAdvancedLogs.filter(log => log.includes('onEnd invoked'));
  
  if (endLogs.length === 0) {
    throw new Error(`No 'onEnd invoked' logs found. Captured logs: ${JSON.stringify(capturedAdvancedLogs)}`);
  }
  
  console.log(`✅ End callback verified: ${endLogs[endLogs.length - 1]}`);
}

/**
 * Generic function to verify any specific log message exists in captured logs.
 * @param logMessage - The specific log message to search for
 * @param description - Description of what this log represents (for error messages)
 * @throws Error if verification fails with detailed error message
 */
export function verifySpecificLog(logMessage: string, description: string): void {
  const matchingLogs = capturedAdvancedLogs.filter(log => log.includes(logMessage));
  
  if (matchingLogs.length === 0) {
    throw new Error(`No '${logMessage}' logs found. Expected: ${description}. Captured logs: ${JSON.stringify(capturedAdvancedLogs)}`);
  }
  
  console.log(`✅ ${description} verified: ${matchingLogs[matchingLogs.length - 1]}`);
}

/**
 * Utility function to get all captured logs for debugging purposes.
 * @returns Array of all captured log messages
 */
export function getAllCapturedLogs(): string[] {
  return [...capturedAdvancedLogs];
}

/**
 * Initiates a consult with another agent via the agents tab.
 * @param page - The agent's main page
 * @param agentName - Name of the agent to consult with (e.g., 'User2 Agent2')
 * @returns Promise<void>
 */
export async function consultViaAgent(page: Page, agentName: string = 'User2 Agent2'): Promise<void> {
  // Click consult with another agent button
  await page.getByTestId('call-control:consult').nth(1).click();  
  // Navigate to Agents tab
  await page.getByRole('tab', { name: 'Agents' }).click();

  //hover over the agent name
  await page.getByRole('listitem', { name: agentName }).hover();

  // Select the specific agent
  await page.getByRole('listitem', { name: agentName }).getByRole('button').click();
  
  // Wait a moment for the consult to be initiated
  await page.waitForTimeout(2000);
}

/**
 * Initiates a consult with a queue via the queues tab.
 * @param page - The agent's main page
 * @param queueName - Name of the queue to consult with (e.g., 'Customer Service Queue')
 * @returns Promise<void>
 */
export async function consultViaQueue(page: Page, queueName: string = 'Customer Service Queue'): Promise<void> {
  // Click consult with another agent button
  await page.getByTestId('call-control:consult').nth(1).click();
  
  // Navigate to Queues tab
  await page.getByRole('tab', { name: 'Queues' }).click();

  // Hover over the queue name
  await page.getByRole('listitem', { name: queueName }).hover();

  // Select the specific queue
  await page.getByRole('listitem', { name: queueName }).getByRole('button').click();
  
  // Wait a moment for the consult to be initiated
  await page.waitForTimeout(2000);
}

/**
 * Cancels an ongoing consult and resumes the original call.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function cancelConsult(page: Page): Promise<void> {
  // Click cancel consult button
  await page.getByTestId('cancel-consult-btn').click();
  
  // Resume the original call
  await page.getByRole('group', { name: 'Call Control with Call' }).getByLabel('Resume the call').click();
}

/**
 * Initiates a transfer via the agents tab (without prior consult).
 * @param page - The agent's main page
 * @param agentName - Name of the agent to transfer to (e.g., 'User2 Agent2')
 * @returns Promise<void>
 */
export async function transferViaAgent(page: Page, agentName: string = 'User2 Agent2'): Promise<void> {
  // Click transfer call button
  await page.getByRole('group', { name: 'Call Control with Call' }).getByLabel('Transfer Call').click();
  
  // Navigate to Agents tab
  await page.getByRole('tab', { name: 'Agents' }).click();
  
  // Hover over the agent name
  await page.getByRole('listitem', { name: agentName }).hover();
  
  // Select the specific agent
  await page.getByRole('listitem', { name: agentName }).getByRole('button').click();
  
  // Wait a moment for the transfer to be processed
  await page.waitForTimeout(2000);
}

/**
 * Initiates a transfer via the queues tab (without prior consult).
 * @param page - The agent's main page
 * @param queueName - Name of the queue to transfer to (e.g., 'Customer Service Queue')
 * @returns Promise<void>
 */
export async function transferViaQueue(page: Page, queueName: string = 'Customer Service Queue'): Promise<void> {
  // Click transfer call button
  await page.getByRole('group', { name: 'Call Control with Call' }).getByLabel('Transfer Call').click();
  
  // Navigate to Queues tab
  await page.getByRole('tab', { name: 'Queues' }).click();
  
  // Hover over the queue name
  await page.getByRole('listitem', { name: queueName }).hover();
  
  // Select the specific queue
  await page.getByRole('listitem', { name: queueName }).getByRole('button').click();
  
  // Complete the transfer (click the main transfer button)
  await page.getByRole('group', { name: 'Call Control with Call' }).getByRole('button').click();
  
  // Wait a moment for the transfer to be processed
  await page.waitForTimeout(2000);
}

/**
 * Transfers a call after establishing a consult with another agent.
 * @param page - The agent's main page
 * @param agentName - Name of the agent to transfer to (e.g., 'User2 Agent2')
 * @returns Promise<void>
 */
export async function transferAfterConsult(page: Page, agentName: string = 'User2 Agent2'): Promise<void> {
  // First establish consult
  await consultViaAgent(page, agentName);
  
  // Then transfer the consult
  await page.getByTestId('transfer-consult-btn').click();
  
  // Complete the transfer
  await page.getByRole('group', { name: 'Call Control with Call' }).getByRole('button').click();
}

/**
 * Ends a consult session and returns to the original call.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function endConsult(page: Page): Promise<void> {
  // End the consult (this should return focus to the original call)
  await page.getByRole('group', { name: 'Call Control with Call' }).getByRole('button').click();
}

/**
 * Accepts an incoming consult or transfer request.
 * This is the same as accepting any incoming task.
 * @param page - The agent's page receiving the consult/transfer
 * @returns Promise<void>
 */
export async function acceptIncomingConsultOrTransfer(page: Page): Promise<void> {
  // Accept the incoming consult/transfer request
  await page.getByRole('button', { name: 'Accept' }).first().click();
}

/**
 * Declines an incoming consult or transfer request.
 * This is the same as declining any incoming task.
 * @param page - The agent's page receiving the consult/transfer
 * @returns Promise<void>
 */
export async function declineIncomingConsultOrTransfer(page: Page): Promise<void> {
  // Decline the incoming consult/transfer request
  await page.getByRole('button', { name: 'Decline' }).first().click();
}

/**
 * Completes wrapup after a consult or transfer operation.
 * @param page - The agent's main page
 * @param wrapupReason - The reason for wrapup (defaults to 'Sale')
 * @returns Promise<void>
 */
export async function completeWrapupAfterConsultOrTransfer(page: Page, wrapupReason: string = WRAPUP_REASONS.SALE): Promise<void> {
  // Open wrapup dialog
  await page.getByRole('dialog', { name: 'Wrap up' }).locator('#select-base-triggerid').click();
  
  // Select wrapup reason
  await page.getByRole('option', { name: wrapupReason, exact: true }).click();
  
  // Submit wrapup
  await page.getByTestId('submit-wrapup-button').click();
}

/**
 * Dismisses any open popover or backdrop that might be blocking UI interactions.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function dismissPopover(page: Page): Promise<void> {
  // Click the popover backdrop to dismiss any open popovers
  await page.locator('.md-popover-backdrop').click();
}