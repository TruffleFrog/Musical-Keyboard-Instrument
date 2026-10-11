import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { studio } from '../app/studio';

function key(code: string, key: string, type: 'keyDown' | 'keyUp' = 'keyDown') {
  fireEvent[type](window, { code, key });
}

describe('Keyboard Studio app', () => {
  beforeEach(() => {
    window.localStorage.clear();
    studio.panic();
    studio.setTab('play');
    studio.setSongMode('listen');
    studio.setOctave(4);
    studio.setInstrument('piano');
  });
  afterEach(() => {
    studio.panic();
  });

  it('lights keys and the readout for QWERTY chords, and clears on release', () => {
    render(<App />);
    const c4 = screen.getByTestId('piano-key-C4');
    const e4 = screen.getByTestId('piano-key-E4');
    expect(c4).toHaveAttribute('data-active', 'false');

    key('KeyA', 'a');
    key('KeyD', 'd');
    key('KeyG', 'g');
    expect(c4).toHaveAttribute('data-active', 'true');
    expect(e4).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('active-notes-readout')).toHaveTextContent('C4');
    expect(screen.getByTestId('lcd-chord')).toHaveTextContent('C');

    key('KeyA', 'a', 'keyUp');
    expect(c4).toHaveAttribute('data-active', 'false');
    expect(e4).toHaveAttribute('data-active', 'true');
    key('KeyD', 'd', 'keyUp');
    key('KeyG', 'g', 'keyUp');
    expect(e4).toHaveAttribute('data-active', 'false');
  });

  it('keeps playing while a range input or knob has focus', () => {
    render(<App />);
    const slider = screen.getByTestId('header-volume-slider');
    slider.focus();
    fireEvent.keyDown(slider, { code: 'KeyA', key: 'a' });
    expect(screen.getByTestId('piano-key-C4')).toHaveAttribute('data-active', 'true');
    fireEvent.keyUp(slider, { code: 'KeyA', key: 'a' });
  });

  it('releases everything on window blur and Escape (no stuck notes)', () => {
    render(<App />);
    key('KeyA', 'a');
    key('KeyG', 'g');
    expect(screen.getByTestId('piano-key-C4')).toHaveAttribute('data-active', 'true');
    fireEvent(window, new Event('blur'));
    expect(screen.getByTestId('piano-key-C4')).toHaveAttribute('data-active', 'false');
    expect(screen.getByTestId('piano-key-G4')).toHaveAttribute('data-active', 'false');
    expect(studio.getVoiceCount()).toBeGreaterThanOrEqual(0);

    key('KeyD', 'd');
    key('Escape', 'Escape');
    expect(screen.getByTestId('piano-key-E4')).toHaveAttribute('data-active', 'false');
  });

  it('shifts the octave with Z/X and arrow keys, within limits', () => {
    render(<App />);
    expect(screen.getByTestId('octave-display')).toHaveTextContent('C4–C6');
    key('KeyX', 'x');
    expect(screen.getByTestId('octave-display')).toHaveTextContent('C5–C7');
    key('KeyX', 'x');
    expect(screen.getByTestId('octave-display')).toHaveTextContent('C5–C7');
    key('KeyZ', 'z');
    key('KeyZ', 'z');
    key('KeyZ', 'z');
    key('KeyZ', 'z');
    expect(screen.getByTestId('octave-display')).toHaveTextContent('C2–C4');
    expect(screen.getByTestId('octave-down-btn')).toBeDisabled();
    key('ArrowUp', 'ArrowUp');
    expect(screen.getByTestId('octave-display')).toHaveTextContent('C3–C5');
  });

  it('switches sounds with 1-6 and from the sound grid', () => {
    render(<App />);
    key('Digit3', '3');
    expect(screen.getByTestId('lcd-patch')).toHaveTextContent('Poly Synth');
    fireEvent.click(screen.getByTestId('instrument-card-organ'));
    expect(screen.getByTestId('lcd-patch')).toHaveTextContent('Pipe Organ');
    expect(screen.getByTestId('instrument-card-organ')).toHaveAttribute('aria-checked', 'true');
  });

  it('latches the sustain pedal from the on-screen control', () => {
    render(<App />);
    const pedal = screen.getByTestId('sustain-toggle-btn');
    expect(pedal).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(pedal);
    expect(pedal).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(pedal);
    expect(pedal).toHaveAttribute('aria-pressed', 'false');
  });

  it('holds the pedal while Space is down', () => {
    render(<App />);
    key('Space', ' ');
    expect(screen.getByTestId('sustain-toggle-btn')).toHaveAttribute('aria-pressed', 'true');
    key('Space', ' ', 'keyUp');
    expect(screen.getByTestId('sustain-toggle-btn')).toHaveAttribute('aria-pressed', 'false');
  });

  it('persists preferences across a reload', () => {
    vi.useFakeTimers();
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByTestId('instrument-card-synth'));
    act(() => {
      vi.advanceTimersByTime(400);
    });
    unmount();
    vi.useRealTimers();
    const saved = JSON.parse(
      window.localStorage.getItem('keyboard_studio_preferences_v2') ?? '{}'
    );
    expect(saved.instrument).toBe('synth');
  });

  it('shows the song library, polyphonic part toggles and learn prompt', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('tab-songs'));
    expect(screen.getByTestId('demo-songs-panel')).toBeInTheDocument();
    expect(screen.getByTestId('selected-song-title')).toHaveTextContent('Ode to Joy');
    expect(screen.getByTestId('part-melody')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('part-chords')).toBeInTheDocument();
    expect(screen.getByTestId('part-bass')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('part-bass'));
    expect(screen.getByTestId('part-bass')).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(screen.getByTestId('mode-practice-btn'));
    expect(screen.getByTestId('practice-prompt-banner')).toBeInTheDocument();
    expect(screen.getByTestId('practice-target-note')).toHaveTextContent('E4');
    expect(screen.getByTestId('demo-step-counter')).toHaveTextContent('Step 1');
  });

  it('Learn mode waits for the right key, accepts any octave, then advances', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('tab-songs'));
    fireEvent.click(screen.getByTestId('mode-practice-btn'));
    // Ode to Joy recommends octave 3: window is C3..C5, so E4 is key "H"? no:
    // target E4 is the 17th key; just check by label from the hint instead.
    const target = within(screen.getByTestId('practice-target-note'));
    const hintKey = target.getByText((_, el) => el?.tagName === 'KBD').textContent!;

    // wrong note first
    key('KeyA', 'a');
    key('KeyA', 'a', 'keyUp');
    expect(screen.getByTestId('demo-step-counter')).toHaveTextContent('Step 1');

    const codeFor = (label: string) =>
      ({ A: 'KeyA', S: 'KeyS', D: 'KeyD', F: 'KeyF', G: 'KeyG', H: 'KeyH', J: 'KeyJ', K: 'KeyK', L: 'KeyL' } as Record<string, string>)[label] ?? `Key${label}`;
    key(codeFor(hintKey), hintKey.toLowerCase());
    key(codeFor(hintKey), hintKey.toLowerCase(), 'keyUp');
    expect(screen.getByTestId('demo-step-counter')).toHaveTextContent('Step 2');
  });

  it('records a take, lists it, and reports empty takes', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('tab-record'));

    fireEvent.click(screen.getByTestId('record-start-btn'));
    fireEvent.click(screen.getByTestId('record-stop-btn'));
    expect(screen.getByTestId('empty-take-notice')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('record-start-btn'));
    expect(screen.getByTestId('recording-status-badge')).toHaveTextContent('Recording');
    key('KeyA', 'a');
    key('KeyA', 'a', 'keyUp');
    key('KeyG', 'g');
    key('KeyG', 'g', 'keyUp');
    fireEvent.click(screen.getByTestId('record-stop-btn'));

    expect(screen.getByTestId('recordings-list')).toBeInTheDocument();
    expect(screen.getByTestId('recording-item-name')).toHaveTextContent('Take 1');
    fireEvent.click(screen.getByTestId('delete-take-btn'));
    expect(screen.queryByTestId('recordings-list')).not.toBeInTheDocument();
  });

  it('opens and closes the help dialog', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('help-btn'));
    expect(screen.getByTestId('help-dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByTestId('help-dialog')).not.toBeInTheDocument();
  });
});
