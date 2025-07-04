// filepath: /Users/prayprab/UI_automation/widgets/playwright/Utils/taskControlUtils.ts
import { Page, expect } from '@playwright/test';

/**
 * Utility functions for task controls testing.
 * Verifies visibility of task control buttons for different task types.
 *
 * @packageDocumentation
 */

/**
 * Verifies that all call task control buttons are visible and accessible.
 * Checks for hold, recording, transfer, consult, and end buttons.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function callTaskControlCheck(page: Page): Promise<void> {
  // Verify call control container is visible
  await expect(page.getByTestId('call-control-container').nth(0)).toBeVisible({ timeout: 30000 });
  
  // Verify hold/resume toggle button is visible
  await expect(page.getByTestId('call-control:hold-toggle').nth(0)).toBeVisible();
  
  // Verify recording toggle button is visible
  await expect(page.getByTestId('call-control:recording-toggle').nth(0)).toBeVisible();
  
  // Verify transfer button is visible
  await expect(page.getByTestId('call-control:transfer').nth(0)).toBeVisible();
  
  // Verify consult button is visible
  await expect(page.getByTestId('call-control:consult').nth(0)).toBeVisible();
  
  // Verify end call button is visible
  await expect(page.getByTestId('call-control:end-call').nth(0)).toBeVisible();
  
  console.log('Call task control check completed successfully - all buttons visible');
}

/**
 * Verifies that chat task control buttons are visible and accessible.
 * Checks for transfer and end buttons only.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function chatTaskControlCheck(page: Page): Promise<void> {
  // Verify chat control container or equivalent is visible
  await expect(page.getByTestId('call-control-container').nth(0)).toBeVisible({ timeout: 30000 });
  
  // Verify transfer button is visible
  await expect(page.getByTestId('call-control:transfer').nth(0)).toBeVisible();
  
  // Verify end button is visible (for chat tasks)
  await expect(page.getByTestId('call-control:end-call').nth(0)).toBeVisible();
  
  console.log('Chat task control check completed successfully - transfer and end buttons visible');
}

/**
 * Verifies that email task control buttons are visible and accessible.
 * Checks for transfer and end buttons only.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function emailTaskControlCheck(page: Page): Promise<void> {
  // Verify email control container or equivalent is visible
  await expect(page.getByTestId('call-control-container').nth(0)).toBeVisible({ timeout: 30000 });
  
  // Verify transfer button is visible
  await expect(page.getByTestId('call-control:transfer').nth(0)).toBeVisible();
  
  // Verify end button is visible (for email tasks)
  await expect(page.getByTestId('call-control:end-call').nth(0)).toBeVisible();
  
  console.log('Email task control check completed successfully - transfer and end buttons visible');
}