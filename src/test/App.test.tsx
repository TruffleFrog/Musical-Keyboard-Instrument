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

  it('switches octaves via Z/X shortcuts and updates virtual piano range', () => {
    render(<App />);
    expect(screen.getByTestId('octave-display')).toHaveTextContent('OCT 4');

    fireEvent.keyDown(window, { code: 'KeyX', key: 'x' });
    expect(screen.getByTestId('octave-display')).toHaveTextContent('OCT 5');
    expect(screen.getByTestId('piano-key-C5')).toBeInTheDocument();

    fireEvent.keyDown(window, { code: 'KeyZ', key: 'z' });
    expect(screen.getByTestId('octave-display')).toHaveTextContent('OCT 4');
  });

  it('supports Practice Mode (Follow Notes) in the Demo Songs tab', () => {
    render(<App />);

    fireEvent.click(screen.getByTestId('tab-songs'));
    expect(screen.getByTestId('demo-songs-panel')).toBeInTheDocument();

    // Switch to Practice Mode on Ode to Joy (starts with E4 -> E4 -> F4 -> G4)
    fireEvent.click(screen.getByTestId('mode-practice-btn'));
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

  it('records a live performance and saves it to the session library', () => {
    render(<App />);

    fireEvent.click(screen.getByTestId('tab-recorder'));
    fireEvent.click(screen.getByTestId('record-start-btn'));
    expect(screen.getByTestId('recording-status-badge')).toHaveTextContent(
      'RECORDING LIVE'
    );

    // Play C4 and G4
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
