import { AudioEngine, audioEngine, type NoteHandle } from '../audio/engine';
import type { LoadState } from '../audio/samples';
import {
  getKeyboardNotes,
  getVirtualNoteFromKeyboardEvent,
  clampOctave,
} from '../data/keyboardMap';
import {
  INSTRUMENT_PRESETS,
  getInstrumentPreset,
  resolveParams,
} from '../data/instruments';
import { getSong, SONGS } from '../music/songs';
import { midiToName } from '../music/notes';
import type { Song } from '../music/song';
import { LearnSession, buildLearnSteps } from '../playback/learn';
import {
  SequencePlayer,
  songToSequence,
  type PlayerSequence,
  type PlayerState,
} from '../playback/sequencePlayer';
import { takeToSequence } from '../playback/take';
import { createStore, type Store } from '../state/store';
import type {
  InstrumentId,
  RecordedNoteEvent,
  Recording,
  SongMode,
  StudioPreferences,
  StudioTab,
  ToneParams,
} from '../types/music';
import {
  downloadBytes,
  exportRecordingToMidi,
  exportSongToMidi,
  safeFileName,
} from '../utils/midiExport';
import {
  loadPreferences,
  loadRecordings,
  savePreferences,
  saveRecordings,
  MAX_SAVED_TAKES,
} from '../utils/storage';

export interface LearnState {
  active: boolean;
  index: number;
  total: number;
  mistakes: number;
  hits: number;
  completed: boolean;
  /** Changes on every press so the UI can flash feedback. */
  tick: number;
  lastResult: 'hit' | 'miss' | null;
}

export interface StudioState {
  prefs: StudioPreferences;
  userNotes: ReadonlySet<number>;
  /** Notes lit by song or take playback. */
  songNotes: ReadonlySet<number>;
  learnTargets: ReadonlySet<number>;
  pedalLatched: boolean;
  pedalHeld: boolean;
  songState: PlayerState;
  disabledParts: ReadonlySet<string>;
  learn: LearnState;
  recording: boolean;
  recordingMs: number;
  recordedCount: number;
  takes: Recording[];
  takeState: PlayerState;
  playingTakeId: string | null;
  sampleState: LoadState;
  helpOpen: boolean;
  notice: string | null;
}

export interface LiveNote {
  midi: number;
  /** performance.now() at key down. */
  t0: number;
  /** performance.now() at key up, or null while held. */
  t1: number | null;
  velocity: number;
}

export interface RollFrame {
  mode: 'free' | 'song' | 'learn' | 'take';
  sequence: PlayerSequence | null;
  beat: number;
  secPerBeat: number;
  live: LiveNote[];
  nowMs: number;
  learnTargets: ReadonlySet<number>;
  isPartVisible: (partId: string | undefined) => boolean;
  isMelody: (partId: string | undefined) => boolean;
}

const EMPTY_SET: ReadonlySet<number> = new Set();
const EMPTY_PARTS: ReadonlySet<string> = new Set();

const raf: (cb: () => void) => number =
  typeof requestAnimationFrame === 'function'
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(cb, 16) as unknown as number;
const caf: (id: number) => void =
  typeof cancelAnimationFrame === 'function'
    ? (id) => cancelAnimationFrame(id)
    : (id) => clearTimeout(id);

function setsEqual(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') {
    const type = ((target as HTMLInputElement).type || 'text').toLowerCase();
    return !['range', 'checkbox', 'radio', 'button', 'submit'].includes(type);
  }
  return false;
}

const INTERACTIVE_SELECTOR =
  'button, a[href], select, summary, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="option"]';
const ARROW_OWNER_SELECTOR =
  'input, select, textarea, [role="slider"], [role="tab"], [role="listbox"], [role="radiogroup"], [role="radio"]';

export class Studio {
  readonly store: Store<StudioState>;
  private readonly engine: AudioEngine;
  private readonly songPlayer: SequencePlayer;
  private readonly takePlayer: SequencePlayer;

