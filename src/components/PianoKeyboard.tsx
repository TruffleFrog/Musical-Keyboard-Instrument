import React, { useRef } from 'react';
import { VirtualKeyNote } from '../types/music';

interface PianoKeyboardProps {
  notes: VirtualKeyNote[];
  activeMidis: Set<number>;
  demoHighlightMidis: Set<number>;
  practiceTargetMidi: number | null;
  showKeyLabels: boolean;
  showNoteNames: boolean;
  accentColor: string;
  onNoteStart: (midi: number) => void;
  onNoteEnd: (midi: number) => void;
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
  activeMidis,
  demoHighlightMidis,
  practiceTargetMidi,
  showKeyLabels,
  showNoteNames,
  accentColor,
  onNoteStart,
  onNoteEnd,
}) => {
  const isPointerDownRef = useRef(false);
  const activePointerMidiRef = useRef<number | null>(null);

  const whiteKeys = notes.filter((n) => !n.isSharp);
  const blackKeys = notes.filter((n) => n.isSharp);
  const totalWhiteKeys = whiteKeys.length; // 15

  const handlePointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    midi: number
  ) => {
    e.preventDefault();
    isPointerDownRef.current = true;
    activePointerMidiRef.current = midi;
    onNoteStart(midi);
  };

  const handlePointerEnter = (midi: number) => {
    if (!isPointerDownRef.current) return;
    if (activePointerMidiRef.current !== null && activePointerMidiRef.current !== midi) {
      onNoteEnd(activePointerMidiRef.current);
    }
    activePointerMidiRef.current = midi;
    onNoteStart(midi);
  };

  const handlePointerUpOrLeave = (midi: number) => {
    if (activePointerMidiRef.current === midi) {
      onNoteEnd(midi);
      activePointerMidiRef.current = null;
    }
  };

  const handleGlobalPointerUp = () => {
    if (activePointerMidiRef.current !== null) {
      onNoteEnd(activePointerMidiRef.current);
      activePointerMidiRef.current = null;
    }
    isPointerDownRef.current = false;
  };

  return (
    <section
      className="piano-stage"
      aria-label="Virtual Piano Keyboard"
      onPointerUp={handleGlobalPointerUp}
      onPointerCancel={handleGlobalPointerUp}
      onPointerLeave={handleGlobalPointerUp}
      style={{ '--instrument-accent': accentColor } as React.CSSProperties}
    >
      <div className="piano-wood-rail">
        <div className="piano-felt-strip" />
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
                  onPointerUp={() => handlePointerUpOrLeave(note.midi)}
                >
                  {isPracticeTarget && (
                    <span className="practice-target-badge">PLAY</span>
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
                  onPointerUp={() => handlePointerUpOrLeave(note.midi)}
                >
                  {isPracticeTarget && (
                    <span className="practice-target-badge">PLAY</span>
                  )}
                  <span className="key-bottom-labels">
                    {showKeyLabels && (
                      <kbd className="key-cap-badge black-cap">{note.keyLabel}</kbd>
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
    </section>
  );
};
