// Smoke-tests a deployed (or locally previewed) build in headless Chromium:
// loads the page, waits for the piano samples, plays a key, checks for failed
// requests / console errors and that the service worker takes control.
// It can NOT judge how the audio sounds.
//
//   node scripts/smoke-url.mjs https://trufflefrog.github.io/Musical-Keyboard-Instrument/
//   node scripts/smoke-url.mjs http://localhost:4173/Musical-Keyboard-Instrument/ --offline
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const url = process.argv[2];
const checkOffline = process.argv.includes('--offline');
if (!url) {
  console.error('usage: node scripts/smoke-url.mjs <url> [--offline]');
  process.exit(2);
}

function localChromium() {
  const root = path.join(process.env.LOCALAPPDATA ?? '', 'ms-playwright');
  if (!fs.existsSync(root)) return undefined;
  const dirs = fs
    .readdirSync(root)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => parseInt(b.split('-')[1], 10) - parseInt(a.split('-')[1], 10));
  for (const d of dirs) {
    const exe = path.join(root, d, 'chrome-win64', 'chrome.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ executablePath: localChromium() });
const context = await browser.newContext();
const page = await context.newPage();
const failed = [];
const errors = [];
page.on('requestfailed', (r) => failed.push(`${r.url()} (${r.failure()?.errorText})`));
page.on('response', (r) => {
  if (r.status() >= 400) failed.push(`${r.url()} -> HTTP ${r.status()}`);
});
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const resp = await page.goto(url, { waitUntil: 'load' });
check('page responds 200', resp?.status() === 200, `HTTP ${resp?.status()}`);
check('title is Keyboard Studio', (await page.title()) === 'Keyboard Studio', await page.title());

await page.getByTestId('piano-key-C4').waitFor({ timeout: 15000 });
check('keyboard rendered', true);

const status = page.getByTestId('sample-status');
try {
  await status.filter({ hasText: 'Piano samples ready' }).waitFor({ timeout: 25000 });
  check('piano samples fetched and decoded', true);
} catch {
  check('piano samples fetched and decoded', false, await status.textContent());
}

await page.keyboard.down('KeyA');
const active = await page.getByTestId('piano-key-C4').getAttribute('data-active');
await page.keyboard.up('KeyA');
check('pressing A lights C4', active === 'true');

await page.getByTestId('tab-songs').click();
await page.getByTestId('demo-play-toggle').click();
await page.waitForFunction(() => document.querySelectorAll('.key.is-song').length >= 2, null, {
  timeout: 8000,
}).then(
  () => check('song playback lights several keys', true),
  () => check('song playback lights several keys', false)
);
await page.getByTestId('demo-play-toggle').click();

const hasSw = await page
  .waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 15000 })
  .then(() => true, () => false);
check('service worker controls the page', hasSw);

check('no failed requests', failed.length === 0, failed.slice(0, 3).join('; '));
check('no console / page errors', errors.length === 0, errors.slice(0, 2).join('; '));

if (checkOffline) {
  await page.waitForTimeout(6000);
  await context.setOffline(true);
  await page.reload();
  const ok = await page
    .getByTestId('piano-key-C4')
    .waitFor({ timeout: 8000 })
    .then(() => true, () => false);
  check('reloads and renders while offline', ok);
  await context.setOffline(false);
}

await browser.close();
const failedChecks = results.filter((r) => !r.ok);
console.log(failedChecks.length === 0 ? '\nALL CHECKS PASSED' : `\n${failedChecks.length} CHECK(S) FAILED`);
process.exit(failedChecks.length === 0 ? 0 : 1);
