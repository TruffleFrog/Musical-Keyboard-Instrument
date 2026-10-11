import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { studio } from '../app/studio';

const ROWS: Array<[string, string]> = [
  ['A S D F G H J K L ; \' \\ , . /', 'White keys (C up two octaves)'],
  ['W E T Y U O P [ ] =', 'Black keys (sharps and flats)'],
  ['Z / X   ·   ↓ / ↑', 'Octave down / up'],
  ['Space (hold)', 'Sustain pedal — or click Sustain to latch it'],
  ['1 – 6', 'Choose sound'],
  ['Esc', 'Silence everything (panic)'],
  ['?', 'Show or hide this help'],
];

export const HelpDialog: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        studio.setHelpOpen(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, []);

  return (
    <div
      className="scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) studio.setHelpOpen(false);
      }}
    >
      <div
        ref={ref}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        tabIndex={-1}
        data-testid="help-dialog"
      >
        <header className="dialog-head">
          <h2 id="help-title">Playing Keyboard Studio</h2>
          <button
            type="button"
            className="icon-btn"
            aria-label="Close help"
            onClick={() => studio.setHelpOpen(false)}
          >
            <X size={18} />
          </button>
        </header>

        <p className="dialog-lead">
          Your computer keyboard is a two-octave piano. The marked band above the
          keys shows which keys it plays; Z and X slide that band along the full
          five-octave keyboard. Songs show the notes falling onto the keys.
        </p>

        <table className="shortcuts">
          <tbody>
            {ROWS.map(([keys, what]) => (
              <tr key={keys}>
                <th scope="row">
                  <kbd>{keys}</kbd>
                </th>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Songs</h3>
        <p>
          <strong>Listen</strong> plays a full arrangement — melody, chords and
          bass — with every key lighting up. <strong>Learn</strong> waits for you:
          play the highlighted melody notes at your own pace and the
          accompaniment follows. Any octave of the right note counts.
        </p>

        <h3>Credits</h3>
        <p className="dialog-credits">
          Grand piano: Salamander Grand Piano by Alexander Holm, licensed{' '}
          <a
            href="https://creativecommons.org/licenses/by/3.0/"
            target="_blank"
            rel="noreferrer"
          >
            CC BY 3.0
          </a>
          . All other sounds are synthesised in your browser. Songs are
          public-domain compositions with original arrangements. Everything runs
          locally; nothing is uploaded.
        </p>
      </div>
    </div>
  );
};
