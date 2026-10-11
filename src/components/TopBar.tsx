import React, { useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Disc3,
  Library,
  OctagonX,
  Piano,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { studio } from '../app/studio';
import { INSTRUMENT_PRESETS, getInstrumentPreset } from '../data/instruments';
import { detectChord } from '../music/chords';
import { midiToName } from '../music/notes';
import type { StudioTab } from '../types/music';
import { useStudio } from './ui';

const TABS: Array<{ id: StudioTab; label: string; icon: React.ReactNode }> = [
  { id: 'play', label: 'Play', icon: <Piano size={16} /> },
  { id: 'songs', label: 'Songs', icon: <Library size={16} /> },
  { id: 'record', label: 'Record', icon: <Disc3 size={16} /> },
];

const Logo: React.FC = () => (
  <svg className="logo" viewBox="0 0 28 28" aria-hidden="true">
    <rect x="2" y="3" width="24" height="22" rx="3" className="logo-body" />
    <rect x="6" y="7" width="4" height="14" rx="1" className="logo-key" />
    <rect x="12" y="7" width="4" height="14" rx="1" className="logo-key" />
    <rect x="18" y="7" width="4" height="14" rx="1" className="logo-key" />
    <rect x="9" y="7" width="3.4" height="8.5" rx="0.8" className="logo-black" />
    <rect x="15" y="7" width="3.4" height="8.5" rx="0.8" className="logo-black" />
  </svg>
);

const Lcd: React.FC = () => {
  const instrument = useStudio((s) => s.prefs.instrument);
  const user = useStudio((s) => s.userNotes);
  const song = useStudio((s) => s.songNotes);
  const sampleState = useStudio((s) => s.sampleState);
  const preset = getInstrumentPreset(instrument);

  const notes = useMemo(
    () => Array.from(new Set([...user, ...song])).sort((a, b) => a - b),
    [user, song]
  );
  const chord = detectChord(notes);
  const names = notes.map(midiToName);
  const shown = names.slice(0, 6);
  const extra = names.length - shown.length;

  const idx = INSTRUMENT_PRESETS.findIndex((p) => p.id === instrument);
  const step = (d: number) => {
    const n = INSTRUMENT_PRESETS.length;
    studio.setInstrument(INSTRUMENT_PRESETS[(idx + d + n) % n].id);
  };
  const loading = instrument === 'piano' && sampleState === 'loading';

  return (
    <div className="lcd" data-testid="led-status-display">
      <div className="lcd-row">
        <button
          type="button"
          className="lcd-step"
          aria-label="Previous sound"
          onClick={() => step(-1)}
        >
          <ChevronLeft size={14} />
        </button>
        <span className="lcd-patch" data-testid="lcd-patch">
          {preset.name}
        </span>
        <button
          type="button"
          className="lcd-step"
          aria-label="Next sound"
          onClick={() => step(1)}
        >
          <ChevronRight size={14} />
        </button>
        <span className="lcd-chord" data-testid="lcd-chord">
          {chord ?? ''}
        </span>
      </div>
      <div className="lcd-notes" data-testid="active-notes-readout">
        {shown.length > 0 ? (
          <>
            {shown.map((n) => (
              <span key={n} className="lcd-note">
                {n}
              </span>
            ))}
            {extra > 0 && <span className="lcd-more">+{extra}</span>}
          </>
        ) : (
          <span className="lcd-idle">
            {loading ? 'Loading piano samples…' : 'Ready — press A S D F … or click the keys'}
          </span>
        )}
      </div>
    </div>
  );
};

export const TopBar: React.FC = () => {
  const tab = useStudio((s) => s.prefs.tab);
  const volume = useStudio((s) => s.prefs.masterVolume);
  const recording = useStudio((s) => s.recording);

  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <div className="brand-text">
          <h1>Keyboard Studio</h1>
        </div>
      </div>

      <nav className="tabs" role="tablist" aria-label="Workspace">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="panel-deck"
            data-testid={`tab-${t.id}`}
            className={tab === t.id ? 'is-active' : ''}
            onClick={() => studio.setTab(t.id)}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.id === 'record' && (
              <span
                className={`rec-dot ${recording ? 'is-on' : ''}`}
                role={recording ? 'img' : undefined}
                aria-label={recording ? 'recording' : undefined}
                aria-hidden={recording ? undefined : true}
              />
            )}
          </button>
        ))}
      </nav>

      <Lcd />

      <div className="top-actions">
        <label className="volume" title="Master volume">
          {volume > 0.01 ? <Volume2 size={16} /> : <VolumeX size={16} />}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            aria-label="Master volume"
            data-testid="header-volume-slider"
            onChange={(e) => studio.setMasterVolume(parseFloat(e.target.value))}
          />
          <span className="volume-value">{Math.round(volume * 100)}</span>
        </label>
        <button
          type="button"
          className="icon-btn"
          aria-label="Keyboard shortcuts and help"
          title="Help and shortcuts (?)"
          data-testid="help-btn"
          onClick={() => studio.setHelpOpen(true)}
        >
          <CircleHelp size={18} />
        </button>
        <button
          type="button"
          className="panic-btn"
          title="Silence everything (Esc)"
          data-testid="panic-btn"
          onClick={() => studio.panic()}
        >
          <OctagonX size={15} />
          <span>Panic</span>
        </button>
      </div>
    </header>
  );
};
