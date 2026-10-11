import { expect, test, type Page } from '@playwright/test';

/**
 * Regression tests for the "page jumps when I press keys" bug.
 *
 * Every major region must keep an identical box (position AND size) no matter
 * what dynamic content appears: held notes, chord names, timers, learn
 * prompts, tab switches, song playback, recording...
 */

const REGIONS: Record<string, string> = {
  topbar: '.topbar',
  lcd: '.lcd',
  deck: '#panel-deck',
  stage: '.stage',
  dock: '.dock',
  keys: '[data-testid="piano-keyboard"]',
};

type Boxes = Record<string, [number, number, number, number]>;

async function measure(page: Page): Promise<Boxes> {
  return page.evaluate((regions) => {
    const out: Record<string, [number, number, number, number]> = {};
    for (const [name, sel] of Object.entries(regions)) {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`missing region ${name}`);
      const r = el.getBoundingClientRect();
      out[name] = [r.x, r.y, r.width, r.height].map(
        (n) => Math.round(n * 100) / 100
      ) as [number, number, number, number];
    }
    return out;
  }, REGIONS);
}

async function expectNoOverflow(page: Page) {
  const o = await page.evaluate(() => ({
    sh: document.documentElement.scrollHeight,
    ih: window.innerHeight,
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
  }));
  expect(o.sh, 'page must not scroll vertically').toBeLessThanOrEqual(o.ih);
  expect(o.sw, 'page must not scroll horizontally').toBeLessThanOrEqual(o.iw);
}

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 720 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'phone', width: 390, height: 844 },
];

const KEYS = [
  'KeyA', 'KeyW', 'KeyS', 'KeyE', 'KeyD', 'KeyF', 'KeyT', 'KeyG',
  'KeyY', 'KeyH', 'KeyU', 'KeyJ', 'KeyK', 'KeyL',
];

for (const vp of VIEWPORTS) {
  test.describe(`layout stability @ ${vp.name} ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await expect(page.getByTestId('piano-key-C4')).toBeVisible();
    });

    test('playing chords, runs and octave shifts never moves anything', async ({ page }) => {
      const before = await measure(page);
      await expectNoOverflow(page);

      // 14-note cluster: the case that used to wrap the readout.
      for (const k of KEYS) await page.keyboard.down(k);
      await expect(page.getByTestId('active-notes-readout')).not.toContainText('Ready');
      expect(await measure(page)).toEqual(before);
      for (const k of KEYS) await page.keyboard.up(k);

      // rapid single notes
      for (let i = 0; i < 40; i++) {
        const k = KEYS[i % KEYS.length];
        await page.keyboard.down(k);
        await page.keyboard.up(k);
      }
      expect(await measure(page)).toEqual(before);

      // octave changes, pedal, sound switching, labels
      for (const code of ['KeyX', 'KeyX', 'KeyZ', 'KeyZ', 'KeyZ', 'KeyZ', 'KeyX']) {
        await page.keyboard.press(code);
        expect(await measure(page)).toEqual(before);
      }
      await page.keyboard.down('Space');
      await page.keyboard.down('KeyA');
      expect(await measure(page)).toEqual(before);
      await page.keyboard.up('KeyA');
      await page.keyboard.up('Space');
      for (const d of ['Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit1']) {
        await page.keyboard.press(d);
      }
      await page.getByTestId('toggle-note-names-btn').click();
      await page.getByTestId('toggle-key-labels-btn').click();
      expect(await measure(page)).toEqual(before);
      await expectNoOverflow(page);
    });

    test('switching tabs keeps the shared regions fixed', async ({ page }) => {
      const play = await measure(page);
      for (const tab of ['songs', 'record', 'play']) {
        await page.getByTestId(`tab-${tab}`).click();
        const boxes = await measure(page);
        expect(boxes, `after switching to ${tab}`).toEqual(play);
        await expectNoOverflow(page);
      }
    });

    test('song playback, learn mode and part toggles never move anything', async ({ page }) => {
      await page.getByTestId('tab-songs').click();
      const before = await measure(page);

      const ids = ['ode-to-joy', 'twinkle', 'greensleeves', 'korobeiniki', 'fur-elise', 'canon-in-d', 'prelude-in-c'];
      for (const id of ids) {
        await page.getByTestId(`song-item-${id}`).click();
        expect(await measure(page), `selecting ${id}`).toEqual(before);
      }
      await page.getByTestId('song-item-prelude-in-c').click();
      await page.getByTestId('demo-play-toggle').click();
      for (let i = 0; i < 6; i++) {
        await page.waitForTimeout(150);
        expect(await measure(page)).toEqual(before);
      }
      await page.getByTestId('part-bass').click();
      await page.getByTestId('melody-only-switch').click();
      await page.getByTestId('demo-play-toggle').click();

      await page.getByTestId('mode-practice-btn').click();
      expect(await measure(page)).toEqual(before);
      for (const k of ['KeyA', 'KeyS', 'KeyD']) {
        await page.keyboard.press(k);
        expect(await measure(page)).toEqual(before);
      }
      await page.getByTestId('mode-autoplay-btn').click();
      expect(await measure(page)).toEqual(before);
      await expectNoOverflow(page);
    });

    test('recording and take playback never move anything', async ({ page }) => {
      await page.getByTestId('tab-record').click();
      const before = await measure(page);
      await page.getByTestId('record-start-btn').click();
      for (const k of KEYS.slice(0, 6)) {
        await page.keyboard.down(k);
        await page.waitForTimeout(40);
        expect(await measure(page)).toEqual(before);
      }
      for (const k of KEYS.slice(0, 6)) await page.keyboard.up(k);
      await page.waitForTimeout(250);
      expect(await measure(page)).toEqual(before);
      await page.getByTestId('record-stop-btn').click();
      expect(await measure(page)).toEqual(before);

      // many takes, long names
      for (let i = 0; i < 6; i++) {
        await page.getByTestId('record-start-btn').click();
        await page.keyboard.press('KeyA');
        await page.getByTestId('record-stop-btn').click();
      }
      expect(await measure(page)).toEqual(before);
      await page.getByTestId('take-play-btn').first().click();
      await page.waitForTimeout(200);
      expect(await measure(page)).toEqual(before);
      await expectNoOverflow(page);
    });
  });
}

test('the readout never wraps and the keyboard keeps its exact position', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const top = async () =>
    page.evaluate(() => document.querySelector('[data-testid="piano-keyboard"]')!.getBoundingClientRect().top);
  const t0 = await top();
  for (const k of KEYS) await page.keyboard.down(k);
  const lcd = await page.evaluate(() => {
    const el = document.querySelector('.lcd')!;
    const notes = el.querySelector('.lcd-notes')!;
    return {
      lcdH: el.getBoundingClientRect().height,
      notesH: notes.getBoundingClientRect().height,
      scrollH: notes.scrollHeight,
    };
  });
  expect(await top()).toBe(t0);
  expect(lcd.lcdH).toBe(44);
  expect(lcd.scrollH).toBeLessThanOrEqual(lcd.notesH);
  for (const k of KEYS) await page.keyboard.up(k);
});
