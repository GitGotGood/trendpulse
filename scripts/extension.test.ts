import { test, expect, type BrowserContext } from '@playwright/test';
import { chromium } from 'playwright';
import path from 'path';

let browserContext: BrowserContext;
const extensionPath = path.join(__dirname, '../extension');

test.beforeEach(async ({ }) => {
    browserContext = await chromium.launchPersistentContext('', {
        headless: false, // Extension testing requires a headful browser
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
        ],
    });
});

test.afterEach(async () => {
    await browserContext.close();
});

test('Popup should load and show trends or error state', async () => {
    const page = await browserContext.newPage();

    // Find the extension ID
    let [background] = browserContext.serviceWorkers();
    if (!background) {
        background = await browserContext.waitForEvent('serviceworker');
    }
    const extensionId = background.url().split('/')[2];

    // Navigate to the popup directly for testing
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Check for Header
    await expect(page.locator('h1')).toHaveText('TrendPulse');

    // Check for Loading State or Trends
    const list = page.locator('#trends-list');
    await expect(list).toBeVisible();

    // Check for Either Success or Error
    const hasTrends = await page.locator('.trend-item').count() > 0;
    const hasError = await page.locator('#error-state').isVisible();

    expect(hasTrends || hasError).toBeTruthy();

    console.log(`Test Result: Trends Found: ${hasTrends}, Error Visible: ${hasError}`);
});
