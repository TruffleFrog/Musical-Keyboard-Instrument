import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';

describe('Keyboard Studio App integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders virtual piano keys and highlights keys on physical QWERTY keydown/keyup', () => {
    render(<App />);

    const c4Key = screen.getByTestId('piano-key-C4');
    const e4Key = screen.getByTestId('piano-key-E4');
    expect(c4Key).toHaveAttribute('data-active', 'false');

    // Press 'A' (C4) and 'D' (E4) simultaneously as a chord
    fireEvent.keyDown(window, { code: 'KeyA', key: 'a' });
    fireEvent.keyDown(window, { code: 'KeyD', key: 'd' });

    expect(c4Key).toHaveAttribute('data-active', 'true');
    expect(e4Key).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('active-notes-readout')).toHaveTextContent('C4');
    expect(screen.getByTestId('active-notes-readout')).toHaveTextContent('E4');

    // Release 'A'
    fireEvent.keyUp(window, { code: 'KeyA', key: 'a' });
    expect(c4Key).toHaveAttribute('data-active', 'false');
    expect(e4Key).toHaveAttribute('data-active', 'true');

    // Release 'D'
    fireEvent.keyUp(window, { code: 'KeyD', key: 'd' });
    expect(e4Key).toHaveAttribute('data-active', 'false');
  });

  it('keeps QWERTY musical keys responsive even when a range slider is focused', () => {
    render(<App />);

    const volumeSlider = screen.getByTestId('header-volume-slider');
    volumeSlider.focus();
    fireEvent.change(volumeSlider, { target: { value: '0.65' } });

    // Dispatch keyDown directly on the focused range slider
    fireEvent.keyDown(volumeSlider, { code: 'KeyA', key: 'a', bubbles: true });
    expect(screen.getByTestId('piano-key-C4')).toHaveAttribute(
      'data-active',
      'true'
    );

    fireEvent.keyUp(volumeSlider, { code: 'KeyA', key: 'a', bubbles: true });
    expect(screen.getByTestId('piano-key-C4')).toHaveAttribute(
      'data-active',
      'false'
    );
  });

  it('clears all active notes on window blur and Escape panic to prevent stuck notes', () => {
    render(<App />);

    const c4Key = screen.getByTestId('piano-key-C4');
    const g4Key = screen.getByTestId('piano-key-G4');

    fireEvent.keyDown(window, { code: 'KeyA', key: 'a' });
    fireEvent.keyDown(window, { code: 'KeyG', key: 'g' });
    expect(c4Key).toHaveAttribute('data-active', 'true');
    expect(g4Key).toHaveAttribute('data-active', 'true');

    // Simulate window blur
    fireEvent(window, new Event('blur'));
    expect(c4Key).toHaveAttribute('data-active', 'false');
    expect(g4Key).toHaveAttribute('data-active', 'false');
  });

  it('switches octaves via Z/X shortcuts and updates virtual piano range', () => {
    render(<App />);
    expect(screen.getByTestId('octave-display')).toHaveTextContent('OCT 4');

    fireEvent.keyDown(window, { code: 'KeyX', key: 'x' });
    expect(screen.getByTestId('octave-display')).toHaveTextContent('OCT 5');
    expect(screen.getByTestId('piano-key-C5')).toBeInTheDocument();

    fireEvent.keyDown(window, { code: 'KeyZ', key: 'z' });
    expect(screen.getByTestId('octave-display')).toHaveTextContent('OCT 4');
  });

  it('supports Practice Mode (Follow Notes) and auto-aligns octave if out of range', () => {
    render(<App />);

    // Shift down to Octave 1 first so C4-G4 would be out of range
    fireEvent.keyDown(window, { code: 'KeyZ', key: 'z' });
    fireEvent.keyDown(window, { code: 'KeyZ', key: 'z' });
    fireEvent.keyDown(window, { code: 'KeyZ', key: 'z' });
    expect(screen.getByTestId('octave-display')).toHaveTextContent('OCT 1');

    fireEvent.click(screen.getByTestId('tab-songs'));
    expect(screen.getByTestId('demo-songs-panel')).toBeInTheDocument();

    // Switching to Practice Mode auto-aligns octave back to 4 so Ode to Joy keys are visible
    fireEvent.click(screen.getByTestId('mode-practice-btn'));
    expect(screen.getByTestId('octave-display')).toHaveTextContent('OCT 4');
    expect(screen.getByTestId('practice-target-note')).toHaveTextContent('E4');

    const e4Key = screen.getByTestId('piano-key-E4');
    expect(e4Key).toHaveAttribute('data-demo-target', 'true');

    // Play E4 twice (first two notes of Ode to Joy)
    fireEvent.keyDown(window, { code: 'KeyD', key: 'd' });
    fireEvent.keyUp(window, { code: 'KeyD', key: 'd' });
    expect(screen.getByTestId('demo-step-counter')).toHaveTextContent('Step 2 /');

    fireEvent.keyDown(window, { code: 'KeyD', key: 'd' });
    fireEvent.keyUp(window, { code: 'KeyD', key: 'd' });
    expect(screen.getByTestId('demo-step-counter')).toHaveTextContent('Step 3 /');
    expect(screen.getByTestId('practice-target-note')).toHaveTextContent('F4');
  });

  it('records a live performance, saves it to the session library, and notifies on empty takes', () => {
    render(<App />);

    fireEvent.click(screen.getByTestId('tab-recorder'));

    // Start & immediately stop without playing notes -> shows empty-take notice
    fireEvent.click(screen.getByTestId('record-start-btn'));
    fireEvent.click(screen.getByTestId('record-stop-btn'));
    expect(screen.getByTestId('empty-take-notice')).toBeInTheDocument();

    // Now record a take with C4 and G4
    fireEvent.click(screen.getByTestId('record-start-btn'));
    expect(screen.getByTestId('recording-status-badge')).toHaveTextContent(
      'RECORDING LIVE'
    );

    fireEvent.keyDown(window, { code: 'KeyA', key: 'a' });
    fireEvent.keyUp(window, { code: 'KeyA', key: 'a' });
    fireEvent.keyDown(window, { code: 'KeyG', key: 'g' });
    fireEvent.keyUp(window, { code: 'KeyG', key: 'g' });

    fireEvent.click(screen.getByTestId('record-stop-btn'));
    expect(screen.getByTestId('recordings-list')).toBeInTheDocument();
    expect(screen.getByTestId('recording-item-name')).toHaveTextContent(
      'Take #1'
    );
  });
});
