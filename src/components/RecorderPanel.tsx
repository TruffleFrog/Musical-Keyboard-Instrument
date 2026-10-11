import React, { useState } from 'react';
import {
  Circle,
  Square,
  Play,
  Download,
  Trash2,
  Disc,
  Music,
  Clock,
  Edit3,
  Check,
  AlertCircle,
} from 'lucide-react';
import { INSTRUMENT_MAP } from '../data/instruments';
import { downloadRecordingAsMidi } from '../utils/midiExport';
import { Recording } from '../types/music';

interface RecorderPanelProps {
  isRecording: boolean;
  recordingElapsedMs: number;
  liveRecordedEventsCount: number;
  emptyTakeNotice: boolean;
  recordings: Recording[];
  playingRecordingId: string | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPlayRecording: (recording: Recording) => void;
  onStopPlayback: () => void;
  onDeleteRecording: (id: string) => void;
  onClearAllRecordings: () => void;
  onRenameRecording: (id: string, newName: string) => void;
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = (totalSec % 60).toFixed(1).padStart(4, '0');
  return `${String(mins).padStart(2, '0')}:${secs}`;
}

export const RecorderPanel: React.FC<RecorderPanelProps> = ({
  isRecording,
  recordingElapsedMs,
  liveRecordedEventsCount,
  emptyTakeNotice,
  recordings,
  playingRecordingId,
  onStartRecording,
  onStopRecording,
  onPlayRecording,
  onStopPlayback,
  onDeleteRecording,
  onClearAllRecordings,
  onRenameRecording,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const latestRecording = recordings[0] ?? null;

  const startEditing = (rec: Recording) => {
    setEditingId(rec.id);
    setEditingName(rec.name);
  };

  const commitEditing = (id: string) => {
    const trimmed = editingName.trim();
    if (trimmed) {
      onRenameRecording(id, trimmed);
    }
    setEditingId(null);
  };

  return (
    <div className="recorder-panel-layout" data-testid="recorder-panel">
      {/* Left: Transport & Live Capture Deck */}
      <div className="studio-card recorder-deck-card">
        <div className="section-header-row">
          <div className="section-title-group">
            <Disc
              size={16}
              className={isRecording ? 'spin-recording-icon' : ''}
            />
            <h2>Performance Recorder</h2>
          </div>
          <span className="section-hint">Millisecond-accurate event capture</span>
        </div>

        <div className="recorder-status-screen">
          <div className="rec-timer-row">
            <span
              className={`rec-badge ${isRecording ? 'is-live' : ''}`}
              data-testid="recording-status-badge"
            >
              {isRecording
                ? '● RECORDING LIVE'
                : playingRecordingId
                  ? '▶ PLAYING BACK'
                  : 'STANDBY'}
            </span>
            <span className="rec-clock" data-testid="recording-timer">
              {isRecording
                ? formatDuration(recordingElapsedMs)
                : latestRecording
                  ? formatDuration(latestRecording.durationMs)
                  : '00:00.0'}
            </span>
          </div>
          <div className="rec-meta-row" data-testid="recording-event-count">
            {isRecording ? (
              <span>
                Captured <strong>{liveRecordedEventsCount}</strong> note events —
                play keys on your keyboard or virtual piano!
              </span>
            ) : emptyTakeNotice ? (
              <span className="rec-empty-notice" data-testid="empty-take-notice">
                <AlertCircle size={13} /> No notes were played during that take —
                press keys while recording to save.
              </span>
            ) : (
              <span>
                Hit Record and play melodies or chords. Export any take as a
                Standard MIDI (<code>.mid</code>) file.
              </span>
            )}
          </div>
        </div>

        <div className="recorder-deck-actions">
          {!isRecording ? (
            <button
              type="button"
              data-testid="record-start-btn"
              className="rec-action-btn start-rec"
              onClick={onStartRecording}
            >
              <Circle size={15} fill="currentColor" />
              <span>Start Recording</span>
            </button>
          ) : (
            <button
              type="button"
              data-testid="record-stop-btn"
              className="rec-action-btn stop-rec"
              onClick={onStopRecording}
            >
              <Square size={15} fill="currentColor" />
              <span>Stop &amp; Save Take</span>
            </button>
          )}

          {latestRecording && (
            <button
              type="button"
              data-testid="record-play-latest-btn"
              disabled={isRecording}
              className="rec-action-btn play-latest"
              onClick={() =>
                playingRecordingId === latestRecording.id
                  ? onStopPlayback()
                  : onPlayRecording(latestRecording)
              }
            >
              {playingRecordingId === latestRecording.id ? (
                <>
                  <Square size={14} fill="currentColor" />
                  <span>Stop Playback</span>
                </>
              ) : (
                <>
                  <Play size={15} fill="currentColor" />
                  <span>Play Latest Take</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Right: Saved Session Recordings & MIDI Export */}
      <div className="studio-card recordings-library-card">
        <div className="section-header-row">
          <div className="section-title-group">
            <Music size={16} />
            <h2>Session Takes ({recordings.length})</h2>
          </div>
          {recordings.length > 1 ? (
            <button
              type="button"
              data-testid="clear-all-recordings-btn"
              className="ghost-action-btn"
              onClick={onClearAllRecordings}
              title="Delete all saved session recordings"
            >
              <Trash2 size={12} />
              <span>Clear All</span>
            </button>
          ) : (
            <span className="section-hint">Saved locally in browser storage</span>
          )}
        </div>

        {recordings.length === 0 ? (
          <div className="empty-recordings-state" data-testid="empty-recordings">
            <Disc size={28} />
            <p>No recordings saved yet in this session.</p>
            <span>
              Click <strong>Start Recording</strong>, play a few notes, then click{' '}
              <strong>Stop &amp; Save Take</strong>.
            </span>
          </div>
        ) : (
          <div
            className="recordings-list"
            data-testid="recordings-list"
            role="list"
          >
            {recordings.map((rec) => {
              const isPlayingThis = playingRecordingId === rec.id;
              const presetName =
                INSTRUMENT_MAP[rec.instrument]?.name ?? rec.instrument;

              return (
                <div
                  key={rec.id}
                  role="listitem"
                  data-testid={`recording-item-${rec.id}`}
                  className={`recording-row ${
                    isPlayingThis ? 'is-playing-row' : ''
                  }`}
                >
                  <div className="recording-info">
                    {editingId === rec.id ? (
                      <div className="recording-rename-box">
                        <input
                          type="text"
                          value={editingName}
                          aria-label="Recording Name"
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEditing(rec.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="icon-small-btn"
                          onClick={() => commitEditing(rec.id)}
                          title="Save Name"
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="recording-title-line">
                        <strong
                          className="recording-name"
                          data-testid="recording-item-name"
                        >
                          {rec.name}
                        </strong>
                        <button
                          type="button"
                          className="icon-small-btn"
                          onClick={() => startEditing(rec)}
                          title="Rename Take"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                    )}

                    <div className="recording-submeta">
                      <span className="rec-instrument-pill">{presetName}</span>
                      <span>
                        <Clock size={11} /> {formatDuration(rec.durationMs)}
                      </span>
                      <span>{rec.events.length} notes</span>
                    </div>
                  </div>

                  <div className="recording-actions">
                    <button
                      type="button"
                      data-testid="recording-play-btn"
                      disabled={isRecording}
                      className={`rec-row-btn ${isPlayingThis ? 'is-active' : ''}`}
                      onClick={() =>
                        isPlayingThis ? onStopPlayback() : onPlayRecording(rec)
                      }
                      title={isPlayingThis ? 'Stop Playback' : 'Play Recording'}
                    >
                      {isPlayingThis ? (
                        <>
                          <Square size={13} fill="currentColor" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Play size={13} fill="currentColor" />
                          <span>Play</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      data-testid="export-midi-btn"
                      className="rec-row-btn midi-btn"
                      onClick={() => downloadRecordingAsMidi(rec)}
                      title="Download Standard MIDI File (.mid)"
                    >
                      <Download size={13} />
                      <span>MIDI</span>
                    </button>

                    <button
                      type="button"
                      data-testid="delete-recording-btn"
                      className="rec-row-btn delete-btn"
                      onClick={() => onDeleteRecording(rec.id)}
                      title="Delete Recording"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
