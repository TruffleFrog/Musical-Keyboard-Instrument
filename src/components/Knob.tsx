import React, { useCallback, useRef } from 'react';

interface KnobProps {
  label: string;
  /** 0..1 */
  value: number;
  /** Text shown under the dial, e.g. "420 ms". */
  display: string;
  defaultValue?: number;
  disabled?: boolean;
  testId?: string;
  onChange: (value: number) => void;
}

const SWEEP = 270; // degrees
const START = 135; // degrees, measured clockwise from 12 o'clock

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

/**
 * Rotary control: drag vertically, scroll, or use arrow keys. Behaves as a
 * `slider` for assistive technology. Double-click resets to the default.
 */
export const Knob: React.FC<KnobProps> = ({
  label,
  value,
  display,
  defaultValue,
  disabled = false,
  testId,
  onChange,
}) => {
  const drag = useRef<{ y: number; v: number } | null>(null);
  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.focus({ preventScroll: true });
      drag.current = { y: e.clientY, v: value };
    },
    [disabled, value]
  );

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const fine = e.shiftKey ? 0.25 : 1;
    const dy = drag.current.y - e.clientY;
    onChange(clamp(drag.current.v + (dy / 160) * fine));
  };

  const end = () => {
    drag.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const step = e.shiftKey ? 0.1 : 0.02;
    let next: number | null = null;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next = value + step;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = value - step;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 1;
    else if (e.key === 'PageUp') next = value + 0.1;
    else if (e.key === 'PageDown') next = value - 0.1;
    if (next !== null) {
      e.preventDefault();
      e.stopPropagation();
      onChange(clamp(next));
    }
  };

  const angle = START + SWEEP * value;
  const tip = polar(28, 28, 17, angle);
  const base = polar(28, 28, 9, angle);

  return (
    <div className={`knob ${disabled ? 'is-disabled' : ''}`}>
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={display}
        aria-disabled={disabled}
        data-testid={testId}
        className="knob-dial"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={onKeyDown}
        onWheel={(e) => {
          if (disabled) return;
          onChange(clamp(value - Math.sign(e.deltaY) * 0.03));
        }}
        onDoubleClick={() => {
          if (!disabled && defaultValue !== undefined) onChange(defaultValue);
        }}
      >
        <svg viewBox="0 0 56 56" aria-hidden="true">
          <path
            className="knob-track"
            d={arc(28, 28, 22, START, START + SWEEP)}
          />
          {value > 0.003 && (
            <path
              className="knob-fill"
              d={arc(28, 28, 22, START, START + SWEEP * value)}
            />
          )}
          <circle className="knob-cap" cx="28" cy="28" r="13" />
          <line
            className="knob-pointer"
            x1={base.x}
            y1={base.y}
            x2={tip.x}
            y2={tip.y}
          />
        </svg>
      </div>
      <span className="knob-label">{label}</span>
      <span className="knob-value">{disabled ? '—' : display}</span>
    </div>
  );
};
