import React, { useCallback, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { studio } from '../app/studio';
import {
  MAX_OCTAVE,
  MIN_OCTAVE,
  WINDOW_SPAN,
  getKeyLabelForMidi,
  layoutKeys,
  nearestWindowMidi,
  windowBaseMidi,
  isInWindow,
} from '../data/keyboardMap';
import { midiToName } from '../music/notes';
import { useStudio } from './ui';

interface KeyboardProps {
  low: number;
  high: number;
}

const NO_TARGETS: ReadonlySet<number> = new Set();

export const KeyboardDock: React.FC<KeyboardProps> = ({ low, high }) => {
  const octave = useStudio((s) => s.prefs.octave);
  const user = useStudio((s) => s.userNotes);
  const song = useStudio((s) => s.songNotes);
  const learnTargets = useStudio((s) => s.learnTargets);
  const learning = useStudio(
    (s) => s.prefs.tab === 'songs' && s.prefs.songMode === 'learn'
  );
  // Target outlines belong to the Songs > Learn view only.
  const targets = learning ? learnTargets : NO_TARGETS;
  const showLetters = useStudio((s) => s.prefs.showKeyLabels);
  const showNames = useStudio((s) => s.prefs.showNoteNames);
  const pedal = useStudio((s) => s.pedalLatched || s.pedalHeld);

  const { keys } = useMemo(() => layoutKeys(low, high), [low, high]);
  const base = windowBaseMidi(octave);

  // Targets outside the computer-keyboard window: point at the nearest key
  // with the same note name that *is* reachable.
  const hints = useMemo(() => {
    const out = new Set<number>();
    for (const t of targets) {
      if (!isInWindow(t, octave)) out.add(nearestWindowMidi(t, octave));
    }
    return out;
  }, [targets, octave]);

  // Window band (the 25 keys the computer keyboard currently plays).
  const bandLow = Math.max(base, low);
  const bandHigh = Math.min(base + WINDOW_SPAN, high);
  const bandStart = keys.find((k) => k.midi === bandLow);
  const bandEnd = keys.find((k) => k.midi === bandHigh);
  const band =
    bandStart && bandEnd
      ? {
          left: bandStart.x * 100,
          width: (bandEnd.x + bandEnd.w - bandStart.x) * 100,
        }
      : null;

  /* ---- pointer input: multi-touch + glissando ---- */
  const bedRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, number>());

  const keyAt = useCallback((x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-midi]');
    if (!(el instanceof HTMLElement)) return null;
    const rect = el.getBoundingClientRect();
    const ratio = rect.height > 0 ? (y - rect.top) / rect.height : 0.7;
    return {
      midi: parseInt(el.dataset.midi!, 10),
      velocity: Math.max(0.3, Math.min(1, 0.3 + ratio * 0.75)),
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const hit = keyAt(e.clientX, e.clientY);
    if (!hit) return;
    e.preventDefault();
    bedRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, hit.midi);
    studio.pressKey(hit.midi, hit.velocity);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const current = pointers.current.get(e.pointerId);
    if (current === undefined) return;
    const hit = keyAt(e.clientX, e.clientY);
    if (hit && hit.midi !== current) {
      studio.releaseKey(current);
      pointers.current.set(e.pointerId, hit.midi);
      studio.pressKey(hit.midi, hit.velocity);
    }
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const current = pointers.current.get(e.pointerId);
    if (current === undefined) return;
    pointers.current.delete(e.pointerId);
    studio.releaseKey(current);
  };

  const lowC = midiToName(base);
  const highC = midiToName(base + WINDOW_SPAN);

  return (
    <section className="dock" aria-label="Keyboard" data-testid="keyboard-dock">
      <div className="dock-strip">
        <div className="dock-group" role="group" aria-label="Octave">
          <span className="dock-label">Octave</span>
          <button
            type="button"
            className="btn btn-sm"
            data-testid="octave-down-btn"
            disabled={octave <= MIN_OCTAVE}
            onClick={() => studio.shiftOctave(-1)}
            aria-label="Octave down"
            title="Octave down (Z)"
          >
            <ChevronLeft size={14} />
            <kbd>Z</kbd>
          </button>
          <span className="octave-readout" data-testid="octave-display">
            {lowC}–{highC}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            data-testid="octave-up-btn"
            disabled={octave >= MAX_OCTAVE}
            onClick={() => studio.shiftOctave(1)}
            aria-label="Octave up"
            title="Octave up (X)"
          >
            <kbd>X</kbd>
            <ChevronRight size={14} />
          </button>
        </div>

        <p className="dock-hint">
          Your computer keyboard plays the marked range · click or touch any key
        </p>

        <button
          type="button"
          className={`pedal ${pedal ? 'is-on' : ''}`}
          aria-pressed={pedal}
          data-testid="sustain-toggle-btn"
          onClick={() => studio.togglePedalLatch()}
          title="Sustain pedal: hold Space, or click to latch"
        >
          <span className="pedal-lamp" aria-hidden="true" />
          <span>Sustain</span>
          <kbd>Space</kbd>
        </button>
      </div>

      <div className="keys-wrap">
        <div className="window-band" aria-hidden="true">
          {band && (
            <span
              className="window-band-fill"
              style={{ left: `${band.left}%`, width: `${band.width}%` }}
            />
          )}
        </div>
        <div
          ref={bedRef}
          className="keys"
          data-testid="piano-keyboard"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onLostPointerCapture={endPointer}
          onContextMenu={(e) => e.preventDefault()}
        >
          {keys.map((k) => {
            const name = midiToName(k.midi);
            const letter = getKeyLabelForMidi(k.midi, octave);
            const down = user.has(k.midi);
            const lit = song.has(k.midi);
            const isTarget = targets.has(k.midi);
            const isHint = hints.has(k.midi);
            const inWindow = k.midi >= base && k.midi <= base + WINDOW_SPAN;
            const isC = k.midi % 12 === 0;
            const cls = [
              'key',
              k.isBlack ? 'key-black' : 'key-white',
              inWindow ? 'in-window' : '',
              down ? 'is-down' : '',
              lit ? 'is-song' : '',
              isTarget ? 'is-target' : '',
              isHint ? 'is-hint' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={k.midi}
                type="button"
                tabIndex={-1}
                className={cls}
                style={{ left: `${k.x * 100}%`, width: `${k.w * 100}%` }}
                data-midi={k.midi}
                data-note={name}
                data-testid={`piano-key-${name}`}
                data-key-binding={letter ?? undefined}
                data-active={down || lit ? 'true' : 'false'}
                data-demo-target={lit || isTarget ? 'true' : 'false'}
                aria-label={name}
                aria-pressed={down || lit}
              >
                {showLetters && letter && <kbd className="key-letter">{letter}</kbd>}
                {(isC || showNames) && <span className="key-name">{name}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
