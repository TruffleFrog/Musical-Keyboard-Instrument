import React, { useEffect, useRef } from 'react';
import { RotateCcw, Activity, Sliders, Volume2 } from 'lucide-react';
import { INSTRUMENT_PRESETS } from '../data/instruments';
import { audioEngine } from '../audio/AudioEngine';
import { InstrumentId, SynthParams } from '../types/music';

interface SoundStudioPanelProps {
  selectedInstrument: InstrumentId;
  params: SynthParams;
  activeNotesCount: number;
  onSelectInstrument: (id: InstrumentId) => void;
  onUpdateParams: (partial: Partial<SynthParams>) => void;
  onResetParams: () => void;
}

export const SoundStudioPanel: React.FC<SoundStudioPanelProps> = ({
  selectedInstrument,
  params,
  activeNotesCount,
  onSelectInstrument,
  onUpdateParams,
  onResetParams,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentPreset =
    INSTRUMENT_PRESETS.find((p) => p.id === selectedInstrument) ??
    INSTRUMENT_PRESETS[0];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;

    let animId = 0;
    const buffer = new Uint8Array(512);
    let phase = 0;

    const renderFrame = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Subtle studio oscilloscope grid
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      const analyser = audioEngine.getAnalyser();
      let hasSignal = false;

      if (analyser) {
        analyser.getByteTimeDomainData(buffer);
        for (let i = 0; i < buffer.length; i++) {
          if (Math.abs(buffer[i] - 128) > 2) {
            hasSignal = true;
            break;
          }
        }
      }

      ctx.strokeStyle = currentPreset.accentColor;
      ctx.lineWidth = 2.2;
      ctx.beginPath();

      if (hasSignal && analyser) {
        const sliceWidth = width / buffer.length;
        let x = 0;
        for (let i = 0; i < buffer.length; i++) {
          const v = buffer[i] / 128.0;
          const y = (v * height) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
      } else {
        // Gentle idle carrier wave
        phase += 0.03;
        for (let x = 0; x < width; x++) {
          const y =
            height / 2 +
            Math.sin((x / width) * Math.PI * 4 + phase) *
              (activeNotesCount > 0 ? 18 : 3.5);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, [currentPreset.accentColor, activeNotesCount]);

  return (
    <div className="studio-panel-grid" data-testid="sound-studio-panel">
      {/* Instrument Patches Grid */}
      <div className="studio-card instruments-section">
        <div className="section-header-row">
          <div className="section-title-group">
            <Volume2 size={16} style={{ color: currentPreset.accentColor }} />
            <h2>Instrument Engines</h2>
          </div>
          <span className="section-hint">
            6 real-time Web Audio synthesis architectures
          </span>
        </div>

        <div className="instrument-cards-grid" role="radiogroup" aria-label="Instruments">
          {INSTRUMENT_PRESETS.map((preset) => {
            const isSelected = preset.id === selectedInstrument;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                data-testid={`instrument-card-${preset.id}`}
                onClick={() => onSelectInstrument(preset.id)}
                className={`instrument-card ${isSelected ? 'is-selected' : ''}`}
                style={
                  {
                    '--card-accent': preset.accentColor,
                  } as React.CSSProperties
                }
              >
                <div className="instrument-card-top">
                  <span className="instrument-category">{preset.category}</span>
                  <span className="instrument-indicator-dot" />
                </div>
                <div className="instrument-name">{preset.name}</div>
                <div className="instrument-tagline">{preset.tagline}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sound Shaper & Oscilloscope */}
      <div className="studio-card synth-controls-section">
        <div className="section-header-row">
          <div className="section-title-group">
            <Sliders size={16} style={{ color: currentPreset.accentColor }} />
            <h2>Sound Shaper &amp; Envelope</h2>
          </div>
          <button
            type="button"
            data-testid="reset-synth-params-btn"
            className="ghost-action-btn"
            onClick={onResetParams}
            title="Restore default settings for this instrument"
          >
            <RotateCcw size={13} />
            <span>Reset Patch</span>
          </button>
        </div>

        <div className="synth-knobs-grid">
          <label className="synth-param-control">
            <div className="param-label-row">
              <span>Patch Level</span>
              <span className="param-val">{Math.round(params.volume * 100)}%</span>
            </div>
            <input
              type="range"
              aria-label="Patch Level"
              data-testid="param-volume"
              min={0.05}
              max={1}
              step={0.01}
              value={params.volume}
              onChange={(e) =>
                onUpdateParams({ volume: parseFloat(e.target.value) })
              }
            />
          </label>

          <label className="synth-param-control">
            <div className="param-label-row">
              <span>Attack</span>
              <span className="param-val">{Math.round(params.attack * 1000)} ms</span>
            </div>
            <input
              type="range"
              aria-label="Attack Time"
              data-testid="param-attack"
              min={0.002}
              max={0.45}
              step={0.002}
              value={params.attack}
              onChange={(e) =>
                onUpdateParams({ attack: parseFloat(e.target.value) })
              }
            />
          </label>

          <label className="synth-param-control">
            <div className="param-label-row">
              <span>Release</span>
              <span className="param-val">{params.release.toFixed(2)} s</span>
            </div>
            <input
              type="range"
              aria-label="Release Time"
              data-testid="param-release"
              min={0.05}
              max={2.2}
              step={0.02}
              value={params.release}
              onChange={(e) =>
                onUpdateParams({ release: parseFloat(e.target.value) })
              }
            />
          </label>

          <label className="synth-param-control">
            <div className="param-label-row">
              <span>Filter Brightness</span>
              <span className="param-val">{Math.round(params.filterCutoff)} Hz</span>
            </div>
            <input
              type="range"
              aria-label="Filter Brightness"
              data-testid="param-cutoff"
              min={250}
              max={10000}
              step={50}
              value={params.filterCutoff}
              onChange={(e) =>
                onUpdateParams({ filterCutoff: parseFloat(e.target.value) })
              }
            />
          </label>

          <label className="synth-param-control">
            <div className="param-label-row">
              <span>Unison Detune</span>
              <span className="param-val">{params.detune} ct</span>
            </div>
            <input
              type="range"
              aria-label="Unison Detune"
              data-testid="param-detune"
              min={0}
              max={30}
              step={1}
              value={params.detune}
              onChange={(e) =>
                onUpdateParams({ detune: parseFloat(e.target.value) })
              }
            />
          </label>

          <label className="synth-param-control">
            <div className="param-label-row">
              <span>Studio Reverb</span>
              <span className="param-val">
                {Math.round(params.reverbMix * 100)}%
              </span>
            </div>
            <input
              type="range"
              aria-label="Studio Reverb"
              data-testid="param-reverb"
              min={0}
              max={0.8}
              step={0.02}
              value={params.reverbMix}
              onChange={(e) =>
                onUpdateParams({ reverbMix: parseFloat(e.target.value) })
              }
            />
          </label>
        </div>

        {/* Live Oscilloscope */}
        <div className="oscilloscope-box">
          <div className="oscilloscope-header">
            <Activity size={13} style={{ color: currentPreset.accentColor }} />
            <span>REAL-TIME WAVEFORM MONITOR</span>
          </div>
          <canvas
            ref={canvasRef}
            width={360}
            height={62}
            className="oscilloscope-canvas"
          />
        </div>
      </div>
    </div>
  );
};
