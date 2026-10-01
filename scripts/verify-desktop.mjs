import { chromium } from 'playwright-core';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';

const exe = resolve(import.meta.dirname, '..', 'release', 'Chen Studio-win32-x64', 'Chen Studio.exe');
if (!existsSync(exe)) throw new Error('Desktop package missing. Run npm run desktop:package.');

const port = 19371;
const testProfile = await mkdtemp(resolve(tmpdir(), 'chen-studio-test-'));
const child = spawn(exe, [`--remote-debugging-port=${port}`], {
  stdio: 'ignore',
  env: { ...process.env, CHEN_STUDIO_USER_DATA: testProfile },
});
let browser;
try {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 1000 });
      break;
    } catch {
      await new Promise((done) => setTimeout(done, 250));
    }
  }
  if (!browser) throw new Error('Could not connect to packaged app.');
  const page = browser.contexts()[0].pages()[0];
  if (!page) throw new Error('Desktop window did not open.');
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.locator('.react-flow__node-studio').first().waitFor({ timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  const starterNodes = await page.locator('.react-flow__node-studio').count();
  const logoLoaded = await page.locator('.brand-mark').evaluate((img) => img.complete && img.naturalWidth > 0);
  const fitsCanvas = await page.evaluate(() => {
    const pane = document.querySelector('.canvas-wrap').getBoundingClientRect();
    return [...document.querySelectorAll('.react-flow__node-studio')].every((node) => {
      const box = node.getBoundingClientRect();
      return box.left >= pane.left - 2 && box.right <= pane.right + 2 && box.top >= pane.top - 2 && box.bottom <= pane.bottom + 2;
    });
  });
  if (process.env.CHEN_DESKTOP_SCREENSHOT) await page.screenshot({ path: process.env.CHEN_DESKTOP_SCREENSHOT });
  await page.setViewportSize({ width: 820, height: 620 });
  await page.getByRole('button', { name: 'Expand elements' }).waitFor();
  await page.getByRole('button', { name: 'Expand properties' }).waitFor();
  const narrowCanvas = await page.locator('.canvas-wrap').evaluate((element) => element.getBoundingClientRect().width);
  await page.getByRole('button', { name: 'Expand elements' }).click();
  const paletteOpened = await page.locator('.palette').isVisible();
  await page.getByRole('button', { name: 'Collapse elements' }).click();
  await page.setViewportSize({ width: 1480, height: 920 });
  await page.getByRole('button', { name: 'Expand elements' }).click();
  await page.getByRole('button', { name: 'Expand properties' }).click();
  await page.getByRole('button', { name: 'New diagram' }).click();
  await page.locator('.palette-item').filter({ hasText: 'Single rectangle' }).click();
  await page.locator('.react-flow__pane').click({ position: { x: 200, y: 200 } });
  await page.locator('.inline-rename').fill('DESKTOP_TEST');
  await page.locator('.inline-rename').press('Enter');
  await page.getByText('Saved locally').waitFor({ timeout: 5000 });
  await page.reload({ waitUntil: 'networkidle' });
  const restored = await page.locator('svg[aria-label="entity: DESKTOP_TEST"]').count();
  if (starterNodes < 10 || !logoLoaded || !fitsCanvas || narrowCanvas < 780 || !paletteOpened || restored !== 1 || errors.length) {
    throw new Error(JSON.stringify({ starterNodes, logoLoaded, fitsCanvas, narrowCanvas, paletteOpened, restored, errors }));
  }
  console.log(`Packaged desktop app OK: ${starterNodes} starter nodes, logo loaded, saved diagram restored.`);
} finally {
  await browser?.close();
  if (child.pid) {
    try { execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); }
    catch { child.kill(); }
  }
  if (dirname(testProfile) !== resolve(tmpdir()) || !basename(testProfile).startsWith('chen-studio-test-')) {
    throw new Error('Unexpected temporary profile path.');
  }
  await rm(testProfile, { recursive: true, force: true, maxRetries: 6, retryDelay: 250 });
}
