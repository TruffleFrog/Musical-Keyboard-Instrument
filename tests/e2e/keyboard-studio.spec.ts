import { expect, test, type Page } from '@playwright/test';

const lit = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.key.is-song')].map((k) => (k as HTMLElement).dataset.note)
  );

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('piano-key-C4')).toBeVisible();
});

test.describe('playing', () => {
  test('QWERTY chords light keys, name the chord, and panic clears them', async ({ page }) => {
    const c4 = page.getByTestId('piano-key-C4');
    await expect(c4).toHaveAttribute('data-key-binding', 'A');

    await page.keyboard.down('KeyA');
    await page.keyboard.down('KeyD');
    await page.keyboard.down('KeyG');
    for (const n of ['C4', 'E4', 'G4']) {
      await expect(page.getByTestId(`piano-key-${n}`)).toHaveAttribute('data-active', 'true');
    }
    await expect(page.getByTestId('lcd-chord')).toHaveText('C');

    await page.keyboard.press('Escape');
    for (const n of ['C4', 'E4', 'G4']) {
      await expect(page.getByTestId(`piano-key-${n}`)).toHaveAttribute('data-active', 'false');
    }
    await page.keyboard.up('KeyA');
    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyG');
  });

  test('mouse press, drag-glissando and release', async ({ page }) => {
    const box = async (n: string) => (await page.getByTestId(`piano-key-${n}`).boundingBox())!;
    const c4 = await box('C4');
    const f4 = await box('F4');
    await page.mouse.move(c4.x + c4.width / 2, c4.y + c4.height - 20);
    await page.mouse.down();
    await expect(page.getByTestId('piano-key-C4')).toHaveAttribute('data-active', 'true');
    await page.mouse.move(f4.x + f4.width / 2, f4.y + f4.height - 20, { steps: 8 });
    await expect(page.getByTestId('piano-key-F4')).toHaveAttribute('data-active', 'true');
    await expect(page.getByTestId('piano-key-C4')).toHaveAttribute('data-active', 'false');
    await page.mouse.up();
    await expect(page.getByTestId('piano-key-F4')).toHaveAttribute('data-active', 'false');
  });

  test('panic releases a key held with the pointer', async ({ page }) => {
    const c4 = await page.getByTestId('piano-key-C4').boundingBox();
    await page.mouse.move(c4!.x + c4!.width / 2, c4!.y + c4!.height - 20);
    await page.mouse.down();
    await expect(page.getByTestId('piano-key-C4')).toHaveAttribute('data-active', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('piano-key-C4')).toHaveAttribute('data-active', 'false');
    await expect(page.getByTestId('active-notes-readout')).toContainText('Ready');
    await page.mouse.up();
  });

  test('octave shift moves the marked QWERTY range', async ({ page }) => {
    await expect(page.getByTestId('octave-display')).toHaveText('C4–C6');
    await page.keyboard.press('KeyX');
    await expect(page.getByTestId('octave-display')).toHaveText('C5–C7');
    await expect(page.getByTestId('piano-key-C5')).toHaveAttribute('data-key-binding', 'A');
    await page.getByTestId('octave-down-btn').click();
    await page.getByTestId('octave-down-btn').click();
    await expect(page.getByTestId('octave-display')).toHaveText('C3–C5');
  });

  test('switching sounds and tone knobs keeps QWERTY playable and persists', async ({ page }) => {
    await page.getByTestId('instrument-card-synth').click();
    await expect(page.getByTestId('lcd-patch')).toHaveText('Poly Synth');

    const knob = page.getByTestId('param-release');
    await knob.focus();
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowUp');
    const value = await knob.getAttribute('aria-valuenow');

    await page.keyboard.down('KeyA');
    await expect(page.getByTestId('piano-key-C4')).toHaveAttribute('data-active', 'true');
    await page.keyboard.up('KeyA');

    await page.getByTestId('header-volume-slider').fill('0.4');
    await page.waitForTimeout(300);
    await page.reload();

    await expect(page.getByTestId('lcd-patch')).toHaveText('Poly Synth');
    await expect(page.getByTestId('param-release')).toHaveAttribute('aria-valuenow', value!);
    await expect(page.getByTestId('header-volume-slider')).toHaveValue('0.4');
  });

  test('sustain: Space holds, button latches', async ({ page }) => {
    const pedal = page.getByTestId('sustain-toggle-btn');
    await page.keyboard.down('Space');
    await expect(pedal).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.up('Space');
    await expect(pedal).toHaveAttribute('aria-pressed', 'false');
    await pedal.click();
    await expect(pedal).toHaveAttribute('aria-pressed', 'true');
    await pedal.click();
    await expect(pedal).toHaveAttribute('aria-pressed', 'false');
  });

  test('help opens with ? and closes with Escape', async ({ page }) => {
    await page.keyboard.press('Shift+Slash');
    await expect(page.getByTestId('help-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('help-dialog')).toHaveCount(0);
  });
});

test.describe('songs', () => {
  test('arrangements light several keys at once and parts can be muted', async ({ page }) => {
    await page.getByTestId('tab-songs').click();
    await page.getByTestId('song-item-prelude-in-c').click();
    await page.getByTestId('demo-play-toggle').click();

    // polyphony: ≥3 keys lit at the same instant
    await page.waitForFunction(() => document.querySelectorAll('.key.is-song').length >= 3, null, {
      timeout: 6000,
    });

    // melody only: never more than the single arpeggio line... but with the
    // prelude's held notes, still fewer than with the bass part.
    const withAll = await page.evaluate(
      () => document.querySelectorAll('.key.is-song').length
    );
    expect(withAll).toBeGreaterThanOrEqual(3);

    await page.getByTestId('demo-play-toggle').click();
    await page.getByTestId('song-item-ode-to-joy').click();
    await page.getByTestId('melody-only-switch').click();
    await page.getByTestId('demo-play-toggle').click();
    let max = 0;
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(120);
      max = Math.max(max, (await lit(page)).length);
    }
    expect(max).toBe(1);

    await page.getByTestId('melody-only-switch').click();
    await page.waitForFunction(() => document.querySelectorAll('.key.is-song').length >= 3, null, {
      timeout: 5000,
    });
  });

  test('tempo changes take effect without restarting the song', async ({ page }) => {
    const elapsed = async () => {
      const t = (await page.getByTestId('song-position').textContent()) ?? '';
      const m = /· (\d+):(\d+) \//.exec(t);
      return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : -1;
    };
    await page.getByTestId('tab-songs').click();
    await page.getByTestId('demo-play-toggle').click();
    await page.waitForTimeout(1600);
    const before = await elapsed();
    expect(before).toBeGreaterThanOrEqual(1);
    await page.getByTestId('demo-speed-slider').fill('1.6');
    await expect(page.getByTestId('demo-speed-value')).toHaveText('1.6×');
    await page.waitForTimeout(900);
    const after = await elapsed();
    expect(after).toBeGreaterThanOrEqual(before); // kept going, did not rewind
    await expect(page.getByTestId('demo-play-toggle')).toContainText('Pause');
  });

  test('a song finishes by itself and returns to stopped', async ({ page }) => {
    await page.getByTestId('tab-songs').click();
    await page.getByTestId('song-item-twinkle').click();
    await page.getByTestId('demo-speed-slider').fill('1.6');
    await page.getByTestId('demo-play-toggle').click();
    await expect(page.getByTestId('demo-play-toggle')).toContainText('Play', { timeout: 40000 });
    await expect.poll(() => lit(page)).toEqual([]);
  });

  test('learn mode: hint, accept right key (any octave), advance, accompany', async ({ page }) => {
    await page.getByTestId('tab-songs').click();
    await page.getByTestId('mode-practice-btn').click();
    await expect(page.getByTestId('demo-step-counter')).toContainText('Step 1 / 62');

    // wrong key does not advance
    await page.keyboard.press('KeyA');
    await expect(page.getByTestId('demo-step-counter')).toContainText('Step 1 / 62');
    await expect(page.getByTestId('demo-step-counter')).toContainText('1 slip');

    // press the hinted computer key
    const hint = (await page.locator('.learn-target kbd').first().textContent())!;
    const code: Record<string, string> = {
      ';': 'Semicolon', "'": 'Quote', '[': 'BracketLeft', ']': 'BracketRight',
      '\\': 'Backslash', ',': 'Comma', '.': 'Period', '/': 'Slash', '=': 'Equal',
    };
    await page.keyboard.press(code[hint] ?? `Key${hint}`);
    await expect(page.getByTestId('demo-step-counter')).toContainText('Step 2 / 62');
    // target key outline is shown on the keyboard
    await expect(page.locator('.key.is-target, .key.is-hint').first()).toBeVisible();
  });

  test('exports an arrangement as a valid MIDI file', async ({ page }) => {
    await page.getByTestId('tab-songs').click();
    const dl = page.waitForEvent('download');
    await page.getByTestId('export-song-midi-btn').click();
    const download = await dl;
    expect(download.suggestedFilename()).toBe('ode-to-joy.mid');
    const stream = await download.createReadStream();
    const parts: Uint8Array[] = [];
    for await (const c of stream) parts.push(c as Uint8Array);
    const total = parts.reduce((n, p) => n + p.length, 0);
    const bytes = new Uint8Array(total);
    let at = 0;
    for (const p of parts) {
      bytes.set(p, at);
      at += p.length;
    }
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('MThd');
    expect((bytes[10] << 8) | bytes[11]).toBe(4); // tempo + melody + chords + bass
  });
});

test.describe('recording', () => {
  test('records, saves, replays with lit keys, renames, exports and deletes', async ({ page }) => {
    await page.getByTestId('tab-record').click();
    await page.getByTestId('record-start-btn').click();
    await expect(page.getByTestId('recording-status-badge')).toHaveText('Recording');

    // Hold a chord long enough that replay keeps keys lit for >1 s, so the
    // assertion below does not race the animation frame.
    await page.keyboard.down('KeyA');
    await page.keyboard.down('KeyD');
    await page.keyboard.down('KeyG');
    await page.waitForTimeout(1500);
    await page.keyboard.up('KeyA');
    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyG');
    await page.getByTestId('record-stop-btn').click();

    await expect(page.getByTestId('recording-item-name')).toContainText('Take 1');

    // replay lights keys
    await page.getByTestId('take-play-btn').click();
    await expect.poll(() => lit(page), { timeout: 3000 }).not.toEqual([]);

    // rename
    await page.getByRole('button', { name: /Rename/ }).click();
    await page.getByLabel('Take name').fill('My idea');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('recording-item-name')).toHaveText('My idea');

    // MIDI export
    const dl = page.waitForEvent('download');
    await page.getByTestId('export-midi-btn').click();
    const download = await dl;
    expect(download.suggestedFilename()).toBe('my-idea.mid');

    // survives a reload
    await page.waitForTimeout(300);
    await page.reload();
    await page.getByTestId('tab-record').click();
    await expect(page.getByTestId('recording-item-name')).toHaveText('My idea');

    await page.getByTestId('delete-take-btn').click();
    await expect(page.getByTestId('recordings-list')).toHaveCount(0);
  });

  test('an empty take is reported, not saved', async ({ page }) => {
    await page.getByTestId('tab-record').click();
    await page.getByTestId('record-start-btn').click();
    await page.getByTestId('record-stop-btn').click();
    await expect(page.getByTestId('empty-take-notice')).toBeVisible();
    await expect(page.getByTestId('recordings-list')).toHaveCount(0);
  });
});
