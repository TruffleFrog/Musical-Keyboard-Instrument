import { nameToMidi } from './notes';
import type { InstrumentId } from '../types/music';

/**
 * Song data model + a small notation parser.
 *
 * A song is a set of independent *parts* (right hand, left hand, bass...).
 * Each part is authored as a compact notation string and compiled to absolute
 * note events measured in beats, so any number of notes can sound together.
 *
 * Notation (whitespace separated):
 *   E4:1            note, advance 1 beat (default duration = d=, initially 1)
 *   C3+E3+G3:2      chord of three notes, advance 2 beats
 *   r:1             rest
 *   E4:.25/2        advance .25 beat but keep sounding for 2 beats (held note)
 *   E4:1@70         velocity 70 (1..127)
 *   C4:1{Twin-}     lyric / hint shown under the note
 *   d=.5            set default duration for following tokens
 *   | ...           bar line (used only for validation)
 *   ( ... )*3       repeat a group
 */

export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type PartRole = 'melody' | 'harmony' | 'bass';

export interface PartDef {
  id: string;
  name: string;
  role: PartRole;
  hand: 'right' | 'left';
  notation: string;
  /** Base velocity 0..1 for notes without an explicit @velocity. */
  velocity?: number;
}

export interface SongDef {
  id: string;
  title: string;
  composer: string;
  /** Short origin / era line, e.g. "1824". */
  era: string;
  difficulty: Difficulty;
  /** Tempo in beats per minute, where a beat is `beatUnit`. */
  bpm: number;
  beatsPerBar: number;
  /** What one beat is in the score, shown next to the tempo. */
  beatUnit: 'quarter' | 'eighth';
  /** Length in beats of an incomplete first bar (anacrusis), if any. */
  pickupBeats?: number;
  key: string;
  recommendedInstrument: InstrumentId;
  recommendedOctave: number;
  description: string;
  /**
   * Where the music comes from and under what terms it may be redistributed.
   * Required: songs without provenance are rejected.
   */
  provenance: string;
  sections?: Array<{ name: string; bar: number }>;
  parts: PartDef[];
}

export interface SongNote {
  /** Stable index into Song.notes after sorting. */
  index: number;
  midi: number;
  /** Start in beats from the beginning of the song. */
  start: number;
  /** Sounding duration in beats. */
  duration: number;
  /** 0..1 */
  velocity: number;
  partId: string;
  lyric?: string;
}

export interface SongPart {
  id: string;
  name: string;
  role: PartRole;
  hand: 'right' | 'left';
  noteCount: number;
  /** Total time the part advances, in beats. */
  advance: number;
  /** Length of each bar delimited by `|` in the notation. */
  barLengths: number[];
}

export interface Song extends Omit<SongDef, 'parts'> {
  parts: SongPart[];
  notes: SongNote[];
  lengthBeats: number;
  barCount: number;
  /** Longest note duration, used for fast active-note lookup. */
  maxDuration: number;
}

export interface ParsedPart {
  notes: Array<Omit<SongNote, 'index' | 'partId'>>;
  /** Total time advanced, in beats. */
  advance: number;
  /** Length in beats of each bar delimited by `|` (or one entry if none). */
  barLengths: number[];
}

const NOTE_RE = '[A-Ga-g][#b]?-?\\d';
const TOKEN_RE = new RegExp(
  `^(${NOTE_RE}(?:\\+${NOTE_RE})*)(?::(\\d*\\.?\\d+)(?:/(\\d*\\.?\\d+))?)?(?:@(\\d+))?(?:\\{([^}]*)\\})?$`
);
const REST_RE = /^r(?::(\d*\.?\d+))?$/i;

export class NotationError extends Error {}

