import React, { useEffect, useRef, useState } from 'react';
import { studio } from './app/studio';
import { computeViewRange } from './data/keyboardMap';
import { HelpDialog } from './components/HelpDialog';
import { KeyboardDock } from './components/Keyboard';
import { PlayPanel } from './components/PlayPanel';
import { RecordPanel } from './components/RecordPanel';
import { RollCanvas } from './components/RollCanvas';
import { SongsPanel } from './components/SongsPanel';
import { TopBar } from './components/TopBar';
import { useStudio } from './components/ui';

/** Measures an element's width, falling back when ResizeObserver is absent. */
function useElementWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth(Math.round(w));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export const App: React.FC = () => {
  const tab = useStudio((s) => s.prefs.tab);
  const octave = useStudio((s) => s.prefs.octave);
  const helpOpen = useStudio((s) => s.helpOpen);
  const [stageRef, width] = useElementWidth<HTMLDivElement>(1280);

  useEffect(() => studio.attach(), []);

  const { low, high } = computeViewRange(octave, width);

  return (
    <div className="app" data-tab={tab}>
      <TopBar />

      <main
        id="panel-deck"
        className="deck-region"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
      >
        {tab === 'play' && <PlayPanel />}
        {tab === 'songs' && <SongsPanel />}
        {tab === 'record' && <RecordPanel />}
      </main>

      <div
        className="stage"
        ref={stageRef}
        data-hint={
          tab === 'songs'
            ? ''
            : 'Notes you play rise from the keys as you hold them'
        }
      >
        <RollCanvas low={low} high={high} />
      </div>

      <KeyboardDock low={low} high={high} />

      {helpOpen && <HelpDialog />}
    </div>
  );
};

export default App;
