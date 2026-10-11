import { DemoSong, SongNote } from '../types/music';
import { noteNameToMidi } from './keyboardMap';

function buildNotes(tuples: Array<[string, number, string?]>): SongNote[] {
  return tuples.map(([note, durationBeats, lyricOrHint]) => ({
    note,
    midi: noteNameToMidi(note),
    durationBeats,
    lyricOrHint,
  }));
}

export const DEMO_SONGS: DemoSong[] = [
  {
    id: 'ode-to-joy',
    title: 'Ode to Joy',
    composer: 'Ludwig van Beethoven',
    difficulty: 'Beginner',
    bpm: 120,
    recommendedInstrument: 'piano',
    recommendedOctave: 4,
    description: 'The iconic theme from Symphony No. 9. Uses stepwise motion across five white keys (C4–G4).',
    notes: buildNotes([
      ['E4', 1, 'Phrase 1'], ['E4', 1], ['F4', 1], ['G4', 1],
      ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
      ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1],
      ['E4', 1.5], ['D4', 0.5], ['D4', 2],

      ['E4', 1, 'Phrase 2'], ['E4', 1], ['F4', 1], ['G4', 1],
      ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
      ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1],
      ['D4', 1.5], ['C4', 0.5], ['C4', 2],

      ['D4', 1, 'Bridge'], ['D4', 1], ['E4', 1], ['C4', 1],
      ['D4', 1], ['E4', 0.5], ['F4', 0.5], ['E4', 1], ['C4', 1],
      ['D4', 1], ['E4', 0.5], ['F4', 0.5], ['E4', 1], ['D4', 1],
      ['C4', 1], ['D4', 1], ['G4', 2],

      ['E4', 1, 'Finale'], ['E4', 1], ['F4', 1], ['G4', 1],
      ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
      ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1],
      ['D4', 1.5], ['C4', 0.5], ['C4', 2],
    ]),
  },
  {
    id: 'twinkle-little-star',
    title: 'Twinkle, Twinkle, Little Star',
    composer: 'Traditional (18th Century)',
    difficulty: 'Beginner',
    bpm: 112,
    recommendedInstrument: 'epiano',
    recommendedOctave: 4,
    description: 'Classic French melody ("Ah! vous dirai-je, maman"). Great for learning leaps on the home row.',
    notes: buildNotes([
      ['C4', 1, 'Twin-'], ['C4', 1, 'kle'], ['G4', 1, 'twin-'], ['G4', 1, 'kle'],
      ['A4', 1, 'lit-'], ['A4', 1, 'tle'], ['G4', 2, 'star'],
      ['F4', 1, 'How'], ['F4', 1, 'I'], ['E4', 1, 'won-'], ['E4', 1, 'der'],
      ['D4', 1, 'what'], ['D4', 1, 'you'], ['C4', 2, 'are'],

      ['G4', 1, 'Up'], ['G4', 1, 'a-'], ['F4', 1, 'bove'], ['F4', 1, 'the'],
      ['E4', 1, 'world'], ['E4', 1, 'so'], ['D4', 2, 'high'],
      ['G4', 1, 'Like'], ['G4', 1, 'a'], ['F4', 1, 'dia-'], ['F4', 1, 'mond'],
      ['E4', 1, 'in'], ['E4', 1, 'the'], ['D4', 2, 'sky'],

      ['C4', 1, 'Twin-'], ['C4', 1, 'kle'], ['G4', 1, 'twin-'], ['G4', 1, 'kle'],
      ['A4', 1, 'lit-'], ['A4', 1, 'tle'], ['G4', 2, 'star'],
      ['F4', 1, 'How'], ['F4', 1, 'I'], ['E4', 1, 'won-'], ['E4', 1, 'der'],
      ['D4', 1, 'what'], ['D4', 1, 'you'], ['C4', 2, 'are'],
    ]),
  },
  {
    id: 'fur-elise',
    title: 'Für Elise (Bagatelle No. 25)',
    composer: 'Ludwig van Beethoven',
    difficulty: 'Intermediate',
    bpm: 126,
    recommendedInstrument: 'piano',
    recommendedOctave: 4,
    description: 'Famous A-minor romantic motif featuring chromatic semitone alternation (E5–D#5) and arpeggios.',
    notes: buildNotes([
      ['E5', 0.5, 'Motif'], ['D#5', 0.5], ['E5', 0.5], ['D#5', 0.5],
      ['E5', 0.5], ['B4', 0.5], ['D5', 0.5], ['C5', 0.5],
      ['A4', 1.5], ['C4', 0.5], ['E4', 0.5], ['A4', 0.5],
      ['B4', 1.5], ['E4', 0.5], ['G#4', 0.5], ['B4', 0.5],
      ['C5', 1.5], ['E4', 0.5],

      ['E5', 0.5, 'Repeat'], ['D#5', 0.5], ['E5', 0.5], ['D#5', 0.5],
      ['E5', 0.5], ['B4', 0.5], ['D5', 0.5], ['C5', 0.5],
      ['A4', 1.5], ['C4', 0.5], ['E4', 0.5], ['A4', 0.5],
      ['B4', 1.5], ['E4', 0.5], ['C5', 0.5], ['B4', 0.5],
      ['A4', 2],
    ]),
  },
  {
    id: 'korobeiniki',
    title: 'Korobeiniki (Tetris Theme)',
    composer: '19th-Century Russian Folk',
    difficulty: 'Intermediate',
    bpm: 138,
    recommendedInstrument: 'chiptune',
    recommendedOctave: 4,
    description: 'Upbeat Russian folk dance immortalized in 8-bit gaming. Sounds authentic on 8-Bit Chiptune!',
    notes: buildNotes([
      ['E5', 1, 'Theme A'], ['B4', 0.5], ['C5', 0.5], ['D5', 1], ['C5', 0.5], ['B4', 0.5],
      ['A4', 1], ['A4', 0.5], ['C5', 0.5], ['E5', 1], ['D5', 0.5], ['C5', 0.5],
      ['B4', 1.5], ['C5', 0.5], ['D5', 1], ['E5', 1],
      ['C5', 1], ['A4', 1], ['A4', 2],

      ['D5', 1, 'Theme B'], ['F5', 0.5], ['A5', 1], ['G5', 0.5], ['F5', 0.5],
      ['E5', 1.5], ['C5', 0.5], ['E5', 1], ['D5', 0.5], ['C5', 0.5],
      ['B4', 1], ['B4', 0.5], ['C5', 0.5], ['D5', 1], ['E5', 1],
      ['C5', 1], ['A4', 1], ['A4', 2],
    ]),
  },
  {
    id: 'greensleeves',
    title: 'Greensleeves',
    composer: 'Traditional English (16th Century)',
    difficulty: 'Intermediate',
    bpm: 108,
    recommendedInstrument: 'synth',
    recommendedOctave: 4,
    description: 'Lush Renaissance modal melody with expressive intervals and raised leading-tone cadences.',
    notes: buildNotes([
      ['A4', 1, 'Verse'], ['C5', 2], ['D5', 1], ['E5', 1.5], ['F5', 0.5], ['E5', 1],
      ['D5', 2], ['B4', 1], ['G4', 1.5], ['A4', 0.5], ['B4', 1],
      ['C5', 2], ['A4', 1], ['A4', 1.5], ['G#4', 0.5], ['A4', 1],
      ['B4', 2], ['G#4', 1], ['E4', 2],

      ['A4', 1, 'Resolve'], ['C5', 2], ['D5', 1], ['E5', 1.5], ['F5', 0.5], ['E5', 1],
      ['D5', 2], ['B4', 1], ['G4', 1.5], ['A4', 0.5], ['B4', 1],
      ['C5', 1.5], ['B4', 0.5], ['A4', 1], ['G#4', 1.5], ['F#4', 0.5], ['G#4', 1],
      ['A4', 3],
    ]),
  },
  {
    id: 'canon-in-d',
    title: 'Canon in D (Melodic Theme)',
    composer: 'Johann Pachelbel',
    difficulty: 'Advanced',
    bpm: 96,
    recommendedInstrument: 'organ',
    recommendedOctave: 4,
    description: 'Baroque counterpoint variations descending gracefully through D major.',
    notes: buildNotes([
      ['F#5', 2, 'Theme 1'], ['E5', 2], ['D5', 2], ['C#5', 2],
      ['B4', 2], ['A4', 2], ['B4', 2], ['C#5', 2],

      ['D5', 1, 'Variation'], ['C#5', 1], ['B4', 1], ['A4', 1],
      ['G4', 1], ['F#4', 1], ['G4', 1], ['E4', 1],
      ['D4', 1], ['F#4', 1], ['A4', 1], ['G4', 1],
      ['F#4', 1], ['D4', 1], ['F#4', 1], ['E4', 1],
      ['D4', 2],
    ]),
  },
];
