import React from 'react';
import {
  Keyboard,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  Disc,
  Sparkles,
  Music,
  Sliders,
} from 'lucide-react';
import { INSTRUMENT_PRESETS } from '../data/instruments';
import { getNoteName, MAX_OCTAVE, MIN_OCTAVE } from '../data/keyboardMap';
import { InstrumentId, StudioTab } from '../types/music';

interface HeaderBarProps {
  instrument: InstrumentId;
  baseOctave: number;
  sustain: boolean;
  showKeyLabels: boolean;
  showNoteNames: boolean;
  activeTab: StudioTab;
  activeMidis: Set<number>;
  demoHighlightMidis: Set<number>;
  isRecording: boolean;
  isDemoPlaying: boolean;
  volume: number;
  onSelectInstrument: (id: InstrumentId) => void;
  onChangeOctave: (delta: number) => void;
  onToggleSustain: () => void;
  onToggleKeyLabels: () => void;
  onToggleNoteNames: () => void;
  onSelectTab: (tab: StudioTab) => void;
  onChangeVolume: (val: number) => void;
  onPanic: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  instrument,
  baseOctave,
  sustain,
  showKeyLabels,
  showNoteNames,
  activeTab,
  activeMidis,
  demoHighlightMidis,
  isRecording,
  isDemoPlaying,
  volume,
  onSelectInstrument,
  onChangeOctave,
  onToggleSustain,
  onToggleKeyLabels,
  onToggleNoteNames,
  onSelectTab,
  onChangeVolume,
  onPanic,
}) => {
  const combinedMidis = Array.from(
    new Set([...activeMidis, ...demoHighlightMidis])
  ).sort((a, b) => a - b);

  const activeNoteNames = combinedMidis.map(getNoteName);
  const currentPreset =
    INSTRUMENT_PRESETS.find((p) => p.id === instrument) ?? INSTRUMENT_PRESETS[0];

  return (
    <header className="studio-header">
      {/* Left: Brand & Navigation Tabs */}
      <div className="header-brand-group">
        <div className="brand-badge">
          <span
            className="brand-led"
            style={{ backgroundColor: currentPreset.accentColor }}
          />
          <div>
            <h1 className="brand-title">KEYBOARD STUDIO</h1>
            <span className="brand-subtitle">WEB AUDIO POLYPHONIC WORKSTATION</span>
          </div>
        </div>

        <nav className="studio-tabs" role="tablist" aria-label="Studio Workspace Tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'studio'}
            data-testid="tab-studio"
            className={`studio-tab-btn ${activeTab === 'studio' ? 'is-active' : ''}`}
            onClick={() => onSelectTab('studio')}
          >
            <Sliders size={15} />
            <span>Sound Studio</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'songs'}
            data-testid="tab-songs"
            className={`studio-tab-btn ${activeTab === 'songs' ? 'is-active' : ''}`}
            onClick={() => onSelectTab('songs')}
          >
            <Music size={15} />
            <span>Demo Songs</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'recorder'}
            data-testid="tab-recorder"
            className={`studio-tab-btn ${activeTab === 'recorder' ? 'is-active' : ''}`}
            onClick={() => onSelectTab('recorder')}
          >
            <Disc
              size={15}
              className={isRecording ? 'spin-recording-icon' : ''}
            />
            <span>Recorder</span>
            {isRecording && <span className="tab-rec-dot" />}
          </button>
        </nav>
      </div>

      {/* Center: Hardware LED Readout */}
      <div className="led-display-panel" data-testid="led-status-display">
        <div className="led-row-top">
          <span className="led-patch-name" style={{ color: currentPreset.accentColor }}>
            {currentPreset.name.toUpperCase()}
          </span>
          <span className="led-range-tag">
            RANGE C{baseOctave}–C{baseOctave + 2}
          </span>
          {isRecording && <span className="led-status-pill rec">● REC</span>}
          {isDemoPlaying && <span className="led-status-pill demo">▶ DEMO</span>}
        </div>
        <div className="led-notes-readout" data-testid="active-notes-readout">
          {activeNoteNames.length > 0 ? (
            activeNoteNames.map((n) => (
              <span key={n} className="led-note-chip">
                {n}
              </span>
            ))
          ) : (
            <span className="led-idle-text">
              READY — PRESS [A–/] OR CLICK KEYS TO PLAY
            </span>
          )}
        </div>
      </div>

      {/* Right: Quick Hardware Performance Controls */}
      <div className="header-controls-group">
        {/* Quick Instrument Select */}
        <label className="control-pill-select" title="Switch Active Instrument">
          <Sparkles size={14} style={{ color: currentPreset.accentColor }} />
          <select
            aria-label="Select Instrument"
            data-testid="header-instrument-select"
            value={instrument}
            onChange={(e) => onSelectInstrument(e.target.value as InstrumentId)}
          >
            {INSTRUMENT_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>

        {/* Master Volume */}
        <div className="control-pill-volume" title="Master Volume">
          {volume > 0.01 ? <Volume2 size={15} /> : <VolumeX size={15} />}
          <input
            type="range"
            aria-label="Master Volume"
            data-testid="header-volume-slider"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
          />
          <span className="mono-value">{Math.round(volume * 100)}%</span>
        </div>

        {/* Octave Switcher */}
        <div className="octave-control-group" role="group" aria-label="Octave Shift">
          <button
            type="button"
            data-testid="octave-down-btn"
            className="hw-icon-btn"
            disabled={baseOctave <= MIN_OCTAVE}
            onClick={() => onChangeOctave(-1)}
            title="Octave Down (Shortcut: Z)"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="octave-readout" data-testid="octave-display">
            OCT {baseOctave}
          </span>
          <button
            type="button"
            data-testid="octave-up-btn"
            className="hw-icon-btn"
            disabled={baseOctave >= MAX_OCTAVE}
            onClick={() => onChangeOctave(1)}
            title="Octave Up (Shortcut: X)"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Sustain Pedal */}
        <button
          type="button"
          data-testid="sustain-toggle-btn"
          aria-pressed={sustain}
          className={`hw-toggle-btn ${sustain ? 'is-on' : ''}`}
          onClick={onToggleSustain}
          title="Toggle Sustain Pedal (Shortcut: Space)"
        >
          <span className="status-dot" />
          <span>SUSTAIN</span>
        </button>

        {/* Key Labels Toggle */}
        <button
          type="button"
          data-testid="toggle-key-labels-btn"
          aria-pressed={showKeyLabels}
          className={`hw-toggle-btn ${showKeyLabels ? 'is-on' : ''}`}
          onClick={onToggleKeyLabels}
          title="Show/Hide Physical Keyboard Bindings"
        >
          <Keyboard size={14} />
          <span>KEYS</span>
        </button>

        {/* Note Names Toggle */}
        <button
          type="button"
          data-testid="toggle-note-names-btn"
          aria-pressed={showNoteNames}
          className={`hw-toggle-btn ${showNoteNames ? 'is-on' : ''}`}
          onClick={onToggleNoteNames}
          title="Show/Hide Musical Note Labels"
        >
          <span>NOTES</span>
        </button>

        {/* Panic / Silence All */}
        <button
          type="button"
          data-testid="panic-btn"
          className="hw-panic-btn"
          onClick={onPanic}
          title="Silence All Active Notes (Esc)"
        >
          PANIC
        </button>
      </div>
    </header>
  );
};
