import React, { useEffect, useRef } from 'react';
import {
  Check,
  Download,
  Pause,
  Play,
  RotateCcw,
  Square,
} from 'lucide-react';
import { studio } from '../app/studio';
import { getInstrumentPreset } from '../data/instruments';
import { barAtBeat, type Song } from '../music/song';
import { SONGS } from '../music/songs';
import { midiToName } from '../music/notes';
import { Segmented, Switch, formatClock, useStudio } from './ui';

function songSeconds(song: Song, speed: number): number {
  return (song.lengthBeats * 60) / (song.bpm * speed);
}

const Timeline: React.FC<{ song: Song }> = ({ song }) => {
  const speed = useStudio((s) => s.prefs.speed);
  const fillRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const total = songSeconds(song, speed);

  useEffect(() => {
    let id = 0;
    let last = '';
    const loop = () => {
      const beat = studio.getSongPosition();
      const frac = Math.max(0, Math.min(1, beat / song.lengthBeats));
      const bar = Math.max(1, barAtBeat(song, beat));
      const text = `Bar ${Math.min(bar, song.barCount)} / ${song.barCount} · ${formatClock(
        frac * total
      )} / ${formatClock(total)}`;
      if (fillRef.current) fillRef.current.style.width = `${(frac * 100).toFixed(2)}%`;
      if (text !== last && textRef.current) {
        textRef.current.textContent = text;
        last = text;
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [song, total]);

  const seekFrom = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = trackRef.current!.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    studio.seekSong(frac * song.lengthBeats);
  };

  const sectionStarts = (song.sections ?? []).map((sec) => ({
    name: sec.name,
    frac: Math.min(
      1,
      Math.max(
        0,
        ((sec.bar - 1) * song.beatsPerBar + (song.pickupBeats ?? 0)) /
          song.lengthBeats
      )
    ),
  }));

  return (
    <div className="timeline">
      <div
        ref={trackRef}
        className="timeline-track"
        role="slider"
        tabIndex={0}
        aria-label="Song position"
        aria-valuemin={0}
        aria-valuemax={Math.round(song.lengthBeats)}
        aria-valuenow={0}
        data-testid="song-timeline"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFrom(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) seekFrom(e);
        }}
        onKeyDown={(e) => {
          const cur = studio.getSongPosition();
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            studio.seekSong(cur + song.beatsPerBar);
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            e.stopPropagation();
            studio.seekSong(Math.max(0, cur - song.beatsPerBar));
          }
        }}
      >
        <div ref={fillRef} className="timeline-fill" />
        {sectionStarts.map((s) => (
          <span
            key={s.name + s.frac}
            className="timeline-mark"
            style={{ left: `${s.frac * 100}%` }}
          />
        ))}
      </div>
      <div className="timeline-labels">
        <div className="timeline-sections" aria-hidden="true">
          {sectionStarts.map((s) => (
            <span key={s.name + s.frac} style={{ left: `${s.frac * 100}%` }}>
              {s.name}
            </span>
          ))}
        </div>
        <span ref={textRef} className="timeline-time" data-testid="song-position" />
      </div>
    </div>
  );
};

const LearnPrompt: React.FC<{ song: Song }> = ({ song }) => {
  const learn = useStudio((s) => s.learn);
  const targets = useStudio((s) => s.learnTargets);
  const octave = useStudio((s) => s.prefs.octave);
  void octave;
  const hints = studio.hintKeyLabels(targets);
  const list = Array.from(targets).sort((a, b) => a - b);

  if (learn.completed) {
    const total = learn.hits + learn.mistakes;
    const acc = total === 0 ? 100 : Math.round((learn.hits / total) * 100);
    return (
      <div className="learn-prompt is-done" data-testid="practice-prompt-banner">
        <Check size={18} />
        <strong>{song.title} complete.</strong>
        <span>
          {learn.total} steps · {acc}% of presses on target
        </span>
      </div>
    );
  }

  return (
    <div
      className="learn-prompt"
      role="status"
      aria-live="polite"
      data-testid="practice-prompt-banner"
      data-result={learn.lastResult ?? undefined}
      key={learn.tick}
    >
      <span className="learn-label">Play</span>
      <span className="learn-targets" data-testid="practice-target-note">
        {list.map((m, i) => (
          <span key={m} className="learn-target">
            <kbd>{hints[i] ?? '·'}</kbd>
            <span>{midiToName(m)}</span>
          </span>
        ))}
      </span>
      <span className="learn-progress" data-testid="demo-step-counter">
        Step {Math.min(learn.index + 1, learn.total)} / {learn.total}
        {learn.mistakes > 0 && ` · ${learn.mistakes} slip${learn.mistakes === 1 ? '' : 's'}`}
      </span>
    </div>
  );
};

