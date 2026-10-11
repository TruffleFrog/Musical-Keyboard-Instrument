import React, { useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  GraduationCap,
  Music2,
  Gauge,
  Wand2,
  CheckCircle2,
} from 'lucide-react';
import { DEMO_SONGS } from '../data/demoSongs';
import { getKeyLabelForMidi } from '../data/keyboardMap';
import { INSTRUMENT_MAP } from '../data/instruments';
import { DemoPlayMode, DemoSong, InstrumentId } from '../types/music';

interface DemoSongsPanelProps {
  selectedSong: DemoSong;
  playMode: DemoPlayMode;
  isPlaying: boolean;
  playbackSpeed: number;
  currentStepIndex: number;
  practiceCompleted: boolean;
  baseOctave: number;
  onSelectSong: (song: DemoSong) => void;
  onChangePlayMode: (mode: DemoPlayMode) => void;
  onTogglePlay: () => void;
  onStopAndReset: () => void;
  onChangeSpeed: (speed: number) => void;
  onSelectStep: (index: number) => void;
  onApplyRecommendedSetup: (instrument: InstrumentId, octave: number) => void;
}

const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const DemoSongsPanel: React.FC<DemoSongsPanelProps> = ({
  selectedSong,
  playMode,
  isPlaying,
  playbackSpeed,
  currentStepIndex,
  practiceCompleted,
  baseOctave,
  onSelectSong,
  onChangePlayMode,
  onTogglePlay,
  onStopAndReset,
  onChangeSpeed,
  onSelectStep,
  onApplyRecommendedSetup,
}) => {
  const activeStepRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (
      activeStepRef.current &&
      typeof activeStepRef.current.scrollIntoView === 'function'
    ) {
      activeStepRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [currentStepIndex, selectedSong.id]);

  const currentNote = selectedSong.notes[currentStepIndex] ?? selectedSong.notes[0];
  const currentKeyBinding = currentNote
    ? getKeyLabelForMidi(currentNote.midi, baseOctave)
    : null;
  const recommendedInstrumentName =
    INSTRUMENT_MAP[selectedSong.recommendedInstrument]?.name ?? 'Grand Piano';

  return (
    <div className="demo-songs-layout" data-testid="demo-songs-panel">
      {/* Left Column: Song Library List */}
      <div className="studio-card demo-song-list-card">
        <div className="section-header-row">
          <div className="section-title-group">
            <Music2 size={16} />
            <h2>Public-Domain Melodies</h2>
          </div>
          <span className="section-hint">{DEMO_SONGS.length} Songs</span>
        </div>

        <div className="song-selector-list" role="listbox" aria-label="Demo Songs">
          {DEMO_SONGS.map((song) => {
            const isSelected = song.id === selectedSong.id;
            return (
              <button
                key={song.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-testid={`song-item-${song.id}`}
                className={`song-list-item ${isSelected ? 'is-selected' : ''}`}
                onClick={() => onSelectSong(song)}
              >
                <div className="song-item-main">
                  <span className="song-item-title">{song.title}</span>
                  <span className="song-item-composer">{song.composer}</span>
                </div>
                <div className="song-item-meta">
                  <span
                    className={`difficulty-badge diff-${song.difficulty.toLowerCase()}`}
                  >
                    {song.difficulty}
                  </span>
                  <span className="song-bpm-tag">{song.bpm} BPM</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Transport, Practice Controls & Interactive Note Sequence Roll */}
      <div className="studio-card demo-player-card">
        <div className="demo-player-top-row">
          <div className="demo-song-info">
            <div className="demo-song-title-bar">
              <h3 data-testid="selected-song-title">{selectedSong.title}</h3>
              <span className="demo-composer-tag">{selectedSong.composer}</span>
              <button
                type="button"
                data-testid="apply-recommended-sound-btn"
                className="ghost-action-btn"
                onClick={() =>
                  onApplyRecommendedSetup(
                    selectedSong.recommendedInstrument,
                    selectedSong.recommendedOctave
                  )
                }
                title={`Switch to ${recommendedInstrumentName} (Octave ${selectedSong.recommendedOctave})`}
              >
                <Wand2 size={13} />
                <span>Use {recommendedInstrumentName}</span>
              </button>
            </div>
            <p className="demo-song-desc">{selectedSong.description}</p>
          </div>

          {/* Mode Toggle: Auto-Play vs Follow Notes Practice */}
          <div
            className="demo-mode-segmented"
            role="group"
            aria-label="Demo Playback Mode"
          >
            <button
              type="button"
              data-testid="mode-autoplay-btn"
              aria-pressed={playMode === 'autoplay'}
              className={`segment-btn ${
                playMode === 'autoplay' ? 'is-active' : ''
              }`}
              onClick={() => onChangePlayMode('autoplay')}
            >
              <Play size={14} />
              <span>Auto-Play</span>
            </button>
            <button
              type="button"
              data-testid="mode-practice-btn"
              aria-pressed={playMode === 'practice'}
              className={`segment-btn ${
                playMode === 'practice' ? 'is-active' : ''
              }`}
              onClick={() => onChangePlayMode('practice')}
            >
              <GraduationCap size={15} />
              <span>Follow Notes (Practice)</span>
            </button>
          </div>
        </div>

        {/* Transport & Speed Bar */}
        <div className="demo-transport-bar">
          <div className="transport-buttons">
            {playMode === 'autoplay' ? (
              <button
                type="button"
                data-testid="demo-play-toggle"
                className={`primary-transport-btn ${
                  isPlaying ? 'is-playing' : ''
                }`}
                onClick={onTogglePlay}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                <span>{isPlaying ? 'Pause Song' : 'Play Song'}</span>
              </button>
            ) : (
              <div
                className="practice-prompt-banner"
                data-testid="practice-prompt-banner"
              >
                {practiceCompleted ? (
                  <span className="practice-complete-msg">
                    <CheckCircle2 size={16} /> Song Complete! Great job!
                  </span>
                ) : (
                  <>
                    <span className="prompt-label">NEXT NOTE:</span>
                    <strong
                      className="prompt-note"
                      data-testid="practice-target-note"
                    >
                      {currentNote?.note}
                    </strong>
                    {currentKeyBinding && (
                      <span className="prompt-key-hint">
                        Press <kbd>{currentKeyBinding}</kbd>
                      </span>
                    )}
                  </>
                )}
              </div>
            )}

            <button
              type="button"
              data-testid="demo-stop-btn"
              className="secondary-transport-btn"
              onClick={onStopAndReset}
              title="Reset to beginning of song"
            >
              <RotateCcw size={14} />
              <span>Restart</span>
            </button>
          </div>

          {/* Playback Speed Controls */}
          <div className="speed-control-group">
            <div className="speed-label">
              <Gauge size={14} />
              <span>Tempo:</span>
              <strong data-testid="demo-speed-value">
                {playbackSpeed.toFixed(2).replace(/\.00$/, '.0')}x
              </strong>
              <span className="effective-bpm">
                ({Math.round(selectedSong.bpm * playbackSpeed)} BPM)
              </span>
            </div>
            <div className="speed-presets-row">
              {SPEED_PRESETS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  data-testid={`speed-btn-${spd}x`}
                  className={`speed-pill-btn ${
                    Math.abs(playbackSpeed - spd) < 0.01 ? 'is-active' : ''
                  }`}
                  onClick={() => onChangeSpeed(spd)}
                >
                  {spd}x
                </button>
              ))}
              <input
                type="range"
                aria-label="Playback Speed"
                data-testid="demo-speed-slider"
                min={0.5}
                max={2.0}
                step={0.05}
                value={playbackSpeed}
                onChange={(e) => onChangeSpeed(parseFloat(e.target.value))}
                className="speed-slider"
              />
            </div>
          </div>

          <div className="demo-progress-counter" data-testid="demo-step-counter">
            Step <strong>{currentStepIndex + 1}</strong> / {selectedSong.notes.length}
          </div>
        </div>

        {/* Interactive Note Sequence & Keyboard Tab Roll */}
        <div className="note-roll-container">
          <div className="note-roll-header">
            <span>NOTE SEQUENCE &amp; KEYBOARD TABS (CLICK ANY STEP TO JUMP)</span>
            <span>
              {playMode === 'practice'
                ? 'Play the highlighted key on your keyboard or virtual piano to advance'
                : 'Virtual piano keys highlight automatically in sync with playback'}
            </span>
          </div>

          <div
            className="note-sequence-strip"
            data-testid="note-sequence-roll"
            role="list"
          >
            {selectedSong.notes.map((songNote, index) => {
              const isCurrent = index === currentStepIndex;
              const isPast = index < currentStepIndex;
              const keyLabel = getKeyLabelForMidi(songNote.midi, baseOctave);

              return (
                <button
                  key={`${songNote.note}-${index}`}
                  ref={isCurrent ? activeStepRef : null}
                  type="button"
                  role="listitem"
                  data-testid={`song-step-${index}`}
                  data-current={isCurrent ? 'true' : 'false'}
                  className={[
                    'note-step-chip',
                    isCurrent ? 'is-current-step' : '',
                    isPast ? 'is-past-step' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onSelectStep(index)}
                >
                  {songNote.lyricOrHint && (
                    <span className="step-phrase-tag">{songNote.lyricOrHint}</span>
                  )}
                  <span className="step-index-num">{index + 1}</span>
                  <span className="step-note-name">{songNote.note}</span>
                  <kbd className="step-qwerty-key">{keyLabel ?? '—'}</kbd>
                  <span className="step-beats">{songNote.durationBeats}b</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
