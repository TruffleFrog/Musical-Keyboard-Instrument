import React, { useEffect, useRef, useState } from 'react';
import { Circle, Download, Pencil, Play, Square, Trash2 } from 'lucide-react';
import { studio } from '../app/studio';
import { INSTRUMENT_MAP } from '../data/instruments';
import type { Recording } from '../types/music';
import { formatClock, useStudio } from './ui';

function clockMs(ms: number): string {
  const total = Math.max(0, ms) / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

const TakeProgress: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id = 0;
    const loop = () => {
      const len = studio.getTakeLength();
      const frac = len > 0 ? studio.getTakePosition() / len : 0;
      if (ref.current) ref.current.style.width = `${Math.min(100, frac * 100)}%`;
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="take-progress" aria-hidden="true">
      <div ref={ref} />
    </div>
  );
};

const TakeRow: React.FC<{ take: Recording; playing: boolean }> = ({
  take,
  playing,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(take.name);
  const inst = INSTRUMENT_MAP[take.instrument]?.name ?? take.instrument;

  const commit = () => {
    studio.renameTake(take.id, draft);
    setEditing(false);
  };

  return (
    <li className={`take ${playing ? 'is-playing' : ''}`} data-testid="recording-item">
      <button
        type="button"
        className="btn btn-icon"
        aria-label={playing ? `Stop ${take.name}` : `Play ${take.name}`}
        data-testid={playing ? 'take-stop-btn' : 'take-play-btn'}
        onClick={() => (playing ? studio.stopTake() : studio.playTake(take.id))}
      >
        {playing ? <Square size={14} /> : <Play size={14} />}
      </button>

      <div className="take-main">
        {editing ? (
          <input
            className="take-name-input"
            autoFocus
            value={draft}
            maxLength={60}
            aria-label="Take name"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setDraft(take.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <span className="take-name" data-testid="recording-item-name">
            {take.name}
          </span>
        )}
        <span className="take-meta">
          {formatClock(take.durationMs / 1000)} · {take.events.length} notes · {inst}
        </span>
        {playing && <TakeProgress />}
      </div>

      <div className="take-actions">
        <button
          type="button"
          className="btn btn-icon"
          aria-label={`Rename ${take.name}`}
          title="Rename"
          onClick={() => {
            setDraft(take.name);
            setEditing(true);
          }}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          className="btn btn-icon"
          aria-label={`Download ${take.name} as MIDI`}
          title="Download MIDI"
          data-testid="export-midi-btn"
          onClick={() => studio.exportTakeMidi(take.id)}
        >
          <Download size={14} />
        </button>
        <button
          type="button"
          className="btn btn-icon btn-danger"
          aria-label={`Delete ${take.name}`}
          title="Delete"
          data-testid="delete-take-btn"
          onClick={() => studio.deleteTake(take.id)}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  );
};

export const RecordPanel: React.FC = () => {
  const recording = useStudio((s) => s.recording);
  const elapsed = useStudio((s) => s.recordingMs);
  const count = useStudio((s) => s.recordedCount);
  const takes = useStudio((s) => s.takes);
  const playingId = useStudio((s) => s.playingTakeId);
  const notice = useStudio((s) => s.notice);

  return (
    <div className="deck deck-record" data-testid="recorder-panel">
      <section className="module module-recorder" aria-labelledby="mod-rec">
        <header className="module-head">
          <h2 id="mod-rec">Recorder</h2>
          <span
            className={`status-chip ${recording ? 'is-rec' : ''}`}
            data-testid="recording-status-badge"
          >
            {recording ? 'Recording' : 'Ready'}
          </span>
        </header>

        <div className="rec-controls">
          {recording ? (
            <button
              type="button"
              className="rec-btn is-recording"
              data-testid="record-stop-btn"
              onClick={() => studio.stopRecording()}
            >
              <Square size={16} />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              className="rec-btn"
              data-testid="record-start-btn"
              onClick={() => studio.startRecording()}
            >
              <Circle size={16} fill="currentColor" />
              <span>Record</span>
            </button>
          )}
          <div className="rec-readout">
            <span className="rec-time" data-testid="recording-time">
              {clockMs(elapsed)}
            </span>
            <span className="rec-count">{recording ? `${count} notes` : ' '}</span>
          </div>
        </div>
        <p
          className={`module-note ${notice ? 'is-notice' : ''}`}
          data-testid={notice ? 'empty-take-notice' : undefined}
        >
          {notice ??
            'Play on your keyboard, then press Stop. Takes keep your touch and sustain pedal.'}
        </p>
      </section>

      <section className="module module-takes" aria-labelledby="mod-takes">
        <header className="module-head">
          <h2 id="mod-takes">Takes</h2>
          {takes.length > 0 && (
            <button
              type="button"
              className="text-btn text-btn-danger"
              onClick={() => studio.clearTakes()}
              data-testid="clear-takes-btn"
            >
              <Trash2 size={12} />
              Clear all
            </button>
          )}
        </header>
        {takes.length === 0 ? (
          <p className="empty-state">
            No takes yet. Hit Record and play something — it is saved in this
            browser and can be exported as a MIDI file.
          </p>
        ) : (
          <ul className="take-list" data-testid="recordings-list">
            {takes.map((t) => (
              <TakeRow key={t.id} take={t} playing={playingId === t.id} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