export const SongsPanel: React.FC = () => {
  const songId = useStudio((s) => s.prefs.songId);
  const mode = useStudio((s) => s.prefs.songMode);
  const speed = useStudio((s) => s.prefs.speed);
  const loop = useStudio((s) => s.prefs.loop);
  const melodyOnly = useStudio((s) => s.prefs.melodyOnly);
  const accompany = useStudio((s) => s.prefs.learnAccompaniment);
  const autoSound = useStudio((s) => s.prefs.autoSound);
  const instrument = useStudio((s) => s.prefs.instrument);
  const state = useStudio((s) => s.songState);
  const disabled = useStudio((s) => s.disabledParts);

  const song = SONGS.find((s) => s.id === songId) ?? SONGS[0];
  const playing = state === 'playing';
  const beatName = song.beatUnit === 'eighth' ? '♪' : '♩';

  return (
    <div className="deck deck-songs" data-testid="demo-songs-panel">
      <section className="module module-library" aria-labelledby="mod-library">
        <header className="module-head">
          <h2 id="mod-library">Library</h2>
          <span className="module-hint">{SONGS.length} public-domain pieces</span>
        </header>
        <div className="song-list" role="listbox" aria-label="Songs">
          {SONGS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="option"
              aria-selected={s.id === song.id}
              data-testid={`song-item-${s.id}`}
              className={`song ${s.id === song.id ? 'is-on' : ''}`}
              onClick={() => studio.selectSong(s.id)}
            >
              <span className="song-title">{s.title}</span>
              <span className="song-sub">
                {s.composer.split('(')[0].trim()}
              </span>
              <span className={`level level-${s.difficulty.toLowerCase()}`}>
                {s.difficulty}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="module module-now" aria-labelledby="mod-now">
        <header className="module-head module-head-title">
          <h2 id="mod-now" data-testid="selected-song-title">
            {song.title}
          </h2>
          <span className="song-meta">
            {song.key} · {beatName} = {Math.round(song.bpm * speed)} ·{' '}
            {song.beatsPerBar}/{song.beatUnit === 'eighth' ? 8 : 4}
          </span>
        </header>

        {mode === 'learn' ? (
          <LearnPrompt song={song} />
        ) : (
          <p className="song-desc">{song.description}</p>
        )}

        <div className="transport">
          <Segmented
            label="Song mode"
            value={mode}
            options={[
              { value: 'listen', label: 'Listen', testId: 'mode-autoplay-btn' },
              { value: 'learn', label: 'Learn', testId: 'mode-practice-btn' },
            ]}
            onChange={(m) => studio.setSongMode(m)}
          />

          {mode === 'listen' ? (
            <>
              <button
                type="button"
                className={`btn btn-primary ${playing ? 'is-playing' : ''}`}
                data-testid="demo-play-toggle"
                onClick={() => studio.toggleSong()}
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
                <span>{playing ? 'Pause' : 'Play'}</span>
              </button>
              <button
                type="button"
                className="btn"
                data-testid="demo-stop-btn"
                onClick={() => studio.stopSong()}
                aria-label="Stop and rewind"
                title="Stop and rewind"
              >
                <Square size={14} />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn"
              data-testid="learn-restart-btn"
              onClick={() => studio.restartLearn()}
            >
              <RotateCcw size={14} />
              <span>Restart</span>
            </button>
          )}

          <label className="tempo" data-testid="tempo-control">
            <span className="tempo-label">Tempo</span>
            <input
              type="range"
              min={0.4}
              max={1.6}
              step={0.05}
              value={speed}
              aria-label="Tempo"
              data-testid="demo-speed-slider"
              onChange={(e) => studio.setSpeed(parseFloat(e.target.value))}
            />
            <span className="tempo-value" data-testid="demo-speed-value">
              {speed.toFixed(2).replace(/0$/, '')}×
            </span>
          </label>
        </div>

        <Timeline song={song} />
      </section>

      <section className="module module-parts" aria-labelledby="mod-parts">
        <header className="module-head">
          <h2 id="mod-parts">Parts</h2>
          <button
            type="button"
            className="text-btn"
            onClick={() => studio.exportCurrentSongMidi()}
            data-testid="export-song-midi-btn"
            title="Download this arrangement as a MIDI file"
          >
            <Download size={12} />
            MIDI
          </button>
        </header>
        <div className="part-list">
          {song.parts.map((p) => {
            const on = !disabled.has(p.id) && (!melodyOnly || p.role === 'melody');
            return (
              <button
                key={p.id}
                type="button"
                role="switch"
                aria-checked={on}
                data-testid={`part-${p.id}`}
                className={`part ${on ? 'is-on' : ''} part-${p.role}`}
                onClick={() => studio.togglePart(p.id)}
              >
                <span className="part-dot" aria-hidden="true" />
                <span className="part-name">{p.name}</span>
                <span className="part-hand">{p.hand === 'right' ? 'RH' : 'LH'}</span>
              </button>
            );
          })}
        </div>
        {mode === 'listen' ? (
          <Switch
            label="Melody only"
            checked={melodyOnly}
            onChange={(v) => studio.setMelodyOnly(v)}
            testId="melody-only-switch"
          />
        ) : (
          <Switch
            label="Play accompaniment as I go"
            checked={accompany}
            onChange={(v) => studio.setLearnAccompaniment(v)}
            testId="accompany-switch"
          />
        )}
        <Switch
          label="Loop"
          checked={loop}
          onChange={(v) => studio.setLoop(v)}
          testId="loop-switch"
          disabled={mode === 'learn'}
        />
        <Switch
          label="Match each song's sound"
          checked={autoSound}
          onChange={(v) => studio.setAutoSound(v)}
          testId="auto-sound-switch"
          hint={`Picks the recommended sound and octave for each song. Now using ${getInstrumentPreset(instrument).name}.`}
        />
      </section>
    </div>
  );
};
