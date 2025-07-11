import { Page, expect } from '@playwright/test';
import { WRAPUP_REASONS } from './constants';

/**
 * Utility functions for advanced task controls testing.
 * Provides functions for consult operations, transfer operations, and end consult actions.
 * These utilities handle complex multi-agent scenarios and task state transitions.
 *
 * @packageDocumentation
 */

/**
 * Initiates a consult with another agent via the agents tab.
 * @param page - The agent's main page
 * @param agentName - Name of the agent to consult with (e.g., 'User2 Agent2')
 * @returns Promise<void>
 */
export async function consultViaAgent(page: Page, agentName: string = 'User2 Agent2'): Promise<void> {
  // Click consult with another agent button
  await page.getByRole('group', { name: 'Call Control', exact: true }).getByLabel('Consult with another agent').click();
  
  // Navigate to Agents tab
  await page.getByRole('tab', { name: 'Agents' }).click();
  
  // Select the specific agent
  await page.getByRole('listitem', { name: agentName }).getByRole('button').click();
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
  
  // Select the specific agent
  await page.getByRole('listitem', { name: agentName }).getByRole('button').click();
  
  // Complete the transfer (click the main transfer button)
  await page.getByRole('group', { name: 'Call Control with Call' }).getByRole('button').click();
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