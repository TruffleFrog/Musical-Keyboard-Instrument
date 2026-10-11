// Captures the screenshots used in the README / review.
//   node scripts/screenshots.mjs docs/screenshots/after   (dev server on :5173)
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] ?? 'docs/screenshots/after';
const base = process.argv[3] ?? 'http://localhost:5173/';
fs.mkdirSync(out, { recursive: true });

const exe = path.join(
  process.env.LOCALAPPDATA ?? '',
  'ms-playwright', 'chromium-1232', 'chrome-win64', 'chrome.exe'
);
const browser = await chromium.launch({
  executablePath: fs.existsSync(exe) ? exe : undefined,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(base);
await page.waitForTimeout(1200);
const shot = (name, opts = {}) =>
  page.screenshot({ path: path.join(out, name), ...opts });

await shot('01-play-idle.png');

for (const k of ['KeyA', 'KeyD', 'KeyG', 'KeyJ', 'KeyW', 'KeyL']) await page.keyboard.down(k);
await page.waitForTimeout(250);
await shot('02-play-chord.png');
for (const k of ['KeyA', 'KeyD', 'KeyG', 'KeyJ', 'KeyW', 'KeyL']) await page.keyboard.up(k);

await page.getByTestId('tab-songs').click();
await page.waitForTimeout(300);
await shot('03-songs.png');

await page.getByTestId('demo-play-toggle').click();
await page.waitForTimeout(3200);
await shot('04-songs-playing.png');
await page.getByTestId('demo-play-toggle').click();

await page.getByTestId('mode-practice-btn').click();
await page.waitForTimeout(500);
await shot('05-songs-learn.png');

await page.getByTestId('tab-record').click();
await page.waitForTimeout(300);
await shot('06-record.png');

await page.setViewportSize({ width: 390, height: 844 });
await page.getByTestId('tab-play').click();
await page.waitForTimeout(400);
await shot('07-mobile.png');

await page.setViewportSize({ width: 1024, height: 700 });
await page.waitForTimeout(300);
await shot('08-tablet.png');

await browser.close();
console.log('saved to', out);
