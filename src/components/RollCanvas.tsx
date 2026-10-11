import React, { useEffect, useRef } from 'react';
import { studio } from '../app/studio';
import { layoutKeys } from '../data/keyboardMap';

interface RollCanvasProps {
  low: number;
  high: number;
}

/** Seconds of music visible between the top edge and the keyboard. */
const VISIBLE_SECONDS = 3.2;

function cssColor(el: Element, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Falling-note view that sits directly above the keyboard and shares its
 * horizontal scale: song notes descend onto the keys that will sound, and
 * notes you play rise away from the keys while held.
 */
export const RollCanvas: React.FC<RollCanvasProps> = ({ low, high }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geometry = useRef(layoutKeys(low, high));
  geometry.current = layoutKeys(low, high);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let id = 0;
    let displayBeat: number | null = null;
    let lastSig = '';
    let colors = {
      melody: '#3ec5b0',
      accomp: '#8b93ff',
      user: '#f0a63a',
      grid: 'rgba(255,255,255,0.05)',
      gridStrong: 'rgba(255,255,255,0.10)',
      target: '#f0a63a',
      line: 'rgba(255,255,255,0.18)',
    };

    const readColors = () => {
      colors = {
        melody: cssColor(canvas, '--song', colors.melody),
        accomp: cssColor(canvas, '--song-2', colors.accomp),
        user: cssColor(canvas, '--accent', colors.user),
        grid: cssColor(canvas, '--roll-grid', colors.grid),
        gridStrong: cssColor(canvas, '--roll-grid-strong', colors.gridStrong),
        target: cssColor(canvas, '--accent', colors.target),
        line: cssColor(canvas, '--roll-line', colors.line),
      };
    };
    readColors();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      lastSig = '';
    };
    resize();
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    const schemeQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onScheme = () => {
      readColors();
      lastSig = '';
    };
    schemeQuery?.addEventListener?.('change', onScheme);

    const draw = () => {
      id = requestAnimationFrame(draw);
      const frame = studio.getRollFrame();
      const keys = geometry.current.keys;
      const keyById = new Map(keys.map((k) => [k.midi, k]));

      // Ease the learn-mode position so steps glide instead of snapping.
      let beat = frame.beat;
      if (frame.mode === 'learn') {
        if (displayBeat === null) displayBeat = beat;
        displayBeat += (beat - displayBeat) * 0.22;
        if (Math.abs(beat - displayBeat) < 0.002) displayBeat = beat;
        beat = displayBeat;
      } else {
        displayBeat = null;
      }

      const recentLive = frame.live.some(
        (n) => n.t1 === null || frame.nowMs - n.t1 < VISIBLE_SECONDS * 1000
      );
      const animating =
        frame.mode === 'song' ||
        frame.mode === 'take' ||
        recentLive ||
        (frame.mode === 'learn' && Math.abs(frame.beat - beat) > 0.0015);
      const sig = `${width}x${height}|${keys.length}:${keys[0]?.midi}|${frame.mode}|${beat.toFixed(3)}|${
        frame.learnTargets.size
      }|${Array.from(frame.learnTargets).join(',')}|${frame.sequence ? 1 : 0}`;
      if (!animating && sig === lastSig) return;
      lastSig = sig;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Guide lines: faint at white-key edges, stronger at each C.
      for (const k of keys) {
        if (k.isBlack) continue;
        const x = Math.round(k.x * width) + 0.5;
        ctx.strokeStyle = k.midi % 12 === 0 ? colors.gridStrong : colors.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      const pxPerSec = height / VISIBLE_SECONDS;
      const pxPerBeat = pxPerSec / Math.max(0.05, frame.secPerBeat);
      const visibleBeats = height / pxPerBeat;

      // Song / take notes
      const seq = frame.sequence;
      if (seq) {
        const notes = seq.notes;
        // first index whose end could be visible
        let lo = 0;
        let hi = notes.length;
        const from = beat - seq.maxDuration;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (notes[mid].start < from) lo = mid + 1;
          else hi = mid;
        }
        for (let i = lo; i < notes.length; i++) {
          const n = notes[i];
          if (n.start > beat + visibleBeats) break;
          if (!frame.isPartVisible(n.partId)) continue;
          const key = keyById.get(n.midi);
          if (!key) continue;
          const end = n.start + n.duration;
          if (end < beat) continue;
          const yBottom = height - (n.start - beat) * pxPerBeat;
          const yTop = height - (end - beat) * pxPerBeat;
          const top = Math.max(-4, yTop);
          const bottom = Math.min(height, yBottom);
          if (bottom - top < 1) continue;

          const x = key.x * width + (key.isBlack ? 0 : 1);
          const w = Math.max(2, key.w * width - (key.isBlack ? 0 : 2));
          const isMel = frame.isMelody(n.partId) || frame.mode === 'take';
          const sounding = n.start <= beat && beat < end;
          const isTarget =
            frame.mode === 'learn' &&
            frame.learnTargets.has(n.midi) &&
            Math.abs(n.start - beat) < 1e-3;

          ctx.globalAlpha = sounding || frame.mode === 'learn' ? 1 : 0.82;
          ctx.fillStyle = isMel ? colors.melody : colors.accomp;
          roundRect(ctx, x, top, w, Math.max(4, bottom - top), 3);
          ctx.fill();
          if (sounding && frame.mode !== 'learn') {
            ctx.fillStyle = 'rgba(255,255,255,0.28)';
            roundRect(ctx, x, top, w, Math.max(4, bottom - top), 3);
            ctx.fill();
          }
          if (isTarget) {
            ctx.globalAlpha = 1;
            ctx.strokeStyle = colors.target;
            ctx.lineWidth = 2;
            roundRect(ctx, x - 1, top - 1, w + 2, Math.max(6, bottom - top + 2), 4);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }

      // Live notes rising from the keys
      for (const n of frame.live) {
        const key = keyById.get(n.midi);
        if (!key) continue;
        const startAgo = (frame.nowMs - n.t0) / 1000;
        const endAgo = n.t1 === null ? 0 : (frame.nowMs - n.t1) / 1000;
        if (endAgo > VISIBLE_SECONDS) continue;
        const yBottom = height - endAgo * pxPerSec;
        const yTop = height - startAgo * pxPerSec;
        const top = Math.max(0, yTop);
        if (yBottom - top < 1) continue;
        const x = key.x * width + (key.isBlack ? 0 : 1);
        const w = Math.max(2, key.w * width - (key.isBlack ? 0 : 2));
        ctx.globalAlpha = Math.max(0.15, 1 - endAgo / VISIBLE_SECONDS);
        ctx.fillStyle = colors.user;
        roundRect(ctx, x, top, w, Math.max(3, yBottom - top), 3);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Hit line
      ctx.fillStyle = colors.line;
      ctx.fillRect(0, height - 1, width, 1);
    };
    id = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(id);
      ro?.disconnect();
      schemeQuery?.removeEventListener?.('change', onScheme);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="roll-canvas"
      data-testid="note-roll"
      aria-hidden="true"
    />
  );
};