  private song: Song;
  private sequence: PlayerSequence;
  private learn: LearnSession | null = null;

  private userHandles = new Map<number, NoteHandle>();
  private codeToMidi = new Map<string, number>();
  private live: LiveNote[] = [];

  private rec = {
    startMs: 0,
    open: new Map<number, { startMs: number; velocity: number; instrument: InstrumentId }>(),
    events: [] as RecordedNoteEvent[],
    pedal: [] as Array<{ timeMs: number; down: boolean }>,
  };
  private recTimer: ReturnType<typeof setInterval> | null = null;
  private frameId: number | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private attached = 0;
  private detach: (() => void) | null = null;

  constructor(engine: AudioEngine = audioEngine) {
    this.engine = engine;
    const prefs = loadPreferences();
    this.song = getSong(prefs.songId);
    this.sequence = songToSequence(this.song);

    this.store = createStore<StudioState>({
      prefs: { ...prefs, songId: this.song.id },
      userNotes: EMPTY_SET,
      songNotes: EMPTY_SET,
      learnTargets: EMPTY_SET,
      pedalLatched: false,
      pedalHeld: false,
      songState: 'stopped',
      disabledParts: EMPTY_PARTS,
      learn: {
        active: false,
        index: 0,
        total: 0,
        mistakes: 0,
        hits: 0,
        completed: false,
        tick: 0,
        lastResult: null,
      },
      recording: false,
      recordingMs: 0,
      recordedCount: 0,
      takes: loadRecordings(),
      takeState: 'stopped',
      playingTakeId: null,
      sampleState: engine.getLoadState(),
      helpOpen: false,
      notice: null,
    });

    const opts = {
      engine,
      getInstrument: () => this.store.get().prefs.instrument,
    };
    this.songPlayer = new SequencePlayer(opts);
    this.takePlayer = new SequencePlayer(opts);
    this.songPlayer.load(this.sequence);
    this.songPlayer.setPartFilter((id) => this.isPartAudible(id));
    this.songPlayer.setSpeed(prefs.speed);
    this.songPlayer.setLoop(prefs.loop);

    this.songPlayer.onState((s) => {
      this.store.set({ songState: s });
      this.syncFrameLoop();
    });
    this.takePlayer.onState((s) => {
      this.store.set({
        takeState: s,
        playingTakeId: s === 'stopped' ? null : this.store.get().playingTakeId,
      });
      this.syncFrameLoop();
    });

    // Apply persisted settings to the engine.
    engine.setMasterVolume(prefs.masterVolume);
    for (const p of INSTRUMENT_PRESETS) {
      engine.setTone(p.id, resolveParams(p.id, prefs.params[p.id]));
    }
    engine.onLoadState((s) => this.store.set({ sampleState: s }));

    if (this.store.get().prefs.songMode === 'learn') this.rebuildLearn();

    // Debounced persistence.
    let lastPrefs = this.store.get().prefs;
    let lastTakes = this.store.get().takes;
    this.store.subscribe(() => {
      const s = this.store.get();
      if (s.prefs !== lastPrefs) {
        lastPrefs = s.prefs;
        this.scheduleSave();
      }
      if (s.takes !== lastTakes) {
        lastTakes = s.takes;
        this.scheduleSave();
      }
    });
  }

  /* ---------------- derived accessors ---------------- */

  get currentSong(): Song {
    return this.song;
  }

  getState(): StudioState {
    return this.store.get();
  }

  isMelodyPart = (partId: string | undefined): boolean =>
    this.song.parts.some((p) => p.id === partId && p.role === 'melody');

  private isPartAudible(partId: string | undefined): boolean {
    const s = this.store.get();
    if (partId === undefined) return true;
    if (s.disabledParts.has(partId)) return false;
    if (s.prefs.melodyOnly && !this.isMelodyPart(partId)) return false;
    return true;
  }

