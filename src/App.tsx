import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioEngine } from './audio/AudioEngine';
import { DEMO_SONGS } from './data/demoSongs';
import { getInstrumentPreset } from './data/instruments';
import {
  getKeyboardNotes,
  getNoteName,
  getVirtualNoteFromKeyboardEvent,
  MAX_OCTAVE,
  MIN_OCTAVE,
} from './data/keyboardMap';
import {
  loadPreferences,
  loadRecordings,
  savePreferences,
  saveRecordings,
} from './utils/storage';
import {
  DemoPlayMode,
  DemoSong,
  InstrumentId,
  RecordedNoteEvent,
  Recording,
  StudioPreferences,
  StudioTab,
  SynthParams,
} from './types/music';
import { HeaderBar } from './components/HeaderBar';
import { PianoKeyboard } from './components/PianoKeyboard';
import { SoundStudioPanel } from './components/SoundStudioPanel';
import { DemoSongsPanel } from './components/DemoSongsPanel';
import { RecorderPanel } from './components/RecorderPanel';

export const App: React.FC = () => {
  const [prefs, setPrefs] = useState<StudioPreferences>(() => loadPreferences());
  const [recordings, setRecordings] = useState<Recording[]>(() =>
    loadRecordings()
  );

  // Active notes played by user (keyboard/mouse/touch)
  const [activeMidis, setActiveMidis] = useState<Set<number>>(() => new Set());
  // Active notes highlighted by Demo Song Auto-Play or Recording Playback
  const [demoHighlightMidis, setDemoHighlightMidis] = useState<Set<number>>(
    () => new Set()
  );

  // Demo Song state
  const [selectedSong, setSelectedSong] = useState<DemoSong>(DEMO_SONGS[0]);
  const [demoPlayMode, setDemoPlayMode] = useState<DemoPlayMode>('autoplay');
  const [isDemoPlaying, setIsDemoPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [practiceCompleted, setPracticeCompleted] = useState(false);

  // Recorder state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [liveRecordedEventsCount, setLiveRecordedEventsCount] = useState(0);
  const [emptyTakeNotice, setEmptyTakeNotice] = useState(false);
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(
    null
  );

  // Refs for low-latency event tracking & non-interrupting live synth params
  const codeToMidiRef = useRef<Map<string, number>>(new Map());
  const recordingStartMsRef = useRef<number>(0);
  const openRecordedNotesRef = useRef<
    Map<number, { startTimeMs: number; instrument: InstrumentId }>
  >(new Map());
  const capturedEventsRef = useRef<RecordedNoteEvent[]>([]);
  const playbackTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const currentPreset = useMemo(
    () => getInstrumentPreset(prefs.instrument),
    [prefs.instrument]
  );

  const currentSynthParams: SynthParams = useMemo(() => {
    const custom = prefs.customParamsByInstrument[prefs.instrument];
    return {
      ...currentPreset.defaultParams,
      ...(custom ?? {}),
    };
  }, [currentPreset, prefs.customParamsByInstrument, prefs.instrument]);

  const instrumentRef = useRef<InstrumentId>(prefs.instrument);
  instrumentRef.current = prefs.instrument;

  const synthParamsRef = useRef<SynthParams>(currentSynthParams);
  synthParamsRef.current = currentSynthParams;

  const keyboardNotes = useMemo(
    () => getKeyboardNotes(prefs.baseOctave),
    [prefs.baseOctave]
  );

  // Persist preferences to localStorage
  useEffect(() => {
    savePreferences(prefs);
  }, [prefs]);

  // Sync sustain state with AudioEngine
  useEffect(() => {
    audioEngine.setSustain(prefs.sustain);
  }, [prefs.sustain]);

  // Update active voices in real time when sliders change
  useEffect(() => {
    audioEngine.updateActiveParams(currentSynthParams);
  }, [currentSynthParams]);

  // Persist recordings to localStorage
  useEffect(() => {
    saveRecordings(recordings);
  }, [recordings]);

  // Clear all scheduled playback timers helper
  const clearPlaybackTimers = useCallback(() => {
    for (const timer of playbackTimersRef.current) {
      clearTimeout(timer);
    }
    playbackTimersRef.current = [];
  }, []);

  // Ensure demo song notes are within the visible 25-key octave window
  const ensureSongInVisibleOctave = useCallback(
    (song: DemoSong) => {
      const baseMidi = (prefs.baseOctave + 1) * 12;
      const maxMidi = baseMidi + 24;
      const outOfBounds = song.notes.some(
        (n) => n.midi < baseMidi || n.midi > maxMidi
      );
      if (outOfBounds) {
        setPrefs((prev) => ({
          ...prev,
          baseOctave: song.recommendedOctave,
        }));
      }
    },
    [prefs.baseOctave]
  );

  // Panic / All Notes Off
  const handlePanic = useCallback(() => {
    clearPlaybackTimers();
    setIsDemoPlaying(false);
    setPlayingRecordingId(null);
    codeToMidiRef.current.clear();
    setActiveMidis(new Set());
    setDemoHighlightMidis(new Set());
    audioEngine.stopAllNotes();
  }, [clearPlaybackTimers]);

  // Start a user-triggered note
  const startUserNote = useCallback(
    (midi: number) => {
      audioEngine.noteOn(
        midi,
        instrumentRef.current,
        synthParamsRef.current,
        0.85
      );
      setActiveMidis((prev) => {
        if (prev.has(midi)) return prev;
        const next = new Set(prev);
        next.add(midi);
        return next;
      });

      // Capture in Recorder if recording is active
      if (isRecording) {
        setEmptyTakeNotice(false);
        const nowOffset = Math.max(
          0,
          performance.now() - recordingStartMsRef.current
        );
        openRecordedNotesRef.current.set(midi, {
          startTimeMs: nowOffset,
          instrument: instrumentRef.current,
        });
        setLiveRecordedEventsCount(
          capturedEventsRef.current.length + openRecordedNotesRef.current.size
        );
      }

      // Advance Practice Mode if in Follow Notes mode
      if (
        prefs.activeTab === 'songs' &&
        demoPlayMode === 'practice' &&
        !practiceCompleted
      ) {
        const expectedNote = selectedSong.notes[currentStepIndex];
        if (expectedNote && expectedNote.midi === midi) {
          if (currentStepIndex + 1 < selectedSong.notes.length) {
            setCurrentStepIndex((idx) => idx + 1);
          } else {
            setPracticeCompleted(true);
          }
        }
      }
    },
    [
      currentStepIndex,
      demoPlayMode,
      isRecording,
      practiceCompleted,
      prefs.activeTab,
      selectedSong.notes,
    ]
  );

  // End a user-triggered note
  const endUserNote = useCallback(
    (midi: number) => {
      audioEngine.noteOff(midi);
      setActiveMidis((prev) => {
        if (!prev.has(midi)) return prev;
        const next = new Set(prev);
        next.delete(midi);
        return next;
      });

      if (isRecording) {
        const openNote = openRecordedNotesRef.current.get(midi);
        if (openNote) {
          openRecordedNotesRef.current.delete(midi);
          const nowOffset = Math.max(
            openNote.startTimeMs + 40,
            performance.now() - recordingStartMsRef.current
          );
          capturedEventsRef.current.push({
            id: `${midi}-${Math.round(openNote.startTimeMs)}`,
            midi,
            noteName: getNoteName(midi),
            startTimeMs: Math.round(openNote.startTimeMs),
            durationMs: Math.round(nowOffset - openNote.startTimeMs),
            velocity: 0.85,
            instrument: openNote.instrument,
          });
          setLiveRecordedEventsCount(
            capturedEventsRef.current.length + openRecordedNotesRef.current.size
          );
        }
      }
    },
    [isRecording]
  );

  // Physical QWERTY Keyboard Listeners + Stuck-Note Prevention
  useEffect(() => {
    const isTextEntryInput = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      if (tag === 'textarea' || target.isContentEditable) return true;
      if (tag === 'input') {
        const inputType = (
          (target as HTMLInputElement).type || 'text'
        ).toLowerCase();
        return (
          inputType === 'text' ||
          inputType === 'search' ||
          inputType === 'email' ||
          inputType === 'password' ||
          inputType === 'number'
        );
      }
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTextEntryInput(e.target)) return;

      if (e.code === 'Escape') {
        e.preventDefault();
        handlePanic();
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) {
          setPrefs((prev) => ({ ...prev, sustain: !prev.sustain }));
        }
        return;
      }

      if (e.code === 'KeyZ' || e.code === 'ArrowDown') {
        e.preventDefault();
        if (!e.repeat) {
          setPrefs((prev) => ({
            ...prev,
            baseOctave: Math.max(MIN_OCTAVE, prev.baseOctave - 1),
          }));
        }
        return;
      }

      if (e.code === 'KeyX' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (!e.repeat) {
          setPrefs((prev) => ({
            ...prev,
            baseOctave: Math.min(MAX_OCTAVE, prev.baseOctave + 1),
          }));
        }
        return;
      }

      if (e.repeat) return;

      const virtualNote = getVirtualNoteFromKeyboardEvent(
        e.code,
        e.key,
        prefs.baseOctave
      );
      if (virtualNote) {
        e.preventDefault();
        codeToMidiRef.current.set(e.code, virtualNote.midi);
        startUserNote(virtualNote.midi);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const activeMidi = codeToMidiRef.current.get(e.code);
      if (activeMidi !== undefined) {
        e.preventDefault();
        codeToMidiRef.current.delete(e.code);
        endUserNote(activeMidi);
        return;
      }

      const fallbackNote = getVirtualNoteFromKeyboardEvent(
        e.code,
        e.key,
        prefs.baseOctave
      );
      if (fallbackNote) {
        endUserNote(fallbackNote.midi);
      }
    };

    const handleWindowBlur = () => {
      for (const midi of codeToMidiRef.current.values()) {
        audioEngine.noteOff(midi);
      }
      codeToMidiRef.current.clear();
      setActiveMidis(new Set());
      audioEngine.stopAllNotes();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleWindowBlur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [endUserNote, handlePanic, prefs.baseOctave, startUserNote]);

  // Demo Song Auto-Play Scheduler (uses refs for synth params & instrument to avoid retrigger stutter)
  useEffect(() => {
    if (!isDemoPlaying || demoPlayMode !== 'autoplay') {
      return;
    }

    const note = selectedSong.notes[currentStepIndex];
    if (!note) {
      setIsDemoPlaying(false);
      setDemoHighlightMidis(new Set());
      return;
    }

    const beatMs = (60 / (selectedSong.bpm * playbackSpeed)) * 1000;
    const stepDurationMs = Math.max(90, beatMs * note.durationBeats);
    const gateDurationMs = Math.max(55, stepDurationMs * 0.84);

    audioEngine.noteOn(
      note.midi,
      instrumentRef.current,
      synthParamsRef.current,
      0.8
    );
    setDemoHighlightMidis(new Set([note.midi]));

    const gateOffTimer = setTimeout(() => {
      audioEngine.noteOff(note.midi);
      setDemoHighlightMidis(new Set());
    }, gateDurationMs);

    const nextStepTimer = setTimeout(() => {
      if (currentStepIndex + 1 < selectedSong.notes.length) {
        setCurrentStepIndex((idx) => idx + 1);
      } else {
        setIsDemoPlaying(false);
        setCurrentStepIndex(0);
        setDemoHighlightMidis(new Set());
      }
    }, stepDurationMs);

    return () => {
      clearTimeout(gateOffTimer);
      clearTimeout(nextStepTimer);
      audioEngine.noteOff(note.midi);
    };
  }, [
    currentStepIndex,
    demoPlayMode,
    isDemoPlaying,
    playbackSpeed,
    selectedSong,
  ]);

  // Live Recording Elapsed Timer
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      setRecordingElapsedMs(performance.now() - recordingStartMsRef.current);
    }, 80);
    return () => clearInterval(interval);
  }, [isRecording]);

  // Preference update helpers
  const handleSelectInstrument = (instrument: InstrumentId) => {
    setPrefs((prev) => ({ ...prev, instrument }));
  };

  const handleChangeOctave = (delta: number) => {
    setPrefs((prev) => ({
      ...prev,
      baseOctave: Math.max(
        MIN_OCTAVE,
        Math.min(MAX_OCTAVE, prev.baseOctave + delta)
      ),
    }));
  };

  const handleUpdateSynthParams = (partial: Partial<SynthParams>) => {
    setPrefs((prev) => {
      const currentCustom =
        prev.customParamsByInstrument[prev.instrument] ??
        getInstrumentPreset(prev.instrument).defaultParams;
      return {
        ...prev,
        customParamsByInstrument: {
          ...prev.customParamsByInstrument,
          [prev.instrument]: {
            ...currentCustom,
            ...partial,
          },
        },
      };
    });
  };

  const handleResetSynthParams = () => {
    setPrefs((prev) => {
      const updated = { ...prev.customParamsByInstrument };
      delete updated[prev.instrument];
      return {
        ...prev,
        customParamsByInstrument: updated,
      };
    });
  };

  // Demo Song handlers
  const handleSelectSong = (song: DemoSong) => {
    setIsDemoPlaying(false);
    setDemoHighlightMidis(new Set());
    setSelectedSong(song);
    setCurrentStepIndex(0);
    setPracticeCompleted(false);
    ensureSongInVisibleOctave(song);
  };

  const handleChangeDemoMode = (mode: DemoPlayMode) => {
    setIsDemoPlaying(false);
    setDemoHighlightMidis(new Set());
    setDemoPlayMode(mode);
    setCurrentStepIndex(0);
    setPracticeCompleted(false);
    ensureSongInVisibleOctave(selectedSong);
  };

  const handleToggleDemoPlay = () => {
    if (isDemoPlaying) {
      setIsDemoPlaying(false);
      setDemoHighlightMidis(new Set());
    } else {
      if (isRecording) {
        setIsRecording(false);
        openRecordedNotesRef.current.clear();
      }
      if (playingRecordingId) {
        clearPlaybackTimers();
        setPlayingRecordingId(null);
      }
      ensureSongInVisibleOctave(selectedSong);
      setDemoPlayMode('autoplay');
      setIsDemoPlaying(true);
    }
  };

  const handleStopAndResetDemo = () => {
    setIsDemoPlaying(false);
    setDemoHighlightMidis(new Set());
    setCurrentStepIndex(0);
    setPracticeCompleted(false);
  };

  // Recording handlers
  const handleStartRecording = () => {
    clearPlaybackTimers();
    setPlayingRecordingId(null);
    setIsDemoPlaying(false);
    setDemoHighlightMidis(new Set());
    setEmptyTakeNotice(false);
    openRecordedNotesRef.current.clear();
    capturedEventsRef.current = [];
    recordingStartMsRef.current = performance.now();
    setRecordingElapsedMs(0);
    setLiveRecordedEventsCount(0);
    setIsRecording(true);
  };

  const handleStopRecording = () => {
    const nowOffset = Math.max(
      100,
      performance.now() - recordingStartMsRef.current
    );

    for (const [midi, openNote] of openRecordedNotesRef.current.entries()) {
      capturedEventsRef.current.push({
        id: `${midi}-${Math.round(openNote.startTimeMs)}`,
        midi,
        noteName: getNoteName(midi),
        startTimeMs: Math.round(openNote.startTimeMs),
        durationMs: Math.max(50, Math.round(nowOffset - openNote.startTimeMs)),
        velocity: 0.85,
        instrument: openNote.instrument,
      });
    }
    openRecordedNotesRef.current.clear();

    const sortedEvents = [...capturedEventsRef.current].sort(
      (a, b) => a.startTimeMs - b.startTimeMs
    );

    setIsRecording(false);

    if (sortedEvents.length > 0) {
      setEmptyTakeNotice(false);
      const presetName = getInstrumentPreset(prefs.instrument).name;
      const newRecording: Recording = {
        id: `rec-${Date.now()}`,
        name: `Take #${recordings.length + 1} (${presetName})`,
        createdAt: new Date().toISOString(),
        durationMs: Math.round(nowOffset),
        instrument: prefs.instrument,
        events: sortedEvents,
      };
      setRecordings((prev) => [newRecording, ...prev]);
    } else {
      setEmptyTakeNotice(true);
    }
  };

  const handlePlayRecording = (recording: Recording) => {
    clearPlaybackTimers();
    setIsDemoPlaying(false);
    setDemoHighlightMidis(new Set());
    setPlayingRecordingId(recording.id);

    for (const ev of recording.events) {
      const inst = ev.instrument || recording.instrument;
      const customParams = prefs.customParamsByInstrument[inst];

      const onTimer = setTimeout(() => {
        audioEngine.noteOn(ev.midi, inst, customParams, ev.velocity);
        setDemoHighlightMidis((prev) => {
          const next = new Set(prev);
          next.add(ev.midi);
          return next;
        });
      }, ev.startTimeMs);

      const offTimer = setTimeout(() => {
        audioEngine.noteOff(ev.midi);
        setDemoHighlightMidis((prev) => {
          const next = new Set(prev);
          next.delete(ev.midi);
          return next;
        });
      }, ev.startTimeMs + Math.max(40, ev.durationMs));

      playbackTimersRef.current.push(onTimer, offTimer);
    }

    const maxEndMs = recording.events.reduce(
      (max, ev) => Math.max(max, ev.startTimeMs + ev.durationMs),
      recording.durationMs
    );

    const doneTimer = setTimeout(() => {
      setPlayingRecordingId(null);
      setDemoHighlightMidis(new Set());
    }, maxEndMs + 80);

    playbackTimersRef.current.push(doneTimer);
  };

  const handleStopRecordingPlayback = () => {
    clearPlaybackTimers();
    setPlayingRecordingId(null);
    setDemoHighlightMidis(new Set());
    audioEngine.stopAllNotes();
  };

  const handleDeleteRecording = (id: string) => {
    if (playingRecordingId === id) {
      handleStopRecordingPlayback();
    }
    setRecordings((prev) => prev.filter((r) => r.id !== id));
  };

  const handleClearAllRecordings = () => {
    handleStopRecordingPlayback();
    setRecordings([]);
  };

  const handleRenameRecording = (id: string, newName: string) => {
    setRecordings((prev) =>
      prev.map((r) => (r.id === id ? { ...r, name: newName } : r))
    );
  };

  // Determine practice target MIDI when in Practice ("Follow Notes") Mode
  const practiceTargetMidi =
    prefs.activeTab === 'songs' &&
    demoPlayMode === 'practice' &&
    !practiceCompleted
      ? selectedSong.notes[currentStepIndex]?.midi ?? null
      : null;

  return (
    <div className="studio-app-shell">
      <HeaderBar
        instrument={prefs.instrument}
        baseOctave={prefs.baseOctave}
        sustain={prefs.sustain}
        showKeyLabels={prefs.showKeyLabels}
        showNoteNames={prefs.showNoteNames}
        activeTab={prefs.activeTab}
        activeMidis={activeMidis}
        demoHighlightMidis={demoHighlightMidis}
        isRecording={isRecording}
        isDemoPlaying={isDemoPlaying}
        volume={currentSynthParams.volume}
        onSelectInstrument={handleSelectInstrument}
        onChangeOctave={handleChangeOctave}
        onToggleSustain={() =>
          setPrefs((prev) => ({ ...prev, sustain: !prev.sustain }))
        }
        onToggleKeyLabels={() =>
          setPrefs((prev) => ({
            ...prev,
            showKeyLabels: !prev.showKeyLabels,
          }))
        }
        onToggleNoteNames={() =>
          setPrefs((prev) => ({
            ...prev,
            showNoteNames: !prev.showNoteNames,
          }))
        }
        onSelectTab={(tab: StudioTab) =>
          setPrefs((prev) => ({ ...prev, activeTab: tab }))
        }
        onChangeVolume={(volume) => handleUpdateSynthParams({ volume })}
        onPanic={handlePanic}
      />

      {/* Upper Studio Rack Deck */}
      <main className="studio-rack-workspace">
        {prefs.activeTab === 'studio' && (
          <SoundStudioPanel
            selectedInstrument={prefs.instrument}
            params={currentSynthParams}
            activeNotesCount={activeMidis.size + demoHighlightMidis.size}
            onSelectInstrument={handleSelectInstrument}
            onUpdateParams={handleUpdateSynthParams}
            onResetParams={handleResetSynthParams}
          />
        )}

        {prefs.activeTab === 'songs' && (
          <DemoSongsPanel
            selectedSong={selectedSong}
            playMode={demoPlayMode}
            isPlaying={isDemoPlaying}
            playbackSpeed={playbackSpeed}
            currentStepIndex={currentStepIndex}
            practiceCompleted={practiceCompleted}
            baseOctave={prefs.baseOctave}
            onSelectSong={handleSelectSong}
            onChangePlayMode={handleChangeDemoMode}
            onTogglePlay={handleToggleDemoPlay}
            onStopAndReset={handleStopAndResetDemo}
            onChangeSpeed={setPlaybackSpeed}
            onSelectStep={(idx) => {
              setCurrentStepIndex(idx);
              setPracticeCompleted(false);
            }}
            onApplyRecommendedSetup={(instrument, octave) => {
              setPrefs((prev) => ({
                ...prev,
                instrument,
                baseOctave: octave,
              }));
            }}
          />
        )}

        {prefs.activeTab === 'recorder' && (
          <RecorderPanel
            isRecording={isRecording}
            recordingElapsedMs={recordingElapsedMs}
            liveRecordedEventsCount={liveRecordedEventsCount}
            emptyTakeNotice={emptyTakeNotice}
            recordings={recordings}
            playingRecordingId={playingRecordingId}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            onPlayRecording={handlePlayRecording}
            onStopPlayback={handleStopRecordingPlayback}
            onDeleteRecording={handleDeleteRecording}
            onClearAllRecordings={handleClearAllRecordings}
            onRenameRecording={handleRenameRecording}
          />
        )}
      </main>

      {/* Prominent Main Stage Virtual Piano Keyboard */}
      <PianoKeyboard
        notes={keyboardNotes}
        baseOctave={prefs.baseOctave}
        sustain={prefs.sustain}
        activeMidis={activeMidis}
        demoHighlightMidis={demoHighlightMidis}
        practiceTargetMidi={practiceTargetMidi}
        practiceStepNumber={currentStepIndex + 1}
        showKeyLabels={prefs.showKeyLabels}
        showNoteNames={prefs.showNoteNames}
        accentColor={currentPreset.accentColor}
        onNoteStart={startUserNote}
        onNoteEnd={endUserNote}
        onChangeOctave={handleChangeOctave}
        onToggleSustain={() =>
          setPrefs((prev) => ({ ...prev, sustain: !prev.sustain }))
        }
      />

      {/* Compact Keyboard Shortcut Footer */}
      <footer className="studio-footer">
        <div className="footer-shortcuts">
          <span>
            <kbd>A</kbd>–<kbd>/</kbd> White Keys
          </span>
          <span>
            <kbd>W</kbd> <kbd>E</kbd> <kbd>T</kbd> <kbd>Y</kbd> <kbd>U</kbd>{' '}
            <kbd>O</kbd> <kbd>P</kbd> <kbd>[</kbd> <kbd>]</kbd> <kbd>=</kbd> Black
            Keys
          </span>
          <span>
            <kbd>Z</kbd> / <kbd>X</kbd> Octave Shift
          </span>
          <span>
            <kbd>Space</kbd> Sustain Pedal
          </span>
          <span>
            <kbd>Esc</kbd> All Notes Off
          </span>
        </div>
        <div className="footer-status">
          Low-Latency Web Audio Engine · 25-Key Polyphonic Manual
        </div>
      </footer>
    </div>
  );
};

export default App;
