import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MAX_OCTAVE, MIN_OCTAVE } from '../data/keyboardMap';
import { VirtualKeyNote } from '../types/music';

interface PianoKeyboardProps {
  notes: VirtualKeyNote[];
  baseOctave: number;
  sustain: boolean;
  activeMidis: Set<number>;
  demoHighlightMidis: Set<number>;
  practiceTargetMidi: number | null;
  practiceStepNumber?: number;
  showKeyLabels: boolean;
  showNoteNames: boolean;
  accentColor: string;
  onNoteStart: (midi: number) => void;
  onNoteEnd: (midi: number) => void;
  onChangeOctave: (delta: number) => void;
  onToggleSustain: () => void;
}

const BLACK_KEY_PRECEDING_WHITE_COUNT: Record<number, number> = {
  1: 1,   // C#
  3: 2,   // D#
  6: 4,   // F#
  8: 5,   // G#
  10: 6,  // A#
  13: 8,  // C#+1
  15: 9,  // D#+1
  18: 11, // F#+1
  20: 12, // G#+1
  22: 13, // A#+1
};

export const PianoKeyboard: React.FC<PianoKeyboardProps> = ({
  notes,
  baseOctave,
  sustain,
  activeMidis,
  demoHighlightMidis,
  practiceTargetMidi,
  practiceStepNumber,
  showKeyLabels,
  showNoteNames,
  accentColor,
  onNoteStart,
  onNoteEnd,
  onChangeOctave,
  onToggleSustain,
}) => {
  const isPointerDownRef = useRef(false);
  const activePointerMidiRef = useRef<number | null>(null);
  const onNoteEndRef = useRef(onNoteEnd);
  onNoteEndRef.current = onNoteEnd;

  const whiteKeys = notes.filter((n) => !n.isSharp);
  const blackKeys = notes.filter((n) => n.isSharp);
  const totalWhiteKeys = whiteKeys.length; // 15

  // Guarantee pointer release even if user drags outside window or keybed
  useEffect(() => {
    const handleWindowPointerUp = () => {
      if (activePointerMidiRef.current !== null) {
        onNoteEndRef.current(activePointerMidiRef.current);
        activePointerMidiRef.current = null;
      }
      isPointerDownRef.current = false;
    };

    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, []);

  const handlePointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    midi: number
  ) => {
    e.preventDefault();
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore if pointer capture is unsupported
    }

    if (
      activePointerMidiRef.current !== null &&
      activePointerMidiRef.current !== midi
    ) {
      onNoteEnd(activePointerMidiRef.current);
    }

    isPointerDownRef.current = true;
    activePointerMidiRef.current = midi;
    onNoteStart(midi);
    // Keep keyboard focus off individual key buttons so Enter/Space never re-triggers
    e.currentTarget.blur();
  };

  const handlePointerEnter = (midi: number) => {
    if (!isPointerDownRef.current) return;
    if (
      activePointerMidiRef.current !== null &&
      activePointerMidiRef.current !== midi
    ) {
      onNoteEnd(activePointerMidiRef.current);
    }
    activePointerMidiRef.current = midi;
    onNoteStart(midi);
  };

  const handlePointerLeaveKey = (midi: number) => {
    if (!isPointerDownRef.current) return;
    if (activePointerMidiRef.current === midi) {
      onNoteEnd(midi);
      activePointerMidiRef.current = null;
    }
  };

  const handlePointerUpKey = (midi: number) => {
    if (activePointerMidiRef.current === midi) {
      onNoteEnd(midi);
      activePointerMidiRef.current = null;
    }
    isPointerDownRef.current = false;
  };

  const activePolyphony = new Set([...activeMidis, ...demoHighlightMidis]).size;

  return (
    <section
      className="piano-stage"
      aria-label="Virtual Piano Keyboard"
      style={{ '--instrument-accent': accentColor } as React.CSSProperties}
    >
      <div className="piano-wood-rail">
        {/* Studio Keybed Performance Strip */}
        <div className="keybed-top-strip">
          <div className="keybed-strip-left">
            <span className="keybed-label">MANUAL</span>
            <span className="keybed-range-pill">
              C{baseOctave} — C{baseOctave + 2} (25 KEYS)
            </span>
            <div className="keybed-octave-inline">
              <button
                type="button"
                className="keybed-mini-btn"
                disabled={baseOctave <= MIN_OCTAVE}
                onClick={(e) => {
                  onChangeOctave(-1);
                  e.currentTarget.blur();
                }}
                title="Octave Down (Shortcut: Z)"
              >
                <ChevronLeft size={12} />
                <span>Z</span>
              </button>
              <button
                type="button"
                className="keybed-mini-btn"
                disabled={baseOctave >= MAX_OCTAVE}
                onClick={(e) => {
                  onChangeOctave(1);
                  e.currentTarget.blur();
                }}
                title="Octave Up (Shortcut: X)"
              >
                <span>X</span>
                <ChevronRight size={12} />
              </button>
            </div>
          </div>

          <div className="keybed-strip-right">
            <span className="keybed-voices-indicator">
              VOICES: <strong>{activePolyphony}</strong>
            </span>
            <button
              type="button"
              className={`keybed-sustain-pill ${sustain ? 'is-on' : ''}`}
              onClick={(e) => {
                onToggleSustain();
                e.currentTarget.blur();
              }}
              title="Toggle Sustain Pedal (Spacebar)"
            >
              <span className="pedal-dot" />
              <span>SUSTAIN PEDAL [SPACE]: {sustain ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        <div className="piano-felt-strip" />

        <div className="piano-keys-scroll-wrapper">
          <div className="piano-keys-bed" data-testid="piano-keyboard">
            {/* White Keys */}
            <div className="white-keys-row">
              {whiteKeys.map((note) => {
                const isUserOrAudioActive = activeMidis.has(note.midi);
                const isDemoActive = demoHighlightMidis.has(note.midi);
                const isPracticeTarget = practiceTargetMidi === note.midi;
                const isHighlighted = isUserOrAudioActive || isDemoActive;

                return (
                  <button
                    key={note.midi}
                    type="button"
                    tabIndex={-1}
                    data-testid={`piano-key-${note.noteName}`}
                    data-midi={note.midi}
                    data-note={note.noteName}
                    data-key-binding={note.keyLabel}
                    data-active={isHighlighted ? 'true' : 'false'}
                    data-demo-target={
                      isDemoActive || isPracticeTarget ? 'true' : 'false'
                    }
                    aria-label={`Piano key ${note.noteName} (Keyboard shortcut ${note.keyLabel})`}
                    aria-pressed={isHighlighted}
                    className={[
                      'piano-key',
                      'white-key',
                      isHighlighted ? 'is-active' : '',
                      isDemoActive ? 'is-demo-playing' : '',
                      isPracticeTarget ? 'is-practice-target' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onPointerDown={(e) => handlePointerDown(e, note.midi)}
                    onPointerEnter={() => handlePointerEnter(note.midi)}
                    onPointerLeave={() => handlePointerLeaveKey(note.midi)}
                    onPointerUp={() => handlePointerUpKey(note.midi)}
                  >
                    <span className="key-led-bar" />
                    {isPracticeTarget && (
                      <span
                        key={practiceStepNumber}
                        className="practice-target-badge"
                      >
                        PLAY {practiceStepNumber ? `#${practiceStepNumber}` : ''}
                      </span>
                    )}
                    <span className="key-bottom-labels">
                      {showKeyLabels && (
                        <kbd className="key-cap-badge">{note.keyLabel}</kbd>
                      )}
                      {showNoteNames && (
                        <span
                          className={`key-note-label ${
                            note.noteBaseName === 'C' ? 'is-root-c' : ''
                          }`}
                        >
                          {note.noteName}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Black Keys */}
            <div className="black-keys-layer">
              {blackKeys.map((note) => {
                const precedingWhite =
                  BLACK_KEY_PRECEDING_WHITE_COUNT[note.semitoneOffset] ?? 1;
                const centerPercent = (precedingWhite / totalWhiteKeys) * 100;
                const isUserOrAudioActive = activeMidis.has(note.midi);
                const isDemoActive = demoHighlightMidis.has(note.midi);
                const isPracticeTarget = practiceTargetMidi === note.midi;
                const isHighlighted = isUserOrAudioActive || isDemoActive;

                return (
                  <button
                    key={note.midi}
                    type="button"
                    tabIndex={-1}
                    data-testid={`piano-key-${note.noteName}`}
                    data-midi={note.midi}
                    data-note={note.noteName}
                    data-key-binding={note.keyLabel}
                    data-active={isHighlighted ? 'true' : 'false'}
                    data-demo-target={
                      isDemoActive || isPracticeTarget ? 'true' : 'false'
                    }
                    aria-label={`Piano key ${note.noteName} (Keyboard shortcut ${note.keyLabel})`}
                    aria-pressed={isHighlighted}
                    style={{ left: `${centerPercent}%` }}
                    className={[
                      'piano-key',
                      'black-key',
                      isHighlighted ? 'is-active' : '',
                      isDemoActive ? 'is-demo-playing' : '',
                      isPracticeTarget ? 'is-practice-target' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onPointerDown={(e) => handlePointerDown(e, note.midi)}
                    onPointerEnter={() => handlePointerEnter(note.midi)}
                    onPointerLeave={() => handlePointerLeaveKey(note.midi)}
                    onPointerUp={() => handlePointerUpKey(note.midi)}
                  >
                    <span className="key-led-bar" />
                    {isPracticeTarget && (
                      <span
                        key={practiceStepNumber}
                        className="practice-target-badge"
                      >
                        PLAY {practiceStepNumber ? `#${practiceStepNumber}` : ''}
                      </span>
                    )}
                    <span className="key-bottom-labels">
                      {showKeyLabels && (
                        <kbd className="key-cap-badge black-cap">
                          {note.keyLabel}
                        </kbd>
                      )}
                      {showNoteNames && (
                        <span className="key-note-label">{note.noteName}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
