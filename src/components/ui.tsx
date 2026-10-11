import React from 'react';
import { studio, type StudioState } from '../app/studio';
import { useStore } from '../state/store';

/** Subscribe to a slice of studio state. */
export function useStudio<S>(selector: (s: StudioState) => S): S {
  return useStore(studio.store, selector);
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: Array<{ value: T; label: React.ReactNode; testId?: string }>;
  onChange: (v: T) => void;
  className?: string;
}

/** Radio-style segmented control. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className = '',
}: SegmentedProps<T>): React.ReactElement {
  return (
    <div className={`segmented ${className}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          data-testid={o.testId}
          className={value === o.value ? 'is-on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
  testId?: string;
  disabled?: boolean;
}

/** Labelled on/off switch. */
export const Switch: React.FC<SwitchProps> = ({
  label,
  checked,
  onChange,
  hint,
  testId,
  disabled,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    data-testid={testId}
    className={`switch ${checked ? 'is-on' : ''}`}
    onClick={() => onChange(!checked)}
    title={hint}
  >
    <span className="switch-track" aria-hidden="true">
      <span className="switch-thumb" />
    </span>
    <span className="switch-label">{label}</span>
  </button>
);

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
