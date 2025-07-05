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
}

/**
 * Toggles the hold state of a call by clicking the hold/resume button.
 * This function will put the call on hold if it's currently active, or resume it if it's on hold.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function holdCallToggle(page: Page): Promise<void> {
  // Wait for hold toggle button to be visible and clickable
  const holdButton = page.getByTestId('call-control:hold-toggle').nth(0);
  await expect(holdButton).toBeVisible({ timeout: 10000 });
  
  // Click the hold toggle button
  await holdButton.click();
}

/**
 * Toggles the recording state of a call by clicking the recording pause/resume button.
 * This function will pause recording if it's currently active, or resume it if it's paused.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function recordCallToggle(page: Page): Promise<void> {
  // Wait for recording toggle button to be visible and clickable
  const recordButton = page.getByTestId('call-control:recording-toggle').nth(0);
  await expect(recordButton).toBeVisible({ timeout: 10000 });
  
  // Click the recording toggle button
  await recordButton.click();
}

/**
 * Verifies the hold timer visibility and content based on expected state.
 * @param page - The agent's main page
 * @param shouldBeVisible - Whether the timer should be visible (true) or hidden (false)
 * @param verifyContent - Whether to verify timer content (default: true when visible)
 * @returns Promise<void>
 */
export async function verifyHoldTimer(page: Page, shouldBeVisible: boolean, verifyContent: boolean = shouldBeVisible): Promise<void> {
  const holdTimerContainer = page.locator('.on-hold-chip-text');
  
  if (shouldBeVisible) {
    await expect(holdTimerContainer).toBeVisible({ timeout: 10000 });
    
    if (verifyContent) {
      // Verify "On hold" text is present
      await expect(holdTimerContainer).toContainText('On hold');
      
      // Verify timer format (should contain time like 00:XX)
      await expect(holdTimerContainer).toContainText(/\d{2}:\d{2}/);
    }
  } else {
    await expect(holdTimerContainer).toBeHidden({ timeout: 10000 });
  }
}

// Global variable to store captured logs
let capturedLogs: string[] = [];

/**
 * Sets up console logging to capture callback logs for task controls.
 * Captures onHoldResume, onRecordingToggle, onEnd callbacks and SDK success messages.
 * @param page - The agent's main page
 * @returns Function to remove the console handler
 */
export function setupConsoleLogging(page: Page): () => void {
  capturedLogs.length = 0;

  const consoleHandler = (msg) => {
    const logText = msg.text();
    if (logText.includes('onHoldResume invoked') ||
        logText.includes('onRecordingToggle invoked') ||
        logText.includes('onEnd invoked') ||
        logText.includes('WXCC_SDK_TASK_HOLD_SUCCESS') ||
        logText.includes('WXCC_SDK_TASK_RESUME_SUCCESS') ||
        logText.includes('WXCC_SDK_TASK_PAUSE_RECORDING_SUCCESS') ||
        logText.includes('WXCC_SDK_TASK_RESUME_RECORDING_SUCCESS')) {
      capturedLogs.push(logText);
    }
  };

  page.on('console', consoleHandler);
  return () => page.off('console', consoleHandler);
}

/**
 * Clears the captured logs array.
 * Should be called before each test or verification to ensure clean state.
 */
export function clearCapturedLogs(): void {
  capturedLogs.length = 0;
}

/**
 * Verifies that hold/resume callback logs are present and contain expected values.
 * @param expectedIsHeld - Expected hold state (true for hold, false for resume)
 * @throws Error if verification fails with detailed error message
 */
export function verifyHoldLogs(expectedIsHeld: boolean): void {
  const holdResumeLogs = capturedLogs.filter(log => log.includes('onHoldResume invoked'));
  const statusLogs = capturedLogs.filter(log => 
    log.includes(expectedIsHeld ? 'WXCC_SDK_TASK_HOLD_SUCCESS' : 'WXCC_SDK_TASK_RESUME_SUCCESS')
  );
  
  if (holdResumeLogs.length === 0) {
    throw new Error(`No 'onHoldResume invoked' logs found. Expected logs for isHeld: ${expectedIsHeld}. Captured logs: ${JSON.stringify(capturedLogs)}`);
  }
  
  if (statusLogs.length === 0) {
    const expectedStatus = expectedIsHeld ? 'WXCC_SDK_TASK_HOLD_SUCCESS' : 'WXCC_SDK_TASK_RESUME_SUCCESS';
    throw new Error(`No '${expectedStatus}' logs found. Captured logs: ${JSON.stringify(capturedLogs)}`);
  }
  
  const lastHoldLog = holdResumeLogs[holdResumeLogs.length - 1];
  if (!lastHoldLog.includes(`isHeld: ${expectedIsHeld}`)) {
    throw new Error(`Expected 'isHeld: ${expectedIsHeld}' in log but found: ${lastHoldLog}`);
  }
}

/**
 * Verifies that recording pause/resume callback logs are present and contain expected values.
 * @param expectedIsRecording - Expected recording state (true for recording, false for paused)
 * @throws Error if verification fails with detailed error message
 */
export function verifyRecordingLogs(expectedIsRecording: boolean): void {
  const recordingLogs = capturedLogs.filter(log => log.includes('onRecordingToggle invoked'));
  const statusLogs = capturedLogs.filter(log => 
    log.includes(expectedIsRecording ? 'WXCC_SDK_TASK_RESUME_RECORDING_SUCCESS' : 'WXCC_SDK_TASK_PAUSE_RECORDING_SUCCESS')
  );
  
  if (recordingLogs.length === 0) {
    throw new Error(`No 'onRecordingToggle invoked' logs found. Expected logs for isRecording: ${expectedIsRecording}. Captured logs: ${JSON.stringify(capturedLogs)}`);
  }
  
  if (statusLogs.length === 0) {
    const expectedStatus = expectedIsRecording ? 'WXCC_SDK_TASK_RESUME_RECORDING_SUCCESS' : 'WXCC_SDK_TASK_PAUSE_RECORDING_SUCCESS';
    throw new Error(`No '${expectedStatus}' logs found. Captured logs: ${JSON.stringify(capturedLogs)}`);
  }
  
  const lastRecordingLog = recordingLogs[recordingLogs.length - 1];
  if (!lastRecordingLog.includes(`isRecording: ${expectedIsRecording}`)) {
    throw new Error(`Expected 'isRecording: ${expectedIsRecording}' in log but found: ${lastRecordingLog}`);
  }
}

/**
 * Verifies that onEnd callback logs are present when tasks are ended.
 * @throws Error if verification fails with detailed error message
 */
export function verifyEndLogs(): void {
  const endLogs = capturedLogs.filter(log => log.includes('onEnd invoked'));
  
  if (endLogs.length === 0) {
    throw new Error(`No 'onEnd invoked' logs found. Captured logs: ${JSON.stringify(capturedLogs)}`);
  }
}