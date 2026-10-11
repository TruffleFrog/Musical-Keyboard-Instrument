import { expect, test } from '@playwright/test';

test.describe('Keyboard Studio E2E', () => {
  test('plays notes and chords via QWERTY keyboard and highlights virtual piano keys', async ({
    page,
  }) => {
    await page.goto('/');

    const c4Key = page.getByTestId('piano-key-C4');
    const e4Key = page.getByTestId('piano-key-E4');
    const g4Key = page.getByTestId('piano-key-G4');

    await expect(c4Key).toBeVisible();
    await expect(c4Key).toHaveAttribute('data-key-binding', 'A');

    // Hold C major triad (A + D + G)
    await page.keyboard.down('KeyA');
    await page.keyboard.down('KeyD');
    await page.keyboard.down('KeyG');

    await expect(c4Key).toHaveAttribute('data-active', 'true');
    await expect(e4Key).toHaveAttribute('data-active', 'true');
    await expect(g4Key).toHaveAttribute('data-active', 'true');

    await page.keyboard.up('KeyA');
    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyG');

    await expect(c4Key).toHaveAttribute('data-active', 'false');
    await expect(e4Key).toHaveAttribute('data-active', 'false');
    await expect(g4Key).toHaveAttribute('data-active', 'false');
  });

  test('switches instruments, adjusts sound parameters, and persists preferences', async ({
    page,
  }) => {
    await page.goto('/');

    const synthCard = page.getByTestId('instrument-card-synth');
    await synthCard.click();
    await expect(synthCard).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('led-status-display')).toContainText(
      'WARM POLYSYNTH'
    );

    // Toggle Sustain via Spacebar
    await page.keyboard.press('Space');
    await expect(page.getByTestId('sustain-toggle-btn')).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    // Reload page and confirm preferences persisted in localStorage
    await page.reload();
    await expect(page.getByTestId('led-status-display')).toContainText(
      'WARM POLYSYNTH'
    );
    await expect(page.getByTestId('sustain-toggle-btn')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('synchronizes virtual piano key highlights during Demo Song playback and supports Practice Mode', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByTestId('tab-songs').click();
    await expect(page.getByTestId('selected-song-title')).toHaveText(
      'Ode to Joy'
    );

    // Speed up playback to 2x and start Auto-Play
    await page.getByTestId('speed-btn-2x').click();
    await page.getByTestId('demo-play-toggle').click();

    // First note of Ode to Joy is E4 — verify virtual key E4 highlights in sync
    const e4Key = page.getByTestId('piano-key-E4');
    await expect(e4Key).toHaveAttribute('data-active', 'true');

    // Pause and switch to Practice Mode
    await page.getByTestId('mode-practice-btn').click();
    await expect(page.getByTestId('practice-target-note')).toHaveText('E4');
    await expect(e4Key).toHaveAttribute('data-demo-target', 'true');

    // Press D (E4) twice to advance to F4
    await page.keyboard.press('KeyD');
    await page.keyboard.press('KeyD');
    await expect(page.getByTestId('practice-target-note')).toHaveText('F4');
  });

  test('records a performance, plays it back, and supports MIDI download', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByTestId('tab-recorder').click();
    await page.getByTestId('record-start-btn').click();

    await page.keyboard.press('KeyA');
    await page.keyboard.press('KeyS');
    await page.keyboard.press('KeyD');

    await page.getByTestId('record-stop-btn').click();

    await expect(page.getByTestId('recording-item-name')).toContainText(
      'Take #1'
    );

    // Verify MIDI export triggers a .mid download
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-midi-btn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.mid$/);
  });
});