  isPartVisible = (partId: string | undefined): boolean => this.isPartAudible(partId);

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flush();
    }, 150);
  }

  /** Writes pending changes immediately (used on page hide). */
  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const s = this.store.get();
    savePreferences(s.prefs);
    saveRecordings(s.takes);
  }

  private updatePrefs(patch: Partial<StudioPreferences>): void {
    this.store.set((s) => ({ prefs: { ...s.prefs, ...patch } }));
  }

  /* ---------------- lifecycle / DOM wiring ---------------- */

  /** Attaches global listeners and starts loading samples. Ref-counted. */
  attach(): () => void {
    this.attached += 1;
    if (this.attached === 1) this.detach = this.bindDom();
    void this.engine.loadSamples();
    return () => {
      this.attached -= 1;
      if (this.attached === 0 && this.detach) {
        this.detach();
        this.detach = null;
      }
    };
  }

  private bindDom(): () => void {
    const onKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);
    const onKeyUp = (e: KeyboardEvent) => this.handleKeyUp(e);
    const onBlur = () => this.releaseKeyboard();
    const onVisibility = () => {
      if (document.hidden) {
        this.releaseKeyboard();
        this.flush();
      }
    };
    // Mouse clicks leave focus on buttons; drop it so Space stays the pedal.
    const onClick = (e: MouseEvent) => {
      if (e.detail === 0) return; // keyboard-initiated click
      const el = e.target instanceof Element ? e.target.closest('button') : null;
      if (el && el instanceof HTMLElement) el.blur();
    };
    const unlock = () => void this.engine.resume();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pagehide', () => this.flush());
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('click', onClick, true);
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('pointerdown', unlock, true);
    };
  }

  /* ---------------- keyboard ---------------- */

  handleKeyDown(e: KeyboardEvent): void {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTextEntry(e.target)) return;
    const target = e.target instanceof HTMLElement ? e.target : null;

    void this.engine.resume();

    if (e.code === 'Escape') {
      e.preventDefault();
      this.panic();
      return;
    }

    if (e.key === '?') {
      e.preventDefault();
      if (!e.repeat) this.setHelpOpen(!this.store.get().helpOpen);
      return;
    }

    if (e.code === 'Space') {
      // Let a focused button/tab/select handle Space itself (accessibility).
      if (target?.closest(INTERACTIVE_SELECTOR)) return;
      e.preventDefault();
      if (!e.repeat) this.setPedalHeld(true);
      return;
    }

    if (e.code === 'KeyZ' || e.code === 'KeyX') {
      e.preventDefault();
      if (!e.repeat) this.shiftOctave(e.code === 'KeyZ' ? -1 : 1);
      return;
    }

    if (
      (e.code === 'ArrowUp' || e.code === 'ArrowDown') &&
      !target?.closest(ARROW_OWNER_SELECTOR)
    ) {
      e.preventDefault();
      if (!e.repeat) this.shiftOctave(e.code === 'ArrowDown' ? -1 : 1);
      return;
    }

    const digit = /^Digit([1-6])$/.exec(e.code);
    if (digit) {
      e.preventDefault();
      if (!e.repeat) {
        const preset = INSTRUMENT_PRESETS[parseInt(digit[1], 10) - 1];
        if (preset) this.setInstrument(preset.id);
      }
      return;
    }

    if (e.repeat) {
      // Swallow auto-repeat of note keys so the page doesn't scroll/jump.
      if (getVirtualNoteFromKeyboardEvent(e.code, e.key, 4)) e.preventDefault();
      return;
    }

    const note = getVirtualNoteFromKeyboardEvent(
      e.code,
      e.key,
      this.store.get().prefs.octave
    );
    if (!note) return;
    e.preventDefault();
    if (this.codeToMidi.has(e.code)) return;
    this.codeToMidi.set(e.code, note.midi);
    this.pressKey(note.midi);
  }

  handleKeyUp(e: KeyboardEvent): void {
    if (e.code === 'Space') {
      if (this.store.get().pedalHeld) {
        e.preventDefault();
        this.setPedalHeld(false);
      }
      return;
    }
    const midi = this.codeToMidi.get(e.code);
    if (midi !== undefined) {
      e.preventDefault();
      this.codeToMidi.delete(e.code);
      this.releaseKey(midi);
    }
  }

  /** Releases every key held on the computer keyboard (focus loss). */
  private releaseKeyboard(): void {
    for (const midi of Array.from(this.codeToMidi.values())) this.releaseKey(midi);
    this.codeToMidi.clear();
    if (this.store.get().pedalHeld) this.setPedalHeld(false);
  }

  /* ---------------- notes ---------------- */

  /** Starts a user note (computer key, pointer or touch). */
  pressKey(midi: number, velocity?: number): void {
    const s = this.store.get();
    const v = velocity ?? s.prefs.touch;
    void this.engine.resume();

    this.userHandles.set(
      midi,
      this.engine.noteOn({
        midi,
        instrument: s.prefs.instrument,
        velocity: v,
        source: 'user',
      })
    );

    const now = performance.now();
    this.live.push({ midi, t0: now, t1: null, velocity: v });
    if (this.live.length > 400) this.live.splice(0, this.live.length - 400);

    this.store.set((st) => ({ userNotes: new Set(st.userNotes).add(midi) }));

    if (s.recording) {
      this.rec.open.set(midi, {
        startMs: now - this.rec.startMs,
        velocity: v,
        instrument: s.prefs.instrument,
      });
      this.store.set({ recordedCount: this.rec.events.length + this.rec.open.size });
    }

    if (s.prefs.tab === 'songs' && s.prefs.songMode === 'learn') {
      this.learnPress(midi);
    }
  }

  releaseKey(midi: number): void {
    const handle = this.userHandles.get(midi);
    if (handle) {
      handle.release();
      this.userHandles.delete(midi);
    }
    const now = performance.now();
    for (let i = this.live.length - 1; i >= 0; i--) {
      if (this.live[i].midi === midi && this.live[i].t1 === null) {
        this.live[i].t1 = now;
        break;
      }
    }
    this.store.set((st) => {
      if (!st.userNotes.has(midi)) return {};
      const next = new Set(st.userNotes);
      next.delete(midi);
      return { userNotes: next };
    });

    const open = this.rec.open.get(midi);
    if (open && this.store.get().recording) {
      this.rec.open.delete(midi);
      const end = now - this.rec.startMs;
      this.rec.events.push({
        id: `${midi}-${Math.round(open.startMs)}`,
        midi,
        noteName: midiToName(midi),
        startTimeMs: Math.round(open.startMs),
        durationMs: Math.max(30, Math.round(end - open.startMs)),
        velocity: open.velocity,
        instrument: open.instrument,
      });
      this.store.set({ recordedCount: this.rec.events.length + this.rec.open.size });
    }
  }

  /** Silences everything and resets transient state. */
  panic(): void {
    this.songPlayer.stop();
    this.takePlayer.stop();
    this.engine.stopAll();
    this.userHandles.clear();
    this.codeToMidi.clear();
    for (const l of this.live) if (l.t1 === null) l.t1 = performance.now();
    if (this.store.get().recording) this.finishOpenRecordedNotes();
    this.store.set({
      userNotes: EMPTY_SET,
      songNotes: EMPTY_SET,
      pedalHeld: false,
      pedalLatched: false,
    });
    this.engine.setPedal(false);
  }

  /* ---------------- performance controls ---------------- */

  setInstrument(id: InstrumentId): void {
    if (this.store.get().prefs.instrument === id) return;
    // Held notes keep ringing on their original sound; new notes use `id`.
    this.updatePrefs({ instrument: id });
  }

  shiftOctave(delta: number): void {
    this.setOctave(this.store.get().prefs.octave + delta);
  }

  setOctave(octave: number): void {
    const next = clampOctave(octave);
    if (next === this.store.get().prefs.octave) return;
    // Notes held by computer keys keep their pitch; the new mapping applies
    // from the next key press.
    this.updatePrefs({ octave: next });
  }

  setMasterVolume(volume: number): void {
    this.engine.setMasterVolume(volume);
    this.updatePrefs({ masterVolume: volume });
  }

  setTouch(touch: number): void {
    this.updatePrefs({ touch });
  }

  setTone(patch: Partial<ToneParams>): void {
    const s = this.store.get();
    const id = s.prefs.instrument;
    const next = { ...resolveParams(id, s.prefs.params[id]), ...patch };
    this.engine.setTone(id, next);
    this.updatePrefs({ params: { ...s.prefs.params, [id]: next } });
  }

  resetTone(): void {
    const s = this.store.get();
    const id = s.prefs.instrument;
    const params = { ...s.prefs.params };
    delete params[id];
    this.engine.setTone(id, getInstrumentPreset(id).defaults);
    this.updatePrefs({ params });
  }

  setShowKeyLabels(v: boolean): void {
    this.updatePrefs({ showKeyLabels: v });
  }

  setShowNoteNames(v: boolean): void {
    this.updatePrefs({ showNoteNames: v });
  }

  setPedalHeld(down: boolean): void {
    this.store.set({ pedalHeld: down });
    this.applyPedal();
  }

  togglePedalLatch(): void {
    this.store.set((s) => ({ pedalLatched: !s.pedalLatched }));
    this.applyPedal();
  }

  private applyPedal(): void {
    const s = this.store.get();
    const down = s.pedalLatched || s.pedalHeld;
    if (s.recording) {
      const last = this.rec.pedal[this.rec.pedal.length - 1];
      if (!last || last.down !== down) {
        this.rec.pedal.push({
          timeMs: Math.round(performance.now() - this.rec.startMs),
          down,
        });
      }
    }
    this.engine.setPedal(down);
  }

  setTab(tab: StudioTab): void {
    if (this.store.get().prefs.tab === tab) return;
    this.updatePrefs({ tab });
    if (tab !== 'songs' && this.songPlayer.getState() === 'playing') {
      this.songPlayer.pause();
    }
  }

  setHelpOpen(open: boolean): void {
    this.store.set({ helpOpen: open });
  }

  dismissNotice(): void {
    this.store.set({ notice: null });
  }

  /* ---------------- songs ---------------- */

  selectSong(id: string): void {
    const song = getSong(id);
    this.songPlayer.stop();
    this.song = song;
    this.sequence = songToSequence(song);
    this.songPlayer.load(this.sequence);
    const s = this.store.get();
    const patch: Partial<StudioPreferences> = { songId: song.id };
    if (s.prefs.autoSound) {
      patch.instrument = song.recommendedInstrument;
      patch.octave = clampOctave(song.recommendedOctave);
    }
    this.store.set({
      songNotes: EMPTY_SET,
      disabledParts: EMPTY_PARTS,
      prefs: { ...s.prefs, ...patch },
    });
    this.rebuildLearn();
  }

  playSong(): void {
    const s = this.store.get();
    if (s.prefs.songMode === 'learn') this.setSongMode('listen');
    if (s.recording) this.stopRecording();
    this.takePlayer.stop();
    void this.engine.resume();
    this.songPlayer.play();
  }

  pauseSong(): void {
    this.songPlayer.pause();
  }

  toggleSong(): void {
    if (this.songPlayer.getState() === 'playing') this.pauseSong();
    else this.playSong();
  }

  stopSong(): void {
    this.songPlayer.stop();
    this.store.set({ songNotes: EMPTY_SET });
  }

  seekSong(beat: number): void {
    const s = this.store.get();
    if (s.prefs.songMode === 'learn' && this.learn) {
      this.learn.seekToBeat(beat);
      this.publishLearn(null);
    } else {
      this.songPlayer.seek(beat);
    }
  }

  setSpeed(speed: number): void {
    this.songPlayer.setSpeed(speed);
    this.updatePrefs({ speed });
  }

  setLoop(loop: boolean): void {
    this.songPlayer.setLoop(loop);
    this.updatePrefs({ loop });
  }

  setMelodyOnly(on: boolean): void {
    this.updatePrefs({ melodyOnly: on });
  }

  setLearnAccompaniment(on: boolean): void {
    this.updatePrefs({ learnAccompaniment: on });
  }

  setAutoSound(on: boolean): void {
    this.updatePrefs({ autoSound: on });
  }

  togglePart(partId: string): void {
    this.store.set((s) => {
      const next = new Set(s.disabledParts);
      if (next.has(partId)) next.delete(partId);
      else next.add(partId);
      return { disabledParts: next };
    });
  }

  applyRecommendedSound(): void {
    this.updatePrefs({
      instrument: this.song.recommendedInstrument,
      octave: clampOctave(this.song.recommendedOctave),
    });
  }

  setSongMode(mode: SongMode): void {
    if (this.store.get().prefs.songMode === mode) return;
    this.songPlayer.stop();
    this.store.set({ songNotes: EMPTY_SET });
    this.updatePrefs({ songMode: mode });
    if (mode === 'learn') {
      // Put the computer-keyboard window where this song's melody lives.
      if (this.store.get().prefs.autoSound) {
        this.updatePrefs({ octave: clampOctave(this.song.recommendedOctave) });
      }
      this.rebuildLearn();
    } else {
      this.learn = null;
      this.store.set({
        learnTargets: EMPTY_SET,
        learn: { ...this.store.get().learn, active: false },
      });
    }
  }

  restartLearn(): void {
    if (!this.learn) return;
    this.learn.restart();
    this.publishLearn(null);
  }

  private rebuildLearn(): void {
    if (this.store.get().prefs.songMode !== 'learn') {
      this.learn = null;
      this.store.set({
        learnTargets: EMPTY_SET,
        learn: { ...this.store.get().learn, active: false },
      });
      return;
    }
    const steps = buildLearnSteps(
      this.sequence.notes,
      this.isMelodyPart,
      this.sequence.lengthBeats
    );
    this.learn = new LearnSession(steps);
    this.publishLearn(null);
  }

  private publishLearn(lastResult: 'hit' | 'miss' | null): void {
    const l = this.learn;
    if (!l) return;
    const prev = this.store.get().learn;
    this.store.set({
      learnTargets: new Set(l.targets),
      learn: {
        active: true,
        index: l.index,
        total: l.total,
        mistakes: l.mistakes,
        hits: l.hits,
        completed: l.completed,
        tick: prev.tick + 1,
        lastResult,
      },
    });
  }

  private learnPress(midi: number): void {
    const l = this.learn;
    if (!l) return;
    const res = l.press(midi);
    if (res.result === 'none') return;
    this.publishLearn(res.result === 'hit' ? 'hit' : 'miss');
    if (res.result === 'hit' && res.advanced && res.completed) {
      const s = this.store.get();
      if (s.prefs.learnAccompaniment) {
        const from = res.completed.start;
        const to = res.completed.nextStart;
        this.songPlayer.playSegment(
          from,
          to,
          (n) => !this.isMelodyPart(n.partId) && this.isPartAudible(n.partId)
        );
      }
    }
  }

  /** Window-key hint for a target pitch: label of the nearest QWERTY key. */
  hintKeyLabels(targets: Iterable<number>): string[] {
    const notes = getKeyboardNotes(this.store.get().prefs.octave);
    const out: string[] = [];
    for (const t of targets) {
      const pcT = ((t % 12) + 12) % 12;
      let best: { label: string; d: number } | null = null;
      for (const n of notes) {
        if (((n.midi % 12) + 12) % 12 !== pcT) continue;
        const d = Math.abs(n.midi - t);
        if (!best || d < best.d) best = { label: n.keyLabel, d };
      }
      if (best) out.push(best.label);
    }
    return out;
  }

  exportCurrentSongMidi(): void {
    const enabled = new Set(
      this.song.parts.filter((p) => this.isPartAudible(p.id)).map((p) => p.id)
    );
    downloadBytes(
      `${safeFileName(this.song.title)}.mid`,
      exportSongToMidi(this.song, enabled)
    );
  }

  /* ---------------- recording ---------------- */

  startRecording(): void {
    this.songPlayer.stop();
    this.takePlayer.stop();
    this.rec = {
      startMs: performance.now(),
      open: new Map(),
      events: [],
      pedal: [],
    };
    const s = this.store.get();
    if (s.pedalLatched || s.pedalHeld) {
      this.rec.pedal.push({ timeMs: 0, down: true });
    }
    this.store.set({
      recording: true,
      recordingMs: 0,
      recordedCount: 0,
      notice: null,
      songNotes: EMPTY_SET,
    });
    // Notes already held are not part of the take.
    this.recTimer = setInterval(() => {
      this.store.set({ recordingMs: performance.now() - this.rec.startMs });
    }, 100);
  }

  private finishOpenRecordedNotes(): void {
    const end = performance.now() - this.rec.startMs;
    for (const [midi, open] of this.rec.open) {
      this.rec.events.push({
        id: `${midi}-${Math.round(open.startMs)}`,
        midi,
        noteName: midiToName(midi),
        startTimeMs: Math.round(open.startMs),
        durationMs: Math.max(30, Math.round(end - open.startMs)),
        velocity: open.velocity,
        instrument: open.instrument,
      });
    }
    this.rec.open.clear();
  }

  stopRecording(): void {
    if (!this.store.get().recording) return;
    if (this.recTimer) clearInterval(this.recTimer);
    this.recTimer = null;
    this.finishOpenRecordedNotes();

    const duration = Math.max(100, Math.round(performance.now() - this.rec.startMs));
    const events = [...this.rec.events].sort(
      (a, b) => a.startTimeMs - b.startTimeMs || a.midi - b.midi
    );
    const pedal = this.rec.pedal.length > 0 ? [...this.rec.pedal] : undefined;
    const s = this.store.get();

    if (events.length === 0) {
      this.store.set({
        recording: false,
        recordingMs: 0,
        recordedCount: 0,
        notice: 'Nothing was played, so no take was saved.',
      });
      return;
    }

    const preset = getInstrumentPreset(s.prefs.instrument);
    const take: Recording = {
      id: `take-${Date.now()}`,
      name: `Take ${this.nextTakeNumber()} · ${preset.name}`,
      createdAt: new Date().toISOString(),
      durationMs: duration,
      instrument: s.prefs.instrument,
      events,
      pedal,
    };
    this.store.set({
      recording: false,
      recordingMs: 0,
      recordedCount: 0,
      takes: [take, ...s.takes].slice(0, MAX_SAVED_TAKES),
    });
  }

  private nextTakeNumber(): number {
    const used = this.store
      .get()
      .takes.map((t) => /^Take (\d+)/.exec(t.name)?.[1])
      .filter((n): n is string => !!n)
      .map((n) => parseInt(n, 10));
    return (used.length ? Math.max(...used) : 0) + 1;
  }

  playTake(id: string): void {
    const take = this.store.get().takes.find((t) => t.id === id);
    if (!take) return;
    if (this.store.get().recording) this.stopRecording();
    this.songPlayer.stop();
    this.takePlayer.load(takeToSequence(take));
    this.takePlayer.setSpeed(1);
    this.takePlayer.setPartFilter(() => true);
    this.store.set({ playingTakeId: id });
    void this.engine.resume();
    this.takePlayer.play();
  }

  stopTake(): void {
    this.takePlayer.stop();
    this.store.set({ playingTakeId: null, songNotes: EMPTY_SET });
  }

  deleteTake(id: string): void {
    if (this.store.get().playingTakeId === id) this.stopTake();
    this.store.set((s) => ({ takes: s.takes.filter((t) => t.id !== id) }));
  }

  renameTake(id: string, name: string): void {
    const clean = name.trim().slice(0, 60) || 'Untitled take';
    this.store.set((s) => ({
      takes: s.takes.map((t) => (t.id === id ? { ...t, name: clean } : t)),
    }));
  }

  clearTakes(): void {
    this.stopTake();
    this.store.set({ takes: [] });
  }

  exportTakeMidi(id: string): void {
    const take = this.store.get().takes.find((t) => t.id === id);
    if (!take) return;
    downloadBytes(`${safeFileName(take.name, 'take')}.mid`, exportRecordingToMidi(take));
  }

  /* ---------------- visuals ---------------- */

  private syncFrameLoop(): void {
    const needs =
      this.songPlayer.getState() === 'playing' ||
      this.takePlayer.getState() === 'playing';
    if (needs && this.frameId === null) {
      const loop = () => {
        this.frameId = null;
        this.updateHighlights();
        if (
          this.songPlayer.getState() === 'playing' ||
          this.takePlayer.getState() === 'playing'
        ) {
          this.frameId = raf(loop);
        } else {
          this.store.set({ songNotes: EMPTY_SET });
        }
      };
      this.frameId = raf(loop);
    } else if (!needs && this.frameId !== null) {
      caf(this.frameId);
      this.frameId = null;
      this.store.set({ songNotes: EMPTY_SET });
    }
  }

  private updateHighlights(): void {
    let next: Set<number> = new Set();
    if (this.takePlayer.getState() === 'playing') {
      next = this.takePlayer.activeAt(this.takePlayer.getPosition());
    } else if (this.songPlayer.getState() === 'playing') {
      next = this.songPlayer.activeAt(this.songPlayer.getPosition());
    }
    if (!setsEqual(next, this.store.get().songNotes)) {
      this.store.set({ songNotes: next });
    }
  }

  /** Called every animation frame by the roll canvas. */
  getRollFrame(): RollFrame {
    const s = this.store.get();
    const now = performance.now();
    if (this.takePlayer.getState() !== 'stopped' && s.prefs.tab === 'record') {
      const seq = this.takePlayer.getSequence();
      return {
        mode: 'take',
        sequence: seq,
        beat: this.takePlayer.getPosition(),
        secPerBeat: 1,
        live: this.live,
        nowMs: now,
        learnTargets: EMPTY_SET,
        isPartVisible: () => true,
        isMelody: () => true,
      };
    }
    if (s.prefs.tab === 'songs') {
      if (s.prefs.songMode === 'learn') {
        const step = this.learn?.step;
        return {
          mode: 'learn',
          sequence: this.sequence,
          beat: step ? step.start : this.sequence.lengthBeats,
          secPerBeat: 60 / (this.sequence.bpm * s.prefs.speed),
          live: this.live,
          nowMs: now,
          learnTargets: s.learnTargets,
          isPartVisible: this.isPartVisible,
          isMelody: this.isMelodyPart,
        };
      }
      return {
        mode: 'song',
        sequence: this.sequence,
        beat: this.songPlayer.getPosition(),
        secPerBeat: this.songPlayer.secondsPerBeat(),
        live: this.live,
        nowMs: now,
        learnTargets: EMPTY_SET,
        isPartVisible: this.isPartVisible,
        isMelody: this.isMelodyPart,
      };
    }
    return {
      mode: 'free',
      sequence: null,
      beat: 0,
      secPerBeat: 0.5,
      live: this.live,
      nowMs: now,
      learnTargets: EMPTY_SET,
      isPartVisible: () => true,
      isMelody: () => true,
    };
  }

  /** Current transport position in beats (for progress UI). */
  getSongPosition(): number {
    const s = this.store.get();
    if (s.prefs.songMode === 'learn' && this.learn) {
      return this.learn.step ? this.learn.step.start : this.sequence.lengthBeats;
    }
    return this.songPlayer.getPosition();
  }

  getSongSequence(): PlayerSequence {
    return this.sequence;
  }

  getTakePosition(): number {
    return this.takePlayer.getPosition();
  }

  getTakeLength(): number {
    return this.takePlayer.getSequence()?.lengthBeats ?? 0;
  }

  /** Test/debug hook: current engine voice count. */
  getVoiceCount(): number {
    return this.engine.getVoiceCount();
  }

  songs(): Song[] {
    return SONGS;
  }
}

export const studio = new Studio();
