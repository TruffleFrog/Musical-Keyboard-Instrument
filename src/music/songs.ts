import { defineSong, type Song, type SongDef } from './song';

/**
 * Built-in arrangements. All pieces are public domain compositions; the
 * arrangements below are original to this project (MIT licensed).
 *
 * Each song has a melody part that is playable on the 25-key QWERTY window
 * ("Learn" mode) plus accompaniment parts (chords / bass) that give the demo
 * real polyphony.
 */

type Voicings = Record<string, string>;
type Maker = (symbol: string, dur: number, posInBar: number) => string;

/**
 * Turns a chord progression such as "C:2 G:2 | Am:4" into notation by asking
 * `make` for each chord. `posInBar` is the beat offset inside the current bar.
 */
function comp(progression: string, beatsPerBar: number, make: Maker): string {
  const out: string[] = [];
  let pos = 0;
  for (const token of progression.split(/\s+/).filter(Boolean)) {
    if (token === '|') {
      out.push('|');
      pos = 0;
      continue;
    }
    const m = /^([A-G][#b]?m?):(\d*\.?\d+)$/.exec(token);
    if (!m) throw new Error(`Bad chord token "${token}"`);
    const dur = parseFloat(m[2]);
    out.push(make(m[1], dur, pos));
    pos = (pos + dur) % beatsPerBar;
  }
  return out.join(' ');
}

const rep = (token: string, n: number) =>
  Array.from({ length: n }, () => token).join(' ');

/* ------------------------------------------------------------------ */
/* Ode to Joy                                                          */
/* ------------------------------------------------------------------ */

const ODE_VOICE: Voicings = { C: 'C3+E3+G3', G: 'B2+D3+G3' };
const ODE_BASS: Voicings = { C: 'C2', G: 'G2' };
const ODE_PROG = `
  C:2 C:2 | C:2 G:2 | C:2 G:2 | C:2 G:2 |
  C:2 C:2 | C:2 G:2 | C:2 G:2 | G:2 C:2 |
  G:2 C:2 | G:2 C:2 | G:2 C:1 G:1 | C:1 G:3 |
  C:2 C:2 | C:2 G:2 | C:2 G:2 | G:2 C:2 |`;

const odeToJoy = defineSong({
  id: 'ode-to-joy',
  title: 'Ode to Joy',
  composer: 'Ludwig van Beethoven',
  era: '1824',
  difficulty: 'Beginner',
  bpm: 112,
  beatsPerBar: 4,
  beatUnit: 'quarter',
  key: 'C major',
  recommendedInstrument: 'piano',
  recommendedOctave: 3,
  description:
    'The finale theme of the Ninth Symphony. The tune moves almost entirely by step, so it is the friendliest first song. Chords and bass sit underneath.',
  sections: [
    { name: 'Theme', bar: 1 },
    { name: 'Answer', bar: 5 },
    { name: 'Bridge', bar: 9 },
    { name: 'Reprise', bar: 13 },
  ],
  parts: [
    {
      id: 'melody',
      name: 'Melody',
      role: 'melody',
      hand: 'right',
      velocity: 0.82,
      notation: `
        E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:1.5 D4:.5 D4:2 |
        E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:.5 C4:2 |
        D4 D4 E4 C4 | D4 E4:.5 F4:.5 E4 C4 | D4 E4:.5 F4:.5 E4 D4 | C4 D4 G3:2 |
        E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:.5 C4:2 |`,
    },
    {
      id: 'chords',
      name: 'Chords',
      role: 'harmony',
      hand: 'left',
      velocity: 0.5,
      notation: comp(ODE_PROG, 4, (s, d) => `${ODE_VOICE[s]}:${d}`),
    },
    {
      id: 'bass',
      name: 'Bass',
      role: 'bass',
      hand: 'left',
      velocity: 0.62,
      notation: comp(ODE_PROG, 4, (s, d) => `${ODE_BASS[s]}:${d}`),
    },
  ],
});

/* ------------------------------------------------------------------ */
/* Twinkle, Twinkle, Little Star                                       */
/* ------------------------------------------------------------------ */

const TWINKLE_PATTERN: Record<string, string> = {
  // The bass note rings for the whole chord while the broken chord moves above.
  C: 'C2+C3:.5/2 G3:.5 E3:.5 G3:.5',
  F: 'F2:.5/2 C3:.5 A2:.5 C3:.5',
  G: 'G2:.5/2 D3:.5 B2:.5 D3:.5',
};

const twinkle = defineSong({
  id: 'twinkle',
  title: 'Twinkle, Twinkle, Little Star',
  composer: 'Traditional (French melody, 1761)',
  era: '1761',
  difficulty: 'Beginner',
  bpm: 96,
  beatsPerBar: 4,
  beatUnit: 'quarter',
  key: 'C major',
  recommendedInstrument: 'epiano',
  recommendedOctave: 4,
  description:
    'A music-box style arrangement: the melody floats over a rocking broken-chord left hand, the way a pianist would play it.',
  sections: [
    { name: 'Twinkle', bar: 1 },
    { name: 'Up above', bar: 5 },
    { name: 'Reprise', bar: 9 },
  ],
  parts: [
    {
      id: 'melody',
      name: 'Melody',
      role: 'melody',
      hand: 'right',
      velocity: 0.8,
      notation: `
        C4{Twin-} C4{kle} G4{twin-} G4{kle} | A4{lit-} A4{tle} G4:2{star} |
        F4{How} F4{I} E4{won-} E4{der} | D4{what} D4{you} C4:2{are} |
        G4{Up} G4{a-} F4{bove} F4{the} | E4{world} E4{so} D4:2{high} |
        G4{Like} G4{a} F4{dia-} F4{mond} | E4{in} E4{the} D4:2{sky} |
        C4{Twin-} C4{kle} G4{twin-} G4{kle} | A4{lit-} A4{tle} G4:2{star} |
        F4{How} F4{I} E4{won-} E4{der} | D4{what} D4{you} C4:2{are} |`,
    },
    {
      id: 'left',
      name: 'Left hand',
      role: 'harmony',
      hand: 'left',
      velocity: 0.5,
      notation: comp(
        `C:2 C:2 | F:2 C:2 | F:2 C:2 | G:2 C:2 |
         C:2 F:2 | C:2 G:2 | C:2 F:2 | C:2 G:2 |
         C:2 C:2 | F:2 C:2 | F:2 C:2 | G:2 C:2 |`,
        4,
        (s) => TWINKLE_PATTERN[s]
      ),
    },
  ],
});

/* ------------------------------------------------------------------ */
/* Für Elise (main theme, A section)                                   */
/* ------------------------------------------------------------------ */

const E_M1 = 'E5 D#5 E5 B4 D5 C5';
const E_M2 = 'A4:1 r:.5 C4 E4 A4';
const E_M3 = 'B4:1 r:.5 E4 G#4 B4';
const E_M3B = 'B4:1 r:.5 E4 C5 B4';
const E_M4 = 'C5:1 r:1 E5 D#5';

// Left-hand arpeggios ring to the end of the group, as with the pedal down.
const E_LA = 'A2:.5/1.5 E3:.5/1 A3:.5/.5 r:1.5';
const E_LE = 'E2:.5/1.5 E3:.5/1 G#3:.5/.5 r:1.5';

const furElise = defineSong({
  id: 'fur-elise',
  title: 'Für Elise',
  composer: 'Ludwig van Beethoven',
  era: 'c. 1810',
  difficulty: 'Intermediate',
  bpm: 132,
  beatsPerBar: 3,
  beatUnit: 'eighth',
  pickupBeats: 1,
  key: 'A minor',
  recommendedInstrument: 'piano',
  recommendedOctave: 4,
  description:
    'Bagatelle No. 25 in A minor. The famous rocking E–D♯ motif in the right hand, answered by rolling A-minor and E-major arpeggios in the left. Played with both endings, twice through.',
  sections: [
    { name: 'Theme', bar: 1 },
    { name: 'Return', bar: 9 },
  ],
  parts: [
    {
      id: 'right',
      name: 'Right hand',
      role: 'melody',
      hand: 'right',
      velocity: 0.8,
      notation: `d=.5
        E5 D#5 |
        ${E_M1} | ${E_M2} | ${E_M3} | ${E_M4} |
        ${E_M1} | ${E_M2} | ${E_M3B} | A4:2 E5 D#5 |
        ${E_M1} | ${E_M2} | ${E_M3} | ${E_M4} |
        ${E_M1} | ${E_M2} | ${E_M3B} | A4:3`,
    },
    {
      id: 'left',
      name: 'Left hand',
      role: 'harmony',
      hand: 'left',
      velocity: 0.52,
      notation: `d=.5
        r:1 |
        r:3 | ${E_LA} | ${E_LE} | ${E_LA} |
        r:3 | ${E_LA} | ${E_LE} | ${E_LA} |
        r:3 | ${E_LA} | ${E_LE} | ${E_LA} |
        r:3 | ${E_LA} | ${E_LE} | ${E_LA}`,
    },
  ],
});

/* ------------------------------------------------------------------ */
/* Greensleeves                                                        */
/* ------------------------------------------------------------------ */

const GS_VOICE: Voicings = {
  Am: 'A3+C4+E4',
  C: 'G3+C4+E4',
  G: 'G3+B3+D4',
  Em: 'G3+B3+E4',
  E: 'G#3+B3+E4',
};
const GS_ROOT: Voicings = { Am: 'A2', C: 'C3', G: 'G2', Em: 'E2', E: 'E2' };

// Bars after the one-beat pickup. Chord names per bar (3 beats each).
const GS_PROG = `
  Am:3 | C:3 | G:3 | Em:3 | Am:3 | Am:1 E:2 | E:3 | E:2 Am:1 |
  Am:3 | C:3 | G:3 | Em:3 | Am:3 | E:3 | Am:3 |
  G:3 | Em:3 | G:3 | Em:3 | Am:3 | Am:1 E:2 | E:3 | E:3 | Am:3 |`;

/** Waltz bass: root on the bar's downbeat of each chord entry. */
const gsBass: Maker = (s, d) => (d > 1 ? `${GS_ROOT[s]}:1 r:${d - 1}` : `${GS_ROOT[s]}:1`);
/** Waltz chords on beats 2 and 3 (no chord on the bar's downbeat). */
const gsChords: Maker = (s, d, pos) => {
  const parts: string[] = [];
  for (let k = 0; k < d; k++) {
    parts.push(pos + k === 0 ? 'r:1' : `${GS_VOICE[s]}:1`);
  }
  return parts.join(' ');
};

const greensleeves = defineSong({
  id: 'greensleeves',
  title: 'Greensleeves',
  composer: 'Traditional English',
  era: 'c. 1580',
  difficulty: 'Intermediate',
  bpm: 100,
  beatsPerBar: 3,
  beatUnit: 'quarter',
  pickupBeats: 1,
  key: 'A minor',
  recommendedInstrument: 'synth',
  recommendedOctave: 4,
  description:
    'A Renaissance ballad in waltz time. Two verses and the soaring chorus, with a bass-and-chord "oom-pah-pah" accompaniment.',
  sections: [
    { name: 'Verse 1', bar: 1 },
    { name: 'Verse 2', bar: 9 },
    { name: 'Chorus', bar: 16 },
  ],
  parts: [
    {
      id: 'melody',
      name: 'Melody',
      role: 'melody',
      hand: 'right',
      velocity: 0.8,
      notation: `
        A4 |
        C5:2 D5 | E5:1.5 F5:.5 E5 | D5:2 B4 | G4:1.5 A4:.5 B4 |
        C5:2 A4 | A4:1.5 G#4:.5 A4 | B4:2 G#4 | E4:2 A4 |
        C5:2 D5 | E5:1.5 F5:.5 E5 | D5:2 B4 | G4:1.5 A4:.5 B4 |
        C5:1.5 B4:.5 A4 | G#4:1.5 F#4:.5 G#4 | A4:3 |
        G5:3 | G5:1.5 F#5:.5 E5 | D5:2 B4 | G4:1.5 A4:.5 B4 |
        C5:2 A4 | A4:1.5 G#4:.5 A4 | B4:2 G#4 | E4:3 | A4:3`,
    },
    {
      id: 'chords',
      name: 'Chords',
      role: 'harmony',
      hand: 'left',
      velocity: 0.48,
      notation: `r:1 | ${comp(GS_PROG, 3, gsChords)}`,
    },
    {
      id: 'bass',
      name: 'Bass',
      role: 'bass',
      hand: 'left',
      velocity: 0.6,
      notation: `r:1 | ${comp(GS_PROG, 3, gsBass)}`,
    },
  ],
});

/* ------------------------------------------------------------------ */
/* Korobeiniki                                                         */
/* ------------------------------------------------------------------ */

const KB_VOICE: Voicings = {
  Am: 'A3+C4+E4',
  Em: 'G3+B3+E4',
  Dm: 'A3+D4+F4',
  C: 'G3+C4+E4',
  G: 'G3+B3+D4',
  E: 'G#3+B3+E4',
};
const KB_ROOT: Voicings = { Am: 'A2', Em: 'E2', Dm: 'D2', C: 'C3', G: 'G2', E: 'E2' };
const KB_FIFTH: Voicings = { Am: 'E3', Em: 'B2', Dm: 'A2', C: 'G2', G: 'D3', E: 'B2' };
const KB_PROG = `
  Am:4 | Am:4 | Em:4 | Am:4 | Dm:4 | C:4 | Em:4 | Am:4 |
  Am:4 | G:4 | Am:4 | E:4 | Am:4 | G:4 | Am:4 | Am:4 |`;

const korobeiniki = defineSong({
  id: 'korobeiniki',
  title: 'Korobeiniki',
  composer: 'Russian folk song (Nekrasov, 1861)',
  era: '1861',
  difficulty: 'Intermediate',
  bpm: 144,
  beatsPerBar: 4,
  beatUnit: 'quarter',
  key: 'A minor',
  recommendedInstrument: 'chiptune',
  recommendedOctave: 4,
  description:
    'The folk dance most people know from falling blocks. Bouncy oom-pah accompaniment under the tune; try it on the 8-Bit sound.',
  sections: [
    { name: 'A', bar: 1 },
    { name: 'B', bar: 5 },
    { name: 'C', bar: 9 },
    { name: 'Reprise', bar: 13 },
  ],
  parts: [
    {
      id: 'melody',
      name: 'Melody',
      role: 'melody',
      hand: 'right',
      velocity: 0.8,
      notation: `
        E5:1 B4:.5 C5:.5 D5:1 C5:.5 B4:.5 | A4:1 A4:.5 C5:.5 E5:1 D5:.5 C5:.5 |
        B4:1.5 C5:.5 D5:1 E5:1 | C5:1 A4:1 A4:2 |
        D5:1.5 F5:.5 A5:1 G5:.5 F5:.5 | E5:1.5 C5:.5 E5:1 D5:.5 C5:.5 |
        B4:1 B4:.5 C5:.5 D5:1 E5:1 | C5:1 A4:1 A4:2 |
        E5:2 C5:2 | D5:2 B4:2 | C5:2 A4:2 | G#4:4 |
        E5:2 C5:2 | D5:2 B4:2 | C5:2 E5:2 | A5:4 |`,
    },
    {
      id: 'chords',
      name: 'Chords',
      role: 'harmony',
      hand: 'left',
      velocity: 0.42,
      notation: comp(KB_PROG, 4, (s) => `r:1 ${KB_VOICE[s]}:1 r:1 ${KB_VOICE[s]}:1`),
    },
    {
      id: 'bass',
      name: 'Bass',
      role: 'bass',
      hand: 'left',
      velocity: 0.6,
      notation: comp(KB_PROG, 4, (s) => `${KB_ROOT[s]}:1 r:1 ${KB_FIFTH[s]}:1 r:1`),
    },
  ],
});

/* ------------------------------------------------------------------ */
/* Canon in D                                                          */
/* ------------------------------------------------------------------ */

const CANON_VOICE: Voicings = {
  D: 'A3+D4+F#4',
  A: 'A3+C#4+E4',
  Bm: 'B3+D4+F#4',
  'F#m': 'A3+C#4+F#4',
  G: 'B3+D4+G4',
};
const CANON_ROOT: Voicings = { D: 'D3', A: 'A2', Bm: 'B2', 'F#m': 'F#2', G: 'G2' };
const CANON_STATEMENT = 'D:2 A:2 | Bm:2 F#m:2 | G:2 D:2 | G:2 A:2 |';
const CANON_PROG = `${rep(CANON_STATEMENT, 5)} D:4`;

const canon = defineSong({
  id: 'canon-in-d',
  title: 'Canon in D',
  composer: 'Johann Pachelbel',
  era: 'c. 1680',
  difficulty: 'Intermediate',
  bpm: 88,
  beatsPerBar: 4,
  beatUnit: 'quarter',
  key: 'D major',
  recommendedInstrument: 'organ',
  recommendedOctave: 4,
  description:
    'The eight-note ground bass loops five times while the line above speeds up from half notes to quarters to flowing eighths — the same trick the original plays with three violins.',
  sections: [
    { name: 'Ground', bar: 1 },
    { name: 'Theme', bar: 5 },
    { name: 'Quarters', bar: 9 },
    { name: 'Eighths', bar: 13 },
    { name: 'Return', bar: 17 },
    { name: 'End', bar: 21 },
  ],
  parts: [
    {
      id: 'melody',
      name: 'Melody',
      role: 'melody',
      hand: 'right',
      velocity: 0.78,
      notation: `
        r:4 | r:4 | r:4 | r:4 |
        F#5:2 E5:2 | D5:2 C#5:2 | B4:2 A4:2 | B4:2 C#5:2 |
        D5 C#5 B4 A4 | G4 F#4 G4 E4 | D4 F#4 A4 G4 | F#4 D4 F#4 E4 |
        d=.5 F#5 D5 A4 D5 E5 C#5 A4 C#5 | D5 B4 F#4 B4 C#5 A4 F#4 A4 |
        B4 G4 D4 G4 A4 F#4 D4 F#4 | B4 D5 G4 B4 C#5 E5 A4 C#5 |
        d=1 F#5:2 E5:2 | D5:2 C#5:2 | B4:2 A4:2 | B4:2 A4:2 |
        D5:4`,
    },
    {
      id: 'harmony',
      name: 'Harmony',
      role: 'harmony',
      hand: 'right',
      velocity: 0.45,
      notation: comp(CANON_PROG, 4, (s, d) => `${CANON_VOICE[s]}:${d}`),
    },
    {
      id: 'bass',
      name: 'Ground bass',
      role: 'bass',
      hand: 'left',
      velocity: 0.62,
      notation: comp(CANON_PROG, 4, (s, d) =>
        s === 'D' && d === 4 ? 'D2+D3:4' : `${CANON_ROOT[s]}:${d}`
      ),
    },
  ],
});

/* ------------------------------------------------------------------ */
/* Prelude in C (BWV 846), opening                                     */
/* ------------------------------------------------------------------ */

/**
 * One bar of the prelude: the five-note figure n1..n5 is played as
 * n1 n2 n3 n4 n5 n3 n4 n5, twice. Notes are held to the end of each half bar
 * (as with half-bar pedalling) so the harmony blooms the way it does on piano.
 */
function preludeBar(n: [string, string, string, string, string]): string {
  const order = [n[0], n[1], n[2], n[3], n[4], n[2], n[3], n[4]];
  const half = order.map(
    (note, i) => `${note}:.25/${(2 - i * 0.25 - 0.06).toFixed(2)}`
  );
  return `${half.join(' ')} ${half.join(' ')}`;
}

const PRELUDE_BARS: Array<[string, string, string, string, string]> = [
  ['C4', 'E4', 'G4', 'C5', 'E5'],
  ['C4', 'D4', 'A4', 'D5', 'F5'],
  ['B3', 'D4', 'G4', 'D5', 'F5'],
  ['C4', 'E4', 'G4', 'C5', 'E5'],
  ['C4', 'E4', 'A4', 'E5', 'A5'],
  ['C4', 'D4', 'F#4', 'A4', 'D5'],
  ['B3', 'D4', 'G4', 'D5', 'G5'],
  ['B3', 'C4', 'E4', 'G4', 'C5'],
];
const PRELUDE_BASS = ['C3', 'C3', 'B2', 'C3', 'C3', 'C3', 'B2', 'B2'];

const prelude = defineSong({
  id: 'prelude-in-c',
  title: 'Prelude in C major (BWV 846)',
  composer: 'Johann Sebastian Bach',
  era: '1722',
  difficulty: 'Advanced',
  bpm: 72,
  beatsPerBar: 4,
  beatUnit: 'quarter',
  key: 'C major',
  recommendedInstrument: 'piano',
  recommendedOctave: 4,
  description:
    'The opening bars of the Well-Tempered Clavier. One simple broken-chord shape, re-harmonised bar by bar; notes ring together like a lightly pedalled piano.',
  sections: [{ name: 'Prelude', bar: 1 }],
  parts: [
    {
      id: 'arpeggio',
      name: 'Arpeggio',
      role: 'melody',
      hand: 'right',
      velocity: 0.7,
      notation: `${PRELUDE_BARS.map(preludeBar).join(' | ')} | C4:.25/4 E4:.25/3.75 G4:.25/3.5 C5:.25/3.25 E5:.25/3 G5:.25/2.75 r:2.5`,
    },
    {
      id: 'bass',
      name: 'Bass',
      role: 'bass',
      hand: 'left',
      velocity: 0.6,
      notation: `${PRELUDE_BASS.map((n) => `${n}:4`).join(' | ')} | C2+C3:4`,
    },
  ],
});

/* ------------------------------------------------------------------ */

export const SONGS: Song[] = [
  odeToJoy,
  twinkle,
  greensleeves,
  korobeiniki,
  furElise,
  canon,
  prelude,
];

export const SONGS_BY_ID: Record<string, Song> = Object.fromEntries(
  SONGS.map((s) => [s.id, s])
);

export function getSong(id: string): Song {
  return SONGS_BY_ID[id] ?? SONGS[0];
}

export type { Song, SongDef };