function tokenize(src: string): string[] {
  return src
    .replace(/\(/g, ' ( ')
    .replace(/\)/g, ' ) ')
    .replace(/\|/g, ' | ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Expands `( ... )*n` groups into a flat token list. */
function expandGroups(tokens: string[]): string[] {
  const out: string[] = [];
  let i = 0;

  function parseSeq(): string[] {
    const seq: string[] = [];
    while (i < tokens.length) {
      const t = tokens[i];
      if (t === ')') return seq;
      i += 1;
      if (t === '(') {
        const inner = parseSeq();
        if (tokens[i] !== ')') throw new NotationError('Unclosed "(" group');
        i += 1;
        let times = 1;
        const rep = /^\*(\d+)$/.exec(tokens[i] ?? '');
        if (rep) {
          times = parseInt(rep[1], 10);
          i += 1;
        }
        for (let n = 0; n < times; n++) seq.push(...inner);
      } else {
        seq.push(t);
      }
    }
    return seq;
  }

  out.push(...parseSeq());
  if (i < tokens.length) throw new NotationError('Unmatched ")"');
  return out;
}

export function parseNotation(
  src: string,
  baseVelocity = 0.75
): ParsedPart {
  const tokens = expandGroups(tokenize(src));
  const notes: ParsedPart['notes'] = [];
  const barLengths: number[] = [];
  let cursor = 0;
  let barStart = 0;
  let defaultDur = 1;
  let sawBar = false;

  for (const token of tokens) {
    if (token === '|') {
      sawBar = true;
      if (cursor > barStart) {
        barLengths.push(round(cursor - barStart));
        barStart = cursor;
      }
      continue;
    }

    const dur = /^d=(\d*\.?\d+)$/.exec(token);
    if (dur) {
      defaultDur = parseFloat(dur[1]);
      continue;
    }

    const rest = REST_RE.exec(token);
    if (rest) {
      cursor += rest[1] !== undefined ? parseFloat(rest[1]) : defaultDur;
      continue;
    }

    const m = TOKEN_RE.exec(token);
    if (!m) throw new NotationError(`Cannot parse token "${token}"`);

    const advance = m[2] !== undefined ? parseFloat(m[2]) : defaultDur;
    const hold = m[3] !== undefined ? parseFloat(m[3]) : advance;
    const velocity =
      m[4] !== undefined
        ? Math.max(0.05, Math.min(1, parseInt(m[4], 10) / 127))
        : baseVelocity;

    for (const name of m[1].split('+')) {
      notes.push({
        midi: nameToMidi(name),
        start: round(cursor),
        duration: round(hold),
        velocity,
        lyric: m[5] || undefined,
      });
    }
    cursor += advance;
  }

  if (cursor > barStart || !sawBar) barLengths.push(round(cursor - barStart));

  return { notes, advance: round(cursor), barLengths };
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Returns a list of problems with a compiled song (empty when valid). */
export function validateSong(song: Song): string[] {
  const problems: string[] = [];
  if (!song.id) problems.push('missing id');
  if (!song.title) problems.push('missing title');
  if (!song.provenance || song.provenance.trim().length < 10) {
    problems.push('missing provenance / licence note');
  }
  if (!Number.isFinite(song.bpm) || song.bpm <= 0) problems.push('invalid bpm');
  if (!Number.isFinite(song.beatsPerBar) || song.beatsPerBar <= 0) {
    problems.push('invalid beatsPerBar');
  }
  if (song.notes.length === 0) problems.push('no notes');
  for (const n of song.notes) {
    if (!Number.isInteger(n.midi) || n.midi < 0 || n.midi > 127) {
      problems.push(`pitch out of range: ${n.midi}`);
    }
    if (!Number.isFinite(n.start) || n.start < 0) problems.push('negative start');
    if (!Number.isFinite(n.duration) || n.duration <= 0) {
      problems.push(`non-positive duration at beat ${n.start}`);
    }
    if (!(n.velocity > 0 && n.velocity <= 1)) problems.push('invalid velocity');
  }
  // Same pitch struck again while it is still sounding within one part.
  const byPart = new Map<string, SongNote[]>();
  for (const n of song.notes) {
    const list = byPart.get(n.partId) ?? [];
    list.push(n);
    byPart.set(n.partId, list);
  }
  for (const [part, notes] of byPart) {
    const lastEnd = new Map<number, number>();
    for (const n of notes) {
      const end = lastEnd.get(n.midi);
      if (end !== undefined && n.start < end - 1e-6) {
        problems.push(`part "${part}" re-strikes pitch ${n.midi} at beat ${n.start} while it still sounds`);
      }
      lastEnd.set(n.midi, n.start + n.duration);
    }
  }
  return problems;
}

export function defineSong(def: SongDef): Song {
  const parts: SongPart[] = [];
  const notes: SongNote[] = [];
  let length = 0;

  for (const part of def.parts) {
    const parsed = parseNotation(part.notation, part.velocity ?? 0.75);
    length = Math.max(length, parsed.advance);
    parts.push({
      id: part.id,
      name: part.name,
      role: part.role,
      hand: part.hand,
      noteCount: parsed.notes.length,
      advance: parsed.advance,
      barLengths: parsed.barLengths,
    });
    for (const n of parsed.notes) {
      notes.push({ ...n, index: 0, partId: part.id });
    }
  }

  notes.sort((a, b) => a.start - b.start || a.midi - b.midi);
  notes.forEach((n, index) => {
    n.index = index;
  });

  const maxDuration = notes.reduce((m, n) => Math.max(m, n.duration), 0);
  const first = def.pickupBeats ?? 0;
  const barCount =
    Math.ceil((length - first) / def.beatsPerBar - 1e-6) + (first > 0 ? 1 : 0);

  const { parts: _unused, ...meta } = def;
  void _unused;
  const song: Song = {
    ...meta,
    parts,
    notes,
    lengthBeats: round(length),
    barCount,
    maxDuration,
  };
  const problems = validateSong(song);
  if (problems.length > 0) {
    throw new NotationError(`Invalid song "${def.id}": ${problems.join('; ')}`);
  }
  return song;
}

/** Bar number (1-based; 0 = pickup) containing a beat position. */
export function barAtBeat(song: Song, beat: number): number {
  const pickup = song.pickupBeats ?? 0;
  if (beat < pickup) return 0;
  return Math.floor((beat - pickup) / song.beatsPerBar) + 1;
}

/** Beat position where a 1-based bar starts. */
export function beatOfBar(song: Song, bar: number): number {
  const pickup = song.pickupBeats ?? 0;
  if (bar <= 0) return 0;
  return pickup + (bar - 1) * song.beatsPerBar;
}

/** Midi pitches whose notes sound at `beat` (start <= beat < start+duration). */
export function activeMidisAt(
  song: Song,
  beat: number,
  isPartEnabled?: (partId: string) => boolean
): Set<number> {
  const out = new Set<number>();
  const { notes } = song;
  // upper bound: first index with start > beat
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid].start <= beat) lo = mid + 1;
    else hi = mid;
  }
  const earliest = beat - song.maxDuration;
  for (let i = lo - 1; i >= 0; i--) {
    const n = notes[i];
    if (n.start < earliest) break;
    if (beat < n.start + n.duration) {
      if (!isPartEnabled || isPartEnabled(n.partId)) out.add(n.midi);
    }
  }
  return out;
}
