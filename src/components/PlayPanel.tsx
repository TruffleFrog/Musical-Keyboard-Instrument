import React from 'react';
import { RotateCcw } from 'lucide-react';
import { studio } from '../app/studio';
import {
  INSTRUMENT_PRESETS,
  attackSeconds,
  getInstrumentPreset,
  releaseSeconds,
  resolveParams,
} from '../data/instruments';
import type { ToneParamKey } from '../types/music';
import { Knob } from './Knob';
import { Segmented, Switch, useStudio } from './ui';

function seconds(s: number): string {
  return s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(1)} s`;
}

const TOUCH_OPTIONS = [
  { value: 'soft', label: 'Soft' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
] as const;
const TOUCH_VALUE = { soft: 0.5, medium: 0.75, hard: 0.95 } as const;

function touchName(v: number): 'soft' | 'medium' | 'hard' {
  if (v < 0.62) return 'soft';
  if (v < 0.85) return 'medium';
  return 'hard';
}

export const PlayPanel: React.FC = () => {
  const instrument = useStudio((s) => s.prefs.instrument);
  const params = useStudio((s) => s.prefs.params);
  const touch = useStudio((s) => s.prefs.touch);
  const showKeyLabels = useStudio((s) => s.prefs.showKeyLabels);
  const showNoteNames = useStudio((s) => s.prefs.showNoteNames);
  const sampleState = useStudio((s) => s.sampleState);

  const preset = getInstrumentPreset(instrument);
  const tone = resolveParams(instrument, params[instrument]);
  const modified = !!params[instrument];

  const knobs: Array<{
    key: ToneParamKey;
    label: string;
    display: string;
  }> = [
    { key: 'brightness', label: 'Tone', display: `${Math.round(tone.brightness * 100)}%` },
    {
      key: 'attack',
      label: 'Attack',
      display: seconds(attackSeconds(instrument, tone)),
    },
    {
      key: 'release',
      label: 'Release',
      display: seconds(releaseSeconds(instrument, tone)),
    },
    { key: 'reverb', label: 'Reverb', display: `${Math.round(tone.reverb * 100)}%` },
    {
      key: 'width',
      label: preset.widthLabel,
      display: `${Math.round(tone.width * 100)}%`,
    },
  ];

  const pianoStatus =
    instrument !== 'piano'
      ? ''
      : sampleState === 'ready'
        ? 'Piano samples ready'
        : sampleState === 'error'
          ? 'Samples unavailable'
          : 'Loading piano…';

  return (
    <div className="deck deck-play" data-testid="play-panel">
      <section className="module module-sound" aria-labelledby="mod-sound">
        <header className="module-head">
          <h2 id="mod-sound">Sound</h2>
          <span className="module-hint">keys 1–6</span>
        </header>
        <div className="instrument-grid" role="radiogroup" aria-label="Instrument">
          {INSTRUMENT_PRESETS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={instrument === p.id}
              data-testid={`instrument-card-${p.id}`}
              className={`instrument ${instrument === p.id ? 'is-on' : ''}`}
              onClick={() => studio.setInstrument(p.id)}
            >
              <span className="instrument-num">{i + 1}</span>
              <span className="instrument-text">
                <span className="instrument-name">{p.name}</span>
                <span className="instrument-caption">{p.caption}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="module module-tone" aria-labelledby="mod-tone">
        <header className="module-head">
          <h2 id="mod-tone">Tone · {preset.name}</h2>
          <button
            type="button"
            className="text-btn"
            disabled={!modified}
            onClick={() => studio.resetTone()}
            data-testid="reset-tone-btn"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </header>
        <div className="knob-row">
          {knobs.map((k) => (
            <Knob
              key={k.key}
              label={k.label}
              value={tone[k.key]}
              display={k.display}
              defaultValue={preset.defaults[k.key]}
              disabled={!preset.controls.includes(k.key)}
              testId={`param-${k.key}`}
              onChange={(v) => studio.setTone({ [k.key]: v })}
            />
          ))}
        </div>
        <p className="module-note">{preset.tagline}</p>
      </section>

      <section className="module module-perform" aria-labelledby="mod-perform">
        <header className="module-head">
          <h2 id="mod-perform">Keyboard</h2>
          <span className="module-hint" data-testid="sample-status">
            {pianoStatus}
          </span>
        </header>
        <div className="field">
          <span className="field-label">Touch</span>
          <Segmented
            label="Key touch"
            value={touchName(touch)}
            options={TOUCH_OPTIONS.map((o) => ({ ...o, testId: `touch-${o.value}` }))}
            onChange={(v) => studio.setTouch(TOUCH_VALUE[v])}
          />
        </div>
        <Switch
          label="Show computer-key letters"
          checked={showKeyLabels}
          onChange={(v) => studio.setShowKeyLabels(v)}
          testId="toggle-key-labels-btn"
        />
        <Switch
          label="Show every note name"
          checked={showNoteNames}
          onChange={(v) => studio.setShowNoteNames(v)}
          testId="toggle-note-names-btn"
        />
        <p className="module-note">
          Click lower on a key for a harder strike; hold Space for sustain.
        </p>
      </section>
    </div>
  );
};
