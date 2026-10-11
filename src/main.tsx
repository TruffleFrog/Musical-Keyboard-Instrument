import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { studio } from './app/studio';
import { AudioEngine } from './audio/engine';
import './styles/studio.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Test hook: lets automated tests drive the real engine (including offline
// rendering). Exposed in dev builds only; never shipped in production.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__keyboardStudio = {
    studio,
    AudioEngine,
  };
}

// Offline support: cache the app shell and piano samples after first load.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // Hand the worker the list of everything this page already loaded
        // (including the piano samples, once they have finished) so it can
        // cache it for offline use.
        const send = () => {
          const urls = [
            window.location.href,
            ...performance
              .getEntriesByType('resource')
              .map((e) => e.name),
          ];
          reg.active?.postMessage({ type: 'precache', urls });
        };
        send();
        window.setTimeout(send, 4000); // samples usually land within seconds
      })
      .catch(() => {
        /* offline caching is optional */
      });
  });
}
